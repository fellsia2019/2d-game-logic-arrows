"""Original promo artwork from the game's arrow shapes/palette, without screenshots.
Requires Pillow and CairoSVG; fonts are read from Windows, never distributed.
"""
from pathlib import Path
from io import BytesIO
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'publication' / 'media'
OUT.mkdir(parents=True, exist_ok=True)
COLORS = [('#7358dc', '#a875eb'), ('#257fd5', '#22b4cf'), ('#c64b8a', '#ee7f93'), ('#178b85', '#47baa2')]

def tile(x, y, size, direction, index):
    a, b = COLORS[index % 4]
    return f'''<defs><linearGradient id="t{x}-{y}" x2="1" y2="1"><stop stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient></defs>
    <g transform="translate({x} {y})"><rect width="{size}" height="{size}" rx="{size*.2}" fill="url(#t{x}-{y})"/>
    <svg x="{size*.16}" y="{size*.16}" width="{size*.68}" height="{size*.68}" viewBox="0 0 48 48"><g transform="rotate({direction*90} 24 24)"><path d="M9 24h28M27 13l11 11-11 11" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g></svg></g>'''

def canvas(w, h, art):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="#f3f5f9"/>{art}</svg>'
    return Image.open(BytesIO(cairosvg.svg2png(bytestring=svg.encode(), scale=2))).convert('RGB'), svg

def save(image, svg, name, w, h):
    image.resize((w, h), Image.Resampling.LANCZOS).save(OUT / f'{name}.png', optimize=True)
    (OUT / f'{name}.svg').write_text(svg, encoding='utf-8')

def text(image, xy, value, size, color='#303556', bold=False):
    font = ImageFont.truetype('C:/Windows/Fonts/' + ('segoeuib.ttf' if bold else 'segoeui.ttf'), size*2)
    ImageDraw.Draw(image).text((xy[0]*2, xy[1]*2), value, font=font, fill=color)

def icon(name, scale):
    size, gap = 128*scale, 16*scale
    start = (512 - (size*2 + gap))/2
    art = '<circle cx="256" cy="256" r="236" fill="#e8e4ff"/>'
    art += ''.join(tile(start + (i%2)*(size+gap), start + (i//2)*(size+gap), size, [0,3,1,2][i], i) for i in range(4))
    image, svg = canvas(512, 512, art)
    save(image, svg, name, 512, 512)

icon('icon', 1.35)
icon('icon-maskable', 1)
for language in ['ru', 'en']:
    art = '<circle cx="678" cy="190" r="236" fill="#e6e1ff"/><circle cx="729" cy="435" r="128" fill="#d9f4ed"/>'
    for i, (x, y, direction) in enumerate([(490,80,0), (609,80,3), (490,199,1), (609,199,0)]):
        art += tile(x, y, 102, direction, i)
    art += '<path d="M726 250h52m-14-14 14 14-14 14" fill="none" stroke="#24a879" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
    art += '<g transform="translate(535 339)"><rect width="210" height="92" rx="18" fill="#fff"/><path d="M24 28c13-5 25-5 38 0 13-5 25-5 38 0v38c-13-5-25-5-38 0-13-5-25-5-38 0zm38 0v38" fill="none" stroke="#7557cf" stroke-width="4" stroke-linejoin="round"/><path d="M125 31h60m-60 16h48m-48 16h37" stroke="#c7c2dd" stroke-width="6" stroke-linecap="round"/></g>'
    image, svg = canvas(800, 470, art)
    text(image, (46,38), 'ЛОГИКА + ЛЮБОПЫТСТВО' if language == 'ru' else 'LOGIC + CURIOSITY', 16, '#626c8d', True)
    text(image, (42,113), 'Разгадай' if language == 'ru' else 'Solve &', 68, bold=True)
    text(image, (42,189), 'и узнай' if language == 'ru' else 'Discover', 68, '#7557cf', True)
    text(image, (46,299), 'Решай и открывай факты' if language == 'ru' else 'Puzzles. Facts. Discovery.', 23)
    text(image, (46,348), '604 факта · 8 тем' if language == 'ru' else '604 facts · 8 topics', 20, '#626c8d')
    # SVG is the artwork source; localized typography is reproducible in this script.
    save(image, svg, f'cover-{language}', 800, 470)
print(f'Generated 4 PNG assets in {OUT}')
