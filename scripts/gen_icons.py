"""Generate Intro app icons: playful radar/wave mark on teal."""
from PIL import Image, ImageDraw

TEAL = (20, 184, 166)
TEAL_DEEP = (13, 148, 136)
TEAL_LIGHT = (45, 212, 191)
ORANGE = (251, 146, 60)
WHITE = (255, 255, 255)
MINT_BG = (244, 250, 247)

DOT = (12, 36)  # in 48-unit grid
ARCS = [25, 17.5, 10]


def draw_mark(d, ox, oy, s, arc_colors, dot_color, stroke=4.5, dot_r=5.5):
    """arc_colors: [outer, mid, inner]"""
    cx, cy = DOT
    w = max(2, int(round(stroke * s)))
    for r, col in zip(ARCS, arc_colors):
        bbox = [ox + (cx - r) * s, oy + (cy - r) * s, ox + (cx + r) * s, oy + (cy + r) * s]
        d.arc(bbox, start=270, end=360, fill=col, width=w)
        # round caps
        for px, py in [(cx, cy - r), (cx + r, cy)]:
            rr = w / 2
            X, Y = ox + px * s, oy + py * s
            d.ellipse([X - rr, Y - rr, X + rr, Y + rr], fill=col)
    rr = dot_r * s
    X, Y = ox + cx * s, oy + cy * s
    d.ellipse([X - rr, Y - rr, X + rr, Y + rr], fill=dot_color)


def gradient_bg(size, top, bottom):
    img = Image.new("RGB", (size, size))
    for y in range(size):
        t = y / size
        img.paste(
            tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
            [0, y, size, y + 1],
        )
    return img


def centered_offsets(size, scale_frac):
    s = size * scale_frac / 48
    return (size - 48 * s) / 2, (size - 48 * s) / 2, s


OUT = "/app/frontend/assets/images"

# ---- icon.png (1024, teal gradient, white waves + orange dot) ----
icon = gradient_bg(1024, TEAL_LIGHT, TEAL_DEEP)
d = ImageDraw.Draw(icon)
ox, oy, s = centered_offsets(1024, 0.64)
draw_mark(d, ox, oy, s, [WHITE, WHITE, WHITE], ORANGE)
icon.save(f"{OUT}/icon.png")

# ---- adaptive-icon.png (1024, transparent, white waves + orange dot; teal bg from app.json) ----
ad = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
d = ImageDraw.Draw(ad)
ox, oy, s = centered_offsets(1024, 0.44)
draw_mark(d, ox, oy, s, [WHITE, WHITE, WHITE], ORANGE)
ad.save(f"{OUT}/adaptive-icon.png")

# ---- splash-image.png (1024, transparent, teal waves + deep dot; mint bg from app.json) ----
sp = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
d = ImageDraw.Draw(sp)
ox, oy, s = centered_offsets(1024, 0.52)
draw_mark(d, ox, oy, s, [ORANGE, TEAL, TEAL_DEEP], TEAL_DEEP)
sp.save(f"{OUT}/splash-image.png")

# ---- favicon.png (64) ----
icon.resize((64, 64), Image.LANCZOS).save(f"{OUT}/favicon.png")

print("icons written")
