# CoVibe - OpenClaw 自动功能流水线

输入一个新需求后，系统按以下固定链路自动执行：

用户输入需求 → OpenClaw 接收并评审 → OpenClaw 调用 Kimi Code API 生成代码 → OpenClaw 上传 GitHub → 新功能上线

## 当前架构

- 前端：`public/index.html` + `public/app.js` + `public/styles.css`
- 后端：`src/server.js`（Node 原生 HTTP）
- 流水线 Agent：
  - `skills/review-agent/index.js`
  - `skills/build-agent/index.js`
  - `skills/release-agent/index.js`
- 状态存储：`data/submissions.json`、`data/features.json`
- 产物目录：`public/features/feature-{id}.js`

## 状态流转

`RECEIVED -> REVIEWING -> APPROVED -> GENERATING -> BUILT -> RELEASING -> RELEASED`

失败分支：`REJECTED` / `FAILED`

## 启动

```bash
cd ~/CoVibe
npm start
```

服务启动后，`POST /api/submit` 会自动触发完整流水线，无需额外 heartbeat 命令。

## 必需环境变量

| 变量 | 说明 |
|---|---|
| `KIMI_API_KEY` | Kimi API Key（Build 阶段必需） |
| `KIMI_BASE_URL` | Kimi API 地址，默认 `https://api.moonshot.cn/v1` |
| `KIMI_CODE_MODEL` | Kimi 代码模型，默认 `kimi-k2.5` |
| `GITHUB_TOKEN` | GitHub Token（Release 上传必需） |
| `GITHUB_REPO` | 目标仓库，格式 `owner/repo` |
| `GITHUB_BRANCH` | 目标分支，默认 `main` |
| `GITHUB_UPLOAD_MODE` | `auto` / `git` / `api`，默认 `auto` |
| `PORT` | 服务端口，默认 `3000` |

## API

- `POST /api/submit`：提交需求
- `GET /api/submissions/:id`：查询单个任务状态
- `GET /api/state`：获取已发布功能和最近任务

## 说明

- Build 阶段不再使用模板回退，必须调用 Kimi Code API。
- Release 阶段会强制执行 GitHub 上传；上传失败则该任务标记为 `FAILED`，不会进入 `RELEASED`。
