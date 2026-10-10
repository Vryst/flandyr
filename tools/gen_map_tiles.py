# Memecah map.png (9208 x 7424) jadi petak 2048 x 2048 di assets/images/map/tiles/ (nama: x_y.png).
# Kenapa: GPU HP sering tidak sanggup menampung 1 gambar sebesar itu (muncul garis-garis / sisa gambar lama).
# Jalankan ulang kalau map.png diganti:  python3 tools/gen_map_tiles.py
import os, json
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
root = os.path.join(os.path.dirname(__file__), '..')
src = os.path.join(root, 'assets/images/map/map.png')
out = os.path.join(root, 'assets/images/map/tiles')
S = 2048
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith('.png'): os.remove(os.path.join(out, f))
im = Image.open(src).convert('RGB')
W, H = im.size
cols, rows = -(-W // S), -(-H // S)
for ty in range(rows):
    for tx in range(cols):
        im.crop((tx * S, ty * S, min(W, (tx + 1) * S), min(H, (ty + 1) * S))).save(os.path.join(out, f'{tx}_{ty}.png'), optimize=True)
print(json.dumps({'dir': 'assets/images/map/tiles', 'size': S, 'cols': cols, 'rows': rows, 'width': W, 'height': H}))
