#!/usr/bin/env python3
"""
fetch_flywire.py — ubah mesh neuropil FlyWire menjadi data/neuropil.json
yang siap dimuat js/connectome.js.

Skrip ini TIDAK mengunduh apa pun sendiri. Unduhan Anda lakukan lewat
akun FlyWire/Codex Anda sendiri (lihat docs/flywire.md), lalu arahkan
skrip ini ke folder hasilnya. Bagian yang dikerjakan skrip:

  1. memuat setiap mesh neuropil (.obj / .ply / .stl)
  2. menyederhanakan poligon agar ringan di browser
  3. memindahkan koordinat FlyWire ke "satuan sasis" model 3D
  4. mengemasnya menjadi satu berkas JSON

PEMAKAIAN
    pip install trimesh numpy
    python tools/fetch_flywire.py --from-dir ~/Unduhan/neuropil_meshes
    node serve.js          # buka http://localhost:5173, centang "Neuropil otak"

Nama berkas menentukan id wilayah. Contoh yang dikenali:
    ME_R.obj  ME_L.obj  LA_R.ply  MB_CA_R.obj  FB.obj  EB.obj

PERIKSA ORIENTASI SETELAH JALAN PERTAMA. Konvensi sumbu dataset FlyWire/
FAFB tidak selalu sama dengan model ini. Kalau otak tampak terbalik atau
menghadap belakang, setel --axes (lihat --help).
"""

import argparse
import json
import os
import re
import sys

try:
    import numpy as np
    import trimesh
except ImportError:
    sys.exit('Butuh dependensi: pip install trimesh numpy')


# ==========================================================
# KONFIGURASI — harus cocok dengan SPEC/BRAIN di js/fly.js
# ==========================================================
CHASSIS_SCALE = 0.37                 # SPEC.scale  (satuan sasis -> mm)
BRAIN_CENTER = (0.0, 0.16, 2.62)     # BRAIN.center dalam satuan sasis

# Peta singkatan -> label & warna. Sesuaikan/lengkapi sesuka Anda;
# id di sini harus sama dengan kunci di js/anatomy-data.js agar panel
# keterangan ikut muncul saat wilayahnya diklik.
REGIONS = {
    # ---------- lobus optik ----------
    'LA':     ('np-lamina',                 'Lamina',                       '#4dd0e1'),
    'ME':     ('np-medula',                 'Medula',                       '#29b6f6'),
    'LO':     ('np-lobula',                 'Lobula',                       '#5c6bc0'),
    'LOP':    ('np-lobula-plate',           'Lobula plate',                 '#7e57c2'),
    'AME':    ('np-ame',                    'Medula aksesori',              '#80deea'),
    # ---------- penciuman ----------
    'AL':     ('np-lobus-antena',           'Lobus antena',                 '#66bb6a'),
    'LH':     ('np-tanduk-lateral',         'Tanduk lateral',               '#9ccc65'),
    # ---------- badan jamur ----------
    'MB_CA':  ('np-mb-kaliks',              'Kaliks badan jamur',           '#ffa726'),
    'CA':     ('np-mb-kaliks',              'Kaliks badan jamur',           '#ffa726'),
    'MB_PED': ('np-mb-pedunkulus',          'Pedunkulus',                   '#ffb74d'),
    'PED':    ('np-mb-pedunkulus',          'Pedunkulus',                   '#ffb74d'),
    'MB_ML':  ('np-mb-lobus',               'Lobus medial badan jamur',     '#ff8a65'),
    'MB_VL':  ('np-mb-lobus',               'Lobus vertikal badan jamur',   '#ff7043'),
    # ---------- kompleks sentral ----------
    'FB':     ('np-badan-kipas',            'Badan kipas',                  '#f06292'),
    'EB':     ('np-badan-elipsoid',         'Badan elipsoid',               '#ec407a'),
    'PB':     ('np-jembatan-protoserebral', 'Jembatan protoserebral',       '#ba68c8'),
    'NO':     ('np-noduli',                 'Noduli',                       '#ce93d8'),
    'BU':     ('np-bu',                     'Bulb',                         '#f48fb1'),
    'GA':     ('np-ga',                     'Gall',                         '#f8bbd0'),
    'LAL':    ('np-lal',                    'Lobus aksesori lateral',       '#e91e63'),
    # ---------- protoserebrum superior ----------
    'SLP':    ('np-slp',                    'Protoserebrum superior lateral',     '#9575cd'),
    'SIP':    ('np-sip',                    'Protoserebrum superior intermediat', '#7e57c2'),
    'SMP':    ('np-smp',                    'Protoserebrum superior medial',      '#673ab7'),
    'SCL':    ('np-scl',                    'Klamp superior',               '#b39ddb'),
    'ICL':    ('np-icl',                    'Klamp inferior',               '#9fa8da'),
    'IB':     ('np-ib',                     'Jembatan inferior',            '#7986cb'),
    'ATL':    ('np-atl',                    'Antler',                       '#5c6bc0'),
    'CRE':    ('np-cre',                    'Crepine',                      '#8e99f3'),
    # ---------- ventrolateral ----------
    'AVLP':   ('np-avlp',                   'Protoserebrum ventrolateral anterior',  '#26a69a'),
    'PVLP':   ('np-pvlp',                   'Protoserebrum ventrolateral posterior', '#00897b'),
    'PLP':    ('np-plp',                    'Protoserebrum lateral posterior',       '#4db6ac'),
    'WED':    ('np-wed',                    'Wedge',                        '#80cbc4'),
    'AOTU':   ('np-aotu',                   'Tuberkel optik anterior',      '#009688'),
    # ---------- ventromedial & lereng ----------
    'VES':    ('np-ves',                    'Vest',                         '#ffb300'),
    'EPA':    ('np-epa',                    'Epaulette',                    '#ffa000'),
    'GOR':    ('np-gor',                    'Gorget',                       '#ff8f00'),
    'SPS':    ('np-sps',                    'Lereng posterior superior',    '#ffca28'),
    'IPS':    ('np-ips',                    'Lereng posterior inferior',    '#ffd54f'),
    # ---------- periesofageal & gnatal ----------
    'GNG':    ('np-gng',                    'Ganglion gnatal',              '#8d6e63'),
    'SAD':    ('np-sad',                    'Saddle',                       '#a1887f'),
    'PRW':    ('np-prw',                    'Prow',                         '#bcaaa4'),
    'FLA':    ('np-fla',                    'Flange',                       '#795548'),
    'CAN':    ('np-can',                    'Cantle',                       '#6d4c41'),
    'AMMC':   ('np-ammc',                   'Pusat mekanosensori antena',   '#d7ccc8'),
    # ---------- lain ----------
    'OCG':    ('np-ocg',                    'Ganglion oselar',              '#ffee58'),
}

EXT = ('.obj', '.ply', '.stl', '.off', '.glb')


def parse_name(fname):
    """'MB_CA_R.obj' -> ('MB_CA', 'R').  Sisi boleh tidak ada."""
    stem = os.path.splitext(os.path.basename(fname))[0]
    m = re.match(r'^(.*?)[_\-]?([LR])$', stem)
    if m and m.group(1):
        return m.group(1).upper(), m.group(2)
    return stem.upper(), None


def guess_unit_scale(extent_max):
    """Tebak satuan sumber dari besaran kotak pembatas -> faktor ke milimeter."""
    if extent_max > 1e5:        # nanometer  (otak ~6e5 nm)
        return 1e-6, 'nanometer'
    if extent_max > 100:        # mikrometer (otak ~600 um)
        return 1e-3, 'mikrometer'
    if extent_max > 0.1:        # sudah milimeter
        return 1.0, 'milimeter'
    return 1.0, 'tidak dikenali (dianggap milimeter)'


def main():
    ap = argparse.ArgumentParser(
        description='Ubah mesh neuropil FlyWire menjadi data/neuropil.json',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--from-dir', required=True,
                    help='folder berisi mesh neuropil (.obj/.ply/.stl)')
    ap.add_argument('--out', default='data/neuropil.json')
    ap.add_argument('--faces', type=int, default=3000,
                    help='maksimum segitiga per wilayah setelah disederhanakan (bawaan 3000)')
    ap.add_argument('--axes', default='x,-y,-z',
                    help='pemetaan sumbu sumber -> model (X kanan, Y dorsal, Z anterior). '
                         'Bawaan "x,-y,-z" sudah diverifikasi terhadap mesh JFRC2NP.surf.fw '
                         'bawaan paket fafbseg. Untuk sumber lain, kalau otak tampak '
                         'terbalik coba "x,-y,z", "x,-z,-y", atau "-x,-y,-z".')
    ap.add_argument('--fit-width', type=float, default=None,
                    help='paksa lebar otak (mm) ke nilai ini; biarkan kosong '
                         'agar ukuran asli dipertahankan')
    ap.add_argument('--source', default='FlyWire / Codex',
                    help='keterangan sumber yang dicatat dalam JSON')
    args = ap.parse_args()

    files = [os.path.join(args.from_dir, f) for f in sorted(os.listdir(args.from_dir))
             if f.lower().endswith(EXT)]
    if not files:
        sys.exit('Tidak ada berkas mesh di ' + args.from_dir)

    # ---------- muat ----------
    loaded = []
    for f in files:
        abbr, side = parse_name(f)
        if abbr not in REGIONS:
            print('  lewati (tidak dikenali): %s' % os.path.basename(f))
            continue
        m = trimesh.load(f, force='mesh')
        if m.is_empty:
            print('  lewati (kosong): %s' % os.path.basename(f))
            continue
        loaded.append((abbr, side, m))
        print('  muat %-10s %-2s %7d segitiga' % (abbr, side or '-', len(m.faces)))

    if not loaded:
        sys.exit('Tidak ada mesh yang cocok dengan tabel REGIONS.')

    # ---------- pemetaan sumbu ----------
    try:
        spec = [t.strip() for t in args.axes.split(',')]
        assert len(spec) == 3
        idx, sgn = [], []
        for t in spec:
            s = -1.0 if t.startswith('-') else 1.0
            idx.append('xyz'.index(t[-1]))
            sgn.append(s)
    except Exception:
        sys.exit('--axes tidak valid: ' + args.axes)

    def remap(v):
        return np.stack([v[:, idx[0]] * sgn[0],
                         v[:, idx[1]] * sgn[1],
                         v[:, idx[2]] * sgn[2]], axis=1)

    # ---------- satuan & kotak pembatas gabungan ----------
    allv = np.vstack([m.vertices for _, _, m in loaded])
    unit, unit_name = guess_unit_scale(float(np.ptp(allv, axis=0).max()))
    allv_mm = remap(allv) * unit
    lo, hi = allv_mm.min(axis=0), allv_mm.max(axis=0)
    center_mm = (lo + hi) / 2.0
    size_mm = hi - lo

    # Sumbu X dipusatkan pada GARIS TENGAH ANATOMIS, bukan kotak pembatas.
    # Himpunan mesh jarang simetris sempurna, sehingga memakai kotak pembatas
    # membuat seluruh otak bergeser ke samping beberapa puluh mikrometer.
    # Wilayah tak berpasangan (EB, FB, PB, GNG, ...) memang terletak di garis
    # tengah, jadi titik beratnya adalah acuan yang benar.
    mid_v = [m.vertices for abbr, side, m in loaded if side is None]
    if mid_v:
        mid_mm = remap(np.vstack(mid_v)) * unit
        center_mm[0] = float(mid_mm[:, 0].mean())
        print('Garis tengah X   : dari %d wilayah tak berpasangan (geser %.1f um '
              'dari titik tengah kotak)'
              % (len(mid_v), abs(center_mm[0] - (lo[0] + hi[0]) / 2.0) * 1000))
    else:
        print('Garis tengah X   : dari kotak pembatas (tidak ada wilayah tak berpasangan)')

    print('\nSatuan sumber terdeteksi : %s' % unit_name)
    print('Ukuran otak (mm)         : %.3f x %.3f x %.3f  (lebar x tinggi x dalam)'
          % (size_mm[0], size_mm[1], size_mm[2]))

    fit = 1.0
    if args.fit_width:
        fit = args.fit_width / size_mm[0]
        print('Dipaksa ke lebar %.3f mm (faktor %.4f)' % (args.fit_width, fit))

    # ---------- konversi + sederhanakan ----------
    out = []
    for abbr, side, m in loaded:
        pid, label, color = REGIONS[abbr]

        if len(m.faces) > args.faces:
            try:
                m = m.simplify_quadric_decimation(args.faces)
            except Exception:
                pass   # tanpa penyederhanaan pun tetap jalan, hanya lebih berat

        v = remap(np.asarray(m.vertices, dtype=np.float64)) * unit
        v = (v - center_mm) * fit / CHASSIS_SCALE + np.array(BRAIN_CENTER)

        out.append({
            'id': pid,
            'abbr': abbr,
            'nama': label + (' (kanan)' if side == 'R' else ' (kiri)' if side == 'L' else ''),
            'side': side,
            'color': color,
            'positions': [round(float(x), 5) for x in v.reshape(-1)],
            'indices': [int(i) for i in np.asarray(m.faces, dtype=np.int64).reshape(-1)],
        })

    doc = {
        'source': args.source,
        'generated': __import__('datetime').datetime.now().isoformat(timespec='seconds'),
        'space': 'chassis',
        'chassisScale': CHASSIS_SCALE,
        'brainCenter': list(BRAIN_CENTER),
        'axes': args.axes,
        # Transformasi disimpan agar tools/fetch_neurons.py memakai kerangka
        # yang SAMA PERSIS - kalau tidak, neuron tidak akan duduk pas di neuropil.
        'transform': {
            'unitScale': unit,
            'centerMm': [float(c) for c in center_mm],
            'fit': float(fit),
            'axes': args.axes,
        },
        'note': 'Koordinat sudah dalam satuan sasis fly.js. Data neuropil berasal '
                'dari FlyWire — wajib mencantumkan sitasi, penggunaan non-komersial.',
        'regions': out,
    }

    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, separators=(',', ':'))

    tris = sum(len(r['indices']) // 3 for r in out)
    mb = os.path.getsize(args.out) / 1e6
    print('\nTertulis %s' % args.out)
    print('  %d wilayah, %d segitiga, %.2f MB' % (len(out), tris, mb))
    print('\nJalankan  node serve.js  lalu centang lapisan "Neuropil otak".')
    print('Kalau otak tampak terbalik atau menghadap belakang, ulangi dengan --axes berbeda.')


if __name__ == '__main__':
    main()
