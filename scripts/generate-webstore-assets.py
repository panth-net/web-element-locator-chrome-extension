#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "docs" / "webstore-assets"
ICON_PATH = ROOT / "icons" / "icon128.png"

TEXT = "#161719"
MUTED = "#6d7179"
LINE = "#d8dbe0"
SURFACE = "#ffffff"
BG = "#f7f7f8"
ACCENT = "#0a84ff"


def font(size, bold=False, mono=False):
    candidates = []
    if mono:
        candidates.append("/System/Library/Fonts/SFNSMono.ttf")
    if bold:
        candidates.extend([
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
        ])
    candidates.extend([
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ])

    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)

    return ImageFont.load_default(size=size)


def text(draw, xy, value, size=16, fill=TEXT, bold=False, mono=False):
    draw.text(xy, value, fill=fill, font=font(size, bold=bold, mono=mono))


def line(draw, xy, width, fill="#e9ebef", radius=5):
    x, y = xy
    draw.rounded_rectangle([x, y, x + width, y + 10], radius=radius, fill=fill)


def icon(size):
    return Image.open(ICON_PATH).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)


def save_jpeg(image, name):
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    path = ASSET_DIR / name
    image.convert("RGB").save(path, "JPEG", quality=95, subsampling=0)
    print(f"{path}: {image.size[0]}x{image.size[1]} JPEG")


def promo():
    img = Image.new("RGB", (440, 280), BG)
    draw = ImageDraw.Draw(img)

    draw.polygon([(0, 0), (236, 0), (0, 182)], fill="#e7f2ff")
    draw.rounded_rectangle([28, 46, 200, 234], radius=8, fill=SURFACE, outline=LINE, width=1)
    draw.rounded_rectangle([42, 62, 112, 74], radius=5, fill="#e9ebef")
    line(draw, (42, 94), 128)
    draw.rounded_rectangle([42, 121, 172, 159], radius=7, fill="#eaf4ff", outline=ACCENT, width=2)
    draw.ellipse([54, 135, 64, 145], fill=ACCENT)
    text(draw, (72, 130), "button.save", size=13, fill=TEXT, bold=True)
    line(draw, (42, 180), 98)

    img.paste(icon(48), (226, 52), icon(48))
    text(draw, (226, 112), "Web Element", size=30, fill="#111318", bold=True)
    text(draw, (226, 145), "Locator", size=30, fill="#111318", bold=True)
    text(draw, (226, 196), "Click. Copy.", size=17, fill="#3e434c", bold=True)
    text(draw, (226, 222), "Paste a locator.", size=17, fill="#3e434c", bold=True)

    save_jpeg(img, "small-promo-440x280.jpg")


def chrome_frame(draw, address):
    draw.rectangle([0, 0, 1280, 64], fill="#f1f2f4")
    draw.line([0, 63, 1280, 63], fill=LINE)
    for i, x in enumerate([28, 48, 68]):
        draw.ellipse([x, 26, x + 12, 38], fill=["#c8ccd3", "#c8ccd3", "#c8ccd3"][i])
    draw.rounded_rectangle([102, 15, 1238, 49], radius=8, fill=SURFACE, outline=LINE)
    text(draw, (118, 23), address, size=14, fill=MUTED)


def screenshot_popup():
    img = Image.new("RGB", (1280, 800), SURFACE)
    draw = ImageDraw.Draw(img)
    chrome_frame(draw, "https://example.test/settings")

    draw.rectangle([0, 64, 864, 800], fill=SURFACE)
    draw.polygon([(0, 64), (864, 64), (864, 306), (0, 432)], fill="#f4f9ff")
    draw.rounded_rectangle([72, 120, 792, 604], radius=8, fill=SURFACE, outline=LINE)
    text(draw, (104, 154), "Example page", size=24, fill=TEXT, bold=True)
    line(draw, (104, 202), 360)
    line(draw, (104, 230), 298)
    draw.rounded_rectangle([104, 292, 760, 512], radius=8, fill="#fbfbfc", outline=LINE)
    text(draw, (136, 326), "Settings", size=18, fill=TEXT, bold=True)
    line(draw, (136, 374), 220)
    line(draw, (136, 414), 300)
    draw.rounded_rectangle([608, 438, 720, 478], radius=8, fill=ACCENT)
    text(draw, (640, 449), "Save", size=14, fill="#ffffff", bold=True)

    draw.rectangle([864, 64, 1280, 800], fill="#eef1f5")
    popup_box = [904, 150, 1240, 650]
    draw.rounded_rectangle(popup_box, radius=8, fill=BG, outline=LINE, width=1)
    draw.rounded_rectangle(popup_box, radius=8, outline="#e7e9ee", width=1)

    img.paste(icon(28), (922, 170), icon(28))
    text(draw, (960, 174), "Web Element Locator", size=17, fill=TEXT, bold=True)
    text(draw, (922, 224), "Copy fields", size=12, fill=MUTED, bold=True)
    draw.rounded_rectangle([922, 244, 1222, 284], radius=8, fill=SURFACE, outline=LINE)
    text(draw, (934, 255), "Page, Target, Owner", size=14, fill=TEXT)
    draw.line([1204, 257, 1211, 264, 1218, 257], fill=MUTED, width=2)

    y = 302
    options = [
        ("Target", "Exact clicked element", True),
        ("Page", "Route/path context", True),
        ("Owner", "Likely parent UI region", True),
        ("Selector", "Stable DOM selector", False),
    ]
    draw.rounded_rectangle([922, 302, 1222, 526], radius=8, fill=SURFACE, outline=LINE)
    for title, detail, checked in options:
        if checked:
            draw.rounded_rectangle([928, y + 6, 1216, y + 54], radius=7, fill="#eaf4ff")
        draw.rounded_rectangle([938, y + 22, 954, y + 38], radius=4, fill=ACCENT if checked else SURFACE, outline=ACCENT if checked else "#9aa1ad")
        if checked:
            draw.rectangle([943, y + 27, 949, y + 33], fill=SURFACE)
        text(draw, (964, y + 16), title, size=13, fill=TEXT, bold=True)
        text(draw, (964, y + 36), detail, size=11, fill=MUTED)
        y += 54

    draw.rounded_rectangle([922, 544, 1222, 584], radius=8, fill=ACCENT)
    text(draw, (1016, 555), "Identify Element", size=14, fill="#ffffff", bold=True)
    text(draw, (922, 606), "Shortcut:", size=12, fill=MUTED)
    text(draw, (984, 606), "Not set", size=12, fill=TEXT, bold=True)
    draw.rounded_rectangle([1118, 598, 1222, 624], radius=6, fill=SURFACE, outline="#d8dbe0")
    text(draw, (1134, 604), "Set shortcut", size=11, fill=ACCENT, bold=True)
    text(draw, (922, 630), "No data is sent anywhere.", size=12, fill=MUTED)

    save_jpeg(img, "screenshot-popup-settings-1280x800.jpg")


def screenshot_highlight():
    img = Image.new("RGB", (1280, 800), SURFACE)
    draw = ImageDraw.Draw(img)
    chrome_frame(draw, "https://example.test/settings")

    draw.rectangle([0, 64, 260, 800], fill=BG)
    draw.line([259, 64, 259, 800], fill=LINE)
    img.paste(icon(28), (22, 92), icon(28))
    text(draw, (60, 96), "Web Element Locator", size=16, fill=TEXT, bold=True)
    nav = [("Overview", False), ("Settings", True), ("Help", False)]
    y = 148
    for item, active in nav:
        fill = SURFACE if active else BG
        draw.rounded_rectangle([22, y, 238, y + 42], radius=8, fill=fill)
        text(draw, (36, y + 12), item, size=14, fill=TEXT if active else "#555b65", bold=active)
        y += 50

    draw.rectangle([260, 64, 1280, 800], fill=SURFACE)
    draw.polygon([(260, 64), (1280, 64), (1280, 292), (260, 422)], fill="#f4f9ff")

    panel = [324, 134, 1064, 554]
    draw.rounded_rectangle(panel, radius=8, fill=SURFACE, outline=LINE)
    text(draw, (356, 174), "Settings", size=24, fill=TEXT, bold=True)
    line(draw, (356, 222), 330)
    line(draw, (356, 250), 258)

    fields = [
        ("Display name", 320),
        ("Email", 360),
        ("Workspace", 286),
    ]
    y = 310
    for label, width in fields:
        text(draw, (356, y), label, size=14, fill="#3e434c", bold=True)
        draw.rounded_rectangle([508, y - 8, 508 + width, y + 30], radius=7, fill=SURFACE, outline=LINE)
        line(draw, (524, y + 5), min(width - 42, 220))
        y += 60
    draw.rounded_rectangle([842, 476, 954, 516], radius=8, fill=ACCENT)
    text(draw, (874, 487), "Save", size=14, fill="#ffffff", bold=True)

    draw.rounded_rectangle([507, 76, 773, 112], radius=8, fill="#ffffff", outline="#d1d5db")
    text(draw, (528, 85), "Web Element Locator active - hover an element", size=13, fill=TEXT, bold=True)
    draw.rounded_rectangle([842, 476, 954, 516], radius=8, outline=ACCENT, width=3)
    draw.rounded_rectangle([812, 526, 982, 552], radius=6, fill=TEXT)
    text(draw, (821, 531), 'button text="Save"', size=12, fill="#ffffff", bold=True)

    draw.rounded_rectangle([858, 612, 1238, 758], radius=8, fill=TEXT, outline=LINE)
    text(draw, (876, 630), "Copied locator", size=14, fill="#ffffff", bold=True)
    text(draw, (876, 668), "page: /settings", size=13, fill="#cbd5e1", mono=True)
    text(draw, (876, 696), 'target: button text="Save"', size=13, fill="#cbd5e1", mono=True)
    text(draw, (876, 724), "owner: form.settings", size=13, fill="#cbd5e1", mono=True)

    save_jpeg(img, "screenshot-element-highlight-1280x800.jpg")


def main():
    promo()
    screenshot_popup()
    screenshot_highlight()


if __name__ == "__main__":
    main()
