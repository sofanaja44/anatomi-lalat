#!/usr/bin/env bash
# =============================================================
# pipeline.sh — bangun seluruh data otak dari nol, satu perintah.
#
# Ditujukan untuk server dengan RAM lapang (>=8 GB BEBAS) dan koneksi
# baik. Di mesin kecil jangan pakai skrip ini — lihat docs/server.md.
#
#   bash tools/pipeline.sh              # neuropil + skeleton
#   NEURONS=20000 bash tools/pipeline.sh
#   SKIP_SKELETONS=1 bash tools/pipeline.sh    # neuropil saja (cepat)
# =============================================================
set -euo pipefail

NEURONS="${NEURONS:-20000}"
PER_BUNDLE="${PER_BUNDLE:-250}"
ROW_GROUP="${ROW_GROUP:-0}"
SKIP_SKELETONS="${SKIP_SKELETONS:-0}"
PARQUET="${PARQUET:-sk_lod1_783_healed_ds2.parquet}"
URL="https://zenodo.org/records/10877326/files/sk_lod1_783_healed_ds2.parquet"

cd "$(dirname "$0")/.."
echo "=== folder kerja: $(pwd) ==="

# ---------- 0. dependensi ----------
echo
echo "--- [0/3] dependensi Python ---"
python3 -m pip install -q -r requirements.txt

# ---------- 1. neuropil (kecil & cepat, tanpa akun) ----------
echo
echo "--- [1/3] mesh neuropil (~8 MB unduhan) ---"
if [ -f data/neuropil.json ]; then
  echo "  data/neuropil.json sudah ada — dilewati."
  echo "  (hapus berkasnya bila ingin dibuat ulang)"
else
  python3 tools/get_neuropil_meshes.py --out neuropil_ply
  python3 tools/fetch_flywire.py --from-dir neuropil_ply \
      --source "FlyWire JFRC2NP.surf.fw (paket fafbseg)"
fi

# ---------- 2. skeleton neuron (besar) ----------
if [ "$SKIP_SKELETONS" = "1" ]; then
  echo
  echo "--- [2/3] skeleton dilewati (SKIP_SKELETONS=1) ---"
else
  echo
  echo "--- [2/3] skeleton neuron ---"
  echo "  Berkas sumber 5,4 GB. Zenodo lambat (~0,2 MB/s dari koneksi rumahan;"
  echo "  dari datacenter biasanya jauh lebih cepat). wget -c aman diulang."
  if [ ! -f "$PARQUET" ]; then
    wget -c -O "$PARQUET" "$URL"
  else
    echo "  $PARQUET sudah ada ($(du -h "$PARQUET" | cut -f1)) — melanjutkan."
    wget -c -O "$PARQUET" "$URL"     # -c: lanjutkan bila belum utuh
  fi

  python3 tools/fetch_flywire_skeletons.py \
      --local-file "$PARQUET" \
      --row-group "$ROW_GROUP" \
      --neurons "$NEURONS" \
      --per-bundle "$PER_BUNDLE"
fi

# ---------- 3. ringkasan ----------
echo
echo "--- [3/3] hasil ---"
for f in data/neuropil.json data/neurons.json; do
  if [ -f "$f" ]; then
    printf '  %-22s %s\n' "$f" "$(du -h "$f" | cut -f1)"
  else
    printf '  %-22s (tidak dibuat)\n' "$f"
  fi
done
echo
echo "Sajikan dengan:  node serve.js     (atau: python3 -m http.server 5173)"
