BERKAS DATA OTAK
================

neuropil.json  — wilayah neuropil otak, dihasilkan oleh tools/fetch_flywire.py
neurons.json   — skeleton sel saraf,   dihasilkan oleh tools/fetch_neurons.py
                 (belum ada; lihat docs/flywire.md)

SUMBER & ATRIBUSI
-----------------
Mesh neuropil berasal dari berkas JFRC2NP.surf.fw yang dibundel dalam paket
Python `fafbseg`, sudah ditransformasi ke ruang FlyWire (FAFB14.1).

Data FlyWire dirilis untuk penggunaan NON-KOMERSIAL dan WAJIB DISITASI.
Periksa syarat terkini di https://codex.flywire.ai sebelum menerbitkan apa pun
yang memuat data ini — termasuk tangkapan layar dari viewer ini.

Sitasi:
  Dorkenwald dkk. (2024) "Neuronal wiring diagram of an adult brain", Nature.
  Schlegel dkk. (2024)  "Whole-brain annotation and multi-connectome cell
                         typing of Drosophila", Nature.

Berkas di folder ini adalah hasil turunan; transformasinya (satuan, pemetaan
sumbu, titik pusat) tercatat di dalam neuropil.json pada kunci "transform".
