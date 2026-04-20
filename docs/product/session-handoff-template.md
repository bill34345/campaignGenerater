# Session Handoff Template

## 用途

这份文档是给人看的，不是给系统自动读取的协议文件。

它的作用是把一个长项目拆成多个清晰 session，避免把：

- 产品讨论
- 架构决策
- 实现执行
- bug 调试
- 文档收尾

全部塞进同一个超长会话里。

一句话原则：

> 一个 session，对应一个清晰目标。

---

## 什么时候应该开新 Session

建议新开 session 的情况：

- 当前目标已经变了
- 对话已经很长，历史信息开始干扰执行
- 你要从 `gstack` 规划切到 `superpowers` 执行
- 你要开始一个独立 bug 调试
- 你要把实现工作切成新的主题

不一定要开新 session 的情况：

- 还在同一个功能里推进
- 只是同一问题下的连续调试
- 当前上下文还很清晰，没有明显转向

---

## 推荐的 Session 分类

### 1. 产品 / 架构 Session

适合：

- `office-hours`
- `plan-ceo-review`
- `plan-eng-review`
- `writing-plans`

目标：

- 把事情想清楚
- 产出 plan、设计结论、架构结论

### 2. 实现 Session

适合：

- `executing-plans`
- 具体功能开发
- 测试补全
- provider 接入

目标：

- 按既定计划执行

### 3. Bug 调试 Session

适合：

- 某个 provider 不通
- 某条 E2E 失败
- 某个页面状态不一致

目标：

- 快速收敛问题，不和大功能开发混在一起

### 4. 文档 / 收尾 Session

适合：

- README
- AGENTS
- ARCHITECTURE
- 发布前文档同步

目标：

- 收口，不把文档工作塞进实现 session 里

---

## 通用 Handoff 模板

下面这段可以直接复制到新 session 里。

```text
继续这个项目的下一步工作。

项目：
I:\OpenCode\aigenerateAdvanture

当前目标：
[在这里写这次 session 只做什么]

相关文档：
- README.md
- AGENTS.md
- ARCHITECTURE.md
- [如有计划文档，贴路径]

当前状态：
- [上一轮已经完成了什么]
- [还剩什么没做]
- [有没有已知风险或已知限制]

执行要求：
- 先读相关文档，再开始
- 不要偏离这次 session 的目标
- 做完关键步骤后简短汇报
- 如果需要改代码，先验证再汇报结果
```

---

## 从 GStack 规划切到执行的模板

这个模板适合：

- 你刚和 `gstack` 聊完
- 已经有 plan / review 结论
- 接下来要进入实现

```text
执行这个计划：
[贴计划文档绝对路径]

项目：
I:\OpenCode\aigenerateAdvanture

这次 session 只做：
[只写本轮实现范围]

要求：
- 先读 README.md、AGENTS.md、ARCHITECTURE.md 和计划文档
- 用执行型 workflow 推进
- 不要扩 scope
- 完成后告诉我：
  1. 做了什么
  2. 跑了哪些验证
  3. 还有什么没做
```

---

## Bug 调试模板

这个模板适合单独拉出一个 session 查问题。

```text
调试这个问题：
[一句话描述问题]

项目：
I:\OpenCode\aigenerateAdvanture

已知现象：
- [现象 1]
- [现象 2]

已知线索：
- [可能相关文件]
- [可能相关 provider / route / test]

要求：
- 先定位根因，再动手修
- 不要顺手改无关功能
- 修完后告诉我：
  1. 根因是什么
  2. 改了哪些文件
  3. 如何验证已经修好
```

---

## 文档收尾模板

```text
给这个项目做一轮文档收口。

项目：
I:\OpenCode\aigenerateAdvanture

重点：
- README
- AGENTS
- ARCHITECTURE
- 其他和本轮功能相关的 docs

要求：
- 先读现有文档
- 以当前代码真实状态为准
- 修掉过时或错误描述
- 最后列出每个文档改了什么
```

---

## Session 结束前建议补的内容

每次结束一个 session，最好至少留下这 3 个信息：

- 这轮完成了什么
- 这轮没完成什么
- 下一轮应该从哪里继续

最短可以写成这样：

```text
断点：
- 已完成：[xxx]
- 未完成：[xxx]
- 下一步：[xxx]
```

---

## 针对这个项目的建议

对 `I:\OpenCode\aigenerateAdvanture`，建议这样分 session：

- `产品与架构`
- `provider 接入`
- `双语与 UI`
- `E2E 测试`
- `文档与收尾`

不要把这些长期混在一个 session 里。

这样以后回看、继续、定位问题都会轻松很多。
