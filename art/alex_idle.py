"""Alex for the plain portfolio, idling the way Pokémon do in battle: breathing, and blinking now
and then. Made from the game's intro sprite (pokemon-website/public/assets/alex-intro.png) as four
frames side by side: at rest, breathing in, blinking, breathing in and blinking.

Breathing in, everything above his lower chest rises a pixel (the row at the cut is kept, so his
arms stretch rather than break). Blinking, each eye closes to a lash line.

    python3 art/alex_idle.py   (needs Pillow; writes frontend/src/assets/alex-idle.png)
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SPRITE = HERE.parents[1] / 'pokemon-website' / 'public' / 'assets' / 'alex-intro.png'
OUT = HERE.parent / 'frontend' / 'src' / 'assets' / 'alex-idle.png'

CUT = 36  # rows above this rise when he breathes in
EYES = [(26, 18), (32, 18)]  # each eye's top-left pixel; an eye is 2×2
SKIN, LASH = (222, 164, 148, 255), (90, 60, 44, 255)


def breathe_in(image: Image.Image) -> Image.Image:
    out = image.copy()
    out.paste(image.crop((0, 1, image.width, CUT)), (0, 0))
    return out


def blink(image: Image.Image, rise: int) -> Image.Image:
    out = image.copy()
    for x, y in EYES:
        for dx in (0, 1):
            out.putpixel((x + dx, y - rise), SKIN)
            out.putpixel((x + dx, y + 1 - rise), LASH)
    return out


def main():
    rest = Image.open(SPRITE).convert('RGBA')
    inhale = breathe_in(rest)
    frames = [rest, inhale, blink(rest, 0), blink(inhale, 1)]
    sheet = Image.new('RGBA', (rest.width * len(frames), rest.height))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * rest.width, 0))
    sheet.save(OUT, optimize=True)
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
