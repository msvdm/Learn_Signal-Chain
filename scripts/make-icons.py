#!/usr/bin/env python3
"""Learn Signal Chain: the logo and every icon made from it.

The mark: sound arrives (a green wave), a hand sets the level (a purple knob),
and the result leaves through a fader (a yellow cap with a red top: too hot).
The colours are the same in the light and the dark theme; only the tile behind
the mark changes.

    python3 scripts/make-icons.py

writes the SVGs (always) and the PNGs (when `rsvg-convert` or the Python
package `cairosvg` is installed):

    public/icon.svg                 favicon + manifest "any": follows the browser's light/dark theme
    public/icon-192.png, icon-512.png
    public/icon-maskable-512.png    full-bleed tile, mark inside the central 80 % circle
    public/apple-touch-icon.png     180 x 180, full-bleed (iOS rounds the corners itself)
    docs/brand/mark.svg             the mark alone, transparent (header, slides, print)
    docs/brand/icon-light.svg       the mark on the light tile
    docs/brand/icon-dark.svg        the mark on the dark tile
    docs/brand/icon-maskable.svg
    docs/brand/social-preview.png   1280 x 640, for GitHub's Settings -> Social preview
    src/components/AppLogo.tsx      the header's logo: the same mark, its tile in the app's theme colours

Deterministic: run it again after a change.
"""
import math, os, shutil, subprocess, sys

def _repo_root():
    d = os.path.dirname(os.path.abspath(__file__))
    while not os.path.exists(os.path.join(d, "package.json")):
        if os.path.dirname(d) == d:
            sys.exit("make-icons.py: run it from inside the Learn Signal Chain repository")
        d = os.path.dirname(d)
    return d


ROOT = _repo_root()
PUBLIC = os.path.join(ROOT, "public")
BRAND = os.path.join(ROOT, "docs", "brand")

# ---- colours (identical in both themes) ------------------------------------
GREEN = "#4ade80"    # the sound arriving   (the app's dark-theme "good" green)
PURPLE = "#9a7fd4"   # the hand on the knob (the app's button purple, light theme)
YELLOW = "#facc15"   # the fader            (the app's dark-theme "hot" yellow)
RED = "#f87171"      # the top of the fader: clipping
CASE = "#24232b"     # the thin outline round every shape, and the cap's centre line
POINTER = "#fbfaf7"  # the knob's pointer

TILES = {  # the tile behind the mark and its keyline (the app's card border)
    "light": dict(tile="#fbfaf7", key="#e6e2d8"),
    "dark": dict(tile="#16181d", key="#2e3341"),
}

# ---- geometry, on a 512 x 512 canvas ---------------------------------------
# The mark is centred on the tile; its width is 381 of 512 (x 66 -> 447).
CW = 11.3                                   # casing: added to every stroke / 2x to every outline
DOT = dict(cx=90.6, cy=256, r=18.8)
WAVES = dict(cx=90.6, cy=256, radii=(47.0, 88.4), half_angle=40, width=20.7)
KNOB = dict(cx=274.8, cy=256, r=60.2, pointer_deg=-55, pointer_len=41.4, pointer_w=16.9)
TRACK = dict(x=407.3, y1=157.3, y2=338.7, width=20.7)
CAP = dict(x=373.5, y=171.4, w=67.7, h=105.3, rx=13.2, red_h=28.2, line_dy=60.2, line_inset=9.4, line_w=7.5)


def _arc(cx, cy, r, a0, a1):
    p = lambda a: (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
    (x0, y0), (x1, y1) = p(a0), p(a1)
    return f"M{x0:.1f} {y0:.1f} A{r} {r} 0 0 1 {x1:.1f} {y1:.1f}"


def mark():
    """The mark's SVG elements (no <svg> wrapper), on the 512 canvas."""
    w, k, c = WAVES, KNOB, CAP
    waves = [_arc(w["cx"], w["cy"], r, -w["half_angle"], w["half_angle"]) for r in w["radii"]]
    track = f'M{TRACK["x"]} {TRACK["y1"]} V{TRACK["y2"]}'
    px = k["cx"] + k["pointer_len"] * math.cos(math.radians(k["pointer_deg"]))
    py = k["cy"] + k["pointer_len"] * math.sin(math.radians(k["pointer_deg"]))
    h = CW / 2
    red = (f'M{c["x"]} {c["y"] + c["rx"]} Q{c["x"]} {c["y"]} {c["x"] + c["rx"]} {c["y"]} '
           f'H{c["x"] + c["w"] - c["rx"]} Q{c["x"] + c["w"]} {c["y"]} {c["x"] + c["w"]} {c["y"] + c["rx"]} '
           f'V{c["y"] + c["red_h"]:.1f} H{c["x"]} Z')
    ly = c["y"] + c["line_dy"]
    out = [
        # 1. the casing, under everything
        f'<g fill="{CASE}" stroke="{CASE}" stroke-linecap="round">',
        f'<circle cx="{DOT["cx"]}" cy="{DOT["cy"]}" r="{DOT["r"] + h:.1f}" stroke="none"/>',
        *[f'<path d="{d}" fill="none" stroke-width="{w["width"] + CW:.1f}"/>' for d in waves],
        f'<circle cx="{k["cx"]}" cy="{k["cy"]}" r="{k["r"] + h:.1f}" stroke="none"/>',
        f'<path d="{track}" fill="none" stroke-width="{TRACK["width"] + CW:.1f}"/>',
        f'<rect x="{c["x"] - h:.1f}" y="{c["y"] - h:.1f}" width="{c["w"] + CW:.1f}" height="{c["h"] + CW:.1f}" rx="{c["rx"] + h:.1f}" stroke="none"/>',
        "</g>",
        # 2. the wave
        f'<circle cx="{DOT["cx"]}" cy="{DOT["cy"]}" r="{DOT["r"]}" fill="{GREEN}"/>',
        *[f'<path d="{d}" fill="none" stroke="{GREEN}" stroke-width="{w["width"]}" stroke-linecap="round"/>' for d in waves],
        # 3. the knob
        f'<circle cx="{k["cx"]}" cy="{k["cy"]}" r="{k["r"]}" fill="{PURPLE}"/>',
        f'<path d="M{k["cx"]} {k["cy"]} L{px:.1f} {py:.1f}" stroke="{POINTER}" stroke-width="{k["pointer_w"]}" stroke-linecap="round"/>',
        # 4. the fader
        f'<path d="{track}" fill="none" stroke="{YELLOW}" stroke-width="{TRACK["width"]}" stroke-linecap="round"/>',
        f'<rect x="{c["x"]}" y="{c["y"]}" width="{c["w"]}" height="{c["h"]}" rx="{c["rx"]}" fill="{YELLOW}"/>',
        f'<path d="{red}" fill="{RED}"/>',
        f'<path d="M{c["x"] + c["line_inset"]:.1f} {ly:.1f} H{c["x"] + c["w"] - c["line_inset"]:.1f}" stroke="{CASE}" stroke-width="{c["line_w"]}" stroke-linecap="round"/>',
    ]
    return "\n  ".join(out)


def svg(body, title="Learn Signal Chain", extra_style=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n'
            f'  <title>{title}</title>{extra_style}\n  {body}\n</svg>\n')


def scaled(body, s):
    return f'<g transform="translate(256 256) scale({s}) translate(-256 -256)">\n  {body}\n  </g>'


def tile(theme, rounded=True):
    t = TILES[theme]
    if not rounded:
        return f'<rect width="512" height="512" fill="{t["tile"]}"/>'
    return (f'<rect width="512" height="512" rx="112" fill="{t["tile"]}"/>\n  '
            f'<rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="{t["key"]}" stroke-width="12"/>')


def adaptive_icon():
    """One file for the favicon: the tile follows the browser's light/dark theme."""
    style = (f'\n  <style>.tile{{fill:{TILES["light"]["tile"]}}}.key{{stroke:{TILES["light"]["key"]}}}'
             f'@media (prefers-color-scheme: dark){{.tile{{fill:{TILES["dark"]["tile"]}}}.key{{stroke:{TILES["dark"]["key"]}}}}}</style>')
    body = ('<rect class="tile" width="512" height="512" rx="112"/>\n  '
            '<rect class="key" x="6" y="6" width="500" height="500" rx="106" fill="none" stroke-width="12"/>\n  ' + mark())
    return svg(body, extra_style=style)


SOCIAL = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640">
  <rect width="1280" height="640" fill="#fbfaf7"/>
  <g transform="translate(120 160) scale(0.625)">{icon}</g>
  <text x="480" y="300" font-family="Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#3a3532">Learn Signal Chain</text>
  <text x="482" y="362" font-family="Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" fill="#5c544f">From microphone to speaker, one healthy step at a time.</text>
  <text x="482" y="420" font-family="Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" fill="#8a8278">Free · open source · runs in your browser</text>
</svg>
"""


def jsx(markup):
    """SVG markup -> JSX: camelCase attributes."""
    for a in ("stroke-width", "stroke-linecap", "stroke-linejoin"):
        markup = markup.replace(a + "=", a.split("-")[0] + a.split("-")[1].capitalize() + "=")
    return markup.replace("/>", " />")


APP_LOGO = """// Made by scripts/make-icons.py: edit the geometry there and run it again, not here.
/**
 * The app's logo: sound arrives (a green wave), a hand sets the level (a purple knob),
 * the result leaves through a fader (a yellow cap with a red top: too hot).
 * The mark's colours are the same in both themes; the tile behind it takes the
 * canvas and border colours of the theme the app is in.
 */
export function AppLogo({{ size = 32, title }}: {{ size?: number; title?: string }}) {{
  return (
    <svg
      viewBox="0 0 512 512" width={{size}} height={{size}}
      role={{title ? 'img' : undefined}} aria-label={{title}} aria-hidden={{title ? undefined : true}}
      style={{{{ display: 'block', flexShrink: 0 }}}}
    >
      <rect width="512" height="512" rx="112" fill="var(--lsc-canvas)" />
      <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="var(--lsc-border)" strokeWidth="12" />
      {mark}
    </svg>
  )
}}
"""


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote", os.path.relpath(path, ROOT))


def png(svg_path, png_path, w, h=None):
    h = h or w
    if shutil.which("rsvg-convert"):
        subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), svg_path, "-o", png_path], check=True)
    else:
        try:
            import cairosvg
        except ImportError:
            print(f"skipped {os.path.relpath(png_path, ROOT)}: install rsvg-convert (librsvg2-bin) or `pip install cairosvg`")
            return
        cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=w, output_height=h)
    print("wrote", os.path.relpath(png_path, ROOT))


def main():
    m = mark()
    light = svg(tile("light") + "\n  " + m)
    dark = svg(tile("dark") + "\n  " + m)
    maskable = svg(tile("light", rounded=False) + "\n  " + scaled(m, 0.86))   # inside the 80 % circle
    apple = svg(tile("light", rounded=False) + "\n  " + scaled(m, 0.94))

    write(os.path.join(PUBLIC, "icon.svg"), adaptive_icon())
    write(os.path.join(BRAND, "mark.svg"), svg(m))
    write(os.path.join(BRAND, "icon-light.svg"), light)
    write(os.path.join(BRAND, "icon-dark.svg"), dark)
    write(os.path.join(BRAND, "icon-maskable.svg"), maskable)
    write(os.path.join(ROOT, "src", "components", "AppLogo.tsx"),
          APP_LOGO.format(mark=jsx(m).replace("\n  ", "\n      ")))

    tmp = os.path.join(BRAND, ".tmp")
    os.makedirs(tmp, exist_ok=True)
    for name, text in (("light", light), ("maskable", maskable), ("apple", apple),
                       ("social", SOCIAL.format(icon=light.split("\n", 1)[1].rsplit("</svg>", 1)[0]))):
        write(os.path.join(tmp, name + ".svg"), text)
    png(os.path.join(tmp, "light.svg"), os.path.join(PUBLIC, "icon-192.png"), 192)
    png(os.path.join(tmp, "light.svg"), os.path.join(PUBLIC, "icon-512.png"), 512)
    png(os.path.join(tmp, "maskable.svg"), os.path.join(PUBLIC, "icon-maskable-512.png"), 512)
    png(os.path.join(tmp, "apple.svg"), os.path.join(PUBLIC, "apple-touch-icon.png"), 180)
    png(os.path.join(tmp, "social.svg"), os.path.join(BRAND, "social-preview.png"), 1280, 640)
    shutil.rmtree(tmp)


if __name__ == "__main__":
    sys.exit(main())
