const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generateArtifact,
  pickSlotsFromModelResponse
} = require('../src/services/generation-service');
const { validateArtifact } = require('../src/services/validation-service');

test('generation uses mock kimi slots when llm succeeds', async () => {
  const artifact = await generateArtifact({
    request: '我想要一个待办清单',
    matchedTemplate: 'todo',
    llmClient: {
      async fillSlots() {
        return {
          title: '我的待办',
          helperText: '快速记录今天任务',
          inputPlaceholder: '输入待办项',
          actionLabel: '新增'
        };
      }
    }
  });

  assert.equal(artifact.moduleType, 'todo');
  assert.equal(artifact.llm.fallback, false);
  assert.equal(artifact.uiSpec.title, '我的待办');

  const validation = validateArtifact(artifact);
  assert.equal(validation.valid, true);
});

test('generation falls back when kimi request fails', async () => {
  const artifact = await generateArtifact({
    request: '我想要一个待办清单',
    matchedTemplate: 'todo',
    llmClient: {
      async fillSlots() {
        throw new Error('KIMI_TIMEOUT');
      }
    }
  });

  assert.equal(artifact.moduleType, 'todo');
  assert.equal(artifact.llm.fallback, true);
  assert.equal(artifact.llm.reason, 'KIMI_TIMEOUT');
});

test('slot parser can extract JSON from plain text', () => {
  const parsed = pickSlotsFromModelResponse('before {"title":"A","helperText":"B"} after');
  assert.equal(parsed.title, 'A');
  assert.equal(parsed.helperText, 'B');
});

test('validation rejects forbidden content', () => {
  const validation = validateArtifact({
    moduleType: 'note',
    moduleConfig: { initialText: '' },
    uiSpec: { title: '<script>alert(1)</script>' }
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.errorCode, 'FORBIDDEN_CONTENT');
});
