/* Server statis mini. Jalankan:  node serve.js   lalu buka http://localhost:5173

   Dipakai juga di produksi (lalat.sopeng.cloud, di belakang Caddy yang
   menambah HTTPS & kompresi), jadi:
     - hanya jenis berkas di MIME yang disajikan, dan tak ada folder/berkas
       tersembunyi (.git, .flywire-cache, ...) - data mentah (.parquet,
       .feather, ratusan MB - GB) & alat (tools/*.py) tidak ikut publik;
     - berkas dialirkan (stream), bukan dibaca utuh ke memori;
     - ETag/Last-Modified + 304: kunjungan ulang tak mengunduh ulang
       berkas yang tak berubah (Cache-Control no-cache = selalu cek dulu);
     - alamat rusak (%-encoding salah) dijawab 400, bukan membuat server mati. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function fail(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }).end(code + ' ' + msg);
}

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { fail(res, 405, 'metode tidak didukung'); return; }
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { fail(res, 400, 'alamat rusak'); return; }
  if (p === '/') p = '/index.html';
  const rel = path.normalize(p).replace(/^(\.\.[\/\\])+/, '');
  const file = path.join(ROOT, rel);
  const type = MIME[path.extname(file).toLowerCase()];
  // tolak di luar ROOT, segmen tersembunyi (".git", ".flywire-cache"), dan
  // jenis berkas di luar daftar (mis. .parquet/.feather/.py)
  if (!file.startsWith(ROOT + path.sep) || rel.split(/[\/\\]/).some(s => s.startsWith('.')) || !type) {
    fail(res, 404, p); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { fail(res, 404, p); return; }
    const etag = 'W/"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const headers = {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'ETag': etag,
      'Last-Modified': st.mtime.toUTCString()
    };
    // Caddy bisa menambah akhiran pengodean ke ETag (mis. -gzip) saat
    // mengompres - dilepas dulu sebelum dibandingkan.
    const inm = req.headers['if-none-match'];
    const ims = req.headers['if-modified-since'];
    const fresh = inm
      ? inm.split(',').some(t => t.trim().replace(/-(gzip|zstd|br)"$/, '"') === etag)
      : !!ims && Date.parse(ims) >= Math.floor(st.mtimeMs / 1000) * 1000;
    if (fresh) { res.writeHead(304, headers).end(); return; }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}).listen(PORT, () => console.log('→ http://localhost:' + PORT));
