# Klasifikasi warna map.png -> grid terrain (0 darat, 1 air, 2 hutan), disimpan sebagai js/terrain-data.js
import sys, base64, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
B = 8
pal = np.array([[240,240,235],[155,204,233],[117,170,96],[178,212,160]])  # krem, biru, ijo tua, ijo muda
cls = np.array([0,1,2,2], dtype=np.uint8)
pil = Image.open(src).convert('RGB')
W, H = pil.size
H2, W2 = H//B, W//B
g = np.zeros((H2, W2), np.uint8)
STRIP = 16                                   # baris sel per batch biar hemat memori
for r0 in range(0, H2, STRIP):
    r1 = min(H2, r0+STRIP)
    im = np.asarray(pil.crop((0, r0*B, W2*B, r1*B))).astype(np.int16)
    d = ((im[:,:,None,:]-pal[None,None,:,:])**2).sum(-1)
    t = cls[d.argmin(-1)]
    n = r1-r0
    blocks = t.reshape(n,B,W2,B).transpose(0,2,1,3).reshape(n,W2,B*B)
    cnt = np.stack([(blocks==k).sum(-1) for k in range(3)], -1)
    gg = cnt.argmax(-1).astype(np.uint8)
    gg[cnt[:,:,1] >= B*B*0.25] = 1           # sungai tipis tetap kebaca sebagai air
    g[r0:r1] = gg
print('grid', W2, H2, {k:round(float((g==k).mean())*100,1) for k in range(3)})
flat = g.ravel(); pad = (-len(flat)) % 4
flat = np.concatenate([flat, np.zeros(pad, np.uint8)]).reshape(-1,4)
packed = (flat[:,0] | flat[:,1]<<2 | flat[:,2]<<4 | flat[:,3]<<6).astype(np.uint8)
open(out,'w').write(f"// AUTO-GENERATED oleh tools/gen_terrain.py dari map.png. Jangan diedit manual.\n"
  f"// 0 = darat (krem), 1 = air (biru), 2 = hutan (ijo). 2 bit per sel.\n"
  f"const TERRAIN_DATA = {{ cols: {W2}, rows: {H2}, data: '{base64.b64encode(packed.tobytes()).decode()}' }};\n")
