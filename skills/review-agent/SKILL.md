# Review Agent

评审用户需求，判断是否可实现。

## Usage

```bash
node skills/review-agent/index.js
```

## Logic

1. 读取 `data/submissions.json`
2. 筛选状态为 `RECEIVED` 或 `REVIEWING` 的提交
3. 对每个提交进行评审：
   - 清晰度评分 (clarity)
   - 可行性评分 (feasibility) - 基于关键词匹配
   - 安全性评分 (safety) - 检测风险关键词
4. 更新提交状态：
   - APPROVED → 可以进入构建阶段
   - REJECTED → 终态，不再处理

## 支持的模板

- `todo` - 待办清单
- `counter` - 计数器  
- `note` - 便签
- `picker` - 随机抽签
- `timer` - 倒计时
