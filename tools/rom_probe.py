#!/usr/bin/env python3
"""Metadata-only probe for the legally supplied GBA research image."""
from __future__ import annotations
import argparse, hashlib, struct, zlib
from pathlib import Path

def field(data: bytes, a: int, b: int) -> str:
    return data[a:b].decode("ascii", "replace").rstrip("\0 ")

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("rom", nargs="?", default="WarioWare, Inc. - Mega Microgame$!.gba")
    path = Path(parser.parse_args().rom)
    data = path.read_bytes()
    words = struct.iter_unpack("<I", data[: len(data) - len(data) % 4])
    pointers = sum(0x08000000 <= word[0] < 0x08000000 + len(data) for word in words)
    print(f"file: {path}")
    print(f"size: {len(data)} bytes ({len(data) / 1024 / 1024:.2f} MiB)")
    print(f"sha1: {hashlib.sha1(data).hexdigest()}")
    print(f"md5: {hashlib.md5(data).hexdigest()}")
    print(f"crc32: {zlib.crc32(data) & 0xffffffff:08X}")
    print(f"title: {field(data, 0xA0, 0xAC)}")
    print(f"game code: {field(data, 0xAC, 0xB0)}")
    print(f"maker: {field(data, 0xB0, 0xB2)}")
    print(f"version: {data[0xBC]}")
    print(f"header complement: {data[0xBD]:02X}")
    print(f"aligned ROM-looking pointers: {pointers}")

if __name__ == "__main__":
    main()
