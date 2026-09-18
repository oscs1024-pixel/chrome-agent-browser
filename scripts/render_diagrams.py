#!/usr/bin/env python3
"""把 docs/diagrams/*.html 渲染为 README 用的 PNG（2x 高清）。

用法：
    /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 scripts/render_diagrams.py
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIR = ROOT / "docs" / "diagrams"


def main() -> int:
    files = sorted(p for p in DIR.glob("*.html"))
    if not files:
        print(f"no html found in {DIR}", file=sys.stderr)
        return 1

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(device_scale_factor=2)
        for f in files:
            page.goto(f.as_uri())
            page.wait_for_timeout(1200)  # 等 webfont 到位
            el = page.query_selector(".page")
            box = el.bounding_box()
            out = f.with_suffix(".png")
            el.screenshot(path=str(out))
            print(f"OK {out.name} {round(box['width'])}x{round(box['height'])} @2x")
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
