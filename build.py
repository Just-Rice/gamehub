#!/usr/bin/env python3
"""Bundle GameHub into single self-contained files.

Outputs:
  dist/gamehub.html   full standalone page — double-click or email it
  dist/artifact.html  body-only fragment for publishing as a Claude Artifact
                      (the host supplies <!doctype>/<html>/<head>/<body>)

Run:  python3 build.py
"""

import pathlib
import re

ROOT = pathlib.Path(__file__).parent
DIST = ROOT / "dist"

TITLE = "GameHub — 15 arcade classics"
DESC = ("A hand-built arcade: Flappy Bird, Tetris, Snake, Minesweeper, Wordle "
        "and more. No engines, no assets, no dependencies.")


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def main():
    html = read("index.html")

    # Body markup, minus the tag soup we are about to inline ourselves.
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    body = re.sub(r"<script[^>]*></script>\s*", "", body)
    body = re.sub(r"<!--.*?-->\s*", "", body, flags=re.S)
    body = body.strip()

    css = read("css/style.css")

    # Script order comes straight from index.html, so the two never drift.
    srcs = re.findall(r'<script src="([^"]+)"></script>', html)
    js = "\n\n".join(
        "/* ===== %s ===== */\n%s" % (s, read(s)) for s in srcs
    )

    DIST.mkdir(exist_ok=True)

    fragment = (
        "<title>%s</title>\n"
        "<style>\n%s\n</style>\n\n"
        "%s\n\n"
        "<script>\n%s\n</script>\n" % (TITLE, css, body, js)
    )
    (DIST / "artifact.html").write_text(fragment, encoding="utf-8")

    standalone = (
        '<!doctype html>\n<html lang="en">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, '
        'viewport-fit=cover">\n'
        '<title>%s</title>\n'
        '<meta name="description" content="%s">\n'
        '<meta name="theme-color" content="#0b0d17">\n'
        '<link rel="icon" href="data:image/svg+xml,'
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        "<text y='.9em' font-size='90'>&#127993;&#65039;</text></svg>\">\n"
        "<style>\n%s\n</style>\n</head>\n<body>\n%s\n"
        "<script>\n%s\n</script>\n</body>\n</html>\n"
        % (TITLE, DESC, css, body, js)
    )
    (DIST / "gamehub.html").write_text(standalone, encoding="utf-8")

    for name in ("gamehub.html", "artifact.html"):
        kb = (DIST / name).stat().st_size / 1024
        print("dist/%-16s %6.1f KB" % (name, kb))
    print("bundled %d scripts" % len(srcs))


if __name__ == "__main__":
    main()
