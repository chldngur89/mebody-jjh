#!/usr/bin/env python3
"""
mebody 앱 아이콘 생성기 — SVG 와 PNG 를 같은 좌표 배열 하나에서 뽑는다.
두 파일이 어긋날 수 없게 하려는 것이 목적이다.

마크: 길이가 다른 라운드 바 4개 = 목 · 어깨 · 골반 · 하체 (mebody Code 의 4축).
위에서 아래로 좁고-넓고-중간-좁은 실루엣이라 몸으로도 읽히고 코드로도 읽힌다.
글자를 쓰지 않으므로 어떤 크기에서도 폰트에 의존하지 않는다.

    python3 scripts/make-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

GREEN = "#014725"  # 브랜드 딥그린
CREAM = "#FFFFF3"  # 브랜드 크림

S = 512  # 기준 캔버스
CORNER = 100  # 라운드 사각 배경의 모서리 (마스커블에는 쓰지 않는다)

# 바 4개: (폭, 라벨). 높이·간격은 아래에서 계산한다.
BARS = [(88, "목"), (304, "어깨"), (200, "골반"), (132, "하체")]
BAR_H = 62
BAR_GAP = 20


def bar_rects():
    """(x0, y0, x1, y1) 네 개. 캔버스 정중앙 기준."""
    total = len(BARS) * BAR_H + (len(BARS) - 1) * BAR_GAP
    top = (S - total) / 2
    out = []
    for i, (w, _) in enumerate(BARS):
        y0 = top + i * (BAR_H + BAR_GAP)
        out.append((S / 2 - w / 2, y0, S / 2 + w / 2, y0 + BAR_H))
    return out


def assert_maskable_safe():
    """마스커블 아이콘은 지름 80% 원 안에 콘텐츠가 들어가야 한다."""
    r = S * 0.8 / 2
    worst = 0.0
    for x0, y0, x1, y1 in bar_rects():
        for x in (x0, x1):
            for y in (y0, y1):
                worst = max(worst, ((x - S / 2) ** 2 + (y - S / 2) ** 2) ** 0.5)
    assert worst <= r, f"안전영역 초과: {worst:.1f} > {r:.1f}"
    return worst, r


def render_png(size: int, rounded: bool) -> Image.Image:
    """4배로 그린 뒤 줄여서 계단을 없앤다."""
    ss = 4
    big = size * ss
    k = big / S
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=CORNER * k, fill=GREEN)
    else:
        d.rectangle([0, 0, big, big], fill=GREEN)
    for x0, y0, x1, y1 in bar_rects():
        d.rounded_rectangle([x0 * k, y0 * k, x1 * k, y1 * k], radius=BAR_H * k / 2, fill=CREAM)
    return img.resize((size, size), Image.LANCZOS)


def render_svg() -> str:
    bars = "\n".join(
        f'  <rect x="{x0:g}" y="{y0:g}" width="{x1 - x0:g}" height="{y1 - y0:g}" '
        f'rx="{BAR_H / 2:g}" fill="{CREAM}"/>'
        for x0, y0, x1, y1 in bar_rects()
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" '
        f'viewBox="0 0 {S} {S}" role="img" aria-label="mebody">\n'
        f'  <rect width="{S}" height="{S}" rx="{CORNER}" fill="{GREEN}"/>\n'
        f"{bars}\n"
        f"</svg>\n"
    )


def mark_rects():
    """배경 없는 마크 단독 좌표 — 바를 감싸는 최소 박스로 원점 이동."""
    rs = bar_rects()
    x0 = min(r[0] for r in rs)
    y0 = min(r[1] for r in rs)
    w = max(r[2] for r in rs) - x0
    h = max(r[3] for r in rs) - y0
    return [(a - x0, b - y0, c - x0, d - y0) for a, b, c, d in rs], w, h


def render_mark_svg(color="currentColor"):
    """헤더 로고용. 아이콘과 같은 형태이므로 두 곳이 어긋날 수 없다."""
    rs, w, h = mark_rects()
    bars = "\n".join(
        f'  <rect x="{x0:g}" y="{y0:g}" width="{x1 - x0:g}" height="{y1 - y0:g}" '
        f'rx="{BAR_H / 2:g}"/>'
        for x0, y0, x1, y1 in rs
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" '
        f'fill="{color}" role="img" aria-label="mebody">\n{bars}\n</svg>\n'
    )


def render_favicon(size: int) -> Image.Image:
    """파비콘은 작아서 모서리를 덜 깎고 여백을 줄인다."""
    ss = 8
    big = size * ss
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.18, fill=GREEN)
    rs, w, h = mark_rects()
    # 파비콘은 16px 까지 내려가므로 마크를 아이콘보다 크게 앉힌다
    scale = big * 0.74 / w
    ox = (big - w * scale) / 2
    oy = (big - h * scale) / 2
    for x0, y0, x1, y1 in rs:
        d.rounded_rectangle(
            [ox + x0 * scale, oy + y0 * scale, ox + x1 * scale, oy + y1 * scale],
            radius=BAR_H * scale / 2, fill=CREAM,
        )
    return img.resize((size, size), Image.LANCZOS)


def main():
    worst, limit = assert_maskable_safe()
    out = Path(__file__).resolve().parent.parent / "public"
    targets = [
        ("icon-192.png", 192, True),
        ("icon-512.png", 512, True),
        # 마스커블·애플 터치 아이콘은 OS 가 직접 모서리를 깎으므로 꽉 찬 사각형으로 준다.
        ("icon-maskable-512.png", 512, False),
        ("apple-touch-icon-180.png", 180, False),
    ]
    for name, size, rounded in targets:
        p = out / name
        render_png(size, rounded).save(p, "PNG", optimize=True)
        print(f"  {name:<28} {size}×{size}  {p.stat().st_size:,}B")
    (out / "icon.svg").write_text(render_svg(), encoding="utf-8")
    print(f"  {'icon.svg':<28} {S}×{S}  {(out / 'icon.svg').stat().st_size:,}B")

    # 헤더 로고용 마크 단독 SVG
    (out / "brand-mark.svg").write_text(render_mark_svg(), encoding="utf-8")
    print(f"  {'brand-mark.svg':<28} 마크 단독 (currentColor)")

    # 파비콘 — 앱과 홈페이지 양쪽에 같은 파일을 둔다
    server = Path("/Users/wh.choi/Desktop/mebody/mebody-server/src/main/resources/static")
    for target in (out, server):
        render_favicon(32).save(target / "favicon-32.png", "PNG", optimize=True)
        render_favicon(180).save(target / "apple-touch-icon-180.png", "PNG", optimize=True)
        (target / "brand-mark.svg").write_text(render_mark_svg(), encoding="utf-8")
        (target / "favicon.svg").write_text(render_svg(), encoding="utf-8")
        print(f"  favicon-32 · favicon.svg · brand-mark.svg → {target.name}/")
    print(f"\n마스커블 안전영역: 콘텐츠 최원점 {worst:.1f} ≤ 한계 {limit:.1f} ✓")


if __name__ == "__main__":
    main()
