#!/usr/bin/env python3
"""
Ekspor konektom otak UTUH FlyWire v783 (versi model Shiu dkk. 2024,
Connectivity_783.parquet + Completeness_783.csv) ke berkas biner CSR
sederhana, supaya simulator LIF JavaScript (js/lif-brain.js) bisa
dijalankan di Node untuk uji coba di server.

Keluaran (.flywire-cache/brain783/, tidak di-commit - besar ~100 MB):
  ids.txt       root_id per indeks neuron (urutan = Completeness_783.csv)
  offsets.i32   CSR: sinaps keluar neuron i ada di [offsets[i], offsets[i+1])
  post.i32      indeks neuron pascasinaps
  w.i16         bobot bertanda = jumlah sinaps x (+1 rangsang / -1 hambat)
  annot.json    anotasi ringkas per indeks (tipe sel, sisi, kelas, posisi 3D)

Posisi 3D (chassisX/Y/Z di annot.json) memakai TRANSFORMASI YANG SAMA PERSIS
dengan tools/fetch_flywire_skeletons.py (baca data/neuropil.json), supaya
neuron duduk pas di mesh neuropil yang sudah ada. soma_x/y/z & pos_x/y/z di
annot.tsv adalah koordinat voxel FlyWire baku 4x4x40 nm/voxel (dikalibrasi
empiris terhadap skeleton Zenodo, bukan diasumsikan - lihat catatan riset
28-09-2026); soma dipakai kalau ada, kalau tidak pos_* (representasi
sinaps) dipakai sebagai gantinya.

Sumber: https://github.com/philshiu/Drosophila_brain_model (salinan lokal
di /root/fly-brain-upstream). Tidak ada nilai acak di sini.
"""
import argparse
import json
import os

import numpy as np
import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('--upstream', default='/root/fly-brain-upstream')
ap.add_argument('--annot', default='.flywire-cache/annot.tsv')
ap.add_argument('--neuropil', default='data/neuropil.json',
                 help='sumber transform kiblat sasis (harus sudah dibangun tools/fetch_flywire.py)')
ap.add_argument('--out', default='.flywire-cache/brain783')
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)

CHASSIS_SCALE = 0.37
BRAIN_CENTER = np.array([0.0, 0.16, 2.62])
VOXEL_NM = np.array([4.0, 4.0, 40.0])   # kalibrasi empiris thd skeleton Zenodo, lihat docstring

comp = pd.read_csv(os.path.join(args.upstream, 'Completeness_783.csv'), index_col=0)
ids = [str(i) for i in comp.index]
n = len(ids)

con = pd.read_parquet(os.path.join(args.upstream, 'Connectivity_783.parquet'),
                      columns=['Presynaptic_Index', 'Postsynaptic_Index',
                               'Excitatory x Connectivity'])
pre = con['Presynaptic_Index'].to_numpy(np.int64)
post = con['Postsynaptic_Index'].to_numpy(np.int64)
w = con['Excitatory x Connectivity'].to_numpy(np.int64)
assert pre.max() < n and post.max() < n
assert np.abs(w).max() < 32768

order = np.argsort(pre, kind='stable')
pre, post, w = pre[order], post[order], w[order]
offsets = np.zeros(n + 1, np.int32)
np.cumsum(np.bincount(pre, minlength=n), out=offsets[1:])

post.astype(np.int32).tofile(os.path.join(args.out, 'post.i32'))
w.astype(np.int16).tofile(os.path.join(args.out, 'w.i16'))
offsets.tofile(os.path.join(args.out, 'offsets.i32'))
with open(os.path.join(args.out, 'ids.txt'), 'w') as fh:
    fh.write('\n'.join(ids))

a = pd.read_csv(args.annot, sep='\t', low_memory=False, dtype={'root_id': str})
a = a.set_index('root_id')
cols = ['super_class', 'cell_class', 'cell_sub_class', 'cell_type', 'side', 'top_nt',
        'known_nt']
# posisi (voxel FlyWire 4 x 4 x 40 nm): soma bila ada, kalau tidak titik
# wakil neuron (pos_*) - untuk visualisasi otak 3D (tools/build_brain_subnet.cjs)
num_cols = ['soma_x', 'soma_y', 'soma_z', 'pos_x', 'pos_y', 'pos_z']
ann = {}
for c in cols:
    s = a[c].reindex(ids)
    ann[c] = [None if pd.isna(v) else str(v) for v in s]
for c in num_cols:
    s = pd.to_numeric(a[c], errors='coerce').reindex(ids)
    ann[c] = [None if pd.isna(v) else int(v) for v in s]

# ---------- posisi 3D dalam satuan sasis fly.js (untuk visualisasi otak) ----------
if os.path.exists(args.neuropil):
    with open(args.neuropil, encoding='utf-8') as fh:
        tr = json.load(fh)['transform']
    spec = [t.strip() for t in tr['axes'].split(',')]
    ax_i = ['xyz'.index(t[-1]) for t in spec]
    ax_s = np.array([-1.0 if t.startswith('-') else 1.0 for t in spec])
    unit = tr['unitScale']
    center = np.array(tr['centerMm'], dtype=np.float64)
    fit = tr.get('fit', 1.0)

    soma = a[['soma_x', 'soma_y', 'soma_z']].apply(pd.to_numeric, errors='coerce')
    posv = a[['pos_x', 'pos_y', 'pos_z']].apply(pd.to_numeric, errors='coerce')
    use = soma.to_numpy(dtype=np.float64)
    fallback = posv.to_numpy(dtype=np.float64)
    use = np.where(np.isnan(use), fallback, use)          # soma bila ada, else pos_*
    nm = use * VOXEL_NM                                    # voxel -> nanometer
    remapped = nm[:, ax_i] * ax_s                           # sumbu FlyWire -> sumbu sasis
    mm = remapped * unit
    chassis = (mm - center) * fit / CHASSIS_SCALE + BRAIN_CENTER
    chassis = pd.DataFrame(chassis, index=a.index, columns=['cx', 'cy', 'cz']).reindex(ids)
    valid = chassis.notna().all(axis=1)
    for i, c in enumerate(['chassisX', 'chassisY', 'chassisZ']):
        col = chassis.iloc[:, i]
        ann[c] = [round(float(v), 5) if ok else None for v, ok in zip(col, valid)]
    print('posisi 3D   :', int(valid.sum()), 'neuron (transform dari', args.neuropil + ')')
else:
    print('posisi 3D   : dilewati (', args.neuropil, 'tidak ada - jalankan tools/fetch_flywire.py dulu)')

with open(os.path.join(args.out, 'annot.json'), 'w') as fh:
    json.dump(ann, fh)

print('neuron', n, 'sinaps(baris)', len(post), '->', args.out)
