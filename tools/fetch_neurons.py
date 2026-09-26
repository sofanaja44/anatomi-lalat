#!/usr/bin/env python3
"""
fetch_neurons.py — ubah skeleton neuron (berkas SWC) menjadi data/neurons.json
yang siap dimuat js/neurons.js.

SWC adalah format baku untuk bentuk sel saraf: tiap baris satu titik, dengan
penunjuk ke titik induknya, sehingga seluruh percabangan terekam.

PENTING — KESELARASAN KOORDINAT
    Jalankan tools/fetch_flywire.py LEBIH DULU. Skrip itu menyimpan
    transformasi yang dipakainya ke dalam data/neuropil.json, dan skrip ini
    membacanya kembali supaya neuron duduk PAS di dalam neuropil.
    Kalau tidak ada, transformasi dihitung sendiri dari kotak pembatas
    neuron — hasilnya mungkin bergeser.

PEMAKAIAN
    pip install numpy
    python tools/fetch_neurons.py --from-dir ~/Unduhan/skeleton

    Bentuk folder yang dikenali:
      a) subfolder = satu berkas serabut (dianjurkan)
             skeleton/nrn-kenyon/*.swc
             skeleton/nrn-epg/*.swc
      b) berkas SWC langsung di dalam folder, dengan --bundle
             python tools/fetch_neurons.py --from-dir ~/swc --bundle nrn-kenyon

    node serve.js      # buka http://localhost:5173, centang "Sel saraf"
"""

import argparse
import json
import os
import sys

try:
    import numpy as np
except ImportError:
    sys.exit('Butuh dependensi: pip install numpy')


# ==========================================================
# KONFIGURASI — harus cocok dengan SPEC/BRAIN di js/fly.js
# ==========================================================
CHASSIS_SCALE = 0.37
BRAIN_CENTER = (0.0, 0.16, 2.62)

# id berkas -> label & warna gradasi (pangkal -> ujung).
# id harus sama dengan kunci di js/anatomy-data.js agar keterangannya muncul.
BUNDLES = {
    'nrn-fotoreseptor':  ('Akson fotoreseptor',        '#ff8a1f', '#00a8c6'),
    'nrn-khiasma-luar':  ('Khiasma luar',              '#00a8c6', '#1272c4'),
    'nrn-khiasma-dalam': ('Khiasma dalam',             '#1272c4', '#5e3aa8'),
    'nrn-pn-olfaktori':  ('Neuron proyeksi olfaktori', '#3fa83f', '#e08a1e'),
    'nrn-kenyon':        ('Sel Kenyon',                '#e08a1e', '#d1401c'),
    'nrn-epg':           ('Neuron kompas E-PG',        '#e03878', '#9a4fd0'),
    'nrn-desenden':      ('Neuron desenden',           '#d13a6b', '#7a5ae0'),
}


def read_swc(path):
    """Baca SWC -> (titik[n,3], induk[n]) dengan indeks yang sudah dipadatkan."""
    xyz, parent, idmap = [], [], {}
    with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            f = line.split()
            if len(f) < 7:
                continue
            nid, x, y, z, pid = int(f[0]), float(f[2]), float(f[3]), float(f[4]), int(f[6])
            idmap[nid] = len(xyz)
            xyz.append((x, y, z))
            parent.append(pid)
    if not xyz:
        return None, None
    par = [idmap.get(p, -1) for p in parent]
    return np.asarray(xyz, dtype=np.float64), par


def swc_branches(xyz, par, max_pts=64):
    """Pecah pohon SWC menjadi ruas-ruas lurus antar titik cabang / ujung."""
    n = len(par)
    children = [[] for _ in range(n)]
    roots = []
    for i, p in enumerate(par):
        if 0 <= p < n:
            children[p].append(i)
        else:
            roots.append(i)

    branches, stack = [], list(roots)
    while stack:
        start = stack.pop()
        path = [start]
        cur = start
        while True:
            kids = children[cur]
            if len(kids) == 1:
                cur = kids[0]
                path.append(cur)
            else:
                stack.extend(kids)          # titik cabang / ujung
                break
        if len(path) > 1:
            if len(path) > max_pts:         # rarefaksi agar ringan
                sel = np.linspace(0, len(path) - 1, max_pts).astype(int)
                path = [path[i] for i in sel]
            branches.append(xyz[path])
    return branches


def guess_unit_scale(extent_max):
    if extent_max > 1e5:
        return 1e-6, 'nanometer'
    if extent_max > 100:
        return 1e-3, 'mikrometer'
    if extent_max > 0.1:
        return 1.0, 'milimeter'
    return 1.0, 'tidak dikenali (dianggap milimeter)'


def axis_mapper(spec_str):
    spec = [t.strip() for t in spec_str.split(',')]
    if len(spec) != 3:
        sys.exit('--axes tidak valid: ' + spec_str)
    idx, sgn = [], []
    for t in spec:
        sgn.append(-1.0 if t.startswith('-') else 1.0)
        idx.append('xyz'.index(t[-1]))

    def remap(v):
        return np.stack([v[:, idx[0]] * sgn[0],
                         v[:, idx[1]] * sgn[1],
                         v[:, idx[2]] * sgn[2]], axis=1)
    return remap


def main():
    ap = argparse.ArgumentParser(
        description='Ubah skeleton SWC menjadi data/neurons.json',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--from-dir', required=True, help='folder berisi berkas .swc')
    ap.add_argument('--out', default='data/neurons.json')
    ap.add_argument('--bundle', default=None,
                    help='id berkas serabut bila semua SWC ada di satu folder datar')
    ap.add_argument('--align-to', default='data/neuropil.json',
                    help='ambil transformasi dari berkas ini agar sejajar dengan neuropil')
    ap.add_argument('--axes', default=None,
                    help='pemetaan sumbu; bawaan mengikuti --align-to, atau "x,-z,-y"')
    ap.add_argument('--max-points', type=int, default=64,
                    help='maksimum titik per ruas cabang (bawaan 64)')
    ap.add_argument('--source', default='FlyWire / Codex (SWC)')
    args = ap.parse_args()

    # ---------- kumpulkan berkas per bundel ----------
    groups = {}
    for entry in sorted(os.listdir(args.from_dir)):
        full = os.path.join(args.from_dir, entry)
        if os.path.isdir(full):
            swc = [os.path.join(full, f) for f in sorted(os.listdir(full))
                   if f.lower().endswith('.swc')]
            if swc:
                groups[entry] = swc
        elif entry.lower().endswith('.swc'):
            key = args.bundle or 'nrn-lain'
            groups.setdefault(key, []).append(full)

    if not groups:
        sys.exit('Tidak ada berkas .swc di ' + args.from_dir)

    # ---------- transformasi ----------
    align, axes = None, args.axes or 'x,-z,-y'
    if os.path.exists(args.align_to):
        try:
            with open(args.align_to, 'r', encoding='utf-8') as fh:
                align = json.load(fh).get('transform')
            if align:
                axes = args.axes or align.get('axes', axes)
                print('Transformasi diambil dari %s (sejajar dengan neuropil).' % args.align_to)
        except Exception:
            align = None
    if not align:
        print('PERINGATAN: %s tidak ditemukan.' % args.align_to)
        print('  Transformasi dihitung dari neuron saja - posisinya mungkin bergeser')
        print('  terhadap wilayah neuropil. Jalankan tools/fetch_flywire.py lebih dulu.')

    remap = axis_mapper(axes)

    # ---------- baca semua skeleton ----------
    loaded = {}
    allpts = []
    for bid, files in groups.items():
        branches = []
        for f in files:
            xyz, par = read_swc(f)
            if xyz is None:
                print('  lewati (kosong): %s' % os.path.basename(f))
                continue
            branches.extend(swc_branches(xyz, par, args.max_points))
        if not branches:
            continue
        loaded[bid] = branches
        allpts.append(np.vstack(branches))
        print('  %-20s %3d berkas, %5d ruas cabang' % (bid, len(files), len(branches)))

    if not loaded:
        sys.exit('Tidak ada skeleton yang terbaca.')

    stacked = np.vstack(allpts)
    if align:
        unit = align['unitScale']
        center_mm = np.asarray(align['centerMm'], dtype=np.float64)
        fit = align.get('fit', 1.0)
        print('Satuan  : dari neuropil (faktor %.3g)' % unit)
    else:
        unit, unit_name = guess_unit_scale(float(np.ptp(stacked, axis=0).max()))
        mm = remap(stacked) * unit
        center_mm = (mm.min(axis=0) + mm.max(axis=0)) / 2.0
        fit = 1.0
        print('Satuan  : %s (ditebak sendiri)' % unit_name)

    def to_chassis(v):
        return (remap(v) * unit - center_mm) * fit / CHASSIS_SCALE + np.array(BRAIN_CENTER)

    # ---------- kemas ----------
    bundles, total = [], 0
    for bid, branches in loaded.items():
        label, c0, c1 = BUNDLES.get(bid, (bid, '#7ee8e0', '#a78bfa'))
        paths = []
        for br in branches:
            v = to_chassis(br)
            paths.append([round(float(x), 5) for x in v.reshape(-1)])
            total += len(v) - 1
        bundles.append({
            'id': bid, 'nama': label,
            'color': c0, 'color2': c1, 'opacity': 0.55,
            'label': True, 'paths': paths,
        })

    doc = {
        'source': args.source,
        'generated': __import__('datetime').datetime.now().isoformat(timespec='seconds'),
        'space': 'chassis',
        'chassisScale': CHASSIS_SCALE,
        'brainCenter': list(BRAIN_CENTER),
        'axes': axes,
        'alignedTo': args.align_to if align else None,
        'note': 'Skeleton neuron berasal dari FlyWire — wajib mencantumkan '
                'sitasi, penggunaan non-komersial.',
        'bundles': bundles,
    }

    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, separators=(',', ':'))

    mb = os.path.getsize(args.out) / 1e6
    print('\nTertulis %s' % args.out)
    print('  %d berkas serabut, %d ruas garis, %.2f MB' % (len(bundles), total, mb))
    if total > 400000:
        print('  CATATAN: cukup berat untuk browser. Kurangi jumlah neuron atau')
        print('  turunkan --max-points bila terasa tersendat.')
    print('\nJalankan  node serve.js  lalu centang lapisan "Sel saraf".')


if __name__ == '__main__':
    main()
