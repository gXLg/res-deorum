from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def draw_labels(
    image_path,
    left_labels,
    right_labels,
    font_path=None,
):
    """
    Parameters
    ----------
    image_path : str
        Input image filename.

    left_labels : list[(str, str)]
        [(text, color), ...]

    right_labels : list[(str, str)]
        [(text, color), ...]

    font_path : str | None
        Optional TTF font path.
    """

    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    w, h = img.size

    # Scale everything from image width
    font_size = 130 #max(24, int(w * 0.03))
    outer_padding = int(w * 0.02)
    inner_padding_x = int(font_size * 0.5)
    inner_padding_y = int(font_size * 0.25)
    line_spacing = int(font_size * 0.4)
    radius = int(font_size * 0.4)

    if font_path:
        font = ImageFont.truetype(font_path, font_size)
    else:
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            font = ImageFont.load_default(font_size)

    def draw_column(labels, align="left"):
        y = outer_padding

        for text, color in labels:
            bbox = draw.textbbox((0, 0), text, font=font)

            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]

            rect_w = text_w + inner_padding_x * 2
            rect_h = text_h + inner_padding_y * 2

            if align == "left":
                x = outer_padding
            else:
                x = w - outer_padding - rect_w

            draw.rounded_rectangle(
                [x, y, x + rect_w, y + rect_h],
                radius=radius,
                fill="black"
            )

            draw.text(
                (
                    x + inner_padding_x,
                    y + inner_padding_y - bbox[1]
                ),
                text,
                fill=color,
                font=font,
                stroke_width=2,
                stroke_fill=color
            )

            y += rect_h + line_spacing

    draw_column(left_labels, "left")
    draw_column(right_labels, "right")

    output_dir = Path(image_path).parent / "labeled"
    output_dir.mkdir(exist_ok=True)

    output_path = output_dir / Path(image_path).name
    img.save(output_path)

    return str(output_path)

life = "#30d97c"
poison = "#c041cc"

colors = {
  "ignis": "#ff0000",
  "aer": "#ffffff",
  "terra": "#7a5c45",
  "aqua": "#3993bd"
}

beat = {
  "ignis": "aer",
  "aer": "terra",
  "terra": "aqua",
  "aqua": "ignis"
}

strong = {
  "ignis": "fulgur",
  "aer": "tempestas",
  "terra": "tremor",
  "aqua": "vapor"
}

long = {
  "ignis": "phoenix",
  "aer": "mediocris",
  "terra": "colossus",
  "aqua": "syrena"
}

stronger = {
  "ignis": "aer",
  "aer": "terra",
  "terra": "ignis",
  "aqua": "ignis"
}

bonus = {
  "terra": ["aqua"],
  "aqua": ["terra", "aer"],
  "aer": ["aqua"]
}

_normal = 1
_strong = 2
_long = 3

def draw_element(element, typ=_normal):
  attack = [e for e in beat if beat[e] == element][0]
  defend = beat[element]
  if typ == _normal:
    l = "1"
    s = "2"
    card = element
  elif typ == _strong:
    l = "1"
    s = "8"
    card = strong[element]
  elif typ == _long:
    l = "3"
    s = "3"
    card = long[element]

  special = []
  if card in stronger:
    special.append(("+", colors[stronger[element]]))
  for b in bonus.get(card, []):
    special.append(("!", colors[b]))

  draw_labels(
    card + ".jpg",
    [
      (s + " x" + l, colors[element]),
      ("ATK", colors[attack]),
      ("DEF", colors[defend])
    ],
    special
  )

if __name__ == "__main__":
  for e in beat:
    draw_element(e, typ=_normal)
    draw_element(e, typ=_strong)
    draw_element(e, typ=_long)

  draw_labels("vita.jpg", [("+3", life), ("-1", poison)], [])
  draw_labels("lumen.jpg", [("+9", life), ("-4", poison)], [])

  draw_labels("nebula.jpg", [], [("??? x2", life), ("-DEF x1", poison)])
  draw_labels("lutum.jpg", [], [("NORMAL x1", life), ("-TABULA x2", poison)])
