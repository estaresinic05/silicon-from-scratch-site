"""Rewrite fluid `Nvw` terms as `calc(N * var(--vwu))`, which is frozen per mode.

The site is two modes with one line at 900px, and a `vw` term is by definition a
ramp across that line. This converts them mechanically so the change is reviewable
as a diff rather than done by hand across sixty declarations.

WHAT IS LEFT ALONE, and why each one is not the gradient:

  * anything inside `min(...)`/`max(...)`/`clamp(...)` that is measuring the
    WINDOW rather than sizing a THING -- container widths and gutter maths. The
    reading column is supposed to track the window.
  * `vh`, `vmin`, `vmax`, `cqw` -- different axis, or container-relative.
  * `100vw` -- almost always "the whole window", not a scale factor.

Run with --check to see what it would do without writing.
"""
import argparse
import re
import sys

FILES = ["styles/main.css", "styles/alu.css", "styles/alu-widget.css",
         "styles/project-directory.css"]

# A vw term that is a SCALE (a number then vw). 100vw and 93vw-style container
# maths are excluded by the guards below, not by this pattern.
TERM = re.compile(r'(?<![\w.-])(\d+(?:\.\d+)?)vw(?![\w-])')

# Lines carrying these are measuring the window, not sizing a thing.
SKIP_LINE = re.compile(r'100vw|--pc-w-|--pc-h|cqw|vmin|vmax')


def is_guard(line):
    """`min(360px, 86vw)` is "never wider than 86% of the window" -- a guard on a
    container, and the one idiom that MUST stay fluid: frozen at the phone
    reference it becomes a fixed 335px, which overflows a 320px screen.
    `clamp(a, Nvw, b)` is a scale and is exactly what we are freezing. A line
    with min() and no clamp() is a guard."""
    return "min(" in line and "clamp(" not in line


def code_spans(line, in_comment):
    """The (start, end) ranges of this line that are CODE, tracking /* */ across
    lines. Without this the converter rewrites the prose inside comments -- it
    turned the sentence explaining the change into a mangled version of itself,
    which is funny once and then confusing forever."""
    spans, i, start = [], 0, None if in_comment else 0
    while i < len(line):
        if not in_comment and line.startswith("/*", i):
            if start is not None:
                spans.append((start, i))
            in_comment, start, i = True, None, i + 2
        elif in_comment and line.startswith("*/", i):
            in_comment, start, i = False, i + 2, i + 2
        else:
            i += 1
    if start is not None:
        spans.append((start, len(line)))
    return spans, in_comment


def convert(text):
    out, changed, in_comment = [], [], False
    for i, line in enumerate(text.split("\n"), 1):
        spans, in_comment = code_spans(line, in_comment)
        if "vw" not in line or SKIP_LINE.search(line) or is_guard(line) or not spans:
            out.append(line)
            continue
        new, last = [], 0
        for a, b in spans:
            new.append(line[last:a])
            new.append(TERM.sub(lambda m: f"calc({m.group(1)} * var(--vwu))",
                                line[a:b]))
            last = b
        new.append(line[last:])
        new = "".join(new)
        if new != line:
            changed.append((i, line.strip(), new.strip()))
        out.append(new)
    return "\n".join(out), changed


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    total = 0
    for f in FILES:
        src = open(f, encoding="utf-8").read()
        new, changed = convert(src)
        if changed:
            print(f"\n=== {f}  ({len(changed)})")
            for ln, before, after in changed:
                print(f"  {ln}: {before}")
                print(f"      -> {after}")
        total += len(changed)
        if not a.check and changed:
            open(f, "w", encoding="utf-8").write(new)
    print(f"\n{total} terms {'would be ' if a.check else ''}converted")
