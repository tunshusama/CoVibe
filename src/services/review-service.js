const TEMPLATE_DEFINITIONS = {
  todo: {
    title: '待办清单',
    keywords: ['todo', '待办', '任务', '清单', 'to-do']
  },
  counter: {
    title: '计数器',
    keywords: ['计数', 'counter', '点击', '加1', '+1', '递增', '统计']
  },
  note: {
    title: '便签',
    keywords: ['便签', '笔记', 'note', '记录', '备忘']
  },
  picker: {
    title: '随机抽签',
    keywords: ['随机', '抽签', '抽取', '选择', 'lottery', 'pick']
  },
  timer: {
    title: '倒计时',
    keywords: ['倒计时', 'timer', '番茄钟', '专注', '计时']
  }
};

const RISK_KEYWORDS = ['删库', '攻击', 'xss', 'sql注入', '木马', '病毒', 'shell', 'exec(', 'rm -rf'];

function matchTemplate(request) {
  const text = request.toLowerCase();
  for (const [type, def] of Object.entries(TEMPLATE_DEFINITIONS)) {
    if (def.keywords.some((kw) => text.includes(kw))) {
      return { type, title: def.title };
    }
  }
  return null;
}

function scoreClarity(request) {
  const text = request.trim();
  if (!text) return 0;
  if (text.length < 4) return 20;
  if (text.length > 200) return 30;

  let score = 40;
  if (text.length >= 8) score += 20;
  if (/我想|希望|需要|请|做一个|增加/i.test(text)) score += 15;
  if (/功能|模块|页面|按钮|输入|显示/i.test(text)) score += 10;
  if (/[\x00-\x1f]/.test(text)) score -= 30;

  return Math.max(0, Math.min(100, score));
}

function scoreSafety(request) {
  const lower = request.toLowerCase();
  let score = 100;
  for (const risk of RISK_KEYWORDS) {
    if (lower.includes(risk)) score -= 30;
  }
  if (/javascript:|<script|onerror=|onload=/i.test(lower)) score -= 40;
  return Math.max(0, Math.min(100, score));
}

function reviewSubmission(request) {
  const text = String(request || '').trim();
  const clarity = scoreClarity(text);
  const matchedTemplate = matchTemplate(text);
  const feasibility = matchedTemplate ? 90 : 20;
  const safety = scoreSafety(text);

  if (!text) {
    return {
      approved: false,
      scores: { clarity: 0, feasibility: 0, safety: 100 },
      reason: '需求为空，请输入你希望网站增加的功能。',
      matchedTemplate: null
    };
  }

  if (text.length > 200) {
    return {
      approved: false,
      scores: { clarity, feasibility, safety },
      reason: '需求太长，请限制在 200 字以内。',
      matchedTemplate: matchedTemplate ? matchedTemplate.type : null
    };
  }

  const approved = clarity >= 40 && feasibility >= 60 && safety >= 80;

  if (!approved) {
    let reason = '评审未通过。';
    if (safety < 80) reason = '检测到高风险指令或潜在攻击意图。';
    else if (feasibility < 60) reason = '当前演示版仅支持待办、计数器、便签、随机抽签、倒计时。';
    else if (clarity < 40) reason = '需求描述不够清晰，请补充具体想要的交互。';

    return {
      approved: false,
      scores: { clarity, feasibility, safety },
      reason,
      matchedTemplate: matchedTemplate ? matchedTemplate.type : null
    };
  }

  return {
    approved: true,
    scores: { clarity, feasibility, safety },
    reason: `评审通过，准备生成并发布：${matchedTemplate.title}`,
    matchedTemplate: matchedTemplate.type
  };
}

module.exports = {
  TEMPLATE_DEFINITIONS,
  reviewSubmission,
  matchTemplate
};
