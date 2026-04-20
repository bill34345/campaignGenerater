# Live Provider Smoke 手动验收流程

这份文档描述的是一套**手动、显式启用**的 live provider smoke 流程。

目标不是做大范围回归，而是确认两件事：

1. 真实 provider key 能完成认证
2. quest generation 真正走到了 provider，而不是 mock 或 fallback

默认 `pnpm playwright test` **不会**跑这套流程。只有你显式设置 `CODEX_E2E_LIVE_PROVIDER=1` 时，`@live` 测试才会被包含，且 `CODEX_TEST_LLM_MOCK` 会自动切到 `0`。

## 适用范围

当前 live smoke 覆盖两条路径：

- `tests/e2e/providers/live-openai-compatible.spec.ts`
- `tests/e2e/providers/live-anthropic.spec.ts`

其中 OpenAI-compatible 路径既可以测：

- `openai_responses`
- `openai_chat`

Anthropic 路径固定测：

- `anthropic`

## 运行前提

先确保本地开发环境可正常启动：

```powershell
pnpm install
pnpm prisma migrate dev
```

然后确认：

- 本机能访问真实 provider
- 你手里的 key 不是 mock key
- 你准备接受真实调用产生的费用

## 环境变量

### OpenAI-compatible

必填：

- `CODEX_E2E_LIVE_PROVIDER=1`
- `CODEX_E2E_LIVE_OPENAI_API_KEY`

可选：

- `CODEX_E2E_LIVE_OPENAI_PROVIDER`
  - 可选值：`openai_responses` 或 `openai_chat`
  - 默认值：`openai_responses`
- `CODEX_E2E_LIVE_OPENAI_MODEL`
- `CODEX_E2E_LIVE_OPENAI_BASE_URL`

### Anthropic

必填：

- `CODEX_E2E_LIVE_PROVIDER=1`
- `CODEX_E2E_LIVE_ANTHROPIC_API_KEY`

可选：

- `CODEX_E2E_LIVE_ANTHROPIC_MODEL`
- `CODEX_E2E_LIVE_ANTHROPIC_BASE_URL`

## PowerShell 运行方式

### 1. 跑 OpenAI Responses

```powershell
$env:CODEX_E2E_LIVE_PROVIDER = "1"
$env:CODEX_E2E_LIVE_OPENAI_API_KEY = "你的真实 key"
$env:CODEX_E2E_LIVE_OPENAI_PROVIDER = "openai_responses"
pnpm playwright test tests/e2e/providers/live-openai-compatible.spec.ts
```

### 2. 跑 OpenAI Chat

如果你用的是只支持 `/v1/chat/completions` 的网关，就改这里：

```powershell
$env:CODEX_E2E_LIVE_PROVIDER = "1"
$env:CODEX_E2E_LIVE_OPENAI_API_KEY = "你的真实 key"
$env:CODEX_E2E_LIVE_OPENAI_PROVIDER = "openai_chat"
$env:CODEX_E2E_LIVE_OPENAI_BASE_URL = "你的兼容网关 URL"
pnpm playwright test tests/e2e/providers/live-openai-compatible.spec.ts
```

### 3. 跑 Anthropic

```powershell
$env:CODEX_E2E_LIVE_PROVIDER = "1"
$env:CODEX_E2E_LIVE_ANTHROPIC_API_KEY = "你的真实 key"
pnpm playwright test tests/e2e/providers/live-anthropic.spec.ts
```

### 4. 一次性跑全部 live smoke

```powershell
$env:CODEX_E2E_LIVE_PROVIDER = "1"
pnpm playwright test --grep "@live"
```

## 手动验收标准

每条 live smoke 至少要满足下面这些条件。

### OpenAI-compatible

- LLM settings 页面里的 `Test connection` 成功
- quest draft 成功生成
- quest editor 页面能打开
- `Generation source` 面板可见
- provider 标签显示为：
  - `OpenAI Responses`，或
  - `OpenAI Chat`
- `#quest-title` 不是空值
- **不应**出现 fallback 提示

### Anthropic

- LLM settings 页面里的 `Test connection` 成功
- quest draft 成功生成
- quest editor 页面能打开
- `Generation source` 面板可见
- provider 标签显示为 `Anthropic`
- `#quest-title` 不是空值
- **不应**出现 fallback 提示

## 如何判断结果是健康的

健康的 live smoke 应该体现为：

- Playwright 通过
- quest editor 中看到 provider badge，而不是 `Fallback`
- title 有真实内容，不是空字符串
- 没有认证失败、额度不足或 fallback note

## 失败时先看什么

### 情况 1：测试被 skip

说明通常是环境变量没配齐。

先检查：

- `CODEX_E2E_LIVE_PROVIDER`
- 对应的 API key 变量

### 情况 2：`Test connection` 失败

优先检查：

- key 是否有效
- base URL 是否正确
- provider 选择是否和网关能力匹配
  - 只支持 chat 的网关，不要选 `openai_responses`

### 情况 3：生成成功但显示 `Fallback`

这代表页面最终可用，但**真实 provider 路径不健康**。

这不算 live smoke 通过。要继续查：

- provider 是否认证失败
- quota 是否不足
- base URL / model 是否不兼容

### 情况 4：生成页停在 `/quests/new`

先看页面是否出现：

- `no town` 守卫
- 表单错误
- provider 错误提示

这类问题通常说明：

- 运行环境状态不对
- 或 provider 没有真正完成生成

## 运行后的清理

跑完后建议把本次 PowerShell 会话里的 live 变量清掉：

```powershell
Remove-Item Env:CODEX_E2E_LIVE_PROVIDER -ErrorAction SilentlyContinue
Remove-Item Env:CODEX_E2E_LIVE_OPENAI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:CODEX_E2E_LIVE_OPENAI_PROVIDER -ErrorAction SilentlyContinue
Remove-Item Env:CODEX_E2E_LIVE_OPENAI_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:CODEX_E2E_LIVE_OPENAI_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:CODEX_E2E_LIVE_ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:CODEX_E2E_LIVE_ANTHROPIC_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:CODEX_E2E_LIVE_ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
```

## 推荐使用方式

不要把 live smoke 当默认回归。

推荐节奏是：

- 日常开发：`pnpm playwright test`
- provider 改动后：跑对应 live smoke
- release 前：手动跑一次 OpenAI-compatible + Anthropic

这套流程的目的，是补足“mock-first 默认回归”之外的真实性验证，而不是替代默认 E2E 套件。
