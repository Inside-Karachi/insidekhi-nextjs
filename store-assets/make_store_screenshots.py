import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ─────────────────────────── CONFIG ───────────────────────────
# Paths resolve relative to this script, so the folder can be moved/copied freely.
_HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(_HERE, "raw-screenshots")
OUT_DIR = os.path.join(_HERE, "screenshots")

BG_COLOR = (12, 10, 16)              # Dark luxury brand background (#0C0A10)

FRAME_COLOR = (16, 16, 19)          # device body
FRAME_EDGE = (78, 80, 88)           # metallic edge highlight
BUTTON_COLOR = (28, 28, 33)

TITLE_FONT = ("/System/Library/Fonts/Avenir Next.ttc", 0)   # Bold
SUB_FONT = ("/System/Library/Fonts/Avenir Next.ttc", 5)     # Medium

# Output sizes. (folder, width, height, max device width as fraction of canvas)
# The phone mockup is the same in every profile — only the canvas around it
# changes — so tablet slots reuse the phone captures, as the stores allow.
PROFILES = [
    ("android-phone", 1080, 1920, 0.70),   # Google Play phone, 9:16
    ("ios-6.5",       1284, 2778, 0.76),   # App Store iPhone 6.5"
    ("ipad-13",       2048, 2732, 0.46),   # App Store iPad 12.9"/13"
]

# Gallery order: strongest/most legible first — the first 2-3 appear in
# store search results. (source filename, output name, title, subtitle)
ITEMS = [
    ("simulator_screenshot_32DB1F0B-FDDE-4232-B3DD-F7C49F4F07F6.png",
     "01-explore-karachi.png",
     "Discover Karachi",
     "Explore top spots, food, shopping & hidden gems."),
    ("simulator_screenshot_EB408FCA-9709-4465-B4D1-9957257BF4C0.png",
     "02-featured-spotlight.png",
     "Handpicked & Curated",
     "Spotlight venues, insider picks, and trending events."),
    ("simulator_screenshot_9CAA56AF-A572-437F-9B39-C274EEA2B1BB.png",
     "03-card-deals.png",
     "Exclusive Card Deals",
     "Unlock bank discounts across dining, shopping & fun."),
    ("simulator_screenshot_922C7112-F366-4E11-8DBE-69ADA07EE3B0.png",
     "04-events-tickets.png",
     "Upcoming Events",
     "Find concerts, exhibitions & get tickets instantly."),
    ("simulator_screenshot_D82D13D1-3120-46DD-A379-175828E3C601.png",
     "05-personalised-recommendations.png",
     "Tailored For You",
     "Personalized recommendations based on your location."),
    ("simulator_screenshot_07D74690-6959-42CD-9EB9-9612484AF3D3.png",
     "06-explorer-rewards.png",
     "Explorer Rewards",
     "Track XP, achievements, reviews & leaderboard rank."),
]

# Layout constants, authored against a 1920px-tall canvas and scaled per profile.
BASE_H = 1920
BASE = dict(
    bezel=30, outer_radius=104, edge_width=3,
    top_pad=96, title_h=78, gap_title_sub=16, sub_h=50,
    gap_after_text=74, bottom_pad=86,
    title_size=68, sub_size=40, title_min=30, sub_min=26,
    shadow_blur=28, shadow_drop=26,
    btn_protrude=9, btn_inset=26, btn_radius=6,
)
# ──────────────────────── END CONFIG ──────────────────────────


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def fit_font(draw, text, max_width, start_size, font_spec, min_size):
    """Shrink the font until the text fits max_width."""
    path, idx = font_spec
    size = start_size
    while size > min_size:
        font = ImageFont.truetype(path, size, index=idx)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(path, min_size, index=idx)


def draw_centered(draw, text, font, cx, block_top, block_h, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = cx - w // 2 - bbox[0]
    y = block_top + (block_h - h) // 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=fill)


def render(shot, title, subtitle, canvas_w, canvas_h, max_w_frac):
    """Composite one screenshot onto one canvas size."""
    scale = canvas_h / BASE_H
    p = {k: max(1, int(round(v * scale))) for k, v in BASE.items()}

    aspect = shot.size[1] / shot.size[0]

    text_block_h = p["title_h"] + p["gap_title_sub"] + p["sub_h"]
    phone_top = p["top_pad"] + text_block_h + p["gap_after_text"]
    phone_h = canvas_h - phone_top - p["bottom_pad"]

    screen_h = phone_h - p["bezel"] * 2
    screen_w = int(screen_h / aspect)
    phone_w = screen_w + p["bezel"] * 2

    # never let the device get too wide for the canvas
    max_phone_w = int(canvas_w * max_w_frac)
    if phone_w > max_phone_w:
        phone_w = max_phone_w
        screen_w = phone_w - p["bezel"] * 2
        screen_h = int(screen_w * aspect)
        phone_h = screen_h + p["bezel"] * 2

    phone_x = (canvas_w - phone_w) // 2
    phone_y = phone_top + (canvas_h - p["bottom_pad"] - phone_top - phone_h) // 2

    canvas = Image.new("RGB", (canvas_w, canvas_h), BG_COLOR)

    # ── soft drop shadow ──────────────────────────────────────────────
    shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    sh_layer = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 150))
    shadow.paste(sh_layer, (phone_x, phone_y + p["shadow_drop"]),
                 rounded_mask((phone_w, phone_h), p["outer_radius"]))
    shadow = shadow.filter(ImageFilter.GaussianBlur(p["shadow_blur"]))
    canvas.paste(shadow, (0, 0), shadow)

    # ── side buttons (drawn first so the frame overlaps their inner half) ──
    btn = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(btn)
    bw = p["btn_protrude"] + p["btn_inset"]

    def side_button(x_left, y_frac, h_frac):
        y_top = phone_y + int(phone_h * y_frac)
        bd.rounded_rectangle(
            [x_left, y_top, x_left + bw, y_top + int(phone_h * h_frac)],
            radius=p["btn_radius"], fill=BUTTON_COLOR)

    lx = phone_x - p["btn_protrude"]        # left: silent switch + volume
    side_button(lx, 0.125, 0.032)
    side_button(lx, 0.195, 0.068)
    side_button(lx, 0.280, 0.068)
    rx = phone_x + phone_w - p["btn_inset"]  # right: power
    side_button(rx, 0.225, 0.105)
    canvas.paste(btn, (0, 0), btn)

    # ── device frame ──────────────────────────────────────────────────
    frame = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    frame.paste(Image.new("RGBA", (phone_w, phone_h), FRAME_COLOR + (255,)),
                (0, 0), rounded_mask((phone_w, phone_h), p["outer_radius"]))
    ImageDraw.Draw(frame).rounded_rectangle(
        [1, 1, phone_w - 2, phone_h - 2], radius=p["outer_radius"],
        outline=FRAME_EDGE + (255,), width=p["edge_width"])
    canvas.paste(frame, (phone_x, phone_y), frame)

    # ── screenshot inside the screen cutout ───────────────────────────
    inner_radius = max(1, p["outer_radius"] - p["bezel"] + int(6 * scale))
    screen = shot.resize((screen_w, screen_h), Image.LANCZOS)
    canvas.paste(screen, (phone_x + p["bezel"], phone_y + p["bezel"]),
                 rounded_mask((screen_w, screen_h), inner_radius))

    # ── title + subtitle ──────────────────────────────────────────────
    draw = ImageDraw.Draw(canvas)
    cx = canvas_w // 2
    max_text_w = int(canvas_w * 0.88)
    t_font = fit_font(draw, title, max_text_w, p["title_size"], TITLE_FONT, p["title_min"])
    s_font = fit_font(draw, subtitle, max_text_w, p["sub_size"], SUB_FONT, p["sub_min"])
    draw_centered(draw, title, t_font, cx, p["top_pad"], p["title_h"], (255, 255, 255))
    draw_centered(draw, subtitle, s_font, cx,
                  p["top_pad"] + p["title_h"] + p["gap_title_sub"], p["sub_h"],
                  (255, 120, 150))
    return canvas


for folder, cw, ch, frac in PROFILES:
    out_dir = os.path.join(OUT_DIR, folder)
    os.makedirs(out_dir, exist_ok=True)
    for filename, out_name, title, subtitle in ITEMS:
        shot = Image.open(os.path.join(SRC_DIR, filename)).convert("RGB")
        canvas = render(shot, title, subtitle, cw, ch, frac)
        out_path = os.path.join(out_dir, out_name)
        canvas.save(out_path, "PNG")
        print(f"{folder:14s} {out_name:28s} {canvas.size[0]}x{canvas.size[1]}")
