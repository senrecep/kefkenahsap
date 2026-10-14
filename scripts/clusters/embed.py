#!/usr/bin/env python3
"""#33: open_clip image embeddings (CPU) + EXIF DateTimeOriginal for the 568 launch photos.

Writes seed/clusters/embeddings.json: {model, photos: [{folder, file, exif, v}]}, v = L2-normalised, 4 decimals.
Run in a throwaway venv outside the repo (see docs/clusters/REPORT.md):
  uv venv /tmp/clipvenv && uv pip install --python /tmp/clipvenv open_clip_torch pillow numpy torch \
    --extra-index-url https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match
  /tmp/clipvenv/bin/python scripts/clusters/embed.py [DATA_DIR]
"""
import json
import sys
from pathlib import Path

import open_clip
import torch
from PIL import Image

MODEL, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"
ROOT = Path(__file__).resolve().parents[2]
DATA = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "../../kefken-data/Webiste"
OUT = ROOT / "seed/clusters/embeddings.json"


def exif_date(img):
    # DateTimeOriginal (0x9003): these webp exports carry it in IFD0, not the Exif sub-IFD, and the time is
    # zeroed (00:00:00), so only the day is kept.
    exif = img.getexif()
    raw = exif.get(0x9003) or exif.get_ifd(0x8769).get(0x9003)
    if not raw or not raw[:4].isdigit() or raw.startswith("0000"):
        return None
    return raw[:10].replace(":", "-")


def main():
    model, _, preprocess = open_clip.create_model_and_transforms(MODEL, pretrained=PRETRAINED)
    model.eval()
    files = sorted(p for p in DATA.glob("*/*") if p.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"})
    photos = []
    with torch.no_grad():
        for i, p in enumerate(files):
            img = Image.open(p)
            date = exif_date(img)
            f = model.encode_image(preprocess(img.convert("RGB")).unsqueeze(0))[0]
            f = f / f.norm()
            photos.append({"folder": p.parent.name, "file": p.name, "exif": date, "v": [round(x, 4) for x in f.tolist()]})
            if (i + 1) % 50 == 0:
                print(f"{i + 1}/{len(files)}", flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"model": f"{MODEL}/{PRETRAINED}", "photos": photos}, separators=(",", ":")) + "\n")
    print(f"{len(photos)} photos, {sum(1 for x in photos if x['exif'])} with EXIF date -> {OUT}")


if __name__ == "__main__":
    main()
