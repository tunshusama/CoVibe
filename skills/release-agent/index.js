const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const FEATURES_FILE = path.join(DATA_DIR, 'features.json');
const FEATURES_DIR = process.env.FEATURES_DIR || path.join(__dirname, '../../public/features');
const REPO_ROOT = path.join(__dirname, '../..');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_UPLOAD_MODE = process.env.GITHUB_UPLOAD_MODE || 'auto'; // auto | git | api
const RELEASING_STALE_MS = Number(process.env.RELEASING_STALE_MS || 20 * 60 * 1000);

function loadSubmissions() {
  if (!fs.existsSync(SUBMISSIONS_FILE)) return [];
  return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
}

function saveSubmissions(submissions) {
  fs.mkdirSync(path.dirname(SUBMISSIONS_FILE), { recursive: true });
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
}

function loadFeatures() {
  if (!fs.existsSync(FEATURES_FILE)) return [];
  return JSON.parse(fs.readFileSync(FEATURES_FILE, 'utf8'));
}

function saveFeatures(features) {
  fs.mkdirSync(path.dirname(FEATURES_FILE), { recursive: true });
  fs.writeFileSync(FEATURES_FILE, JSON.stringify(features, null, 2));
}

function nowISO() {
  return new Date().toISOString();
}

function reconcileSubmissionStates(submissions, features) {
  let changed = 0;
  const now = Date.now();

  for (const submission of submissions) {
    if (submission.status !== 'RELEASING') continue;

    const matchedFeature = features.find((f) => Number(f.submissionId) === Number(submission.id) || Number(f.id) === Number(submission.id));
    if (matchedFeature) {
      submission.status = 'RELEASED';
      submission.error = null;
      submission.releasedAt = submission.releasedAt || matchedFeature.releasedAt || nowISO();
      submission.updatedAt = nowISO();
      changed += 1;
      continue;
    }

    const updatedTs = Date.parse(submission.updatedAt || submission.createdAt || '');
    if (Number.isFinite(updatedTs) && now - updatedTs > RELEASING_STALE_MS) {
      submission.status = 'FAILED';
      submission.error = 'RELEASE_STALE_NO_FEATURE';
      submission.updatedAt = nowISO();
      changed += 1;
    }
  }

  return changed;
}

function hasGitRepo() {
  return fs.existsSync(path.join(REPO_ROOT, '.git'));
}

function collectReleasePaths(submission) {
  const paths = [];
  if (submission.featureFile) {
    paths.push(path.relative(REPO_ROOT, path.join(FEATURES_DIR, submission.featureFile)));
  }
  if (submission.artifact?.approach === 'site-patch' && Array.isArray(submission.artifact.changedFiles)) {
    for (const file of submission.artifact.changedFiles) {
      paths.push(file);
    }
  }
  paths.push(path.relative(REPO_ROOT, SUBMISSIONS_FILE));
  paths.push(path.relative(REPO_ROOT, FEATURES_FILE));
  return Array.from(new Set(paths));
}

function gitPushSubmission(submission) {
  if (!hasGitRepo()) {
    throw new Error('GIT_REPO_NOT_FOUND');
  }

  const files = collectReleasePaths(submission);
  if (files.length === 0) {
    throw new Error('NO_RELEASE_FILES');
  }
  const addArgs = files.map((f) => `"${f}"`).join(' ');
  execSync(`git add ${addArgs}`, {
    cwd: REPO_ROOT,
    stdio: 'pipe'
  });

  try {
    execSync(`git commit -m "feat: release feature #${submission.id}"`, {
      cwd: REPO_ROOT,
      stdio: 'pipe'
    });
  } catch (error) {
    const stderr = String(error.stderr || '');
    if (!stderr.includes('nothing to commit')) {
      throw new Error(`GIT_COMMIT_FAILED:${stderr.slice(0, 300)}`);
    }
  }

  execSync('git push', {
    cwd: REPO_ROOT,
    stdio: 'pipe'
  });
}

function githubRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    if (!GITHUB_TOKEN) return reject(new Error('MISSING_GITHUB_TOKEN'));
    if (!GITHUB_REPO || !GITHUB_REPO.includes('/')) return reject(new Error('MISSING_GITHUB_REPO'));

    const payload = body ? JSON.stringify(body) : null;

    const req = https.request(
      {
        hostname: 'api.github.com',
        port: 443,
        path: apiPath,
        method,
        headers: {
          'User-Agent': 'openclaw-release-agent',
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          const statusCode = Number(res.statusCode || 0);
          if (statusCode < 200 || statusCode >= 300) {
            if (statusCode === 404) return resolve(null);
            return reject(new Error(`GITHUB_HTTP_${statusCode}:${raw.slice(0, 500)}`));
          }
          if (!raw) return resolve({});
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({});
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function githubGetFileSha(repoPath) {
  const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');
  const data = await githubRequest('GET', `/repos/${GITHUB_REPO}/contents/${encodedPath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`);
  return data && data.sha ? data.sha : null;
}

async function githubPutFile(repoPath, content, message) {
  const existingSha = await githubGetFileSha(repoPath);
  const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');

  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: GITHUB_BRANCH,
    ...(existingSha ? { sha: existingSha } : {})
  };

  await githubRequest('PUT', `/repos/${GITHUB_REPO}/contents/${encodedPath}`, body);
}

async function githubUploadSubmission(submission) {
  if (submission.featureFile) {
    const featurePath = path.join(FEATURES_DIR, submission.featureFile);
    if (!fs.existsSync(featurePath)) {
      throw new Error(`FEATURE_FILE_NOT_FOUND:${submission.featureFile}`);
    }
    const featureContent = fs.readFileSync(featurePath, 'utf8');
    await githubPutFile(`public/features/${submission.featureFile}`, featureContent, `feat: release feature #${submission.id} code`);
  }

  if (submission.artifact?.approach === 'site-patch' && Array.isArray(submission.artifact.changedFiles)) {
    for (const relPath of submission.artifact.changedFiles) {
      const absPath = path.join(REPO_ROOT, relPath);
      if (!fs.existsSync(absPath)) continue;
      const content = fs.readFileSync(absPath, 'utf8');
      await githubPutFile(relPath, content, `feat: apply site patch #${submission.id} (${relPath})`);
    }
  }

  const submissionsContent = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
  const featuresContent = fs.readFileSync(FEATURES_FILE, 'utf8');
  await githubPutFile('data/submissions.json', submissionsContent, `chore: sync submissions for feature #${submission.id}`);
  await githubPutFile('data/features.json', featuresContent, `chore: sync released features for feature #${submission.id}`);
}

async function uploadToGitHub(submission) {
  if (GITHUB_UPLOAD_MODE === 'git') {
    gitPushSubmission(submission);
    return 'git';
  }

  if (GITHUB_UPLOAD_MODE === 'api') {
    await githubUploadSubmission(submission);
    return 'api';
  }

  // auto: prefer local git repo push, fallback to GitHub API.
  if (hasGitRepo()) {
    try {
      gitPushSubmission(submission);
      return 'git';
    } catch (error) {
      console.warn(`RELEASE_AGENT: git push failed, fallback to GitHub API: ${error.message}`);
    }
  }

  await githubUploadSubmission(submission);
  return 'api';
}

async function run() {
  const submissions = loadSubmissions();
  const features = loadFeatures();
  const reconciled = reconcileSubmissionStates(submissions, features);
  if (reconciled > 0) {
    saveSubmissions(submissions);
    console.log(`RELEASE_AGENT: Reconciled ${reconciled} stale submission state(s)`);
  }

  const pending = submissions.filter((s) => s.status === 'BUILT');

  if (pending.length === 0) {
    console.log('RELEASE_AGENT: No built submissions to release');
    return { processed: 0 };
  }

  console.log(`RELEASE_AGENT: Found ${pending.length} submission(s) to release`);

  let released = 0;
  let failed = 0;

  for (const submission of pending) {
    if (submission.status === 'CANCELLED') {
      console.log(`RELEASE_AGENT: Submission #${submission.id} cancelled, skip`);
      continue;
    }
    console.log(`RELEASE_AGENT: Releasing submission #${submission.id}: "${submission.request}"`);

    let previousFeatures = null;
    try {
      const latest = loadSubmissions().find((s) => s.id === submission.id);
      if (!latest || latest.status === 'CANCELLED') {
        console.log(`RELEASE_AGENT: Submission #${submission.id} cancelled before release, skip`);
        continue;
      }
      submission.status = 'RELEASING';
      submission.updatedAt = nowISO();

      const isSitePatch = submission.artifact?.approach === 'site-patch';
      if (!isSitePatch) {
        const featureFilePath = path.join(FEATURES_DIR, submission.featureFile || '');
        if (!fs.existsSync(featureFilePath)) {
          throw new Error(`FEATURE_FILE_NOT_FOUND:${submission.featureFile}`);
        }

        const feature = {
          id: submission.id,
          submissionId: submission.id,
          moduleType: submission.artifact?.moduleType || `custom-${submission.id}`,
          request: submission.request,
          featureFile: submission.featureFile,
          usedAI: submission.usedAI || false,
          releasedAt: nowISO()
        };
        const nextFeatures = [...features];
        const existingIndex = nextFeatures.findIndex((f) => f.id === submission.id);
        if (existingIndex >= 0) {
          nextFeatures[existingIndex] = feature;
        } else {
          nextFeatures.push(feature);
        }

        previousFeatures = [...features];
        features.length = 0;
        features.push(...nextFeatures);
        saveFeatures(features);
      }
      saveSubmissions(submissions);

      const uploadMode = await uploadToGitHub(submission);

      submission.status = 'RELEASED';
      submission.releasedAt = nowISO();
      submission.updatedAt = nowISO();
      submission.error = null;
      submission.release = {
        uploadedAt: nowISO(),
        via: uploadMode,
        branch: GITHUB_BRANCH
      };

      saveSubmissions(submissions);
      released += 1;
      console.log(`RELEASE_AGENT: Submission #${submission.id} RELEASED (uploaded via ${uploadMode})`);
    } catch (err) {
      if (previousFeatures && submission.status === 'RELEASING') {
        features.length = 0;
        features.push(...previousFeatures);
        saveFeatures(features);
      }
      submission.status = 'FAILED';
      submission.error = err.message;
      submission.updatedAt = nowISO();
      saveSubmissions(submissions);
      failed += 1;
      console.error(`RELEASE_AGENT: Submission #${submission.id} FAILED - ${err.message}`);
    }
  }

  return {
    processed: pending.length,
    released,
    failed
  };
}

module.exports = { run };

if (require.main === module) {
  run()
    .then((result) => {
      console.log('Release Agent completed:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Release Agent failed:', err);
      process.exit(1);
    });
}
