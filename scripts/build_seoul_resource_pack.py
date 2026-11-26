#!/usr/bin/env python3
"""Build and verify deterministic original Arnis Seoul resource packs; stdlib only."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import zipfile
import zlib

SLOTS = (
    ("light_blue_stained_glass", "547B99", 78, "glass2"),
    ("light_gray_stained_glass", "B1C1CB", 65, "glass2"),
    ("gray_stained_glass", "667580", 92, "glass1"),
    ("black_stained_glass", "343B43", 110, "glass1"),
    ("yellow_stained_glass", "BB9251", 90, "gold"),
    ("red_concrete", "B51E2C", 255, "metal"),
    ("light_gray_concrete", "AEB8C1", 255, "metal"),
    ("white_concrete", "E2E5E5", 255, "metal"),
    ("gray_concrete", "505A62", 255, "panel"),
    ("polished_blackstone", "292C30", 255, "stone"),
    ("brown_concrete", "796044", 255, "metal"),
)
BOUTIQUE_SLOTS = (
    ("dark_prismarine", "267757", 255, "ceramic"),
    ("gold_block", "B99B58", 255, "brushed"),
    ("quartz_block_bottom", "E7E1D5", 255, "stone"),
    ("black_concrete", "222528", 255, "panel"),
)
SIGNATURE = b"\x89PNG\r\n\x1a\n"


def pixel(slot, x, y, n):
    name, hex_rgb, alpha, style = slot
    rgb = tuple(bytes.fromhex(hex_rgb))
    if style.startswith("glass") or style == "gold":
        seam = x == 0 or (style == "glass2" and x == n // 2) or (style == "gold" and y == 0)
        if seam:
            if style == "gold":
                return (108, 81, 53, 205)
            return (*[round(v * .72 + 255 * .28) for v in rgb], 195)
        return (*rgb, alpha)
    h = ((x + 1) * 73856093 ^ (y + 1) * 19349663 ^ len(name) * 83492791) & 0xffffffff
    delta = h % 9 - 4 if style == "stone" else h % 5 - 2
    if style == "panel" and x == 0:
        delta = -4
    if style == "ceramic":
        delta = -13 if x % (n//4) == 0 or y % (n//4) == 0 else h % 9 - 4
    if style == "brushed":
        delta = ((y * 13 + len(name)) % 9) - 4
    return (*[max(0, min(255, v + delta)) for v in rgb], 255)


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def png(slot, n):
    raw = b"".join(b"\0" + bytes(v for x in range(n) for v in pixel(slot, x, y, n))
                   for y in range(n))
    return (SIGNATURE + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def verify_png(data, slot, n):
    assert data.startswith(SIGNATURE)
    p, raw, ended = 8, b"", False
    while p < len(data):
        size = struct.unpack_from(">I", data, p)[0]
        kind, payload = data[p+4:p+8], data[p+8:p+8+size]
        assert zlib.crc32(kind + payload) == struct.unpack_from(">I", data, p+8+size)[0]
        if kind == b"IHDR":
            assert struct.unpack(">IIBBBBB", payload) == (n, n, 8, 6, 0, 0, 0)
        elif kind == b"IDAT":
            raw += payload
        elif kind == b"IEND":
            ended = True
        p += size + 12
    assert ended and p == len(data)
    scan = zlib.decompress(raw)
    assert len(scan) == n * (n*4+1)
    for y in range(n):
        row = scan[y*(n*4+1):(y+1)*(n*4+1)]
        assert row[0] == 0
        for x in range(n):
            assert tuple(row[1+x*4:5+x*4]) == pixel(slot, x, y, n)
    assert tuple(scan[(n//3)*(n*4+1)+1+4*(n//3):(n//3)*(n*4+1)+5+4*(n//3)])[-1] == slot[2]


def build(out, n, slots=SLOTS, variant="core"):
    meta = {"pack": {"pack_format": 34, "description": f"Arnis Seoul {variant.title()} {n}px (Java 1.21–1.21.1)"}}
    files = {"pack.mcmeta": (json.dumps(meta, ensure_ascii=False, indent=2)+"\n").encode()}
    for slot in slots:
        data = png(slot, n)
        verify_png(data, slot, n)
        files[f"assets/minecraft/textures/block/{slot[0]}.png"] = data
    path = out / f"arnis-seoul-{variant}-{n}px.zip"
    with zipfile.ZipFile(path, "w") as z:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, (1980,1,1,0,0,0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        assert set(z.namelist()) == set(files)
        assert json.loads(z.read("pack.mcmeta"))["pack"]["pack_format"] == 34
        for slot in slots:
            verify_png(z.read(f"assets/minecraft/textures/block/{slot[0]}.png"), slot, n)
    return path


def main():
    out = Path(sys.argv[1] if len(sys.argv)>1 else "dist")
    out.mkdir(parents=True, exist_ok=True)
    paths = [build(out, n) for n in (16,32)] + [build(out, n, BOUTIQUE_SLOTS, "boutique") for n in (16,32)]
    (out/"SHA256SUMS.txt").write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in paths), encoding="ascii")
    print(f"Verified {2*(len(SLOTS)+len(BOUTIQUE_SLOTS))} RGBA PNG textures and 4 resource packs.")


if __name__ == "__main__":
    main()
