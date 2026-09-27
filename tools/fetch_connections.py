#!/usr/bin/env python3
"""
fetch_connections.py — bangun tabel konektivitas ringkas (data/connections.json)
dari tabel edge FlyWire ASLI, supaya viewer bisa menjawab "neuron ini
tersambung ke mana saja" saat satu neuron individual diklik.

TIDAK PERLU AKUN. Sumbernya arsip Zenodo terbuka (CC BY 4.0), terpisah dari
arsip skeleton:

    doi.org/10.5281/zenodo.10676866  "FlyWire Whole-brain Connectome
    Connectivity Data" (Dorkenwald dkk. 2024 Nature)

Berkas yang dipakai: proofread_connections_783.feather (852 MB) — tabel
SUDAH teragregasi per pasangan (pre_root_id, post_root_id, neuropil), bukan
9,5 GB data sinapsis mentah per titik koordinat (flywire_synapses_783.feather,
TIDAK dipakai skrip ini — jauh lebih besar dan tidak perlu untuk sekadar
tahu siapa tersambung ke siapa).

CARA KERJA
    1. Baca data/neurons.json — kumpulkan root_id neuron yang SUDAH
       digambar di viewer (wajib dijalankan setelah
       fetch_flywire_skeletons.py versi yang menyimpan root_id per neuron).
    2. Baca proofread_connections_783.feather, saring baris yang pre ATAU
       post root_id-nya ada di kumpulan itu (baris lain dibuang).
    3. Gabungkan neuropil (satu pasang neuron bisa tersambung di lebih dari
       satu wilayah otak) jadi satu edge dengan total syn_count.
    4. Untuk tiap neuron kita, ambil top-K mitra masuk (in) & keluar (out)
       berdasarkan jumlah sinapsis, plus label jenis selnya dari tabel
       anotasi (dipakai ulang dari .flywire-cache/annot.tsv bila sudah ada).
    5. Tulis data/connections.json — ringkas, cukup untuk panel keterangan.

PEMAKAIAN
    wget -c https://zenodo.org/api/records/10676866/files/proofread_connections_783.feather/content \
        -O proofread_connections_783.feather
    python tools/fetch_connections.py --local-file proofread_connections_783.feather

SITASI
    Dorkenwald dkk. (2024) Nature; Schlegel dkk. (2024) Nature.
    Konektivitas: doi.org/10.5281/zenodo.10676866 (CC BY 4.0)
"""

import argparse
import json
import os
import sys

try:
    import numpy as np
    import pyarrow as pa
    import pyarrow.ipc as ipc
except ImportError:
    sys.exit('Butuh dependensi: pip install pyarrow numpy')

CONN_URL = ('https://zenodo.org/api/records/10676866/files/'
            'proofread_connections_783.feather/content')
ANNOT_URL = ('https://raw.githubusercontent.com/flyconnectome/flywire_annotations/'
             'main/supplemental_files/Supplemental_file1_neuron_annotations.tsv')

# Kolom neurotransmitter di feather -> kode singkat dipakai di JSON keluaran.
NT_COLS = [('gaba_avg', 'gaba'), ('ach_avg', 'ach'), ('glut_avg', 'glut'),
           ('oct_avg', 'oct'), ('ser_avg', 'ser'), ('da_avg', 'da')]


def load_annotations(path, quiet=False):
    """root_id -> "cell_type (super_class)" ringkas untuk tampilan."""
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
                rid = int(rid)
            except ValueError:
                continue
            ctype = (row.get('cell_type') or '').strip()
            sup = (row.get('super_class') or '').strip()
            side = (row.get('side') or '').strip()
            label = ctype or sup or 'tak diketahui'
            if side:
                label += ' (%s)' % side
            out[rid] = label
    return out


def collect_our_ids(neurons_json_path):
    with open(neurons_json_path, encoding='utf-8') as fh:
        doc = json.load(fh)
    ids = set()
    for bd in doc.get('bundles', []):
        for nr in bd.get('neurons', []):
            rid = nr.get('id')
            if rid is not None:
                ids.add(int(rid))
    if not ids:
        sys.exit('Tidak ada root_id di %s — jalankan ulang '
                  'fetch_flywire_skeletons.py versi terbaru dulu.' % neurons_json_path)
    return ids


def main():
    ap = argparse.ArgumentParser(
        description='Bangun data/connections.json dari tabel edge FlyWire asli',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--local-file', default=None,
                    help='berkas proofread_connections_783.feather yang SUDAH diunduh '
                         '(wajib — 852 MB, unduh dulu dengan wget -c)')
    ap.add_argument('--neurons-json', default='data/neurons.json',
                    help='sumber daftar root_id yang sudah digambar di viewer')
    ap.add_argument('--out', default='data/connections.json')
    ap.add_argument('--top-k', type=int, default=20,
                    help='maksimum mitra masuk & keluar yang disimpan per neuron (bawaan 20)')
    ap.add_argument('--min-syn', type=int, default=2,
                    help='buang edge dengan total sinapsis di bawah ini (bawaan 2, kurangi derau)')
    ap.add_argument('--cache', default='.flywire-cache')
    args = ap.parse_args()

    if not args.local_file or not os.path.exists(args.local_file):
        sys.exit('Perlu --local-file <proofread_connections_783.feather>.\n'
                  'Unduh dulu:\n  wget -c %s -O proofread_connections_783.feather' % CONN_URL)

    os.makedirs(args.cache, exist_ok=True)
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)

    print('Neuron kita    : membaca %s ...' % args.neurons_json)
    our_ids = collect_our_ids(args.neurons_json)
    our_arr = np.array(sorted(our_ids), dtype=np.int64)
    print('  %s root_id (neuron yang sudah digambar di viewer)' % format(len(our_ids), ','))

    print('Anotasi        : ' + args.cache + '/annot.tsv')
    annot = load_annotations(os.path.join(args.cache, 'annot.tsv'), quiet=True)
    print('  %s neuron berlabel' % format(len(annot), ','))

    gb = os.path.getsize(args.local_file) / 1e9
    print('Tabel edge     : %s (%.2f GB)' % (args.local_file, gb))
    with open(args.local_file, 'rb') as fh:
        reader = ipc.open_file(fh)
        n_batches = reader.num_record_batches
        print('  %d batch — memindai & menyaring...' % n_batches)

        # agregat sementara: (pre,post) -> [syn_total, nt_sums(6), syn_for_nt_weight]
        agg = {}
        rows_kept = 0
        rows_seen = 0
        for bi in range(n_batches):
            batch = reader.get_batch(bi)
            pre = batch.column('pre_pt_root_id').to_numpy(zero_copy_only=False)
            post = batch.column('post_pt_root_id').to_numpy(zero_copy_only=False)
            syn = batch.column('syn_count').to_numpy(zero_copy_only=False)
            nts = [batch.column(c).to_numpy(zero_copy_only=False) for c, _ in NT_COLS]
            rows_seen += len(pre)

            mask = np.isin(pre, our_arr) | np.isin(post, our_arr)
            idx = np.flatnonzero(mask)
            rows_kept += len(idx)
            for i in idx:
                key = (int(pre[i]), int(post[i]))
                s = int(syn[i])
                a = agg.get(key)
                if a is None:
                    a = [0, [0.0] * len(NT_COLS)]
                    agg[key] = a
                a[0] += s
                for j in range(len(NT_COLS)):
                    a[1][j] += float(nts[j][i]) * s

            if (bi + 1) % 20 == 0 or bi + 1 == n_batches:
                print('    batch %d/%d — %s baris disimpan dari %s dipindai'
                      % (bi + 1, n_batches, format(rows_kept, ','), format(rows_seen, ',')),
                      flush=True)

    print('Edge unik      : %s (setelah gabung lintas-neuropil)' % format(len(agg), ','))

    # ---------- susun per-neuron: daftar masuk (in) & keluar (out) ----------
    outgoing = {}
    incoming = {}
    for (pre, post), (syn_total, nt_sums) in agg.items():
        if syn_total < args.min_syn:
            continue
        dom_i = max(range(len(NT_COLS)), key=lambda j: nt_sums[j])
        nt_code = NT_COLS[dom_i][1]
        if pre in our_ids:
            outgoing.setdefault(pre, []).append((post, syn_total, nt_code))
        if post in our_ids:
            incoming.setdefault(post, []).append((pre, syn_total, nt_code))

    def label_of(rid):
        return annot.get(rid, 'tak diketahui')

    neurons_out = {}
    for rid in our_ids:
        out_edges = sorted(outgoing.get(rid, []), key=lambda t: -t[1])[:args.top_k]
        in_edges = sorted(incoming.get(rid, []), key=lambda t: -t[1])[:args.top_k]
        if not out_edges and not in_edges:
            continue
        neurons_out[str(rid)] = {
            'ct': label_of(rid),
            'out': [{'p': str(p), 'w': w, 'nt': nt, 'g': int(p in our_ids)}
                    for p, w, nt in out_edges],
            'in': [{'p': str(p), 'w': w, 'nt': nt, 'g': int(p in our_ids)}
                   for p, w, nt in in_edges],
        }

    # label untuk SEMUA partner yang disebut (termasuk yang tak punya geometri)
    labels = {}
    for rid in our_ids:
        labels[str(rid)] = label_of(rid)
    for n in neurons_out.values():
        for e in n['out'] + n['in']:
            if e['p'] not in labels:
                labels[e['p']] = label_of(int(e['p']))

    doc = {
        'source': 'FlyWire proofread_connections_783 (Zenodo 10676866, CC BY 4.0)',
        'generated': __import__('datetime').datetime.now().isoformat(timespec='seconds'),
        'note': 'Konektivitas neuron proofread. Wajib sitasi: Dorkenwald dkk. 2024 '
                'Nature; Schlegel dkk. 2024 Nature. "g":1 berarti mitra ini juga '
                'punya geometri di viewer (bisa disorot 3D); "g":0 hanya teks.',
        'topK': args.top_k,
        'minSyn': args.min_syn,
        'labels': labels,
        'neurons': neurons_out,
    }
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))

    mb = os.path.getsize(args.out) / 1e6
    n_with_data = len(neurons_out)
    print('\nTertulis %s (%.2f MB)' % (args.out, mb))
    print('  %s / %s neuron kita punya data konektivitas' % (format(n_with_data, ','), format(len(our_ids), ',')))
    print('  %s label partner (termasuk yang tak digambar)' % format(len(labels), ','))
    print('\nJalankan  node serve.js  lalu klik satu neuron di lapisan "Sel saraf".')


if __name__ == '__main__':
    main()
