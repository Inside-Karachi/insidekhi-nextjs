# Store Screenshot Mechanism — Reusable Handoff

Generates polished Play Store / App Store listing screenshots: raw simulator captures
composited onto a branded background, mounted inside a drawn phone-device frame, with a
title + subtitle above each.

Built for **TAFS Staff** (Aug 2026).

---

## ▶ If you were just handed this

You should have received **two files**: this doc and `make_store_screenshots.py`. Keep them
in the same directory — the doc describes the script rather than duplicating it.

Do this, in order:

1. **Set up Pillow** — §3. Do not skip it; the obvious `pip install Pillow` fails on macOS
   for two separate reasons documented there.
2. **Put the raw screenshots** in a `raw-screenshots/` folder next to the script. They must
   all come from one simulator device (§4).
3. **Edit only the CONFIG block** at the top of the script:
   - `BG_COLOR` → the app's brand colour, as an RGB tuple (not hex)
   - `ITEMS` → one row per screenshot: `(source file, output name, title, subtitle)`,
     ordered strongest-first (§7 explains the ordering and copy rules)
   - `PROFILES` → trim to the store slots this app actually needs (§2)
4. **Run** `python make_store_screenshots.py` — every size is written to
   `screenshots/<profile>/`.
5. **Look at every output image** before handing them over. Long titles auto-shrink and
   can end up too small; unusual source aspect ratios can leave odd margins.

Paths resolve relative to the script, so nothing else needs configuring. §6 is the
reference for every tunable if the default look needs adjusting.

---

## 1. What it produces

For each raw screenshot, one PNG **per store slot** (Play phone, iPhone 6.5", iPad 13")
containing

- solid brand-colour background
- bold **title** + lighter **subtitle** centred at the top
- the screenshot inside a **phone frame** — dark bezel, rounded screen cutout, metallic
  edge highlight, side buttons (silent switch + volume left, power right)
- soft gaussian drop shadow behind the device

Everything is drawn programmatically with Pillow. **No device-mockup PNG asset is needed**,
which is what makes it portable between apps.

---

## 2. Store constraints that drove the numbers

**Google Play — phone**

| Requirement | Value | How we satisfy it |
|---|---|---|
| Count | 2–8 | 5 |
| Format | PNG or JPEG | PNG |
| Max size | 8 MB each | ~110–235 KB |
| Aspect ratio | 16:9 or 9:16 | 1080×1920 = 9:16 |
| Each side | 320–3840 px | 1080 and 1920 |

**App Store Connect** — accepts a fixed set of exact pixel sizes per slot:

| Slot | Accepted sizes | We output |
|---|---|---|
| iPhone 6.5" | 1242×2688, 2688×1242, 1284×2778, 2778×1284 | **1284×2778** |
| iPad 12.9"/13" | 2064×2752, 2752×2064, 2048×2732, 2732×2048 | **2048×2732** |

Up to 10 screenshots + 3 previews per slot.

### Tablet slots reuse the phone captures

The iPad canvas is far squarer (1.33) than a phone screenshot (~2.17). Rather than
capture on an iPad, the same phone mockup is centred on a tablet-sized canvas with wider
side margins — permitted by the stores and the normal approach when an app has no
dedicated tablet layout. The only per-profile knob is the device width fraction (0.46 on
iPad vs 0.70–0.76 on phones), which keeps the framing deliberate instead of stretched.

---

## 3. Environment setup

Needs Python + **Pillow**. On macOS this is the fiddly part — two real blockers hit during
the original build:

| Problem | Cause | Fix |
|---|---|---|
| `pip` crashes with `ImportError: ... pyexpat ... Symbol not found: _XML_SetAllocTrackerActivationThreshold` | Homebrew **python@3.14** had a broken `pyexpat` linked against the system libexpat | Don't use 3.14 — use python@3.13 |
| `error: externally-managed-environment` | PEP 668 — Homebrew Python blocks global installs | Use a venv (not `--break-system-packages`) |

Working setup:

```bash
# use a Python that is NOT the broken 3.14
/opt/homebrew/bin/python3.13 -m venv /tmp/shotvenv
/tmp/shotvenv/bin/pip install --quiet Pillow
/tmp/shotvenv/bin/python -c "from PIL import Image; print('Pillow OK')"
```

Then always run the script with `/tmp/shotvenv/bin/python`, not bare `python3`.

> `sips` (built into macOS) can pad/resize but **cannot** draw rounded corners, masks,
> shadows or text — that's why Pillow is required for this. `sips` is still the right tool
> for the store icon (see Appendix A).

---

## 4. Capturing the source screenshots

- Take them all from **one simulator device** so every capture shares an aspect ratio.
  The script derives the phone-frame size from each source's own aspect, so mixing devices
  produces inconsistently-sized frames across the gallery.
- TAFS Staff used iPhone 16 Pro simulator → **1206×2622** (aspect 2.174).
- Keep the iOS status bar in frame — the dynamic island reads as a real device inside the
  drawn bezel.
- Raw captures go in `raw-screenshots/`, finished uploads land in `screenshots/`.

---

## 5. The script

The generator lives beside this file: **`make_store_screenshots.py`**.

It is intentionally not duplicated here — read it directly so the two can never drift.
Structure:

| Part | What it does |
|---|---|
| `CONFIG` block (top) | Everything you normally edit: paths, `BG_COLOR`, fonts, `PROFILES`, `ITEMS` |
| `BASE` dict | Layout constants authored against a 1920px-tall canvas |
| `rounded_mask()` | Rounded-rectangle alpha mask — used for the screen cutout, frame and shadow |
| `fit_font()` | Shrinks a font until the string fits the available width |
| `draw_centered()` | Centres text inside a reserved block, correcting for glyph bearing |
| `render()` | Composites one screenshot onto one canvas size |
| bottom loop | `PROFILES × ITEMS` — writes every size in one pass |

### How one image is built (order matters)

1. Fill the canvas with `BG_COLOR`.
2. Paste a rounded silhouette of the device, offset down, then **gaussian-blur the whole
   layer** → a real soft shadow.
3. Draw the **side buttons**, so the frame drawn next overlaps their inner half and they
   read as protruding from behind the body.
4. Paste the **device frame**: rounded rect in `FRAME_COLOR`, plus a thin `FRAME_EDGE`
   outline for the metallic rim.
5. Paste the **screenshot** inset by `bezel`, masked to the inner corner radius.
6. Draw **title** and **subtitle** last, on top.

### Multi-size rendering

`render()` takes the canvas size and derives a scale factor `canvas_h / 1920`, then
multiplies every constant in `BASE` by it — bezel, radii, padding, font sizes, shadow
blur. So one set of hand-tuned numbers produces correct proportions at any output size,
and adding a new store slot is a one-line addition to `PROFILES`.

Device size is computed from **leftover vertical space** (canvas minus text block and
padding), then capped by the profile's width fraction. That means text and device can
never collide no matter how long the copy is, and the cap is what keeps the tablet
renders from looking like a stretched phone.

Run it:

```bash
/tmp/shotvenv/bin/python make_store_screenshots.py
```

Every profile is rebuilt on each run; outputs overwrite in place.

---

## 6. Tunable reference

Top-level config:

| Constant | Effect | Notes |
|---|---|---|
| `BG_COLOR` | Background | RGB tuple, **not** hex. `#031954` → `(3, 25, 84)` |
| `FRAME_COLOR` | Device body | Near-black |
| `FRAME_EDGE` | Metallic rim | Set equal to `FRAME_COLOR` to remove the rim |
| `PROFILES` | Output sizes | `(folder, width, height, max device width fraction)` — add a row for a new store slot |
| `ITEMS` | The gallery | `(source file, output name, title, subtitle)`, in order |

Inside `BASE` (values are for a 1920px-tall canvas; everything scales from there):

| Key | Effect | Notes |
|---|---|---|
| `bezel` | Device border thickness | 30 = balanced. 44 = chunky. Below ~20 it stops reading as a device |
| `outer_radius` | Device corner rounding | 104 suits a ~700px-wide phone (≈0.14 × width) |
| `edge_width` | Rim thickness | |
| `top_pad` / `title_h` / `gap_title_sub` / `sub_h` / `gap_after_text` / `bottom_pad` | Vertical rhythm | Device height is whatever's left, so more text space = smaller device |
| `title_size` / `sub_size` / `*_min` | Type scale | `fit_font` shrinks toward the `_min` when copy is long |
| `shadow_blur` / `shadow_drop` | Shadow softness and offset | |
| `btn_protrude` / `btn_inset` / `btn_radius` | Side buttons | `protrude` is how far they stick out past the body |

The subtitle colour `(176, 192, 226)` is a muted tint of the background family — change it
alongside `BG_COLOR`.

The inner (screen) corner radius is derived as `outer_radius - bezel + 6×scale`, so it
stays correct automatically when you change `bezel`.

### Fonts

macOS `.ttc` files hold multiple faces — select with `index=`. Avenir Next:

| index | Face |
|---|---|
| 0 | **Bold** ← title |
| 2 | Demi Bold |
| 5 | Medium ← subtitle |
| 7 | Regular |

Enumerate any `.ttc`:

```python
from PIL import ImageFont
for i in range(8):
    print(i, ImageFont.truetype("/System/Library/Fonts/Avenir Next.ttc", 40, index=i).getname())
```

Fallback that always exists: `/System/Library/Fonts/Supplemental/Arial Bold.ttf` (single
face, no `index`).

---

## 7. Adapting to a new app — checklist

1. Copy the whole `store-assets/` folder into the new project.
2. Replace `raw-screenshots/` with captures from **one** simulator device.
3. Set `BG_COLOR` to the app's brand colour (RGB tuple).
4. Rewrite `ITEMS` — one entry per screenshot, in intended gallery order.
5. Trim or extend `PROFILES` to the store slots you actually need.
6. Run, then **actually look at every output** before uploading.
7. Delete stale outputs from previous runs if you renamed anything, so nothing old gets
   uploaded by mistake.

Paths resolve relative to the script, so `SRC_DIR` / `OUT_DIR` need no editing.

### Writing the copy

- **Title**: 2–4 words, a feature name, Title Case, no period.
- **Subtitle**: one short sentence, sentence case, ends with a period.
- Long titles auto-shrink via `fit_font`, but past ~28 characters they get visibly small —
  shorten the words instead.

### Ordering strategy

Play surfaces the **first 2–3** screenshots in search results, so order by impact, not by
app navigation order:

1. Most **visually legible at thumbnail size** — dense, colourful, obviously "what the app
   does" (TAFS Staff: the attendance calendar).
2. Highest **personal value** to the user (payroll).
3. The key **action/workflow** (apply for leave).
4. Supporting views.
5. Weakest thumbnail last — screens with lots of empty white space.

Name outputs `01-…png`, `02-…png` so Finder's alphabetical sort matches gallery order and
you can select-all and drag into Play Console in one go.

---

## 8. Design decisions worth keeping

- **Drawn frame, not a mockup image** — no asset to license, ship, or rescale; adapts to any
  source aspect ratio automatically.
- **Buttons drawn before the frame** so the frame overlaps their inner half and they read as
  protruding from behind the body.
- **Shadow blurred at layer level** (`GaussianBlur(28)`) rather than faked with opacity —
  gives real depth against a dark background.
- **Phone size derived from leftover vertical space**, so text and device can never collide
  regardless of copy length.

---

## Appendix A — 512×512 store icon

Play Console wants the listing icon at **512×512 PNG, ≤1024 KB**. `sips` handles it:

```bash
sips -s format png -z 512 512 ../assets/app-icon.png --out icon-512.png
```

- `-z H W` — note **height first**.
- Don't bother with `--setProperty hasAlpha yes`; it errors (`Error 13`) and Play Console
  validates dimensions/format/size, not the presence of an alpha channel. Plain RGB uploads
  fine.

---

## Appendix B — InsideKhi reference values

| Item | Value |
|---|---|
| Background | `#0C0A10` → `(12, 10, 16)` |
| Subtitle tint | `#FF7896` → `(255, 120, 150)` |
| Source captures | iPhone 16 Pro simulator, 1170×2532 |
| Bezel | 30 px (at 1920px canvas height; scales per profile) |
| Fonts | Avenir Next Bold (title) / Medium (subtitle) |
| Output | `screenshots/android-phone/`, `screenshots/ios-6.5/`, `screenshots/ipad-13/` |

Final gallery (same 6 in every size folder):

| File | Title | Subtitle |
|---|---|---|
| `01-explore-karachi.png` | Discover Karachi | Explore top spots, food, shopping & hidden gems. |
| `02-featured-spotlight.png` | Handpicked & Curated | Spotlight venues, insider picks, and trending events. |
| `03-card-deals.png` | Exclusive Card Deals | Unlock bank discounts across dining, shopping & fun. |
| `04-events-tickets.png` | Upcoming Events | Find concerts, exhibitions & get tickets instantly. |
| `05-personalised-recommendations.png` | Tailored For You | Personalized recommendations based on your location. |
| `06-explorer-rewards.png` | Explorer Rewards | Track XP, achievements, reviews & leaderboard rank. |
