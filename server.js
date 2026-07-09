const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 8000;
const base = path.join(__dirname);

function contentType(p) {
  const ext = path.extname(p).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.svgz': 'image/svg+xml'
  }[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/login.html';
  const filePath = path.join(base, urlPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - Arquivo não encontrado');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(port, '0.0.0.0', () => console.log(`Server listening on http://localhost:${port} and on all network interfaces`));
