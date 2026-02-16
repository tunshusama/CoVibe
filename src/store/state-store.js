const fs = require('fs');
const path = require('path');
const { PIPELINE_STATUS } = require('../types/pipeline-types');

function nowISO() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    submissions: [],
    reviews: [],
    artifacts: [],
    releases: [],
    releasedFeatures: [],
    features: [],
    lastSubmissionId: 0,
    lastReviewId: 0,
    lastArtifactId: 0,
    lastReleaseId: 0,
    lastFeatureId: 0,
    currentVersion: 0
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    ensureDir(filePath);
    if (!fs.existsSync(filePath)) {
      this.saveState(defaultState());
    }
  }

  loadState() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const migrated = this.migrateLegacy(parsed);
      this.saveState(migrated);
      return migrated;
    } catch {
      const initial = defaultState();
      this.saveState(initial);
      return initial;
    }
  }

  saveState(state) {
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  mutate(mutator) {
    const state = this.loadState();
    const result = mutator(state);
    this.saveState(state);
    return result;
  }

  migrateLegacy(input) {
    const state = { ...defaultState(), ...input };

    if (!Array.isArray(state.submissions)) state.submissions = [];
    if (!Array.isArray(state.reviews)) state.reviews = [];
    if (!Array.isArray(state.artifacts)) state.artifacts = [];
    if (!Array.isArray(state.releases)) state.releases = [];

    if (!Array.isArray(state.releasedFeatures)) {
      state.releasedFeatures = [];
    }

    const legacyFeatures = Array.isArray(input.features) ? input.features : [];
    if (state.releasedFeatures.length === 0 && legacyFeatures.length > 0) {
      state.releasedFeatures = legacyFeatures.map((f, i) => ({
        id: i + 1,
        submissionId: 0,
        moduleType: f.type || 'note',
        moduleConfig: f.config || {},
        uiSpec: {
          title: f.title || '历史功能',
          source: 'legacy-migration'
        },
        request: f.request || '历史功能导入',
        version: i + 1,
        releasedAt: f.createdAt || nowISO()
      }));
      state.features = clone(state.releasedFeatures);
      state.lastFeatureId = state.releasedFeatures.length;
      state.currentVersion = state.releasedFeatures.length;
    }

    if (state.features.length === 0 && state.releasedFeatures.length > 0) {
      state.features = clone(state.releasedFeatures);
    }

    if (state.currentVersion === 0 && state.releases.length > 0) {
      state.currentVersion = Math.max(...state.releases.map((r) => Number(r.version) || 0), 0);
    }

    state.lastSubmissionId = Number(state.lastSubmissionId || 0);
    state.lastReviewId = Number(state.lastReviewId || 0);
    state.lastArtifactId = Number(state.lastArtifactId || 0);
    state.lastReleaseId = Number(state.lastReleaseId || 0);
    state.lastFeatureId = Number(state.lastFeatureId || 0);

    return state;
  }

  createSubmission(request, ip) {
    return this.mutate((state) => {
      state.lastSubmissionId += 1;
      const submission = {
        id: state.lastSubmissionId,
        request,
        ip,
        status: PIPELINE_STATUS.RECEIVED,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        error: null
      };
      state.submissions.unshift(submission);
      return submission;
    });
  }

  updateSubmission(submissionId, patch) {
    return this.mutate((state) => {
      const found = state.submissions.find((s) => s.id === submissionId);
      if (!found) return null;
      Object.assign(found, patch, { updatedAt: nowISO() });
      return found;
    });
  }

  recordReview(submissionId, reviewData) {
    return this.mutate((state) => {
      state.lastReviewId += 1;
      const review = {
        id: state.lastReviewId,
        submissionId,
        createdAt: nowISO(),
        ...reviewData
      };
      state.reviews.unshift(review);
      return review;
    });
  }

  recordArtifact(submissionId, artifactData) {
    return this.mutate((state) => {
      state.lastArtifactId += 1;
      const artifact = {
        id: state.lastArtifactId,
        submissionId,
        generatedAt: nowISO(),
        ...artifactData
      };
      state.artifacts.unshift(artifact);
      return artifact;
    });
  }

  recordRelease(submissionId, releaseData) {
    return this.mutate((state) => {
      state.lastReleaseId += 1;
      const release = {
        id: state.lastReleaseId,
        submissionId,
        releasedAt: nowISO(),
        ...releaseData
      };
      state.releases.unshift(release);
      state.currentVersion = release.version;
      return release;
    });
  }

  appendReleasedFeature(featureData) {
    return this.mutate((state) => {
      state.lastFeatureId += 1;
      const releasedFeature = {
        id: state.lastFeatureId,
        ...featureData
      };
      state.releasedFeatures.unshift(releasedFeature);
      state.features = clone(state.releasedFeatures);
      return releasedFeature;
    });
  }

  nextVersion() {
    return this.mutate((state) => {
      state.currentVersion += 1;
      return state.currentVersion;
    });
  }

  getSubmissionDetails(submissionId) {
    const state = this.loadState();
    const submission = state.submissions.find((s) => s.id === submissionId) || null;
    if (!submission) return null;

    return {
      submission,
      review: state.reviews.find((r) => r.submissionId === submissionId) || null,
      artifact: state.artifacts.find((a) => a.submissionId === submissionId) || null,
      release: state.releases.find((r) => r.submissionId === submissionId) || null
    };
  }

  getPublicState() {
    const state = this.loadState();
    return {
      releasedFeatures: state.releasedFeatures,
      features: state.features,
      recentSubmissions: state.submissions.slice(0, 20).map((s) => {
        const review = state.reviews.find((r) => r.submissionId === s.id);
        return {
          id: s.id,
          request: s.request,
          status: s.status,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          reason: review ? review.reason : null
        };
      })
    };
  }
}

module.exports = {
  StateStore,
  defaultState,
  nowISO
};
