#!/usr/bin/env python3
"""Rasterize PWA icons from the SVG sources (no extra npm dependency)."""

from __future__ import annotations

import math
import re
import struct
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "public" / "icons"
PUBLIC = ROOT / "public"

SSAA = 4


def parse_color(value: str) -> tuple[int, int, int, int]:
    value = value.strip()
    if value.startswith("#") and len(value) == 7:
        r = int(value[1:3], 16)
        g = int(value[3:5], 16)
        b = int(value[5:7], 16)
        return (r, g, b, 255)
    raise ValueError(f"Unsupported color: {value}")


def parse_transform(value: str | None) -> tuple[float, float, float]:
    """Return (scale, tx, ty) for translate/scale/translate(-cx -cy) groups."""
    if not value:
        return (1.0, 0.0, 0.0)
    translates = re.findall(
        r"translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)", value
    )
    scales = re.findall(r"scale\(\s*([-\d.]+)\s*\)", value)
    scale = float(scales[0]) if scales else 1.0
    tx = ty = 0.0
    if len(translates) >= 1:
        tx += float(translates[0][0])
        ty += float(translates[0][1])
    if len(translates) >= 2:
        tx += float(translates[1][0]) * scale
        ty += float(translates[1][1]) * scale
    return (scale, tx, ty)


def parse_path(d: str) -> list[tuple[float, float]]:
    tokens = re.findall(r"[MmLlHhVv]|-?\d*\.?\d+", d)
    points: list[tuple[float, float]] = []
    i = 0
    cmd = "M"
    cx = cy = 0.0

    def take_number() -> float:
        nonlocal i
        value = float(tokens[i])
        i += 1
        return value

    while i < len(tokens):
        token = tokens[i]
        if re.fullmatch(r"[MmLlHhVv]", token):
            cmd = token
            i += 1
            continue
        if cmd == "M":
            cx, cy = take_number(), take_number()
            points.append((cx, cy))
            cmd = "L"
        elif cmd == "m":
            cx += take_number()
            cy += take_number()
            points.append((cx, cy))
            cmd = "l"
        elif cmd == "L":
            cx, cy = take_number(), take_number()
            points.append((cx, cy))
        elif cmd == "l":
            cx += take_number()
            cy += take_number()
            points.append((cx, cy))
        elif cmd == "H":
            cx = take_number()
            points.append((cx, cy))
        elif cmd == "h":
            cx += take_number()
            points.append((cx, cy))
        elif cmd == "V":
            cy = take_number()
            points.append((cx, cy))
        elif cmd == "v":
            cy += take_number()
            points.append((cx, cy))
        else:
            raise ValueError(f"Unsupported path command: {cmd}")
    return points


def dist_to_segment(
    px: float, py: float, ax: float, ay: float, bx: float, by: float
) -> float:
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    if length2 == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / length2
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def sd_rounded_rect(
    px: float, py: float, width: float, height: float, radius: float
) -> float:
    qx = abs(px - width / 2) - (width / 2 - radius)
    qy = abs(py - height / 2) - (height / 2 - radius)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - radius


def load_icon(path: Path) -> dict[str, object]:
    tree = ET.parse(path)
    root = tree.getroot()
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0][1:]

    def tag(name: str) -> str:
        return f"{{{ns}}}{name}" if ns else name

    rect = root.find(tag("rect"))
    if rect is None:
        raise ValueError(f"Missing rect in {path}")
    rx = float(rect.get("rx") or 0)
    fill = parse_color(rect.get("fill") or "#000000")

    group = root.find(tag("g"))
    scale, tx, ty = parse_transform(group.get("transform") if group is not None else None)
    path_el = (group if group is not None else root).find(tag("path"))
    if path_el is None:
        path_el = root.find(f".//{tag('path')}")
    if path_el is None:
        raise ValueError(f"Missing path in {path}")

    points = parse_path(path_el.get("d") or "")
    stroke = parse_color(path_el.get("stroke") or "#000000")
    stroke_width = float(path_el.get("stroke-width") or 8) * scale
    transformed = [(x * scale + tx, y * scale + ty) for x, y in points]
    return {
        "fill": fill,
        "rx": rx,
        "stroke": stroke,
        "stroke_width": stroke_width,
        "points": transformed,
    }


def sample(
    spec: dict[str, object], px: float, py: float, size: int
) -> tuple[int, int, int, int]:
    view = 128.0
    scale = size / view
    x = px / scale
    y = py / scale
    rx = float(spec["rx"])
    fill = spec["fill"]
    stroke = spec["stroke"]
    points = spec["points"]
    half = float(spec["stroke_width"]) / 2

    if rx > 0:
        inside_bg = sd_rounded_rect(x, y, view, view, rx) <= 0
    else:
        inside_bg = 0 <= x < view and 0 <= y < view

    dist = min(
        dist_to_segment(x, y, ax, ay, bx, by)
        for (ax, ay), (bx, by) in zip(points, points[1:])
    )
    inside_stroke = dist <= half

    if inside_stroke:
        return stroke  # type: ignore[return-value]
    if inside_bg:
        return fill  # type: ignore[return-value]
    return (0, 0, 0, 0)


def blend(
    acc: list[int], color: tuple[int, int, int, int]
) -> None:
    acc[0] += color[0] * color[3]
    acc[1] += color[1] * color[3]
    acc[2] += color[2] * color[3]
    acc[3] += color[3]


def rasterize(spec: dict[str, object], size: int) -> bytes:
    samples = SSAA
    hi = size * samples
    pixels = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0, 0]
            for oy in range(samples):
                for ox in range(samples):
                    px = x * samples + ox + 0.5
                    py = y * samples + oy + 0.5
                    # Map high-res sample space back to output pixels.
                    blend(acc, sample(spec, px * size / hi, py * size / hi, size))
            count = samples * samples
            a = acc[3] // count
            if a == 0:
                rgba = (0, 0, 0, 0)
            else:
                rgba = (acc[0] // acc[3], acc[1] // acc[3], acc[2] // acc[3], a)
            idx = (y * size + x) * 4
            pixels[idx : idx + 4] = bytes(rgba)
    return bytes(pixels)


def write_png(path: Path, width: int, height: int, rgba: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = b"".join(
        b"\x00" + rgba[i * width * 4 : (i + 1) * width * 4] for i in range(height)
    )
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def write_ico(path: Path, pngs: list[tuple[int, bytes]]) -> None:
    count = len(pngs)
    offset = 6 + 16 * count
    entries = b""
    payload = b""
    for size, data in pngs:
        entries += struct.pack(
            "<BBBBHHII",
            size if size < 256 else 0,
            size if size < 256 else 0,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
        payload += data
        offset += len(data)
    path.write_bytes(struct.pack("<HHH", 0, 1, count) + entries + payload)


def main() -> None:
    any_spec = load_icon(ICONS / "icon.svg")
    maskable_spec = load_icon(ICONS / "icon-maskable.svg")

    outputs = [
        (ICONS / "icon-192.png", any_spec, 192),
        (ICONS / "icon-512.png", any_spec, 512),
        (ICONS / "favicon-32.png", any_spec, 32),
        (ICONS / "icon-maskable-192.png", maskable_spec, 192),
        (ICONS / "icon-maskable-512.png", maskable_spec, 512),
        (PUBLIC / "apple-touch-icon.png", maskable_spec, 180),
    ]

    png_by_size: dict[int, bytes] = {}
    for path, spec, size in outputs:
        print(f"Rasterizing {path.name} ({size}x{size})")
        rgba = rasterize(spec, size)
        write_png(path, size, size, rgba)
        png_by_size[size] = path.read_bytes()

    favicon_16 = rasterize(any_spec, 16)
    favicon_16_path = ICONS / "favicon-16.png"
    write_png(favicon_16_path, 16, 16, favicon_16)
    write_ico(
        PUBLIC / "favicon.ico",
        [
            (16, favicon_16_path.read_bytes()),
            (32, png_by_size[32]),
        ],
    )
    print("Wrote", PUBLIC / "favicon.ico")


if __name__ == "__main__":
    main()
