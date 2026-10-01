/* Pemuat konektom utuh (keluaran tools/export_brain783.py) untuk
   menjalankan js/lif-brain.js di Node - uji coba & analisis di server. */
'use strict';
const fs = require('fs');
const path = require('path');
const LIF = require('../js/lif-brain.js');

const DIR = path.join(__dirname, '..', '.flywire-cache', 'brain783');

function readArr(file, Type) {
  const b = fs.readFileSync(path.join(DIR, file));
  return new Type(b.buffer, b.byteOffset, b.byteLength / Type.BYTES_PER_ELEMENT);
}

function load() {
  const ids = fs.readFileSync(path.join(DIR, 'ids.txt'), 'utf8').split('\n');
  const net = {
    n: ids.length,
    offsets: readArr('offsets.i32', Int32Array),
    post: readArr('post.i32', Int32Array),
    w: readArr('w.i16', Int16Array)
  };
  const annot = JSON.parse(fs.readFileSync(path.join(DIR, 'annot.json'), 'utf8'));
  const idx = new Map(ids.map((id, i) => [id, i]));
  // pilih indeks neuron dengan filter anotasi, mis. {cell_type:'DNa02'}
  function select(f) {
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      let ok = true;
      for (const k in f) {
        const v = annot[k][i];
        if (f[k] instanceof RegExp ? !(v && f[k].test(v)) : v !== f[k]) { ok = false; break; }
      }
      if (ok) out.push(i);
    }
    return out;
  }
  return { LIF, net, ids, annot, idx, select };
}

module.exports = { load };
