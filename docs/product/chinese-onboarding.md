---
title: 中文首次使用指南
tags:
  - onboarding
  - chinese
  - gm-workbench
---

# 中文首次使用指南

> [!info] 当前适用范围
> 这份指南只覆盖当前项目已经实现的功能：
> 创建 campaign、上传资料、canon review、quest request、quest editor、GM packet preview。
> 还不包含正式 PDF 出版或商城发布流程。

## 你第一次使用时要做什么

第一次不要直接拿整本长模组 PDF 开始。

先用一组小一点、可控一点的中文材料跑通完整流程：

1. 一份“官方模组摘录”
2. 一份“GM 改动记录”
3. 一个明确的城镇
4. 一个明确的支线目标

这样你更容易判断这个工作台对你有没有帮助。

## 启动方式

在项目根目录运行：

```bash
pnpm install
pnpm prisma migrate dev
pnpm dev
```

然后打开：

- [http://127.0.0.1:3000/campaigns/new](http://127.0.0.1:3000/campaigns/new)

> [!warning] 关于 OpenAI Key
> 不配置 `OPENAI_API_KEY` 也能使用，但 quest draft 会走 fallback 逻辑，不是真实模型生成。
> 如果你想测试真实生成效果，请在 `.env` 中配置：
>
> ```env
> DATABASE_URL="file:./dev.db"
> OPENAI_API_KEY="你的 key"
> ```

## 推荐的首次使用流程

### 1. 创建一个 campaign

在 `Campaign setup` 页面填写：

- `Campaign name`
- `Party level`
- `Tone`
- `Content constraints`

建议你第一次就用中文填。

示例：

- `Campaign name`: 瓦拉奇支线测试
- `Party level`: 5
- `Tone`: 哥特悬疑，压抑，带一点民间恐怖
- `Content constraints`: 避免过度血腥；不要加入强制背叛队友桥段

### 2. 上传两份资料

当前系统支持上传：

- `.txt`
- `.md`
- `.docx`
- `.pdf`

第一次建议只上传两份：

1. 官方模组摘录
2. GM 改动记录

你可以直接参考：

- [官方模组摘录示例](../../tests/fixtures/official-module-excerpt.zh.md)
- [GM改动示例](../../tests/fixtures/gm-overrides.zh.md)

或者直接打开项目里的文件：

- [官方模组摘录示例.md](/I:/OpenCode/aigenerateAdvanture/tests/fixtures/official-module-excerpt.zh.md)
- [GM改动示例.md](/I:/OpenCode/aigenerateAdvanture/tests/fixtures/gm-overrides.zh.md)

### 3. 进入 Canon Review

这一步不要跳过。

系统会从你上传的资料里抽取 facts，但这些 facts 不会天然等于“你这桌现在的真实 canon”。

你在这里要做的事是：

- 把明显正确的事实保留为 `active`
- 对已经被你桌面实际改写的事实做 override 判断
- 把不确定的内容留在 `uncertain`

> [!tip] 记住这个原则
> 官方原文不是最高优先级。
> 你这桌已经发生过的事件、GM 明确改写过的状态，优先级更高。

### 4. 进入 Request Quest

从 campaign overview 或 canon review 页面进入 `Request quest`。

这里最关键的不是只填 town name，而是把你要的支线约束说清楚。

重点字段：

- `Town name`
- `Town vibe`
- `Local tension`
- `Quest type`
- `Main plot relation`
- `Desired length`
- `Extra context`

其中最重要的是：

- `Local tension`
- `Extra context`

### 5. 生成 Quest Draft

生成完成后，系统会给你一个结构化 draft。

当前 draft 不是文学成品，而是：

- 标题
- premise
- hook
- scenes
- NPCs
- rewards
- return path
- GM summary

这是对的。它的定位是“可编辑的 GM 草稿”，不是“直接出版的模组 PDF”。

### 6. 在 Quest Editor 里手工修

进入 quest editor 后，你可以直接改：

- 标题
- premise
- hook
- scenes
- NPCs
- rewards
- return to main plot
- summary

右侧的 `GM packet preview` 会同步显示当前草稿。

## 最适合中文用户的资料写法

### 官方模组摘录怎么写

尽量按“事实块”来写，不要一股脑贴整段长文。

建议结构：

```md
# 模组名称

## 当前地点

## 地点事实
- ...

## NPC事实
- ...

## 未解决线索
- ...

## 限制
- ...
```

### GM 改动记录怎么写

建议把“已经发生的变化”和“你想保留的主线方向”分开写。

建议结构：

```md
# GM改动记录

## 已发生事件
- ...

## 当前真实状态
- ...

## 想保留的主线方向
- ...

## 禁用内容
- ...
```

## 中文用户第一次最容易踩的坑

> [!warning] 坑 1：一上来就喂整本大 PDF
> 不建议。
> 第一次先喂摘录，不要先喂完整超长模组。

> [!warning] 坑 2：跳过 Canon Review
> 不建议。
> 不 review，系统只是在“读文件”，不是在“理解你这桌现在的真相”。

> [!warning] 坑 3：Extra context 写得太空
> 如果你只写“来一个支线”，结果通常会比较泛。
> 中文用户尤其应该把“我要什么氛围、想怎么接回主线、不要出现什么”写清楚。

> [!warning] 坑 4：把它当最终出版器
> 当前不是。
> 现在更适合把它当“支线模组草稿工作台”。

## 最小可运行中文示例

第一次建议你这样试：

1. 创建一个 campaign
2. 上传：
   - [官方模组摘录示例.md](/I:/OpenCode/aigenerateAdvanture/tests/fixtures/official-module-excerpt.zh.md)
   - [GM改动示例.md](/I:/OpenCode/aigenerateAdvanture/tests/fixtures/gm-overrides.zh.md)
3. 做 canon review
4. 在 request quest 页填：
   - 地点：瓦拉奇
   - 风格：调查 / 悬疑
   - 时长：3 小时
   - 与主线关系：弱回接
5. 把下面这份模板贴进 `Extra context`：

见：

- [中文提示词模板.md](/I:/OpenCode/aigenerateAdvanture/docs/product/chinese-prompts.md)

## 一句话理解当前产品

> 这是一个中文也能直接用的“长团支线模组草稿工作台”，不是最终出版器。
