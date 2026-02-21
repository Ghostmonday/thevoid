#!/usr/bin/env python3
"""
Luxury Fortress Dashboard Assets Generator
Creates pixel-perfect SVG and PNG assets following Obsidian Sanctum design philosophy
"""

import os
from PIL import Image, ImageDraw
import math

# Configuration
OUTPUT_DIR = "/home/amir/Documents/projects/Mini-Agent/assets"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Color Palette (Obsidian Sanctum)
COLORS = {
    "obsidian": (10, 10, 11),
    "onyx": (20, 20, 21),
    "charcoal": (28, 28, 28),
    "champagne": (212, 175, 55),
    "champagne_light": (240, 220, 140),
    "rose_bronze": (183, 110, 121),
    "platinum": (229, 228, 226),
    "platinum_dim": (100, 100, 100),
    "ivory": (245, 243, 235),
    "white": (255, 255, 255),
}


def hex_to_rgb(hex_color):
    """Convert hex to RGB tuple"""
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))


# Premium hex colors
CHAMPAGNE = hex_to_rgb("#d4af37")
CHAMPAGNE_LIGHT = hex_to_rgb("#f0dc8c")
ROSE_BRONZE = hex_to_rgb("#b76e79")
PLATINUM = hex_to_rgb("#e5e4e2")
OBSIDIAN = hex_to_rgb("#0a0a0b")
ONYX = hex_to_rgb("#141414")
CHARCOAL = hex_to_rgb("#1c1c1c")
IVORY = hex_to_rgb("#f5f3eb")


def create_gradient_background(
    width, height, color1=OBSIDIAN, color2=ONYX, vertical=True
):
    """Create a premium gradient background"""
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)

    for y in range(height):
        ratio = y / height
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    return img


def create_noise_texture(width, height, opacity=15):
    """Add subtle noise texture for premium feel"""
    img = Image.new("RGBA", (width, height))
    pixels = img.load()

    import random

    for y in range(height):
        for x in range(width):
            if random.random() < 0.3:
                noise = random.randint(-opacity, opacity)
                pixels[x, y] = (noise, noise, noise, 30)

    return img


def draw_diamond_logo(draw, cx, cy, size, color, stroke_width=2):
    """Draw a geometric diamond logo element"""
    # Outer diamond
    points = [
        (cx, cy - size),
        (cx + size, cy),
        (cx, cy + size),
        (cx - size, cy),
    ]
    draw.polygon(points, outline=color, width=stroke_width)

    # Inner diamond
    inner_size = size * 0.6
    inner_points = [
        (cx, cy - inner_size),
        (cx + inner_size, cy),
        (cx, cy + inner_size),
        (cx - inner_size, cy),
    ]
    draw.polygon(inner_points, fill=None, outline=color, width=1)

    # Center dot
    draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=color)


def draw_hexagon(draw, cx, cy, size, color, stroke_width=1, filled=False):
    """Draw a hexagon element"""
    points = []
    for i in range(6):
        angle = math.pi / 3 * i - math.pi / 6
        x = cx + size * math.cos(angle)
        y = cy + size * math.sin(angle)
        points.append((x, y))

    if filled:
        draw.polygon(points, fill=color)
    else:
        draw.polygon(points, outline=color, width=stroke_width)


def create_logo_png():
    """Create the main logo in PNG format"""
    size = 256
    img = create_gradient_background(size, size)
    img = img.convert("RGBA")

    # Add subtle noise
    noise = create_noise_texture(size, size, opacity=8)
    img = Image.alpha_composite(img, noise)

    draw = ImageDraw.Draw(img)

    # Main diamond (larger)
    draw_diamond_logo(draw, size // 2, size // 2, 80, CHAMPAGNE, stroke_width=3)

    # Accent diamonds on corners
    draw_diamond_logo(draw, 45, 45, 20, CHAMPAGNE_LIGHT, stroke_width=1)
    draw_diamond_logo(draw, size - 45, 45, 20, ROSE_BRONZE, stroke_width=1)
    draw_diamond_logo(draw, 45, size - 45, 20, PLATINUM, stroke_width=1)
    draw_diamond_logo(draw, size - 45, size - 45, 20, CHAMPAGNE, stroke_width=1)

    # Connecting lines
    draw.line([(45, 45), (size // 2, size // 2)], fill=(*CHAMPAGNE, 50), width=1)
    draw.line([(size - 45, 45), (size // 2, size // 2)], fill=(*CHAMPAGNE, 50), width=1)
    draw.line([(45, size - 45), (size // 2, size // 2)], fill=(*CHAMPAGNE, 50), width=1)
    draw.line(
        [(size - 45, size - 45), (size // 2, size // 2)], fill=(*CHAMPAGNE, 50), width=1
    )

    img.save(f"{OUTPUT_DIR}/logo-main.png")
    print(f"Created: {OUTPUT_DIR}/logo-main.png")
    return img


def create_logo_with_text_png():
    """Create logo with brand name text"""
    width, height = 512, 128
    img = create_gradient_background(width, height)
    img = img.convert("RGBA")

    draw = ImageDraw.Draw(img)

    # Draw diamond logo on left
    draw_diamond_logo(draw, 64, height // 2, 40, CHAMPAGNE, stroke_width=2)

    # Draw smaller accent diamonds
    draw_diamond_logo(draw, 24, height // 2 - 30, 12, CHAMPAGNE_LIGHT, stroke_width=1)
    draw_diamond_logo(draw, 24, height // 2 + 30, 12, ROSE_BRONZE, stroke_width=1)

    # Note: PIL doesn't support advanced text rendering
    # For production, use Cairo or reportlab

    img.save(f"{OUTPUT_DIR}/logo-with-text.png")
    print(f"Created: {OUTPUT_DIR}/logo-with-text.png")


def create_icon_set():
    """Create a set of UI icons"""
    icon_size = 64
    icons = ["diamond", "shield", "crown", "star", "hexagon"]

    for icon_name in icons:
        img = Image.new("RGBA", (icon_size, icon_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        cx, cy = icon_size // 2, icon_size // 2

        if icon_name == "diamond":
            draw_diamond_logo(draw, cx, cy, 24, CHAMPAGNE, stroke_width=2)
        elif icon_name == "shield":
            # Shield shape
            points = [
                (cx - 20, cy - 24),
                (cx + 20, cy - 24),
                (cx + 20, cy),
                (cx, cy + 24),
                (cx - 20, cy),
            ]
            draw.polygon(points, outline=CHAMPAGNE, width=2)
        elif icon_name == "crown":
            # Crown/castle top
            points = [
                (cx - 20, cy + 20),
                (cx - 20, cy - 10),
                (cx - 10, cy - 10),
                (cx - 10, cy - 20),
                (cx, cy - 5),
                (cx + 10, cy - 20),
                (cx + 10, cy - 10),
                (cx + 20, cy - 10),
                (cx + 20, cy + 20),
            ]
            draw.polygon(points, outline=CHAMPAGNE, width=2)
        elif icon_name == "star":
            # 5-pointed star
            points = []
            for i in range(5):
                angle = math.pi * 2 * i / 5 - math.pi / 2
                x = cx + 22 * math.cos(angle)
                y = cy + 22 * math.sin(angle)
                points.append((x, y))
            draw.polygon(points, outline=CHAMPAGNE, width=2)
        elif icon_name == "hexagon":
            draw_hexagon(draw, cx, cy, 24, CHAMPAGNE, stroke_width=2)

        img.save(f"{OUTPUT_DIR}/icon-{icon_name}.png")
        print(f"Created: {OUTPUT_DIR}/icon-{icon_name}.png")


def create_pattern_tile():
    """Create a premium background pattern tile"""
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Subtle grid with gold intersections
    for i in range(0, size, 16):
        draw.line([(i, 0), (i, size)], fill=(40, 40, 42, 30), width=1)
        draw.line([(0, i), (size, i)], fill=(40, 40, 42, 30), width=1)

    # Gold dots at intersections
    for x in range(0, size, 16):
        for y in range(0, size, 16):
            draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=(*CHAMPAGNE, 40))

    # Diamond accents at some intersections
    for x in range(8, size, 32):
        for y in range(8, size, 32):
            draw_diamond_logo(draw, x, y, 4, (*CHAMPAGNE, 60), stroke_width=1)

    img.save(f"{OUTPUT_DIR}/pattern-tile.png")
    print(f"Created: {OUTPUT_DIR}/pattern-tile.png")


def create_stat_card_preview():
    """Create a sample stat card with the luxury aesthetic"""
    width, height = 280, 160
    img = create_gradient_background(width, height)

    draw = ImageDraw.Draw(img)

    # Top accent line (champagne gold)
    draw.line([(0, 0), (width, 0)], fill=CHAMPAGNE, width=2)

    # Subtle border
    draw.rectangle([0, 0, width - 1, height - 1], outline=(*CHARCOAL, 100), width=1)

    # Corner accents
    corner_size = 8
    # Top-left
    draw.line([(0, corner_size), (0, 0), (corner_size, 0)], fill=CHAMPAGNE, width=1)
    # Top-right
    draw.line(
        [(width - corner_size, 0), (width, 0), (width, corner_size)],
        fill=CHAMPAGNE,
        width=1,
    )
    # Bottom-left
    draw.line(
        [(0, height - corner_size), (0, height), (corner_size, height)],
        fill=CHAMPAGNE,
        width=1,
    )
    # Bottom-right
    draw.line(
        [(width - corner_size, height), (width, height), (width, height - corner_size)],
        fill=CHAMPAGNE,
        width=1,
    )

    img.save(f"{OUTPUT_DIR}/stat-card-preview.png")
    print(f"Created: {OUTPUT_DIR}/stat-card-preview.png")


def create_leaderboard_item():
    """Create a sample leaderboard item"""
    width, height = 400, 72
    img = create_gradient_background(width, height)

    draw = ImageDraw.Draw(img)

    # Rank number (platinum)
    # Divider line
    draw.line([(50, 0), (50, height)], fill=(*CHARCOAL, 80), width=1)
    draw.line([(0, height - 1), (width, height - 1)], fill=(*CHARCOAL, 80), width=1)

    # Hover highlight area would go here

    img.save(f"{OUTPUT_DIR}/leaderboard-item.png")
    print(f"Created: {OUTPUT_DIR}/leaderboard-item.png")


def create_svg_assets():
    """Create SVG versions for scalability"""
    svg_content = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="obsidianGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#141414"/>
      <stop offset="100%" style="stop-color:#0a0a0b"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f0dc8c"/>
      <stop offset="50%" style="stop-color:#d4af37"/>
      <stop offset="100%" style="stop-color:#b8962e"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="512" height="512" fill="url(#obsidianGrad)"/>
  
  <!-- Main Diamond Logo -->
  <g transform="translate(256, 256)" filter="url(#glow)">
    <polygon points="0,-120 120,0 0,120 -120,0" 
             fill="none" stroke="url(#goldGrad)" stroke-width="4"/>
    <polygon points="0,-72 72,0 0,72 -72,0" 
             fill="none" stroke="url(#goldGrad)" stroke-width="2"/>
    <circle cx="0" cy="0" r="8" fill="#d4af37"/>
  </g>
  
  <!-- Corner Accent Diamonds -->
  <g filter="url(#glow)">
    <polygon points="80,80 100,100 80,120 60,100" fill="none" stroke="#f0dc8c" stroke-width="1.5"/>
    <polygon points="432,80 452,100 432,120 412,100" fill="none" stroke="#b76e79" stroke-width="1.5"/>
    <polygon points="80,432 100,412 80,392 60,412" fill="none" stroke="#e5e4e2" stroke-width="1.5"/>
    <polygon points="432,432 452,412 432,392 412,412" fill="none" stroke="#d4af37" stroke-width="1.5"/>
  </g>
  
  <!-- Connecting Lines -->
  <line x1="80" y1="80" x2="256" y2="256" stroke="#d4af37" stroke-width="0.5" opacity="0.3"/>
  <line x1="432" y1="80" x2="256" y2="256" stroke="#d4af37" stroke-width="0.5" opacity="0.3"/>
  <line x1="80" y1="432" x2="256" y2="256" stroke="#d4af37" stroke-width="0.5" opacity="0.3"/>
  <line x1="432" y1="432" x2="256" y2="256" stroke="#d4af37" stroke-width="0.5" opacity="0.3"/>
</svg>"""

    with open(f"{OUTPUT_DIR}/logo-main.svg", "w") as f:
        f.write(svg_content)
    print(f"Created: {OUTPUT_DIR}/logo-main.svg")


def create_all_assets():
    """Generate all assets"""
    print("🎨 Generating Luxury Fortress Dashboard Assets...")
    print("=" * 50)

    create_logo_png()
    create_logo_with_text_png()
    create_icon_set()
    create_pattern_tile()
    create_stat_card_preview()
    create_leaderboard_item()
    create_svg_assets()

    print("=" * 50)
    print("✅ All assets generated successfully!")
    print(f"📁 Output directory: {OUTPUT_DIR}")


if __name__ == "__main__":
    create_all_assets()
