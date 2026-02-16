const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const FEATURES_DIR = process.env.FEATURES_DIR || path.join(__dirname, '../../public/features');
const REPO_ROOT = path.join(__dirname, '../..');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');

const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
const KIMI_CODE_MODEL = process.env.KIMI_CODE_MODEL || process.env.KIMI_MODEL || 'kimi-k2.5';
const KIMI_TIMEOUT_MS = Number(process.env.KIMI_TIMEOUT_MS || 120_000);
const KIMI_MAX_RETRIES = Number(process.env.KIMI_MAX_RETRIES || 2);

function loadSubmissions() {
  if (!fs.existsSync(SUBMISSIONS_FILE)) return [];
  return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
}

function saveSubmissions(submissions) {
  fs.mkdirSync(path.dirname(SUBMISSIONS_FILE), { recursive: true });
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
}

function nowISO() {
  return new Date().toISOString();
}

function requestJSON(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        },
        timeout: KIMI_TIMEOUT_MS
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          const statusCode = Number(res.statusCode || 0);
          if (statusCode < 200 || statusCode >= 300) {
            return reject(new Error(`KIMI_HTTP_${statusCode}:${raw.slice(0, 500)}`));
          }
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error('KIMI_BAD_JSON_RESPONSE'));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('KIMI_TIMEOUT'));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function normalizeModelCode(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  return text
    .replace(/^```(?:javascript|js)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function extractAssistantContent(response) {
  const choice = response?.choices?.[0];
  if (!choice) return '';

  const message = choice.message || {};
  const content = message.content;
  if (typeof content === 'string') return content;

  // Some providers return structured content blocks.
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }

  if (typeof response?.output_text === 'string') return response.output_text;
  return '';
}

function enforceRegistrationAndType(code, moduleType) {
  let output = code;

  output = output.replace(
    /window\.registerFeature\s*\(\s*[^,]+,\s*([^)]+)\)/,
    `window.registerFeature('${moduleType}', $1)`
  );

  output = output.replace(
    /registerFeature\s*\(\s*[^,]+,\s*([^)]+)\)/,
    `registerFeature('${moduleType}', $1)`
  );

  output = output.replace(/const\s+moduleType\s*=\s*['"][^'"]+['"]/g, `const moduleType = '${moduleType}'`);
  output = output.replace(/let\s+moduleType\s*=\s*['"][^'"]+['"]/g, `let moduleType = '${moduleType}'`);
  output = output.replace(/var\s+moduleType\s*=\s*['"][^'"]+['"]/g, `var moduleType = '${moduleType}'`);

  if (!/registerFeature\s*\(/.test(output)) {
    // Auto-attach registration if model forgot this final line.
    const hasCreateCardFn =
      /function\s+createCard\s*\(/.test(output) ||
      /const\s+createCard\s*=\s*\(/.test(output) ||
      /let\s+createCard\s*=\s*\(/.test(output) ||
      /var\s+createCard\s*=\s*\(/.test(output);

    if (hasCreateCardFn) {
      output += `\n\nif (typeof window.registerFeature === 'function') {\n  window.registerFeature('${moduleType}', createCard);\n}\n`;
    }
  }

  if (!/registerFeature\s*\(/.test(output)) {
    throw new Error('KIMI_CODE_MISSING_REGISTER_FEATURE');
  }

  return output;
}

function createFallbackFeatureCode({ submission, moduleType, reason }) {
  const safeTitle = String(submission.request || '新功能').replace(/[`$\\]/g, '').slice(0, 120);
  return [
    `// Feature ${submission.id}: ${submission.request}`,
    `// Fallback generated at ${nowISO()} because: ${reason}`,
    `(function() {`,
    `  const moduleType = '${moduleType}';`,
    `  function createCard() {`,
    `    const card = document.createElement('div');`,
    `    card.className = 'card';`,
    `    const title = document.createElement('strong');`,
    `    title.textContent = '${safeTitle}';`,
    `    const titleWrap = document.createElement('div');`,
    `    titleWrap.appendChild(title);`,
    `    const hintWrap = document.createElement('div');`,
    `    hintWrap.className = 'placeholder-content';`,
    `    const hint = document.createElement('p');`,
    `    hint.textContent = '该功能已创建，复杂交互生成失败，已启用兜底展示。';`,
    `    hintWrap.appendChild(hint);`,
    `    const ts = document.createElement('small');`,
    `    ts.textContent = new Date().toLocaleString('zh-CN');`,
    `    card.appendChild(titleWrap);`,
    `    card.appendChild(hintWrap);`,
    `    card.appendChild(ts);`,
    `    return card;`,
    `  }`,
    `  if (typeof window.registerFeature === 'function') {`,
    `    window.registerFeature(moduleType, createCard);`,
    `  }`,
    `})();`,
    ``
  ].join('\n');
}

function escapeForRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateGeneratedCode(code, moduleType) {
  const src = String(code || '');
  if (!src.trim()) throw new Error('KIMI_EMPTY_CODE');

  try {
    new vm.Script(src, { filename: `feature-${moduleType}.js` });
  } catch (error) {
    throw new Error(`KIMI_CODE_SYNTAX_ERROR:${error.message}`);
  }

  if (src.length < 80) {
    throw new Error('KIMI_CODE_TOO_SHORT');
  }

  const requiredRegister = new RegExp(`registerFeature\\s*\\(\\s*['"]${escapeForRegex(moduleType)}['"]`);
  if (!requiredRegister.test(src)) {
    throw new Error('KIMI_CODE_BAD_REGISTER_TARGET');
  }

  if (!/createCard\s*\(/.test(src)) {
    throw new Error('KIMI_CODE_MISSING_CREATE_CARD');
  }

  if (!(/className\s*=\s*['"]card['"]/.test(src) || /classList\.add\(\s*['"]card['"]\s*\)/.test(src))) {
    throw new Error('KIMI_CODE_MISSING_CARD_CLASS');
  }

  if (/\beval\s*\(|\bnew Function\b|document\.write\s*\(/.test(src)) {
    throw new Error('KIMI_CODE_BLOCKED_API');
  }
}

function isUiPatchRequest(request) {
  const text = String(request || '').toLowerCase();
  if (!text) return false;
  return [
    /按钮.*(太小|高度|宽度|样式|ui|界面)/,
    /输入框.*(太矮|太高|多行|五行|高度|样式|ui|界面)/,
    /(删除|删掉|去掉).*(未知模块|模块|红色框|重复)/,
    /(ui|界面|样式|布局|主题|颜色).*(修改|调整|优化|修复)/
  ].some((re) => re.test(text));
}

function patchComposerButtonHeight(stylesText) {
  return stylesText.replace(
    /(\.composer button\s*\{[^}]*?)height:\s*[^;]+;([^}]*\})/s,
    `$1height: auto;\n  min-height: 8.5rem;\n  align-self: stretch;$2`
  );
}

function applyUiPatch(submission) {
  const request = String(submission.request || '');
  const appJsPath = path.join(PUBLIC_DIR, 'app.js');
  const stylesPath = path.join(PUBLIC_DIR, 'styles.css');
  const indexPath = path.join(PUBLIC_DIR, 'index.html');

  const changedFiles = [];

  if (/(删除|删掉|去掉).*(未知模块|模块|红色框|重复)/.test(request) && fs.existsSync(appJsPath)) {
    let appJs = fs.readFileSync(appJsPath, 'utf8');
    const next = appJs
      .replace(/card\.textContent = `未知模块: \$\{type\}`;\n\s*return card;/, 'return null;')
      .replace(
        /if \(feature\.__scriptLoadFailed\) \{[\s\S]*?runtimeRoot\.appendChild\(card\);\n\s*return;\n\s*\}/,
        'if (feature.__scriptLoadFailed) {\n      return;\n    }'
      )
      .replace(
        /runtimeRoot\.appendChild\(createFeatureCard\(feature\)\);/,
        'const card = createFeatureCard(feature);\n    if (card) runtimeRoot.appendChild(card);'
      );

    if (next !== appJs) {
      fs.writeFileSync(appJsPath, next, 'utf8');
      changedFiles.push('public/app.js');
    }
  }

  if (/(按钮.*(太小|高度|宽度|样式)|输入框.*(太矮|太高|多行|五行|高度|样式))/i.test(request) && fs.existsSync(stylesPath)) {
    const styles = fs.readFileSync(stylesPath, 'utf8');
    const next = patchComposerButtonHeight(styles);
    if (next !== styles) {
      fs.writeFileSync(stylesPath, next, 'utf8');
      changedFiles.push('public/styles.css');
    }
  }

  if (/输入框.*(多行|五行)/.test(request) && fs.existsSync(indexPath)) {
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const next = indexHtml.replace(/<textarea id="requestInput"[^>]*rows="\d+"/, '<textarea id="requestInput" rows="5"');
    if (next !== indexHtml) {
      fs.writeFileSync(indexPath, next, 'utf8');
      changedFiles.push('public/index.html');
    }
  }

  if (changedFiles.length === 0) {
    throw new Error('UI_PATCH_NO_EFFECT');
  }

  return {
    kind: 'site-patch',
    moduleType: `site-patch-${submission.id}`,
    changedFiles
  };
}

async function generateKimiCode(submission) {
  if (!KIMI_API_KEY) {
    throw new Error('MISSING_KIMI_API_KEY');
  }

  const moduleType = `custom-${submission.id}`;

  const systemPrompt = [
    'You are OpenClaw build agent.',
    'Generate ONLY executable JavaScript code (no markdown).',
    'Return one self-contained IIFE module.',
    `The moduleType must be exactly "${moduleType}".`,
    'The code must call window.registerFeature(moduleType, createCard).',
    'createCard must return a DOM element with class "card".',
    'Use vanilla JavaScript only.',
    'Do not use eval/new Function/script injection.',
    'Escape user-provided text with window.escapeHTML when rendering dynamic content.',
    'Add one <small> timestamp element inside the card.'
  ].join(' ');

  const userPrompt = [
    `用户需求：${submission.request}`,
    '请生成完整可运行的前端交互组件代码。',
    '不要解释，不要 markdown。'
  ].join('\n');

  const base = new URL(KIMI_BASE_URL);
  const endpoint = new URL('/v1/chat/completions', base);
  let response = null;
  let normalized = '';
  let lastError = null;

  for (let attempt = 1; attempt <= KIMI_MAX_RETRIES + 1; attempt += 1) {
    try {
      response = await requestJSON(
        endpoint,
        {
          model: KIMI_CODE_MODEL,
          temperature: 1,
          max_tokens: 2500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        },
        {
          Authorization: `Bearer ${KIMI_API_KEY}`
        }
      );

      const generatedCode = extractAssistantContent(response);
      normalized = normalizeModelCode(generatedCode);
      if (normalized) break;

      lastError = new Error('KIMI_EMPTY_CODE');
      const canRetryEmpty = attempt <= KIMI_MAX_RETRIES;
      if (!canRetryEmpty) {
        throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      continue;
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt <= KIMI_MAX_RETRIES &&
        (
          String(error.message || '').includes('KIMI_TIMEOUT') ||
          String(error.message || '').includes('KIMI_HTTP_5') ||
          String(error.message || '').includes('KIMI_EMPTY_CODE')
        );
      if (!canRetry) throw error;
      const delayMs = 1000 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (!response) {
    throw lastError || new Error('KIMI_REQUEST_FAILED');
  }
  if (!normalized) {
    throw new Error('KIMI_EMPTY_CODE');
  }

  const enforced = enforceRegistrationAndType(normalized, moduleType);
  validateGeneratedCode(enforced, moduleType);
  const header = [
    `// Feature ${submission.id}: ${submission.request}`,
    `// Generated with Kimi Code API at ${nowISO()}`,
    ''
  ].join('\n');

  return {
    moduleType,
    code: `${header}${enforced}\n`
  };
}

async function run() {
  const submissions = loadSubmissions();
  const pending = submissions.filter((s) => s.status === 'APPROVED');

  if (pending.length === 0) {
    console.log('BUILD_AGENT: No approved submissions to build');
    return { processed: 0 };
  }

  console.log(`BUILD_AGENT: Found ${pending.length} submission(s) to build`);
  console.log(`BUILD_AGENT: Kimi Code API model: ${KIMI_CODE_MODEL}`);

  let built = 0;
  let failed = 0;

  for (const submission of pending) {
    if (submission.status === 'CANCELLED') {
      console.log(`BUILD_AGENT: Submission #${submission.id} cancelled, skip`);
      continue;
    }
    console.log(`BUILD_AGENT: Building submission #${submission.id}: "${submission.request}"`);

    try {
      const latest = loadSubmissions().find((s) => s.id === submission.id);
      if (!latest || latest.status === 'CANCELLED') {
        console.log(`BUILD_AGENT: Submission #${submission.id} cancelled before build, skip`);
        continue;
      }
      submission.status = 'GENERATING';
      submission.updatedAt = nowISO();
      submission.error = null;
      saveSubmissions(submissions);

      let builtResult;
      if (isUiPatchRequest(submission.request)) {
        builtResult = applyUiPatch(submission);
      } else {
        try {
          builtResult = await generateKimiCode(submission);
        } catch (err) {
          if (String(err.message || '').includes('KIMI_CODE_MISSING_REGISTER_FEATURE')) {
            builtResult = {
              moduleType: `custom-${submission.id}`,
              code: createFallbackFeatureCode({
                submission,
                moduleType: `custom-${submission.id}`,
                reason: 'KIMI_CODE_MISSING_REGISTER_FEATURE'
              })
            };
          } else {
            throw err;
          }
        }
      }

      submission.status = 'BUILT';
      if (builtResult.kind === 'site-patch') {
        submission.featureFile = null;
        submission.usedAI = false;
        submission.artifact = {
          moduleType: builtResult.moduleType,
          generatedAt: nowISO(),
          approach: 'site-patch',
          changedFiles: builtResult.changedFiles
        };
      } else {
        const featureFileName = `feature-${submission.id}.js`;
        fs.mkdirSync(FEATURES_DIR, { recursive: true });
        fs.writeFileSync(path.join(FEATURES_DIR, featureFileName), builtResult.code);
        submission.featureFile = featureFileName;
        submission.usedAI = true;
        submission.artifact = {
          moduleType: builtResult.moduleType,
          generatedAt: nowISO(),
          approach: builtResult.code.includes('兜底展示') ? 'kimi-code-api-with-fallback' : 'kimi-code-api'
        };
      }
      submission.updatedAt = nowISO();

      built += 1;
      console.log(
        builtResult.kind === 'site-patch'
          ? `BUILD_AGENT: Submission #${submission.id} BUILT -> site patch (${builtResult.changedFiles.join(', ')})`
          : `BUILD_AGENT: Submission #${submission.id} BUILT -> ${submission.featureFile}`
      );
    } catch (err) {
      submission.status = 'FAILED';
      submission.error = err.message;
      submission.updatedAt = nowISO();
      failed += 1;
      console.error(`BUILD_AGENT: Submission #${submission.id} FAILED - ${err.message}`);
    }

    saveSubmissions(submissions);
  }

  return {
    processed: pending.length,
    built,
    failed
  };
}

module.exports = { run };

if (require.main === module) {
  run()
    .then((result) => {
      console.log('Build Agent completed:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Build Agent failed:', err);
      process.exit(1);
    });
}
