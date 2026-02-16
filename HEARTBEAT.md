# CoVibe Pipeline Notes

默认模式下，服务端会在收到提交后自动触发完整流水线，不需要额外 heartbeat。

流水线顺序固定：

1. Review Agent：评审需求（安全性/清晰度）
2. Build Agent：调用 Kimi Code API 生成前端功能模块
3. Release Agent：上传 GitHub 并将任务标记为 RELEASED

状态流转：

`RECEIVED -> REVIEWING -> APPROVED -> GENERATING -> BUILT -> RELEASING -> RELEASED`

## 手动执行（排障）

```bash
node skills/review-agent/index.js
node skills/build-agent/index.js
node skills/release-agent/index.js
```

## 关键环境变量

- `KIMI_API_KEY`
- `KIMI_BASE_URL`
- `KIMI_CODE_MODEL`
- `GITHUB_TOKEN`
- `GITHUB_REPO`
- `GITHUB_BRANCH`
- `GITHUB_UPLOAD_MODE`
