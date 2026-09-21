#!/usr/bin/env python3
"""Build the OrchestKit link card (1200x630): conductor art, frosted panel with
wordmark, the tagline (brand.tagline, derived from the host list), the skills /
agents / hooks counts (brand.totals, read from the repo) and a "Works with" row
of the eight host marks.

Renders at 2x and downsamples. Marks are sized by ink weight so blocky marks
(OpenCode, Pi) and thin ones (Claude, Codex) read as one row. Nothing is drawn
in the bottom 95 px, where X lays its title bar.

Usage: card.py [--art PATH] [--out PATH]
       card.py --site    background + layout for docs/site/app/opengraph-image.tsx
"""

import argparse
import json
import os
import shutil

import brand as b
from PIL import Image, ImageChops, ImageDraw, ImageFilter

S = 2  # supersample factor
W, H = b.W * S, b.H * S
LEFT = 80 * S
SAFE = b.SAFE_BOTTOM * S
HAIR = (255, 255, 255, 34)


def fnt(name: str, px: int):
    return b.font(name, px * S)


def mark(name: str, box: int) -> Image.Image:
    """Mark cropped to its ink, fitted to box, then scaled by ink density."""
    im = Image.open(os.path.join(b.HERE, "icons", f"{name}.png")).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    r = box / max(im.width, im.height)
    im = im.resize(
        (max(1, round(im.width * r)), max(1, round(im.height * r))), Image.Resampling.LANCZOS
    )
    hist = im.getchannel("A").histogram()
    ink = sum(i * n for i, n in enumerate(hist)) / (255 * box * box)
    k = max(0.72, min(1.12, (0.30 / max(ink, 0.05)) ** 0.45))
    return im.resize(
        (max(1, round(im.width * k)), max(1, round(im.height * k))), Image.Resampling.LANCZOS
    )


def put(canvas: Image.Image, im: Image.Image, cx: float, cy: float) -> None:
    canvas.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))


def overlay(img: Image.Image, draw_fn) -> None:
    """Draw translucent shapes on their own layer so alpha blends instead of replacing."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    img.alpha_composite(layer)


def ramp(lo: float, hi: float, v: int, peak: int) -> int:
    """Map v in 0..255 to 0..peak between the fractions lo and hi."""
    t = (v / 255 - lo) / (hi - lo)
    return max(0, min(peak, round(t * peak)))


def backdrop(art: Image.Image) -> Image.Image:
    """Cover-crop at 2x, darken the left half and the bottom strip."""
    img = b.cover(art, W, H).convert("RGBA")
    ramp_x = Image.new("L", (256, 1))
    ramp_x.putdata(list(range(255, -1, -1)))  # 255 at the left edge
    horiz = ramp_x.resize((W, H)).point([ramp(0.22, 0.50, v, 235) for v in range(256)])
    vert = Image.linear_gradient("L").resize((W, H))  # 255 at the bottom
    vert = vert.point([ramp(0.72, 1.0, v, 200) for v in range(256)])
    return Image.composite(
        Image.new("RGBA", (W, H), b.BG + (255,)), img, ImageChops.lighter(horiz, vert)
    )


def draw_stats(img: Image.Image, d: ImageDraw.ImageDraw, box: dict[str, int], counts: dict[str, int]) -> None:
    """Number and word share a baseline so the word survives feed size.
    docs/site/app/opengraph-image.tsx draws the same row live from TOTALS."""
    x, y, inner_w, stat_h = box["x"], box["y"], box["width"], box["height"]
    fnum, fword = fnt("Geist-Bold.ttf", 44), fnt("Geist-Medium.ttf", 24)
    stats = [(counts[k], b.STAT_WORDS[k]) for k in ("skills", "agents", "hooks")]
    widths = [d.textlength(str(n), font=fnum) + 8 * S + d.textlength(w, font=fword) for n, w in stats]
    gap = (inner_w - sum(widths)) / 2
    base_y, sx = y + 40 * S, x
    for i, ((n, word), w) in enumerate(zip(stats, widths)):
        d.text((sx, base_y), str(n), font=fnum, fill=b.FG, anchor="ls")
        d.text((sx + d.textlength(str(n), font=fnum) + 8 * S, base_y), word, font=fword, fill=b.MUTED, anchor="ls")
        if i < len(stats) - 1:
            lx = sx + w + gap / 2
            overlay(img, lambda o, lx=lx: o.line([(lx, y + 6 * S), (lx, y + stat_h - 4 * S)], fill=HAIR, width=S))
        sx += w + gap


def panel(img: Image.Image, counts: dict[str, int] | None) -> dict[str, int]:
    """Draw the panel. counts=None leaves the stat row empty for the site to fill.
    Returns the stat row box in 2x pixels."""
    pad, box = 40 * S, 34 * S
    inner_w = 580 * S
    stat_h = 50 * S
    panel_h = pad + (4 + 24 + 88 + 18 + 28 + 30) * S + stat_h + (28 + 1 + 24) * S + box + pad
    x0, y0 = LEFT - pad, (SAFE - panel_h) // 2
    region = (x0, y0, x0 + inner_w + 2 * pad, y0 + panel_h)

    # frosted glass: blur what is behind, shade it, clip to a rounded rect
    glass = img.crop(region).filter(ImageFilter.GaussianBlur(18 * S))
    glass = Image.alpha_composite(glass, Image.new("RGBA", glass.size, b.BG + (160,)))
    clip = Image.new("L", glass.size, 0)
    ImageDraw.Draw(clip).rounded_rectangle([0, 0, glass.width - 1, glass.height - 1], radius=22 * S, fill=255)
    img.paste(glass, region[:2], clip)
    overlay(img, lambda o: o.rounded_rectangle(region, radius=22 * S, outline=HAIR, width=S))
    d = ImageDraw.Draw(img)

    x, y = LEFT, y0 + pad
    for i in range(64 * S):  # accent rule: the site's indigo to violet trace
        t = i / (64 * S - 1)
        col = tuple(round(b.INDIGO[k] + (b.VIOLET[k] - b.INDIGO[k]) * t) for k in range(3))
        d.line([(x + i, y), (x + i, y + 4 * S)], fill=col)
    y += (4 + 24) * S
    d.text((x - 4 * S, y), "OrchestKit", font=fnt("Geist-Bold.ttf", 88), fill=b.FG, anchor="lt")
    y += (88 + 18) * S
    d.text((x, y), b.tagline(), font=fnt("Geist-Medium.ttf", 28), fill=b.MUTED, anchor="lt")
    y += (28 + 30) * S

    stat_box = {"x": x, "y": y, "width": inner_w, "height": stat_h}
    if counts is not None:
        draw_stats(img, d, stat_box, counts)
    y += stat_h + 28 * S

    overlay(img, lambda o: o.line([(x, y), (x + inner_w, y)], fill=HAIR, width=S))
    # "Works with" frames the row as compatibility, not partnership. No name
    # labels: at 500 px feed width they shrink to about 6 px.
    y += (1 + 24) * S + box // 2
    fcap = fnt("Geist-Medium.ttf", 18)
    d.text((x, y), "Works with", font=fcap, fill=b.DIM, anchor="lm")
    start = x + d.textlength("Works with", font=fcap) + 26 * S + box / 2
    step = (x + inner_w - box / 2 - start) / (len(b.HOSTS) - 1)
    for i, (host, _) in enumerate(b.HOSTS):
        put(img, mark(host, box), start + i * step, y)
    return stat_box


def render(art: Image.Image, counts: dict[str, int] | None) -> Image.Image:
    img = backdrop(art)
    panel(img, counts)
    return img.convert("RGB").resize((b.W, b.H), Image.Resampling.LANCZOS)


SITE_ASSETS = os.path.join(b.ROOT, "docs", "site", "assets", "og")


def hexcolor(rgb: tuple[int, int, int]) -> str:
    return "#%02x%02x%02x" % rgb


def write_site_assets(art: Image.Image) -> None:
    """Card background without the stat row, plus where and how to draw that row.
    docs/site/app/opengraph-image.tsx reads both at build time."""
    os.makedirs(SITE_ASSETS, exist_ok=True)
    for name in ("Geist-Bold.ttf", "Geist-Medium.ttf"):  # Satori needs ttf, not woff2
        shutil.copyfile(os.path.join(b.HERE, "fonts", name), os.path.join(SITE_ASSETS, name))
    img = backdrop(art)
    box = panel(img, None)
    img.convert("RGB").resize((b.W, b.H), Image.Resampling.LANCZOS).save(
        os.path.join(SITE_ASSETS, "card-bg.png"), optimize=True
    )
    layout = {
        "statRow": {k: v / S for k, v in box.items()},
        "numberSize": 44,
        "wordSize": 24,
        "wordGap": 8,
        "baseline": 40,
        "words": [b.STAT_WORDS[k] for k in ("skills", "agents", "hooks")],
        "colors": {
            "number": hexcolor(b.FG),
            "word": hexcolor(b.MUTED),
            "divider": "rgba(255, 255, 255, 0.13)",
        },
    }
    with open(os.path.join(SITE_ASSETS, "card-layout.json"), "w") as f:
        json.dump(layout, f, indent=2)
        f.write("\n")
    print(os.path.relpath(SITE_ASSETS, b.ROOT), layout["statRow"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--art", default=None, help="art plate; default is the newest art/A-<n>.png")
    ap.add_argument("--out", default=os.path.join(b.HERE, "out", "og-card.png"))
    ap.add_argument("--site", action="store_true", help="write docs/site/assets/og/ for opengraph-image.tsx")
    a = ap.parse_args()
    art = Image.open(a.art or b.newest_plate("A"))
    if a.site:
        write_site_assets(art)
        return
    counts = b.totals()
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    render(art, counts).save(a.out, optimize=True)
    print(a.out, " ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
