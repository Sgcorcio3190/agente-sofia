// Minimal HTTP server for Railway web deployments.
// The agent itself still runs through src/index.js or the /run endpoint.

require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 3000;
let running = false;
let lastRun = null;
let lastError = null;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function isAuthorized(req) {
  if (!process.env.RUN_TOKEN) return true;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return token === process.env.RUN_TOKEN;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'Agente de Licitaciones COMPRASAL',
      running,
      lastRun,
      lastError,
      runEndpoint: '/run',
    });
  }

  if (url.pathname === '/run') {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return sendJson(res, 405, { ok: false, error: 'Use GET or POST' });
    }

    if (!isAuthorized(req)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    }

    if (running) {
      return sendJson(res, 409, { ok: false, error: 'Agent is already running' });
    }

    running = true;
    lastError = null;

    try {
      const { runOnce } = require('./index');
      await runOnce();
      lastRun = new Date().toISOString();
      return sendJson(res, 200, { ok: true, lastRun });
    } catch (err) {
      lastError = err.message;
      return sendJson(res, 500, { ok: false, error: err.message });
    } finally {
      running = false;
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Agente Sofia escuchando en puerto ${PORT}`);
});
