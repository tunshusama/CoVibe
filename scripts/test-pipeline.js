#!/usr/bin/env node
/**
 * CoVibe 流水线测试脚本
 * 
 * 模拟完整的流水线流程：
 * 1. 提交需求
 * 2. Review Agent 评审
 * 3. Build Agent 构建 (使用 Codex 或 Fallback)
 * 4. Release Agent 发布
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize empty submissions if not exists
if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, '[]');
}

// Import agents
const reviewAgent = require('../skills/review-agent');
const buildAgent = require('../skills/build-agent');
const releaseAgent = require('../skills/release-agent');

function loadSubmissions() {
  return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
}

function saveSubmissions(submissions) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
}

function nowISO() {
  return new Date().toISOString();
}

// Create a test submission
function createTestSubmission(request) {
  const submissions = loadSubmissions();
  const newId = submissions.length > 0 ? Math.max(...submissions.map(s => s.id)) + 1 : 1;
  
  const submission = {
    id: newId,
    request: request,
    ip: '127.0.0.1',
    status: 'RECEIVED',
    createdAt: nowISO(),
    updatedAt: nowISO(),
    error: null
  };
  
  submissions.unshift(submission);
  saveSubmissions(submissions);
  
  console.log(`\n📝 Created test submission #${newId}: "${request}"`);
  return newId;
}

// Run full pipeline
async function runPipeline(submissionId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 STEP 1: Review Agent');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const reviewResult = await reviewAgent.run();
  console.log('Review Result:', reviewResult);
  
  // Check if approved
  const submissions = loadSubmissions();
  const submission = submissions.find(s => s.id === submissionId);
  
  if (submission.status === 'REJECTED') {
    console.log('\n❌ Submission was rejected. Pipeline stopped.');
    console.log(`Reason: ${submission.review.reason}`);
    return;
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔨 STEP 2: Build Agent (Codex)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const buildResult = await buildAgent.run();
  console.log('Build Result:', buildResult);
  
  if (buildResult.built === 0) {
    console.log('\n❌ Build failed. Pipeline stopped.');
    return;
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 STEP 3: Release Agent');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const releaseResult = await releaseAgent.run();
  console.log('Release Result:', releaseResult);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ PIPELINE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Final status
  const finalSubmissions = loadSubmissions();
  const finalSubmission = finalSubmissions.find(s => s.id === submissionId);
  console.log(`\nFinal Status: ${finalSubmission.status}`);
  console.log(`Feature File: ${finalSubmission.featureFile || 'N/A'}`);
  console.log(`Used Codex: ${finalSubmission.generation?.usedCodex ? '✅ Yes' : '❌ No (fallback)'}`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const testRequest = args[0] || '我想要一个待办清单';
  
  console.log('╔════════════════════════════════════╗');
  console.log('║     CoVibe Pipeline Test           ║');
  console.log('╚════════════════════════════════════╝');
  
  console.log(`\n📋 Test Request: "${testRequest}"`);
  
  // Check Codex configuration
  const hasCodex = process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY;
  console.log(`\n🔑 Codex API: ${hasCodex ? '✅ Configured' : '❌ Not configured (will use fallback)'}`);
  
  // Create submission
  const submissionId = createTestSubmission(testRequest);
  
  // Run pipeline
  try {
    await runPipeline(submissionId);
  } catch (err) {
    console.error('\n❌ Pipeline error:', err.message);
    process.exit(1);
  }
}

main();
