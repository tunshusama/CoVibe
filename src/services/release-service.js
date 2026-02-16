function releaseArtifact({ submission, artifact, version }) {
  return {
    released: true,
    version,
    moduleType: artifact.moduleType,
    moduleConfig: artifact.moduleConfig,
    uiSpec: artifact.uiSpec,
    request: submission.request,
    rollbackOf: null
  };
}

module.exports = {
  releaseArtifact
};
