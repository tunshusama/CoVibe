# Build Agent

根据评审通过的需求生成代码。

## 双模式代码生成

### Mode 1: Codex (优先)
如果配置了 `OPENAI_API_KEY`，Build Agent 会调用 Codex/OpenAI API 来生成代码。

**优势：**
- 更灵活，可以处理更复杂的需求
- 代码质量更高
- 利用你现有的 Codex 额度

### Mode 2: 模板回退
如果 Codex 调用失败或未配置 API Key，自动回退到内置模板生成。

**优势：**
- 零成本
- 速度快
- 稳定可靠

## 配置

```bash
# 启用 Codex 模式
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://api.openai.com/v1"  # 可选

# 禁用 Codex，强制使用模板
export USE_CODEX=false
```

## Usage

```bash
node skills/build-agent/index.js
```

## 数据流

```
submissions.json (APPROVED)
       ↓
  Codex API / 模板
       ↓
public/features/feature-{id}.js
       ↓
submissions.json (BUILT)
```

## 生成的代码结构

每个功能模块生成一个 IIFE：
- 自包含的 JavaScript
- 调用 `window.registerFeature(moduleType, createCardFn)`
- createCardFn 返回一个 DOM 元素
- 支持前端动态加载

## 支持的模块类型

- `todo` - 待办清单
- `counter` - 计数器  
- `note` - 便签
- `picker` - 随机抽签
- `timer` - 倒计时
