#!/usr/bin/env python3
"""
fetch_flywire_skeletons.py — ambil skeleton neuron FlyWire ASLI langsung
dari arsip terbuka Zenodo, lalu tulis data/neurons.json.

TIDAK PERLU AKUN. Arsipnya terbuka (CC BY 4.0) dan sudah berada dalam ruang
koordinat FlyWire 783 — sama persis dengan mesh neuropil dari
tools/fetch_flywire.py, sehingga keduanya otomatis sejajar.

CARA KERJA
    Berkas sumbernya 5,4 GB (268 juta titik, 139.248 neuron). Skrip ini tidak
    mengunduh semuanya: data terurut menurut id neuron, jadi ia MENGALIRKAN
    potongan dari awal berkas lewat HTTP range request, mengumpulkan neuron
    utuh sampai jumlah yang diminta terpenuhi, lalu berhenti.
    Dengan bawaan --neurons 5000 biasanya hanya ±250 MB yang terunduh.

    Neuron yang terkumpul lalu dipadankan dengan tabel anotasi resmi untuk
    diketahui jenis selnya, dan dikelompokkan menjadi berkas serabut.

PEMAKAIAN
    pip install pyarrow fsspec aiohttp requests numpy
    python tools/fetch_flywire.py --from-dir neuropil_ply     # 1. WAJIB DULU
    python tools/fetch_flywire_skeletons.py                   # 2. baru ini
    node serve.js       # buka http://localhost:5173, centang "Sel saraf"

CATATAN
    Potongan berurutan = sampel acak menurut jenis sel. Jenis yang berlimpah
    (neuron lobus optik, sel Kenyon) pasti terwakili; jenis yang sangat langka
    (mis. EPG, hanya 47 di seluruh otak) mungkin tidak ikut. Perbesar
    --neurons bila perlu, dengan konsekuensi unduhan lebih besar.

SITASI
    Dorkenwald dkk. (2024) Nature; Schlegel dkk. (2024) Nature.
    Skeleton: doi.org/10.5281/zenodo.10877326 (CC BY 4.0)
"""

import argparse
import json
import os
import sys

try:
    import numpy as np
    import pyarrow.parquet as pq
    import fsspec
except ImportError:
    sys.exit('Butuh dependensi: pip install pyarrow fsspec aiohttp requests numpy')


SKEL_URL = ('https://zenodo.org/records/10877326/files/'
            'sk_lod1_783_healed_ds2.parquet')
ANNOT_URL = ('https://raw.githubusercontent.com/flyconnectome/flywire_annotations/'
             'main/supplemental_files/Supplemental_file1_neuron_annotations.tsv')

CHASSIS_SCALE = 0.37
BRAIN_CENTER = (0.0, 0.16, 2.62)

# Aturan pengelompokan, diperiksa berurutan. Yang cocok pertama dipakai.
#   (id berkas, label, warna pangkal, warna ujung, kolom, nilai yang cocok)
RULES = [
    ('nrn-khiasma-luar',  'Khiasma luar (lamina > medula)', '#00a8c6', '#1272c4',
     'cell_class', {'LA>ME', 'ME>LA'}),
    ('nrn-khiasma-dalam', 'Khiasma dalam (medula > lobula)', '#1272c4', '#5e3aa8',
     'cell_class', {'ME>LO', 'ME>LOP', 'ME>LO.LOP', 'LO>LOP'}),
    ('nrn-kenyon',        'Sel Kenyon (badan jamur)',       '#e08a1e', '#d1401c',
     'cell_class', {'Kenyon_Cell'}),
    ('nrn-epg',           'Kompleks sentral',               '#e03878', '#9a4fd0',
     'cell_class', {'CX'}),
    ('nrn-desenden',      'Neuron desenden',                '#d13a6b', '#7a5ae0',
     'super_class', {'descending', 'ascending'}),
    ('nrn-pn-olfaktori',  'Jalur penciuman & sensorik',     '#3fa83f', '#e08a1e',
     'super_class', {'sensory', 'sensory_ascending'}),
    ('nrn-optik-lain',    'Neuron lobus optik lainnya',     '#ff8a1f', '#00a8c6',
     'super_class', {'optic', 'visual_projection', 'visual_centrifugal'}),
    ('nrn-sentral-lain',  'Neuron otak tengah lainnya',     '#8d6e63', '#bcaaa4',
     'super_class', {'central'}),
]


def load_annotations(path, quiet=False):
    """root_id -> {super_class, cell_class, cell_type, side}"""
    import csv
    if not os.path.exists(path):
        if not quiet:
            print('Mengunduh tabel anotasi (32 MB)...')
        import urllib.request
        urllib.request.urlretrieve(ANNOT_URL, path)
    out = {}
    with open(path, encoding='utf-8', newline='') as fh:
        for row in csv.DictReader(fh, delimiter='\t'):
            rid = row.get('root_id')
            if not rid:
                continue
            try:
                out[int(rid)] = (row.get('super_class', ''), row.get('cell_class', ''),
                                 row.get('cell_type', ''), row.get('side', ''))
            except ValueError:
                continue
    return out


def branches(node_id, parent_id, xyz, max_pts):
    """Pecah satu pohon skeleton menjadi ruas antar titik cabang/ujung."""
    idx = {int(n): i for i, n in enumerate(node_id)}
    n = len(node_id)
    children = [[] for _ in range(n)]
    roots = []
    for i, p in enumerate(parent_id):
        j = idx.get(int(p), -1)
        if j >= 0:
            children[j].append(i)
        else:
            roots.append(i)

    out, stack = [], list(roots)
    while stack:
        cur = stack.pop()
        path = [cur]
        while True:
            kids = children[cur]
            if len(kids) == 1:
                cur = kids[0]
                path.append(cur)
            else:
                stack.extend(kids)
                break
        if len(path) > 1:
            if len(path) > max_pts:
                sel = np.linspace(0, len(path) - 1, max_pts).astype(int)
                path = [path[i] for i in sel]
            out.append(xyz[path])
    return out


def main():
    ap = argparse.ArgumentParser(
        description='Ambil skeleton neuron FlyWire asli dari Zenodo (tanpa akun)',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--neurons', type=int, default=5000,
                    help='berapa neuron utuh dikumpulkan dari aliran data (bawaan 5000, ~250 MB)')
    ap.add_argument('--per-bundle', type=int, default=180,
                    help='maksimum neuron yang digambar per berkas serabut (bawaan 180)')
    ap.add_argument('--max-points', type=int, default=48,
                    help='maksimum titik per ruas cabang (bawaan 48)')
    ap.add_argument('--out', default='data/neurons.json')
    ap.add_argument('--align-to', default='data/neuropil.json',
                    help='ambil transformasi dari berkas ini agar sejajar dengan neuropil')
    ap.add_argument('--local-file', default=None,
                    help='baca dari berkas parquet yang SUDAH diunduh, bukan streaming. '
                         'Jalur yang dianjurkan di server: unduh dulu dengan '
                         '"wget -c <url>" lalu tunjuk ke berkasnya. Jauh lebih cepat, '
                         'hemat memori, dan tahan koneksi putus.')
    ap.add_argument('--row-group', type=int, default=0,
                    help='row group mana yang dibaca (0-3). Tiap row group memuat '
                         '~35.000 neuron berbeda.')
    ap.add_argument('--cache', default='.flywire-cache',
                    help='folder simpanan tabel anotasi & blok unduhan')
    ap.add_argument('--timeout', type=int, default=3600,
                    help='batas diam per blok (detik). Zenodo sangat lambat (~0,2 MB/s), '
                         'satu blok kolom 206 MB bisa makan ~17 menit.')
    args = ap.parse_args()

    os.makedirs(args.cache, exist_ok=True)

    # ---------- transformasi: WAJIB sama dengan neuropil ----------
    if not os.path.exists(args.align_to):
        sys.exit('Tidak ada %s.\nJalankan tools/fetch_flywire.py lebih dulu supaya '
                 'neuron sejajar dengan neuropil.' % args.align_to)
    with open(args.align_to, encoding='utf-8') as fh:
        tr = json.load(fh).get('transform')
    if not tr:
        sys.exit('%s tidak memuat kunci "transform". Buat ulang dengan '
                 'tools/fetch_flywire.py versi terbaru.' % args.align_to)

    spec = [t.strip() for t in tr['axes'].split(',')]
    ax_i = ['xyz'.index(t[-1]) for t in spec]
    ax_s = [-1.0 if t.startswith('-') else 1.0 for t in spec]
    unit = tr['unitScale']
    center = np.asarray(tr['centerMm'], dtype=np.float64)
    fit = tr.get('fit', 1.0)
    print('Transformasi  : dari %s (sumbu %s)' % (args.align_to, tr['axes']))

    def to_chassis(v):
        m = np.stack([v[:, ax_i[0]] * ax_s[0],
                      v[:, ax_i[1]] * ax_s[1],
                      v[:, ax_i[2]] * ax_s[2]], axis=1) * unit
        return (m - center) * fit / CHASSIS_SCALE + np.array(BRAIN_CENTER)

    # ---------- anotasi ----------
    annot = load_annotations(os.path.join(args.cache, 'annot.tsv'))
    print('Anotasi       : %s neuron' % format(len(annot), ','))

    # ---------- alirkan skeleton ----------
    print('Mengalirkan skeleton dari Zenodo (berhenti setelah %s neuron)...'
          % format(args.neurons, ','))
    """
    Catatan teknis (hasil pengukuran, bukan dugaan):
      - Footer parquet berkas ini saja 50 MB.
      - pyarrow meminta SATU KOLOM PENUH sekaligus: ~206 MB per permintaan.
        Jadi tidak ada cara mengambil "sedikit saja" - minimum ~1,3 GB
        (footer + 6 kolom) sebelum baris pertama bisa dibaca.
      - Zenodo melayani ~0,2 MB/s, sehingga satu blok bisa makan ~17 menit.
        Batas waktu bawaan aiohttp (5 menit) pasti terlampaui -> dimatikan.
      - Blok disimpan ke disk (blockcache) supaya percobaan ulang tidak
        mengunduh dari nol lagi.
    """
    if args.local_file:
        if not os.path.exists(args.local_file):
            sys.exit('Tidak ada berkas: %s' % args.local_file)
        gb = os.path.getsize(args.local_file) / 1e9
        print('  Sumber: berkas lokal %s (%.2f GB)' % (args.local_file, gb))
        pf = pq.ParquetFile(args.local_file, pre_buffer=False)
    else:
        import aiohttp
        blocks = os.path.join(args.cache, 'blocks')
        os.makedirs(blocks, exist_ok=True)
        fs = fsspec.filesystem(
            'blockcache',
            target_protocol='http',
            target_options={'client_kwargs': {
                'timeout': aiohttp.ClientTimeout(total=None, sock_connect=60,
                                                 sock_read=args.timeout)}},
            cache_storage=blocks,
        )
        fh = fs.open(SKEL_URL, 'rb')
        # pre_buffer=False & use_threads=False menekan pemakaian memori
        pf = pq.ParquetFile(fh, pre_buffer=False)
        print('  Singgahan blok: %s (aman diulang bila putus)' % blocks)
        print('  PERINGATAN: mode streaming butuh RAM bebas >=4 GB. pyarrow meminta')
        print('  satu kolom penuh (~206 MB) sekali baca, dan tiap lapisan menyimpan')
        print('  salinannya. Di mesin kecil pakai --local-file (lihat docs/server.md).')

    # ---------------------------------------------------------------
    # Dibaca SATU KOLOM PADA SATU WAKTU.
    #
    # Membaca enam kolom sekaligus menahan ~3 GB di memori — terlalu besar
    # untuk mesin 8 GB yang sebagian besarnya sudah terpakai. Parquet bersifat
    # kolumnar, jadi tiap kolom bisa diambil sendiri-sendiri: puncak memori
    # turun jadi ~600 MB, dengan lalu lintas jaringan yang sama.
    #
    # Kolom 'neuron' dibaca lebih dulu untuk menentukan sampai baris ke berapa
    # kita butuh, sehingga kolom berikutnya bisa dipotong sedini mungkin.
    # ---------------------------------------------------------------
    def read_column(name, limit=None):
        """Baca satu kolom dari row group 0, berhenti setelah `limit` baris."""
        out, n = [], 0
        for batch in pf.iter_batches(batch_size=2_000_000, columns=[name],
                                     row_groups=[args.row_group], use_threads=False):
            a = batch.column(name).to_numpy(zero_copy_only=False)
            if limit is not None and n + len(a) >= limit:
                out.append(a[:limit - n])
                n = limit
                break
            out.append(a)
            n += len(a)
            print('    %s: %s baris' % (name, format(n, ',')), flush=True)
        return np.concatenate(out) if out else np.array([])

    # Kolom 'neuron' dipindai SAMBIL JALAN untuk mencari batas antar neuron.
    # Menahan seluruh kolom (67 juta int64 = 536 MB, jadi ~1,1 GB saat
    # digabung) hanya untuk mencari batas adalah pemborosan yang membuat
    # proses dimatikan sistem pada mesin 8 GB. Cukup simpan indeksnya.
    print('  [1/6] memindai kolom "neuron" untuk mencari batas antar neuron...', flush=True)
    starts, ids = [], []
    base, prev_id = 0, None
    for batch in pf.iter_batches(batch_size=2_000_000, columns=['neuron'],
                                 row_groups=[args.row_group], use_threads=False):
        a = batch.column('neuron').to_numpy(zero_copy_only=False)
        if prev_id is None or int(a[0]) != prev_id:
            starts.append(base); ids.append(int(a[0]))
        for c in np.flatnonzero(np.diff(a)) + 1:
            starts.append(base + int(c)); ids.append(int(a[c]))
        prev_id = int(a[-1])
        base += len(a)
        print('    %s baris, %s neuron' % (format(base, ','), format(len(starts), ',')),
              flush=True)
        del a
        if len(starts) > args.neurons:
            break

    n_avail = len(starts)
    take = min(args.neurons, n_avail - 1 if n_avail > args.neurons else n_avail)
    cut = int(starts[take]) if take < n_avail else base
    print('  mengambil %s neuron (%s baris dari %s)'
          % (format(take, ','), format(cut, ','), format(base, ',')), flush=True)

    data = {}
    for i, c in enumerate(['node_id', 'parent_id', 'x', 'y', 'z'], start=2):
        print('  [%d/6] kolom "%s"...' % (i, c), flush=True)
        data[c] = read_column(c, cut)

    xyz_all = np.stack([data['x'], data['y'], data['z']], axis=1)
    nid_all, pid_all = data['node_id'], data['parent_id']
    del data

    print('  menyusun pohon skeleton...', flush=True)
    collected = {}
    bounds = starts[:take] + [cut]
    for k in range(take):
        a, b = int(bounds[k]), int(bounds[k + 1])
        if b - a < 8:
            continue
        collected[ids[k]] = branches(nid_all[a:b], pid_all[a:b],
                                     xyz_all[a:b], args.max_points)
        if (k + 1) % 500 == 0:
            print('    %s / %s neuron' % (format(k + 1, ','), format(take, ',')), flush=True)
    del nid_all, pid_all, xyz_all
    print('  selesai: %s neuron' % format(len(collected), ','), flush=True)

    # ---------- kelompokkan ----------
    bundles = {}
    tak_dikenal = 0
    for rid, brs in collected.items():
        a = annot.get(rid)
        if not a:
            tak_dikenal += 1
            continue
        sup, cls, ctype, side = a
        for bid, label, c0, c1, field, values in RULES:
            val = cls if field == 'cell_class' else sup
            if val in values:
                bundles.setdefault(bid, {'label': label, 'c0': c0, 'c1': c1,
                                         'neurons': []})['neurons'].append((rid, brs))
                break

    print('\nHasil pengelompokan:')
    out = []
    total_seg = 0
    for bid, label, c0, c1, field, values in RULES:
        b = bundles.get(bid)
        if not b:
            print('  %-20s (tidak ada dalam potongan ini)' % bid)
            continue
        chosen = b['neurons'][:args.per_bundle]
        paths = []
        for rid, brs in chosen:
            for br in brs:
                v = to_chassis(br)
                paths.append([round(float(x), 5) for x in v.reshape(-1)])
                total_seg += len(v) - 1
        out.append({'id': bid, 'nama': b['label'], 'color': b['c0'], 'color2': b['c1'],
                    'opacity': 0.5, 'label': True, 'paths': paths,
                    'neuronCount': len(chosen), 'available': len(b['neurons'])})
        print('  %-20s %4d neuron dipakai (tersedia %d), %s ruas'
              % (bid, len(chosen), len(b['neurons']), format(sum(len(p) // 3 - 1 for p in paths), ',')))

    if tak_dikenal:
        print('  (%d neuron tanpa anotasi dilewati)' % tak_dikenal)

    doc = {
        'source': 'FlyWire 783 skeletons (Zenodo 10877326, CC BY 4.0)',
        'generated': __import__('datetime').datetime.now().isoformat(timespec='seconds'),
        'space': 'chassis',
        'chassisScale': CHASSIS_SCALE,
        'brainCenter': list(BRAIN_CENTER),
        'axes': tr['axes'],
        'alignedTo': args.align_to,
        'sampled': len(collected),
        'note': 'Skeleton neuron FlyWire, potongan sampel. Wajib sitasi: '
                'Dorkenwald dkk. 2024 Nature; Schlegel dkk. 2024 Nature.',
        'bundles': out,
    }
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))

    mb = os.path.getsize(args.out) / 1e6
    print('\nTertulis %s' % args.out)
    print('  %d berkas serabut, %s ruas garis, %.2f MB'
          % (len(out), format(total_seg, ','), mb))
    if total_seg > 400_000:
        print('  CATATAN: cukup berat. Turunkan --per-bundle bila terasa tersendat.')
    print('\nJalankan  node serve.js  lalu centang lapisan "Sel saraf".')


if __name__ == '__main__':
    main()
