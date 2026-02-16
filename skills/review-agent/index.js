const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

// 风险关键词
const RISK_KEYWORDS = ['删库', '攻击', 'xss', 'sql注入', '木马', '病毒', 'shell', 'exec(', 'rm -rf', 'eval(', 'document.write', 'innerHTML', 'cookie', 'localStorage', 'fetch('];
const LEGAL_RISK_KEYWORDS = ['赌博', '诈骗', '洗钱', '黑产', '盗号', '钓鱼', '外挂', '破解', '入侵', '违法', '违禁', '仿冒', '盗版', '色情', '成人内容', '毒品', '枪支', '炸弹', '监听', '窃取'];
const COMPLEXITY_KEYWORDS = ['支付系统', '实时协作', '音视频', '直播', '多租户', '权限系统', '工作流引擎', '训练模型', '推荐系统', '区块链', '爬虫平台', '搜索引擎', 'ERP', 'CRM'];

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

function scoreClarity(request) {
  const text = request.trim();
  if (!text) return 0;
  if (text.length < 3) return 20;
  if (text.length > 500) return 30;

  let score = 50;
  if (text.length >= 8) score += 20;
  if (/想要|希望|需要|做一个|添加|给我|功能|组件/i.test(text)) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

function scoreSafety(request) {
  const lower = request.toLowerCase();
  let score = 100;
  for (const risk of RISK_KEYWORDS) {
    if (lower.includes(risk.toLowerCase())) score -= 40;
  }
  for (const risk of LEGAL_RISK_KEYWORDS) {
    if (lower.includes(risk.toLowerCase())) score -= 50;
  }
  if (/javascript:|<script|onerror=|onload=|onmouseover=/i.test(lower)) score -= 50;
  return Math.max(0, Math.min(100, score));
}

function scoreComplexity(request) {
  const text = String(request || '').trim();
  if (!text) return 0;

  let score = 10;
  if (text.length > 120) score += 20;
  if (text.length > 260) score += 20;
  if (text.length > 420) score += 20;

  const clauseCount = (text.match(/[，,。；;、]/g) || []).length;
  score += Math.min(20, clauseCount * 2);

  for (const keyword of COMPLEXITY_KEYWORDS) {
    if (text.includes(keyword)) score += 20;
  }

  const numberedSteps = (text.match(/\d+\./g) || []).length;
  score += Math.min(20, numberedSteps * 5);

  return Math.max(0, Math.min(100, score));
}

function reviewSubmission(request) {
  const text = String(request || '').trim();
  const clarity = scoreClarity(text);
  const safety = scoreSafety(text);
  const complexity = scoreComplexity(text);

  if (!text) {
    return {
      approved: false,
      scores: { clarity: 0, safety: 100, complexity: 0 },
      reason: '需求为空，请输入你希望网站增加的功能。',
      recommendedApproach: null
    };
  }

  if (text.length > 500) {
    return {
      approved: false,
      scores: { clarity, safety, complexity },
      reason: '需求太长，请限制在 500 字以内。',
      recommendedApproach: null
    };
  }

  if (safety < 60) {
    return {
      approved: false,
      scores: { clarity, safety, complexity },
      reason: '检测到法律/安全风险，需求被拒绝。',
      recommendedApproach: null
    };
  }

  if (complexity >= 70) {
    return {
      approved: false,
      scores: { clarity, safety, complexity },
      reason: '需求复杂度过高，超出当前自动生成能力，请拆分为更小的需求。',
      recommendedApproach: '建议拆成 1-2 个简单交互功能分别提交。'
    };
  }

  if (clarity < 40) {
    return {
      approved: false,
      scores: { clarity, safety, complexity },
      reason: '需求描述不够清晰，请补充具体想要的交互和功能细节。',
      recommendedApproach: '建议描述：功能名称、主要操作、显示内容'
    };
  }

  // 开放式评审 - 只要清晰+安全就通过
  return {
    approved: true,
    scores: { clarity, safety, complexity },
    reason: `评审通过：${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`,
    recommendedApproach: `根据需求 "${text.slice(0, 100)}" 生成交互式组件，包含用户描述的输入、操作和显示逻辑。`
  };
}

async function run() {
  const submissions = loadSubmissions();
  const pending = submissions.filter(s => s.status === 'RECEIVED' || s.status === 'REVIEWING');
  
  if (pending.length === 0) {
    console.log('REVIEW_AGENT: No pending submissions to review');
    return { processed: 0 };
  }

  console.log(`REVIEW_AGENT: Found ${pending.length} submission(s) to review`);

  for (const submission of pending) {
    if (submission.status === 'CANCELLED') {
      console.log(`REVIEW_AGENT: Submission #${submission.id} cancelled, skip`);
      continue;
    }
    console.log(`REVIEW_AGENT: Reviewing submission #${submission.id}: "${submission.request}"`);
    
    submission.status = 'REVIEWING';
    submission.updatedAt = nowISO();
    
    const review = reviewSubmission(submission.request);
    submission.review = review;
    
    if (review.approved) {
      submission.status = 'APPROVED';
      console.log(`REVIEW_AGENT: Submission #${submission.id} APPROVED`);
    } else {
      submission.status = 'REJECTED';
      console.log(`REVIEW_AGENT: Submission #${submission.id} REJECTED - ${review.reason}`);
    }
    
    submission.updatedAt = nowISO();
  }

  saveSubmissions(submissions);
  
  return { 
    processed: pending.length,
    approved: pending.filter(s => s.status === 'APPROVED').length,
    rejected: pending.filter(s => s.status === 'REJECTED').length
  };
}

module.exports = { run };

// CLI mode
if (require.main === module) {
  run().then(result => {
    console.log('Review Agent completed:', result);
    process.exit(0);
  }).catch(err => {
    console.error('Review Agent failed:', err);
    process.exit(1);
  });
}
