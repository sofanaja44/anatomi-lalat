#!/usr/bin/env python3
"""
get_neuropil_meshes.py — unduh 78 mesh permukaan neuropil FlyWire.

TIDAK PERLU AKUN. Mesh-nya (sudah ditransformasi ke ruang FlyWire) ikut
dibundel di dalam paket Python `fafbseg` sebagai
`fafbseg/data/JFRC2NP.surf.fw.zip`. Skrip ini mengambil paketnya TANPA
dependensi (7,9 MB, bukan ratusan MB), lalu mengeluarkan berkas PLY-nya.

PEMAKAIAN
    python tools/get_neuropil_meshes.py                 # -> neuropil_ply/
    python tools/fetch_flywire.py --from-dir neuropil_ply

Hasilnya AL_L.ply, AL_R.ply, ME_L.ply, ... (43 wilayah, kiri+kanan).
"""

import argparse
import io
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

INNER = 'fafbseg/data/JFRC2NP.surf.fw.zip'


def main():
    ap = argparse.ArgumentParser(description='Unduh mesh neuropil FlyWire (tanpa akun)')
    ap.add_argument('--out', default='neuropil_ply', help='folder keluaran')
    ap.add_argument('--keep-wheel', action='store_true',
                    help='jangan hapus berkas .whl setelah selesai')
    args = ap.parse_args()

    tmp = tempfile.mkdtemp(prefix='fafbseg-')
    try:
        print('Mengunduh paket fafbseg tanpa dependensi (~8 MB)...')
        r = subprocess.run(
            [sys.executable, '-m', 'pip', 'download', 'fafbseg',
             '--no-deps', '-d', tmp, '--quiet'],
            capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit('pip download gagal:\n' + (r.stderr or r.stdout))

        whls = [f for f in os.listdir(tmp) if f.endswith('.whl')]
        if not whls:
            sys.exit('Tidak ada berkas .whl terunduh.')
        whl = os.path.join(tmp, whls[0])
        print('  dapat %s (%.1f MB)' % (whls[0], os.path.getsize(whl) / 1e6))

        z = zipfile.ZipFile(whl)
        if INNER not in z.namelist():
            sys.exit('Paket tidak memuat %s.\nVersi fafbseg mungkin berubah; '
                     'periksa isinya secara manual.' % INNER)

        inner = zipfile.ZipFile(io.BytesIO(z.read(INNER)))
        os.makedirs(args.out, exist_ok=True)
        n = 0
        for name in inner.namelist():
            # __MACOSX berisi resource fork, bukan mesh
            if '__MACOSX' in name or not name.lower().endswith('.ply'):
                continue
            with open(os.path.join(args.out, os.path.basename(name)), 'wb') as fh:
                fh.write(inner.read(name))
            n += 1

        print('\nDiekstrak %d berkas PLY -> %s/' % (n, args.out))
        names = sorted(os.path.splitext(f)[0] for f in os.listdir(args.out)
                       if f.endswith('.ply'))
        print('  contoh: %s' % ', '.join(names[:10]))
        print('\nLangkah berikutnya:')
        print('  python tools/fetch_flywire.py --from-dir %s' % args.out)

        if args.keep_wheel:
            shutil.copy(whl, '.')
            print('\n(.whl disalin ke folder kerja)')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
