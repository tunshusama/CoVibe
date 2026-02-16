const { TEMPLATE_DEFINITIONS } = require('./review-service');

function sanitizeSlot(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .slice(0, 80)
    .trim();
}

function baseTemplate(type) {
  const title = TEMPLATE_DEFINITIONS[type] ? TEMPLATE_DEFINITIONS[type].title : '功能模块';

  switch (type) {
    case 'todo':
      return {
        moduleType: 'todo',
        moduleConfig: { initialItems: [] },
        uiSpec: { title, inputPlaceholder: '新增待办', actionLabel: '添加', emptyHint: '还没有任务' }
      };
    case 'counter':
      return {
        moduleType: 'counter',
        moduleConfig: { initialValue: 0, step: 1 },
        uiSpec: { title, incrementLabel: '+', decrementLabel: '-', valuePrefix: '当前值' }
      };
    case 'note':
      return {
        moduleType: 'note',
        moduleConfig: { initialText: '' },
        uiSpec: { title, inputPlaceholder: '写点什么', previewHint: '（实时预览）' }
      };
    case 'picker':
      return {
        moduleType: 'picker',
        moduleConfig: { delimiter: ',', initialOptions: [] },
        uiSpec: { title, inputPlaceholder: '输入选项，逗号分隔', actionLabel: '抽一个', emptyHint: '请先输入选项', resultPrefix: '结果' }
      };
    case 'timer':
      return {
        moduleType: 'timer',
        moduleConfig: { defaultMinutes: 25 },
        uiSpec: { title, actionLabel: '开始', doneLabel: '时间到', initialValue: '25:00' }
      };
    default:
      return null;
  }
}

function defaultSlots(type, request) {
  const suffix = sanitizeSlot(request).slice(0, 10) || '新功能';
  return {
    title: sanitizeSlot(`${TEMPLATE_DEFINITIONS[type].title} · ${suffix}`),
    helperText: sanitizeSlot(`来自需求：${suffix}`)
  };
}

function readJsonFromText(content) {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    const maybeJson = content.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybeJson);
    } catch {
      return null;
    }
  }
}

function pickSlotsFromModelResponse(responseText) {
  const parsed = readJsonFromText(responseText);
  if (!parsed || typeof parsed !== 'object') return null;

  return {
    title: sanitizeSlot(parsed.title),
    helperText: sanitizeSlot(parsed.helperText),
    inputPlaceholder: sanitizeSlot(parsed.inputPlaceholder),
    actionLabel: sanitizeSlot(parsed.actionLabel)
  };
}

function createKimiClient(options = {}) {
  const apiKey = options.apiKey || process.env.KIMI_API_KEY;
  const baseUrl = options.baseUrl || process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
  const model = options.model || process.env.KIMI_MODEL || 'kimi-k2-5';

  return {
    async fillSlots({ request, matchedTemplate, timeoutMs }) {
      if (!apiKey) {
        throw new Error('MISSING_KIMI_API_KEY');
      }

      const prompt = [
        '你是 OpenClaw 的文案补全器。',
        `模板类型: ${matchedTemplate}`,
        `用户需求: ${request}`,
        '请只返回一个 JSON 对象，不要包含 markdown 代码块。',
        '可选字段: title, helperText, inputPlaceholder, actionLabel',
        '不要输出可执行代码，不要输出 HTML 标签。'
      ].join('\n');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              { role: 'system', content: 'You only output JSON.' },
              { role: 'user', content: prompt }
            ]
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`KIMI_HTTP_${res.status}:${text.slice(0, 120)}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        const slots = pickSlotsFromModelResponse(content);
        if (!slots) {
          throw new Error('KIMI_BAD_CONTENT');
        }
        return slots;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('KIMI_TIMEOUT');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

async function generateArtifact({ request, matchedTemplate, timeoutMs = 2000, llmClient }) {
  const template = baseTemplate(matchedTemplate);
  if (!template) {
    throw new Error('UNSUPPORTED_TEMPLATE');
  }

  const client = llmClient || createKimiClient();
  let llm = { used: true, fallback: false, reason: null, provider: 'kimi-2.5' };
  let slots = null;

  try {
    slots = await client.fillSlots({ request, matchedTemplate, timeoutMs });
  } catch (error) {
    llm = { used: true, fallback: true, reason: error.message, provider: 'kimi-2.5' };
    slots = defaultSlots(matchedTemplate, request);
  }

  if (slots) {
    if (slots.title) template.uiSpec.title = slots.title;
    if (slots.helperText) template.uiSpec.helperText = slots.helperText;
    if (slots.inputPlaceholder) template.uiSpec.inputPlaceholder = slots.inputPlaceholder;
    if (slots.actionLabel) template.uiSpec.actionLabel = slots.actionLabel;
  }

  return {
    moduleType: template.moduleType,
    moduleConfig: template.moduleConfig,
    uiSpec: template.uiSpec,
    llm
  };
}

module.exports = {
  generateArtifact,
  createKimiClient,
  pickSlotsFromModelResponse
};
