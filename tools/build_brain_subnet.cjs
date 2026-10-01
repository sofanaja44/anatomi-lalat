#!/usr/bin/env node
/* ==========================================================
   Bangun data/brain-lalat.json - potongan otak untuk alive.html.

   Model LIF Shiu dkk. (js/lif-brain.js) TIDAK punya aktivitas spontan:
   neuron yang tak pernah menembak tak pernah mengirim apa pun ke neuron
   lain. Jadi untuk input tertentu, cukup menyimpan neuron yang PERNAH
   menembak - hasilnya identik dengan otak utuh (138.639 neuron).

   Skrip ini menjalankan otak UTUH di Node untuk banyak kombinasi input
   yang dipakai halaman, mengumpulkan semua neuron yang pernah menembak,
   lalu menyimpan jaringan di antara neuron-neuron itu saja. Kombinasi
   input di luar sapuan ini = pendekatan (dicek ulang di akhir: otak
   potongan vs otak utuh pada beberapa kombinasi tak terlihat sapuan).

   ATURAN KEAMANAN (ditemukan lewat uji coba 29-30 Sep 2026, lihat
   docs/otak-lalat.md "Yang tidak berhasil"): tiga kelompok input di bawah
   TIDAK BOLEH aktif bersamaan berpasangan - kombinasinya memicu aktivitas
   tak terkendali ("kejang", macet di puluhan ribu spike/detik, TIDAK
   reda walau input dimatikan):
     - visi (lc4L/R, lplc2L/R)   x   rasa mulut (sugarL/R, bitterL/R)
     - visi (lc4L/R, lplc2L/R)   x   rasa kaki (legGL/R)
     - rasa kaki (legGL/R)      x   rasa mulut (sugarL/R, bitterL/R)
   DNp09 (p9L/R, dorongan lapar) AMAN dikombinasikan dengan SALAH SATU
   dari ketiganya. Sapuan & js/alive.js WAJIB menaati aturan ini - jangan
   tambah kondisi yang melanggarnya tanpa menguji ulang seperti di atas.

   Jalankan (butuh .flywire-cache/brain783 dari tools/export_brain783.py):
     node tools/build_brain_subnet.cjs
   ========================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const SIM_MS = 2000;

// Kelompok input (sensor/dorongan) & keluaran (DN pembaca gerak) - lihat
// komentar di js/alive.js untuk rujukan literatur tiap kelompok.
const INPUTS = {
  p9L: { cell_type: 'DNp09', side: 'left' },
  p9R: { cell_type: 'DNp09', side: 'right' },
  sugarL: { cell_sub_class: 'sugar/water', side: 'left' },
  sugarR: { cell_sub_class: 'sugar/water', side: 'right' },
  bitterL: { cell_sub_class: 'bitter', side: 'left' },
  bitterR: { cell_sub_class: 'bitter', side: 'right' },
  // giant fiber (DNp01) - LPLC2 (ukuran sudut) + LC4 (kecepatan sudut) -
  // von Reyn, Card dkk. 2019 Current Biology
  lc4L: { cell_type: 'LC4', side: 'left' },
  lc4R: { cell_type: 'LC4', side: 'right' },
  lplc2L: { cell_type: 'LPLC2', side: 'left' },
  lplc2R: { cell_type: 'LPLC2', side: 'right' },
  // rasa kaki (leg ascending gustatory receptor neurons / lgAGRNs, jalur
  // SA_VTV_* di FlyWire) - Schlegel dkk. 2024 / McKellar dkk. 2025 (bioRxiv)
  legGL: { super_class: 'sensory_ascending', cell_class: 'gustatory', side: 'left' },
  legGR: { super_class: 'sensory_ascending', cell_class: 'gustatory', side: 'right' }
};
const OUTPUT_TYPES = [
  'DNg97', 'DNa02', 'DNa01', 'DNb02', 'CB0890', 'DNg60', 'CB0701', 'MDN',
  'DNp01',                       // GF (giant fiber) - lompat + lepas landas
  'DNp02', 'DNp04', 'DNp11'      // DN lain yang direkrut LC4/LPLC2 (arah kabur)
];

// Batas laju input AMAN (diuji stabil, lihat catatan di atas & docs/otak-lalat.md):
//   - dorongan lapar (p9), gula, pahit: sampai 100 Hz (sapuan lama)
//   - visi/giant fiber (lc4, lplc2): sampai 100 Hz, TAK BOLEH bareng rasa
//   - rasa kaki (legG): sampai 40 Hz, TAK BOLEH bareng rasa mulut/visi
function conditions() {
  const out = [];
  for (const p9 of [0, 25, 50, 75, 100])
    for (const side of ['both', 'L', 'R'])
      for (const sugar of [0, 25, 50, 75, 100])
        for (const bitter of [0, 50, 100]) {
          if (p9 === 0 && side !== 'both') continue;
          out.push({ p9L: side !== 'R' ? p9 : 0, p9R: side !== 'L' ? p9 : 0,
                     sugarL: sugar, sugarR: sugar, bitterL: bitter, bitterR: bitter });
        }
  // gula/pahit satu sisi saja (tetes di satu sisi mulut)
  for (const s of [50, 100]) {
    out.push({ p9L: 100, p9R: 100, sugarL: s, sugarR: 0, bitterL: 0, bitterR: 0 });
    out.push({ p9L: 100, p9R: 100, sugarL: 0, sugarR: s, bitterL: 0, bitterR: 0 });
    out.push({ p9L: 100, p9R: 100, sugarL: s, sugarR: 0, bitterL: s, bitterR: 0 });
    out.push({ p9L: 100, p9R: 100, sugarL: 0, sugarR: s, bitterL: 0, bitterR: s });
  }
  // visi/giant fiber - SENDIRIAN atau dengan p9 saja (tak pernah + rasa).
  // lc4 & lplc2 SISI YANG SAMA selalu digerakkan pada laju yang SAMA
  // (js/alive.js memakai satu sinyal "kuat looming" per sisi, bukan dua
  // sinyal independen - lihat catatan di alive.js) - jadi yang perlu
  // disapu cuma rasio kiri:kanan (wL) & kekuatan keseluruhan (rate).
  for (const p9 of [0, 50, 100])
    for (const wL of [0, 0.25, 0.5, 0.75, 1])
      for (const rate of [30, 60, 100]) {
        const rL = Math.round(rate * wL), rR = Math.round(rate * (1 - wL));
        out.push({ p9L: p9, p9R: p9, lc4L: rL, lc4R: rR, lplc2L: rL, lplc2R: rR });
      }
  // rasa kaki - dengan p9 saja (tak pernah + rasa mulut/visi)
  for (const p9 of [0, 50, 100])
    for (const side of ['both', 'L', 'R'])
      for (const rate of [15, 30, 40]) {
        out.push({ p9L: side !== 'R' ? p9 : 0, p9R: side !== 'L' ? p9 : 0,
                   legGL: side !== 'R' ? rate : 0, legGR: side !== 'L' ? rate : 0 });
      }
  return out;
}

function runCond(B, groups, cond, ms) {
  const sim = B.LIF.create(B.net);
  const d = {};
  for (const g in cond) if (cond[g] > 0) groups[g].forEach(i => { d[i] = cond[g]; });
  sim.setDrive(d);
  sim.run(ms);
  return sim.spikeCount;
}

if (!isMainThread) {
  const B = require('./brain-node.cjs').load();
  const groups = {};
  for (const g in INPUTS) groups[g] = B.select(INPUTS[g]);
  const seen = new Uint8Array(B.net.n);
  for (const cond of workerData.conds) {
    const sc = runCond(B, groups, cond, SIM_MS);
    for (let i = 0; i < sc.length; i++) if (sc[i]) seen[i] = 1;
  }
  parentPort.postMessage(seen);
  return;
}

(async function main() {
  const B = require('./brain-node.cjs').load();
  const conds = conditions();
  const nW = Math.max(1, Math.min(8, os.cpus().length));
  console.log('kondisi:', conds.length, '| worker:', nW, '| durasi/kondisi:', SIM_MS, 'ms');
  const t0 = Date.now();
  const parts = await Promise.all(Array.from({ length: nW }, (_, w) => new Promise((res, rej) => {
    const wk = new Worker(__filename, { workerData: { conds: conds.filter((_, k) => k % nW === w) } });
    wk.on('message', res); wk.on('error', rej);
  })));
  const keep = new Uint8Array(B.net.n);
  parts.forEach(s => s.forEach((v, i) => { if (v) keep[i] = 1; }));

  const groups = {};
  for (const g in INPUTS) { groups[g] = B.select(INPUTS[g]); groups[g].forEach(i => { keep[i] = 1; }); }
  const outputs = {};
  OUTPUT_TYPES.forEach(t => { outputs[t] = B.select({ cell_type: t }); outputs[t].forEach(i => { keep[i] = 1; }); });

  const sel = [];
  keep.forEach((v, i) => { if (v) sel.push(i); });
  const local = new Map(sel.map((g, k) => [g, k]));
  const offsets = [0], post = [], w = [];
  sel.forEach(g => {
    for (let e = B.net.offsets[g]; e < B.net.offsets[g + 1]; e++) {
      const j = local.get(B.net.post[e]);
      if (j !== undefined) { post.push(j); w.push(B.net.w[e]); }
    }
    offsets.push(post.length);
  });
  console.log('neuron dipakai:', sel.length, '| sinaps:', post.length, '| waktu', ((Date.now() - t0) / 1000).toFixed(1), 's');

  const A = B.annot;
  const mapLocal = arr => arr.map(i => local.get(i));
  const hasPos = A.chassisX != null;
  const data = {
    source: 'FlyWire v783 via Shiu dkk. 2024 (Connectivity_783.parquet), anotasi Schlegel dkk. 2024',
    cite: 'Dorkenwald dkk. 2024 Nature; Schlegel dkk. 2024 Nature; Shiu dkk. 2024 Nature; Sapkal dkk. 2024 Nature; von Reyn & Card dkk. 2019 Current Biology',
    generated: new Date().toISOString().slice(0, 10),
    note: 'Potongan otak: semua neuron yang pernah menembak pada ' + conds.length +
          ' kombinasi input (' + SIM_MS + ' ms, otak utuh), + neuron input/keluaran. Model LIF tanpa aktivitas spontan, jadi neuron yang tak pernah menembak tak berpengaruh.',
    n: sel.length,
    ids: sel.map(i => B.ids[i]),
    type: sel.map(i => A.cell_type[i] || null),
    side: sel.map(i => A.side[i] || null),
    cls: sel.map(i => A.super_class[i] || null),
    key: sel,   // indeks di otak utuh (fase input, lihat js/lif-brain.js)
    offsets, post, w,
    inputs: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, mapLocal(v)])),
    outputs: Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, mapLocal(v)]))
  };
  if (hasPos) {
    // posisi 3D (satuan sasis fly.js) - untuk visualisasi otak, lihat
    // tools/export_brain783.py. Dibulatkan ke 3 desimal (cukup untuk titik
    // kecil di dalam kepala, menghemat ukuran berkas).
    data.pos = sel.map(i => [A.chassisX[i], A.chassisY[i], A.chassisZ[i]]
      .map(v => v == null ? null : Math.round(v * 1000) / 1000));
  }
  // Cek: potongan vs otak utuh harus IDENTIK pada titik SAPUAN (grid
  // conditions() persis) - ini yang MENGGERBANG penulisan berkas.
  // p9 di produksi (js/alive.js) memakai nilai KONTINU dari rasa lapar,
  // sedangkan looming juga kontinu (angSize/dAng) - keduanya BISA jatuh
  // DI LUAR titik sapuan. Itu pendekatan yang sudah didokumentasikan
  // (docs/otak-lalat.md) & terbukti tak bermasalah di uji Playwright
  // sebelumnya (p9 kontinu sejak awal) - dicek di sini hanya sebagai
  // INFORMASI (softChecks), TIDAK menggagalkan penulisan berkas.
  const LIF = B.LIF;
  const subNet = { n: sel.length, offsets: Int32Array.from(offsets), post: Int32Array.from(post), w: Int16Array.from(w), key: Int32Array.from(sel) };
  function checkOne(c) {
    const full = runCond(B, groups, c, 1000);
    const sim = LIF.create(subNet); const d = {};
    for (const g in c) groups[g].forEach(i => { d[local.get(i)] = c[g]; });
    sim.setDrive(d); sim.run(1000);
    const fo = [], so = [];
    OUTPUT_TYPES.forEach(t => outputs[t].forEach(i => { fo.push(full[i]); so.push(sim.spikeCount[local.get(i)]); }));
    return fo.join() === so.join() ? null : fo.join();
  }
  const hardChecks = [   // PERSIS di titik sapuan conditions() - wajib identik
    { p9L: 100, p9R: 100 }, { p9L: 100, p9R: 100, sugarL: 100, sugarR: 100 },
    { p9L: 60, p9R: 60, sugarL: 75, sugarR: 0, bitterL: 100, bitterR: 0 },
    { p9L: 100, p9R: 100, lc4L: 100, lc4R: 0, lplc2L: 100, lplc2R: 0 },
    { p9L: 50, p9R: 50, lc4L: 30, lc4R: 30, lplc2L: 30, lplc2R: 30 },
    { p9L: 100, p9R: 100, legGL: 40, legGR: 0 }
  ];
  const softChecks = [   // sengaja DI LUAR sapuan - cuma informasi
    { p9L: 80, p9R: 80, lc4L: 90, lc4R: 40, lplc2L: 90, lplc2R: 40 },
    { p9L: 37, p9R: 37, legGL: 22, legGR: 9 }
  ];
  let allSame = true;
  hardChecks.forEach(c => {
    const diff = checkOne(c);
    allSame = allSame && !diff;
    console.log('cek (sapuan)  ', JSON.stringify(c), diff ? 'BEDA: ' + diff : 'IDENTIK');
  });
  softChecks.forEach(c => {
    const diff = checkOne(c);
    console.log('cek (di luar) ', JSON.stringify(c), diff ? 'beda dikit (wajar, lihat komentar)' : 'identik juga');
  });
  if (!allSame) { console.error('Potongan otak TIDAK identik dengan otak utuh DI TITIK SAPUAN - berkas tidak ditulis.'); process.exit(1); }

  const outFile = path.join(__dirname, '..', 'data', 'brain-lalat.json');
  fs.writeFileSync(outFile, JSON.stringify(data));
  console.log('ditulis:', outFile, (fs.statSync(outFile).size / 1024).toFixed(0), 'KB');
})();
