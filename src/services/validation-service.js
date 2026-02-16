const ALLOWED_CONFIG_KEYS = {
  todo: ['initialItems'],
  counter: ['initialValue', 'step'],
  note: ['initialText'],
  picker: ['delimiter', 'initialOptions'],
  timer: ['defaultMinutes']
};

const FORBIDDEN_PATTERN = /<script|javascript:|onerror=|onload=|eval\(|new Function|=>|function\s*\(/i;

function walk(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) walk(v, visit);
    return;
  }
  visit(value);
}

function hasForbiddenValues(value) {
  let found = false;
  walk(value, (leaf) => {
    if (found) return;
    if (typeof leaf === 'string' && FORBIDDEN_PATTERN.test(leaf)) {
      found = true;
    }
  });
  return found;
}

function validateArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    return { valid: false, errorCode: 'INVALID_ARTIFACT', errorMessage: '产物为空或格式错误。' };
  }

  const { moduleType, moduleConfig, uiSpec } = artifact;

  if (!ALLOWED_CONFIG_KEYS[moduleType]) {
    return { valid: false, errorCode: 'UNSUPPORTED_MODULE', errorMessage: `不支持的模块类型：${moduleType}` };
  }

  if (!moduleConfig || typeof moduleConfig !== 'object' || Array.isArray(moduleConfig)) {
    return { valid: false, errorCode: 'INVALID_CONFIG', errorMessage: 'moduleConfig 必须是对象。' };
  }

  const allowedKeys = ALLOWED_CONFIG_KEYS[moduleType];
  const configKeys = Object.keys(moduleConfig);
  if (configKeys.some((k) => !allowedKeys.includes(k))) {
    return { valid: false, errorCode: 'CONFIG_KEY_DENIED', errorMessage: 'moduleConfig 存在未授权字段。' };
  }

  if (!uiSpec || typeof uiSpec !== 'object' || Array.isArray(uiSpec)) {
    return { valid: false, errorCode: 'INVALID_UI_SPEC', errorMessage: 'uiSpec 必须是对象。' };
  }

  if (hasForbiddenValues({ moduleConfig, uiSpec })) {
    return { valid: false, errorCode: 'FORBIDDEN_CONTENT', errorMessage: '检测到危险内容，禁止发布。' };
  }

  return { valid: true, errorCode: null, errorMessage: null };
}

module.exports = {
  validateArtifact
};
