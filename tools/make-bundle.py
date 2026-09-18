#!/usr/bin/env python3
"""Flatten cwi-voice-command into a single self-contained HTML file for
headless-browser latency measurement.

The deployed page loads ES modules over HTTP; this VM's Chromium blocks
localhost HTTP via Local Network Access checks, so for measurement only we
inline the exact same module sources (mechanical transform, no logic edits)
into one file and load it via file://. The DOM, CSS, and pipeline code are
byte-identical to index.html.

Usage: python3 tools/make-bundle.py  ->  writes /tmp/cwi-voice-command.bundle.html
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# dependency order (leaves first)
ORDER = [
    "src/adapters/decision-adapter.js",
    "src/adapters/local-classifier.js",
    "src/adapters/jev-backend.js",
    "src/adapters/llm-escalation.js",
    "src/adapters/stt-adapter.js",
    "src/adapters/tts-adapter.js",
    "src/config.js",
    "src/mixer.js",
    "src/handover.js",
]


def strip_module(src):
    # remove import statements (incl. multi-line `import { ... } from '...';`)
    src = re.sub(r"^import\s.*?from\s+['\"][^'\"]+['\"]\s*;", "", src,
                 flags=re.M | re.S)
    src = re.sub(r"^import\s+['\"][^'\"]+['\"]\s*;", "", src, flags=re.M)
    # export class/function/const -> plain declarations
    src = re.sub(r"^export\s+(?=class\b|function\b|const\b|let\b)", "", src,
                 flags=re.M)
    # drop re-export lists: export { A, B };
    src = re.sub(r"^export\s*\{[^}]*\}\s*;", "", src, flags=re.M)
    return src


def main():
    parts = []
    for rel in ORDER:
        with open(os.path.join(ROOT, rel)) as f:
            parts.append("// ==== %s ====\n" % rel + strip_module(f.read()))
    bundled = "\n".join(parts)

    # sanity: no imports/exports may survive
    seen = {}
    for i, line in enumerate(bundled.splitlines(), 1):
        s = line.strip()
        if s.startswith("import ") or re.match(r"^export\s", s):
            sys.exit("transform leak at line %d: %s" % (i, s[:80]))
    for m in re.finditer(r"^(?:class|function|const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)", bundled, re.M):
        name = m.group(1)
        seen.setdefault(name, []).append(m.start())
    dupes = {k: v for k, v in seen.items() if len(v) > 1}
    if dupes:
        sys.exit("top-level name collision(s): %s" % ", ".join(sorted(dupes)))

    with open(os.path.join(ROOT, "index.html")) as f:
        html = f.read()
    # remove the page's own import lines (now satisfied by the bundle)
    html = re.sub(r"<script type=\"module\">\nimport \{ createConfig \} from '\./src/config\.js';\nimport \{ createMixer \} from '\./src/mixer\.js';\nimport \{ createHandover \} from '\./src/handover\.js';",
                  lambda _m: "<script type=\"module\">\n/* bundled sources inlined for measurement; imports stripped */\n" + bundled,
                  html, count=1)
    if "createConfig" not in html or bundled not in html:
        sys.exit("page transform failed")
    # The page declares its own TRACKS const identical to the classifier's;
    # drop the duplicate so the single module scope has one declaration.
    page_tracks = "const TRACKS = ['vocals','drums','guitar','bass','keys','synth','horns','percussion','master'];"
    if page_tracks not in html:
        sys.exit("page TRACKS literal changed — update the dedupe")
    html = html.replace(page_tracks, "/* TRACKS: uses local-classifier's (identical) */", 1)
    out = "/tmp/cwi-voice-command.bundle.html"
    with open(out, "w") as f:
        f.write(html)
    print("wrote", out, "(%d bytes)" % os.path.getsize(out))


if __name__ == "__main__":
    main()
