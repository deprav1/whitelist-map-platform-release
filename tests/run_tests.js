const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, '..', 'public-lite');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Extract path and decode URI components (e.g. spaces, Cyrillic symbols in filenames)
  let requestPath = decodeURIComponent(req.url.split('?')[0]);
  if (requestPath === '/') {
    requestPath = '/index.html';
  }
  
  const filePath = path.join(PUBLIC_DIR, requestPath);
  
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${requestPath}`);
      return;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[HTTP Server] Error: Port ${PORT} is already in use.`);
  } else {
    console.error('[HTTP Server] Error:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`[HTTP Server] Running on http://localhost:${PORT}`);
  
  const args = ['playwright', 'test', ...process.argv.slice(2)];
  console.log(`[Test Runner] Executing: npx ${args.join(' ')}`);
  
  const env = { ...process.env, TEST_URL: `http://localhost:${PORT}` };
  const testProcess = spawn('npx', args, { stdio: 'inherit', shell: true, env });
  
  testProcess.on('close', (code) => {
    console.log(`[Test Runner] Playwright process exited with code ${code}`);
    server.close(() => {
      console.log('[HTTP Server] Stopped.');
      process.exit(code);
    });
  });
  
  testProcess.on('error', (err) => {
    console.error('[Test Runner] Failed to start Playwright process:', err);
    server.close(() => {
      process.exit(1);
    });
  });
});
