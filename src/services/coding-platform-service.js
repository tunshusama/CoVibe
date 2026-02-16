const { reviewSubmission } = require('./review-service');
const { generateArtifact } = require('./generation-service');

function createCodingPlatformService(options = {}) {
  const mode = options.mode || process.env.OPENCLAW_PLATFORM_MODE || 'mock';
  const baseUrl = options.baseUrl || process.env.OPENCLAW_PLATFORM_BASE_URL || '';
  const apiKey = options.apiKey || process.env.OPENCLAW_PLATFORM_API_KEY || '';

  async function mockReviewAndBuild({ request }) {
    const review = reviewSubmission(request);
    if (!review.approved) {
      return { review, artifact: null };
    }

    const artifact = await generateArtifact({
      request,
      matchedTemplate: review.matchedTemplate,
      timeoutMs: 2000
    });

    return { review, artifact };
  }

  async function remoteReviewAndBuild({ request }) {
    if (!baseUrl) {
      throw new Error('OPENCLAW_PLATFORM_BASE_URL_MISSING');
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const reviewRes = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ request })
    });

    if (!reviewRes.ok) {
      const text = await reviewRes.text();
      throw new Error(`PLATFORM_REVIEW_HTTP_${reviewRes.status}:${text.slice(0, 120)}`);
    }

    const review = await reviewRes.json();
    if (!review.approved) {
      return { review, artifact: null };
    }

    const buildRes = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/build`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ request, review })
    });

    if (!buildRes.ok) {
      const text = await buildRes.text();
      throw new Error(`PLATFORM_BUILD_HTTP_${buildRes.status}:${text.slice(0, 120)}`);
    }

    const artifact = await buildRes.json();
    return { review, artifact };
  }

  return {
    mode,
    async reviewAndBuild({ request }) {
      if (mode === 'remote') return remoteReviewAndBuild({ request });
      return mockReviewAndBuild({ request });
    }
  };
}

module.exports = {
  createCodingPlatformService
};
