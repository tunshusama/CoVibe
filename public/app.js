const requestInput = document.getElementById('requestInput');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusText = document.getElementById('statusText');
const runtimeRoot = document.getElementById('runtimeRoot');

const TERMINAL_STATUS = new Set(['RELEASED', 'REJECTED', 'FAILED', 'CANCELLED']);
let pollTimer = null;
let loadedFeatures = new Set();
let activeSubmissionId = null;

function escapeHTML(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
window.escapeHTML = escapeHTML;

function showStatus(text, type = '') {
  statusText.hidden = false;
  statusText.className = `status ${type}`.trim();
  statusText.textContent = text;
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { hour12: false });
}

// Feature registry for dynamically loaded features
window.registerFeature = function(featureType, createCardFn) {
  window.featureRegistry = window.featureRegistry || {};
  window.featureRegistry[featureType] = createCardFn;
};

// Legacy card creators for built-in templates
function createTodoCard(feature) {
  const card = document.createElement('div');
  card.className = 'card';
  const title = feature.uiSpec?.title || '待办清单';
  const placeholder = feature.uiSpec?.inputPlaceholder || '新增待办';
  const actionLabel = feature.uiSpec?.actionLabel || '添加';

  card.innerHTML = `
    <div><strong>${escapeHTML(title)}</strong></div>
    <div class="todo-row">
      <input type="text" placeholder="${escapeHTML(placeholder)}" />
      <button>${escapeHTML(actionLabel)}</button>
    </div>
    <ul class="todo-list"></ul>
    <small>${formatTime(feature.releasedAt)}</small>
  `;

  const input = card.querySelector('input');
  const button = card.querySelector('button');
  const list = card.querySelector('.todo-list');

  button.addEventListener('click', () => {
    const v = input.value.trim();
    if (!v) return;
    const li = document.createElement('li');
    li.textContent = v;
    list.appendChild(li);
    input.value = '';
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') button.click();
  });

  return card;
}

function createCounterCard(feature) {
  const card = document.createElement('div');
  card.className = 'card';
  const title = feature.uiSpec?.title || '计数器';
  let count = Number(feature.moduleConfig?.initialValue || 0);
  const step = Number(feature.moduleConfig?.step || 1);

  card.innerHTML = `
    <div><strong>${escapeHTML(title)}</strong></div>
    <div class="counter-row">
      <button>-</button>
      <span class="counter-val">${count}</span>
      <button>+</button>
    </div>
    <small>${escapeHTML(feature.uiSpec?.valuePrefix || '当前值')}</small>
  `;

  const [minus, plus] = card.querySelectorAll('button');
  const val = card.querySelector('.counter-val');

  minus.addEventListener('click', () => {
    count -= step;
    val.textContent = count;
  });
  plus.addEventListener('click', () => {
    count += step;
    val.textContent = count;
  });

  return card;
}

function createNoteCard(feature) {
  const card = document.createElement('div');
  card.className = 'card';
  const title = feature.uiSpec?.title || '便签';

  card.innerHTML = `
    <div><strong>${escapeHTML(title)}</strong></div>
    <div class="note-row"><textarea rows="3" placeholder="${escapeHTML(feature.uiSpec?.inputPlaceholder || '写点什么')}"></textarea></div>
    <div class="note-preview">${escapeHTML(feature.uiSpec?.previewHint || '（实时预览）')}</div>
    <small>${formatTime(feature.releasedAt)}</small>
  `;

  const textarea = card.querySelector('textarea');
  const preview = card.querySelector('.note-preview');
  textarea.addEventListener('input', () => {
    preview.textContent = textarea.value || feature.uiSpec?.previewHint || '（实时预览）';
  });

  return card;
}

function createPickerCard(feature) {
  const card = document.createElement('div');
  card.className = 'card';
  const title = feature.uiSpec?.title || '随机抽签';

  card.innerHTML = `
    <div><strong>${escapeHTML(title)}</strong></div>
    <div class="picker-row">
      <input type="text" placeholder="${escapeHTML(feature.uiSpec?.inputPlaceholder || '输入选项，逗号分隔')}" />
      <button>${escapeHTML(feature.uiSpec?.actionLabel || '抽一个')}</button>
    </div>
    <div class="pick-result"></div>
    <small>${formatTime(feature.releasedAt)}</small>
  `;

  const input = card.querySelector('input');
  const button = card.querySelector('button');
  const result = card.querySelector('.pick-result');
  const delimiter = feature.moduleConfig?.delimiter || ',';

  button.addEventListener('click', () => {
    const options = input.value.split(delimiter).map((x) => x.trim()).filter(Boolean);
    if (!options.length) {
      result.textContent = feature.uiSpec?.emptyHint || '请先输入选项';
      return;
    }
    const picked = options[Math.floor(Math.random() * options.length)];
    result.textContent = `${feature.uiSpec?.resultPrefix || '结果'}: ${picked}`;
  });

  return card;
}

function createTimerCard(feature) {
  const card = document.createElement('div');
  card.className = 'card';
  const title = feature.uiSpec?.title || '倒计时';
  const defaultMinutes = Number(feature.moduleConfig?.defaultMinutes || 25);

  card.innerHTML = `
    <div><strong>${escapeHTML(title)}</strong></div>
    <div class="timer-row">
      <input type="number" min="1" value="${defaultMinutes}" />
      <button>${escapeHTML(feature.uiSpec?.actionLabel || '开始')}</button>
    </div>
    <div class="timer-val">${escapeHTML(feature.uiSpec?.initialValue || '25:00')}</div>
    <small>${formatTime(feature.releasedAt)}</small>
  `;

  const input = card.querySelector('input');
  const button = card.querySelector('button');
  const timerVal = card.querySelector('.timer-val');
  let timer = null;

  button.addEventListener('click', () => {
    let left = Math.floor(Number(input.value || 0) * 60);
    if (!Number.isFinite(left) || left <= 0) return;
    clearInterval(timer);

    const paint = () => {
      const mm = String(Math.floor(left / 60)).padStart(2, '0');
      const ss = String(left % 60).padStart(2, '0');
      timerVal.textContent = `${mm}:${ss}`;
    };

    paint();
    timer = setInterval(() => {
      left -= 1;
      if (left < 0) {
        clearInterval(timer);
        timerVal.textContent = feature.uiSpec?.doneLabel || '时间到';
        return;
      }
      paint();
    }, 1000);
  });

  return card;
}

// Dynamic feature loader
async function loadFeatureScript(featureFile) {
  if (!featureFile || loadedFeatures.has(featureFile)) return;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `/features/${featureFile}`;
    script.onload = () => {
      loadedFeatures.add(featureFile);
      resolve(true);
    };
    script.onerror = () => {
      console.warn('Feature script load failed:', featureFile);
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

function createFeatureCard(feature) {
  // Check if this feature has a dynamic script
  if (feature.featureFile && window.featureRegistry) {
    // Try the feature's moduleType first
    if (window.featureRegistry[feature.moduleType]) {
      const createFn = window.featureRegistry[feature.moduleType];
      try {
        return createFn();
      } catch (err) {
        console.error('Error creating feature card:', err);
      }
    }
    
    // For AI-generated features with 'custom' type, try to find any registered feature
    // that was loaded from the same feature file
    if (feature.moduleType === 'custom' || !window.featureRegistry[feature.moduleType]) {
      // Try to find a matching registered feature by checking all registry keys
      for (const [key, createFn] of Object.entries(window.featureRegistry)) {
        // Skip built-in types
        if (['todo', 'counter', 'note', 'picker', 'timer', 'temperature'].includes(key)) continue;
        try {
          const card = createFn();
          if (card) return card;
        } catch (err) {
          console.error('Error trying feature registry key:', key, err);
        }
      }
    }
  }
  
  // Fallback to built-in templates
  const type = feature.moduleType || feature.type;
  if (type === 'todo') return createTodoCard(feature);
  if (type === 'counter') return createCounterCard(feature);
  if (type === 'note') return createNoteCard(feature);
  if (type === 'picker') return createPickerCard(feature);
  if (type === 'timer') return createTimerCard(feature);

  return null;
}

async function renderReleasedFeatures(features) {
  runtimeRoot.innerHTML = '';
  
  // Load all feature scripts first
  for (const feature of features || []) {
    if (feature.featureFile) {
      const ok = await loadFeatureScript(feature.featureFile);
      if (!ok) {
        feature.__scriptLoadFailed = true;
      }
    }
  }
  
  // Then render all cards
  (features || []).forEach((feature) => {
    if (feature.__scriptLoadFailed) {
      return;
    }
    const card = createFeatureCard(feature);
    if (card) runtimeRoot.appendChild(card);
  });
}

async function refreshRuntime() {
  const res = await fetch('/api/state');
  const data = await res.json();
  await renderReleasedFeatures(data.releasedFeatures || []);
}

async function pollSubmission(submissionId) {
  try {
    const res = await fetch(`/api/submissions/${submissionId}`);
    if (!res.ok) {
      return { __error: `STATUS_API_${res.status}` };
    }
    return await res.json();
  } catch (error) {
    return { __error: error.message || 'NETWORK_ERROR' };
  }
}

async function runPolling(submissionId) {
  if (pollTimer) clearInterval(pollTimer);
  activeSubmissionId = submissionId;
  cancelBtn.hidden = false;
  cancelBtn.disabled = false;

  const tick = async () => {
    const submission = await pollSubmission(submissionId);
    if (!submission || submission.__error) {
      showStatus(
        `无法获取任务状态（${submission ? submission.__error : 'UNKNOWN'}）。请确认后端已重启到最新版本。`,
        'bad'
      );
      cancelBtn.hidden = true;
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }

    showStatus(`状态: ${submission.status}`, submission.status === 'RELEASED' ? 'ok' : submission.status === 'FAILED' || submission.status === 'REJECTED' ? 'bad' : '');

    if (submission.status === 'REJECTED') {
      showStatus(`评审未通过: ${submission.review?.reason || submission.error || '未知原因'}`, 'bad');
    }

    if (submission.status === 'FAILED') {
      showStatus(`处理失败: ${submission.error || '未知错误'}`, 'bad');
    }

    if (submission.status === 'RELEASED') {
      showStatus('功能已上线', 'ok');
      await refreshRuntime();
    }

    if (submission.status === 'CANCELLED') {
      showStatus('需求已取消执行。', 'bad');
    }

    if (TERMINAL_STATUS.has(submission.status)) {
      cancelBtn.hidden = true;
      cancelBtn.disabled = true;
      activeSubmissionId = null;
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  await tick();
  pollTimer = setInterval(tick, 900);
}

async function submitRequest() {
  const request = requestInput.value.trim();
  if (!request) return;

  submitBtn.disabled = true;
  showStatus('需求已提交，等待 OpenClaw 处理...');

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request })
    });
    const data = await res.json();

    if (!res.ok) {
      showStatus(data.error || '提交失败', 'bad');
      return;
    }

    requestInput.value = '';
    showStatus(`需求已受理，任务 #${data.submissionId} 等待评审...`);
    await runPolling(data.submissionId);
  } finally {
    submitBtn.disabled = false;
  }
}

async function cancelActiveSubmission() {
  if (!activeSubmissionId) return;
  const ok = window.confirm(`确认取消任务 #${activeSubmissionId} 吗？`);
  if (!ok) return;

  cancelBtn.disabled = true;
  try {
    const res = await fetch(`/api/submissions/${activeSubmissionId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showStatus(data.error || '取消失败', 'bad');
      cancelBtn.disabled = false;
      return;
    }
    showStatus(`任务 #${activeSubmissionId} 已取消`, 'bad');
    cancelBtn.hidden = true;
    activeSubmissionId = null;
    await refreshRuntime();
  } catch (error) {
    showStatus(`取消失败: ${error.message || 'NETWORK_ERROR'}`, 'bad');
    cancelBtn.disabled = false;
  }
}

submitBtn.addEventListener('click', submitRequest);
cancelBtn.addEventListener('click', cancelActiveSubmission);
requestInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitRequest();
});

refreshRuntime();
