# Spec：安卓 ActionCard 卡片消息内容被截断

> 由 Superpowers brainstorm 产出。最后更新：2026-08-20

## 背景与目标

安卓 `ZXActionCardMsg`（AI 卡片）在会话列表里有两个独立的显示缺陷，用户拿到的内容不完整且无从展开：

| 编号 | 现象 | 触发条件 | 用户后果 |
|------|------|----------|----------|
| **A** | 卡片高度被截到 480dp，但**底部没有「查看更多」按钮** | 正文含表格（走段栈路径） | 内容被切死，无展开入口 |
| **B** | 有「查看更多」按钮，**展开后知识来源列表仍不显示** | 正文不含表格（走单 TextView 路径）且带 `agentKnowledgeList` | 尾部内容丢失，引用来源看不到 |

复现样本（用户提供的真实消息，写进调试页作为固定用例）：

- A：群 AI 框「报餐统计」卡片，`messageUId` `D03K-9J2E-FFC7-TSGJ`，正文含 17 行 GFM 表格 + 后续列表 + 引用块。
- B：Eric 智能体「报销制度」回复，`messageUId` `D03K-EQ8P-HBSE-SIRP`，正文含 `<reference data-ref="_agent_file_doc_id_2079906448088322049">` 六处，`agentKnowledgeList` 一项（员工手册2026.pdf）。

**成功标准**：两条样本在真机上——含表格的能折叠且出按钮、点开看全文；不含表格的展开后知识来源可见可点。且不回退上一轮修好的「翻历史被拽回最新 AI 卡片」。

## 根因模型

两个 bug 根因不同，**不能合并成一个修法**。

### A：折叠判定与外框硬夹解耦不完整

`ActionCardMessageItemProvider.java:365-382`（段栈路径）：

```java
holder.mdContentStack.setHeightCap(finalMaxHeight);   // 当帧先硬顶 480dp
holder.mdContentStack.post(() -> {
    if (holder.mdContentStack.isFoldNeeded(finalMaxHeight)) {
        holder.mdContentStack.applyFold(true, finalMaxHeight);
        holder.llExpand.setVisibility(View.VISIBLE);   // 出按钮
    } else {
        holder.mdContentStack.applyFold(false, finalMaxHeight);  // ← 没有 setHeightCap(0)
    }
});
```

`ZXMarkdownContentView#isFoldNeeded`（`:191`）累加**子 View 的 `getMeasuredHeight()`**。只要 post 执行时子 View 尚未完成有效测量（表格段是 `HorizontalScrollView`，行绑定后需再一轮测量；异步图片；RecyclerView 复用时序），`totalHeight()` 偏小甚至为 0 → 判定「不需折叠」→ 走 else 分支：**按钮不显示，而 `heightCapPx` 仍是 480dp，`onMeasure` 继续把外框夹死**。症状与 A 完全吻合。

> 硬夹本身是上一轮为修「翻历史被拽回」刻意加的（避免段栈以 4.8 万 px 完整高度参与一次布局），不能去掉；要去掉的是它对 post 时序的依赖。

### B：知识来源尾段没进最终文本或没被绘制

单 TextView 路径把知识来源追加进同一个 `SpannableStringBuilder`（`:295` → `addKnowledgeDocList`）。展开后仍缺，说明与限高无关。三条待验假设：

1. 渲染过程抛异常 → 落进 `catch`（`:324` 起），兜底分支只 `setText(var3.getContent())`，**不追加知识来源**；
2. `preprocess` 的 `useDocList` 过滤（`:859-864`）结果为空——`docIdToOrder` 未命中 `item.getDocId()`；
3. `KnowledgeItemLineHeightSpan(-4dp)` 收紧行高把尾部若干行压到不可见。

**先诊断再修**，不猜着改。修法在 plan 里作为「定位完成后填充」的任务，不在 spec 里预设。

## 修改方案

### A1：段栈自报真实高度（选定方案）

`ZXMarkdownContentView` 自己掌握折叠判定，provider 只接结果：

- `onMeasure` 中在 clamp 之前，把 `super.onMeasure` 得出的高度存为 `rawContentHeight`；
- `isFoldNeeded()` 改用 `rawContentHeight`，不再累加子 View 测量值；
- 新增 `setOnFoldStateListener(boolean foldNeeded)`，段栈在测量完成后回调 provider 显/隐「查看更多」；
- **不变量（写成注释）：判定为不需折叠时，`heightCap` 必须复位为 0。** 这是当前 bug 的直接成因，任何新增分支都要守住。

provider 的三个入口——气泡绑定（`:365`）、`defaultModuleLongMessageContentExpandOrFold`（`:501`）、`referUnitXuanFuPrimaryActionCardView`（`:528`）——统一接这个回调，不再各写一份 post 判定。

被否的替代方案：

| 方案 | 做法 | 否决理由 |
|------|------|----------|
| A2 | 保留 post，换 `OnPreDrawListener`，并在不需折叠分支补 `setHeightCap(0)` | 改动小，但仍依赖时机；表格二次测量 / 异步图片仍可能翻车 |
| A3 | 按 markdown 文本长度估算是否超限，不测量 | 无时序问题，但阈值不准，短内容会误显按钮 |

### B：诊断先行

把两条样本加进 `IM/src/main/java/com/im/debug/MarkdownGfmCasesActivity.java`（仅调试页，不进 release 路径），打点输出：是否进 catch、`useDocList.size()`、最终 ssb 末尾 30 字符。真机 onTest 跑一遍定位到具体假设，再写修法。定位日志在修复合入前删除。

## 范围

- **本期做**：安卓端 A、B 两个缺陷的定位与修复，覆盖所有渲染该类消息的入口——会话页气泡、右侧悬浮「收起内容」、引用悬浮单元（`referUnitXuanFuPrimaryActionCardView`）、引用预览、合并转发详情。
- **本期不做**：PC / iOS / web 的同类排查；折叠阈值（480dp）调整；表格横滚、渐变罩等已完结的渲染议题。

## 各端差异点

本期仅安卓。段栈（`ZXMarkdownContentView`）是安卓独有实现，PC 用 markdown-it + CSS `max-height`，iOS 另有一套，三端管线不共享（见 `20260814-pc安卓-GFM-Markdown渲染对齐/impl-notes.md` 第 1 节）。

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 折叠实现 | — | 段栈按段取舍 + 外框硬夹 | 本期不动 | 本期不动 |
| 知识来源尾段 | — | 追加进正文 Spannable | 本期不动 | 本期不动 |

## 依赖的接口

无新增接口。消息结构沿用现有 `ZXActionCardMsg`（`content.content` 正文 markdown、`content.agentKnowledgeList` 知识来源），本期不改契约。

## 验证

安卓无单测、无 lint 兜底，验证靠真机 onTest（`./gradlew installOnTestDebug`）。矩阵：

| 场景 | 折叠态 | 展开态 | 「收起内容」悬浮入口 |
|------|--------|--------|----------------------|
| 含表格（样本 A） | 出按钮、切在段边界 | 表格完整可横滚 | 能收回 480dp 且按钮回来 |
| 不含表格（样本 B） | 出按钮 | 知识来源可见可点 | 同上 |
| 己方 / 对方气泡 | 背景九图正确 | — | — |

回归项：引用悬浮单元、引用预览、合并转发详情三处显示正常；消息列表快速翻历史**不被拽回**最新 AI 卡片（上一轮的坑，段栈子 View 禁获焦那条不能破）。

## 待用户确认的问题

无。范围与方案已确认（2026-08-20）。
