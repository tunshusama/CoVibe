const http = require('http');
const fs = require('fs');
const path = require('path');

const { run: runReviewAgent } = require('../skills/review-agent/index');
const { run: runBuildAgent } = require('../skills/build-agent/index');
const { run: runReleaseAgent } = require('../skills/release-agent/index');

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FEATURE_FILES_DIR = process.env.FEATURES_DIR || path.join(PUBLIC_DIR, 'features');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const FEATURES_FILE = path.join(DATA_DIR, 'features.json');

// Ensure data files exist
function initDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, '[]');
  }
  if (!fs.existsSync(FEATURES_FILE)) {
    fs.writeFileSync(FEATURES_FILE, '[]');
  }
  if (!fs.existsSync(FEATURE_FILES_DIR)) {
    fs.mkdirSync(FEATURE_FILES_DIR, { recursive: true });
  }
}

function loadSubmissions() {
  return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
}

function saveSubmissions(submissions) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
}

function loadFeatures() {
  return JSON.parse(fs.readFileSync(FEATURES_FILE, 'utf8'));
}

function generateId() {
  const submissions = loadSubmissions();
  return submissions.length > 0 ? Math.max(...submissions.map((s) => s.id)) + 1 : 1;
}

function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function serveStatic(req, res, publicDir) {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);
  const normalized = reqPath === '/' ? '/index.html' : reqPath;
  const fullPath = path.normalize(path.join(publicDir, normalized));

  if (!fullPath.startsWith(publicDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(fullPath) });
    res.end(data);
  });
}

function serveFeatureFile(req, res) {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);
  const normalized = reqPath.replace(/^\/features\//, '');
  if (!normalized || normalized.includes('..')) {
    sendText(res, 400, 'Bad Request');
    return true;
  }

  const fullPath = path.normalize(path.join(FEATURE_FILES_DIR, normalized));
  if (!fullPath.startsWith(FEATURE_FILES_DIR)) {
    sendText(res, 403, 'Forbidden');
    return true;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(fullPath) });
    res.end(data);
  });
  return true;
}

function createRateLimiter({ limit = 20, windowMs = 60_000 } = {}) {
  const store = new Map();
  return {
    allow(ip) {
      const now = Date.now();
      const bucket = store.get(ip) || [];
      const fresh = bucket.filter((ts) => now - ts < windowMs);
      if (fresh.length >= limit) {
        store.set(ip, fresh);
        return false;
      }
      fresh.push(now);
      store.set(ip, fresh);
      return true;
    }
  };
}

function safeRequestInput(value) {
  const text = String(value || '').trim();
  if (!text) return { valid: false, reason: '需求为空。' };
  if (text.length > 200) return { valid: false, reason: '需求太长，请限制在 200 字以内。' };
  if (!/[\p{L}\p{N}\p{P}\p{Zs}]+/u.test(text)) {
    return { valid: false, reason: '需求包含非法字符。' };
  }
  return { valid: true, value: text };
}

function createAppServer({
  host = process.env.HOST || '0.0.0.0',
  port = DEFAULT_PORT,
  publicDir = PUBLIC_DIR,
  rateLimiter = createRateLimiter(),
  autoPipeline = true
} = {}) {
  let pipelineRunning = false;
  let pipelineQueued = false;

  async function runPipelineLoop() {
    if (pipelineRunning) return;

    pipelineRunning = true;
    try {
      do {
        pipelineQueued = false;

        const reviewRes = await runReviewAgent();
        const buildRes = await runBuildAgent();
        const releaseRes = await runReleaseAgent();

        const touched = Number(reviewRes?.processed || 0) + Number(buildRes?.processed || 0) + Number(releaseRes?.processed || 0);
        if (touched === 0) break;
      } while (pipelineQueued);
    } catch (error) {
      console.error('PIPELINE: Unexpected failure', error);
    } finally {
      pipelineRunning = false;
      if (pipelineQueued) {
        setTimeout(runPipelineLoop, 0);
      }
    }
  }

  function enqueuePipeline() {
    if (!autoPipeline) return;
    pipelineQueued = true;
    setTimeout(runPipelineLoop, 0);
  }

  const server = http.createServer(async (req, res) => {
    const { method, url } = req;

    // GET /api/state - 获取公开状态（已发布功能列表）
    if (method === 'GET' && url === '/api/state') {
      const features = loadFeatures();
      const submissions = loadSubmissions();
      const recentSubmissions = submissions.slice(-10).reverse();
      return sendJSON(res, 200, {
        releasedFeatures: features,
        recentSubmissions: recentSubmissions.map((s) => ({
          id: s.id,
          request: s.request,
          status: s.status,
          createdAt: s.createdAt
        }))
      });
    }

    // GET /api/submissions/:id - 获取单个提交详情
    const matchSubmission = method === 'GET' && url.match(/^\/api\/submissions\/(\d+)$/);
    if (matchSubmission) {
      const submissionId = Number(matchSubmission[1]);
      const submissions = loadSubmissions();
      const submission = submissions.find((s) => s.id === submissionId);
      if (!submission) {
        return sendJSON(res, 404, { error: 'Submission not found' });
      }
      return sendJSON(res, 200, submission);
    }

    // POST /api/submit - 提交新需求
    if (method === 'POST' && url === '/api/submit') {
      try {
        const ip = req.socket.remoteAddress || 'unknown';
        if (!rateLimiter.allow(ip)) {
          return sendJSON(res, 429, { error: '请求过于频繁，请稍后再试。' });
        }

        const body = await parseBody(req);
        const input = safeRequestInput(body.request);
        if (!input.valid) {
          return sendJSON(res, 400, { error: input.reason });
        }

        const submissions = loadSubmissions();
        const submission = {
          id: generateId(),
          request: input.value,
          status: 'RECEIVED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ip,
          review: null,
          artifact: null,
          featureFile: null,
          releasedAt: null,
          error: null
        };

        submissions.push(submission);
        saveSubmissions(submissions);

        console.log(`New submission #${submission.id}: "${submission.request}"`);
        enqueuePipeline();

        return sendJSON(res, 202, {
          submissionId: submission.id,
          status: submission.status
        });
      } catch (error) {
        return sendJSON(res, 400, { error: error.message });
      }
    }

    // Static files
    if (method === 'GET') {
      if (url.startsWith('/features/')) {
        return serveFeatureFile(req, res);
      }
      return serveStatic(req, res, publicDir);
    }

    return sendText(res, 405, 'Method Not Allowed');
  });

  return {
    server,
    host,
    port,
    start() {
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          server.removeListener('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.removeListener('error', onError);
          resolve(server);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
    }
  };
}

async function startServer(options = {}) {
  initDataFiles();

  const requestedPort = Number(options.port || DEFAULT_PORT);
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i += 1) {
    const candidatePort = requestedPort + i;
    const app = createAppServer({ ...options, port: candidatePort });
    try {
      await app.start();
      const address = app.server.address();
      const finalPort = typeof address === 'object' && address ? address.port : app.port;
      console.log(`CoVibe (OpenClaw) running at http://${app.host}:${finalPort}`);
      console.log('OpenClaw pipeline active: submit -> review -> Kimi code build -> GitHub release');
      return app.server;
    } catch (error) {
      if (error && error.code === 'EADDRINUSE') {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Unable to bind a port in range ${requestedPort}-${requestedPort + maxAttempts - 1}`);
}

if (require.main === module) {
  startServer();
}

module.exports = { createAppServer, startServer };
