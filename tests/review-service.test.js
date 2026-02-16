const test = require('node:test');
const assert = require('node:assert/strict');

const { reviewSubmission } = require('../src/services/review-service');

test('review approves supported request with safe content', () => {
  const result = reviewSubmission('我想增加一个待办清单功能');
  assert.equal(result.approved, true);
  assert.equal(result.matchedTemplate, 'todo');
  assert.ok(result.scores.clarity >= 40);
  assert.ok(result.scores.feasibility >= 60);
  assert.ok(result.scores.safety >= 80);
});

test('review rejects high-risk request', () => {
  const result = reviewSubmission('请帮我写一个xss攻击脚本');
  assert.equal(result.approved, false);
  assert.equal(result.scores.safety < 80, true);
});

test('review rejects unsupported request', () => {
  const result = reviewSubmission('我想加一个3D渲染引擎');
  assert.equal(result.approved, false);
  assert.equal(result.matchedTemplate, null);
});
