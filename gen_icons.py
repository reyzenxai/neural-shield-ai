"""Generate Neural Shield AI extension icons at 16x16, 48x48, 128x128."""
from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = r"D:\Startups\neural-shield-ai\extension\dist\icons"
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def make_icon(size: int) -> Image.Image:
    S = size
    scale = S / 100.0

    # Work at 4x for anti-aliasing, then downscale
    WORK = S * 4
    sc = WORK / 100.0

    img = Image.new("RGBA", (WORK, WORK), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── background rounded square ──────────────────────────────────────────
    r = int(20 * sc)
    draw.rounded_rectangle([0, 0, WORK - 1, WORK - 1], radius=r,
                            fill=(13, 7, 33, 255))

    # Subtle top-left gradient overlay (simulate bg gradient)
    for i in range(int(40 * sc)):
        alpha = int(40 * (1 - i / (40 * sc)))
        d = int((80 - i * 2) * sc)
        if d > 0:
            draw.ellipse([0, 0, d, d], fill=(45, 27, 105, alpha))

    # ── outer triangle (right-pointing play button) ────────────────────────
    # Vertices: left-top, left-bottom, right-tip
    lt = (int(10 * sc), int(12 * sc))
    lb = (int(10 * sc), int(88 * sc))
    rt = (int(88 * sc), int(50 * sc))

    # Outer glow (blurred wide triangle)
    glow_img = Image.new("RGBA", (WORK, WORK), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_img)
    gd.polygon([lt, lb, rt], fill=(168, 85, 247, 120))
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(int(6 * sc)))
    img = Image.alpha_composite(img, glow_img)
    draw = ImageDraw.Draw(img)

    # Outer triangle — simulate gradient: draw slices from left (purple) to right (pink)
    steps = max(30, int(60 * sc))
    for i in range(steps):
        t = i / steps
        # Interpolate from violet (#7C3AED) → purple (#A855F7) → pink (#C084FC)
        if t < 0.5:
            c = lerp((124, 58, 237), (168, 85, 247), t * 2)
        else:
            c = lerp((168, 85, 247), (192, 132, 252), (t - 0.5) * 2)
        color = (*c, 255)

        # Narrow slice of the triangle at this horizontal position
        x = lt[0] + t * (rt[0] - lt[0])
        # Y bounds at this x
        frac = t  # 0 at left edge, 1 at right tip
        y_top = lt[1] + frac * (rt[1] - lt[1])
        y_bot = lb[1] + frac * (rt[1] - lb[1])
        x_next = lt[0] + (t + 1 / steps) * (rt[0] - lt[0])

        draw.polygon(
            [(int(x), int(y_top)), (int(x), int(y_bot)),
             (int(x_next), int(y_bot + (1 / steps) * (rt[1] - lb[1]))),
             (int(x_next), int(y_top + (1 / steps) * (rt[1] - lt[1])))],
            fill=color,
        )

    # ── dark inner cutout ─────────────────────────────────────────────────
    m1 = int(7 * sc)
    ilt = (lt[0] + m1, lt[1] + int(10 * sc))
    ilb = (lb[0] + m1, lb[1] - int(10 * sc))
    irt = (int(76 * sc), int(50 * sc))
    draw.polygon([ilt, ilb, irt], fill=(13, 7, 33, 255))

    # ── inner accent triangle ─────────────────────────────────────────────
    m2 = int(5 * sc)
    a_lt = (ilt[0] + m2, ilt[1] + int(6 * sc))
    a_lb = (ilb[0] + m2, ilb[1] - int(6 * sc))
    a_rt = (int(66 * sc), int(50 * sc))

    # Pink gradient for inner triangle
    for i in range(steps):
        t = i / steps
        c = lerp((217, 70, 239), (232, 121, 249), t)
        color = (*c, 255)
        x = a_lt[0] + t * (a_rt[0] - a_lt[0])
        frac = t
        y_top = a_lt[1] + frac * (a_rt[1] - a_lt[1])
        y_bot = a_lb[1] + frac * (a_rt[1] - a_lb[1])
        x_next = a_lt[0] + (t + 1 / steps) * (a_rt[0] - a_lt[0])
        draw.polygon(
            [(int(x), int(y_top)), (int(x), int(y_bot)),
             (int(x_next), int(y_bot + (1 / steps) * (a_rt[1] - a_lb[1]))),
             (int(x_next), int(y_top + (1 / steps) * (a_rt[1] - a_lt[1])))],
            fill=color,
        )

    # ── center eye ───────────────────────────────────────────────────────
    cx, cy = int(50 * sc), int(50 * sc)
    er = int(9 * sc)
    draw.ellipse([cx - er, cy - er, cx + er, cy + er], fill=(13, 7, 33, 255))
    er2 = int(5.5 * sc)
    draw.ellipse([cx - er2, cy - er2, cx + er2, cy + er2], fill=(217, 70, 239, 255))
    er3 = int(2.5 * sc)
    draw.ellipse([cx - er3, cy - er3, cx + er3, cy + er3], fill=(240, 171, 252, 255))

    # Downscale with LANCZOS for anti-aliasing
    img = img.resize((S, S), Image.LANCZOS)
    return img

for size in [16, 48, 128]:
    icon = make_icon(size)
    path = os.path.join(OUT, f"icon{size}.png")
    icon.save(path, "PNG")
    print(f"Saved {path}")

print("Done.")
