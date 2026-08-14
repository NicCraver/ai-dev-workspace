# Spec：PC 端 + 安卓端 机器人/智能体消息 GFM Markdown 渲染对齐

> 最后更新：2026-08-14
> 上游行为规范：`context/features/20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化/spec-port-pc-android.md`
> （下称**行为 spec**，第 4~10 节的用例与规则本文不重抄，只标注每条在两端的落点与差异）
> 本文是**本轮迭代的实施 spec**：范围、现状差距、各端设计、不做清单、验收。

## 1. 范围

| 端 | 是否本轮 | 说明 |
|----|---------|------|
| PC（`apps/desktop`） | ✅ | 自有 `markdown-it` 管线 |
| 安卓（`apps/android`） | ✅ | 自有 Markwon 管线 |
| web（`apps/web`） | ❌ | `marked` + `AcMarkdown.vue` 只服务 AI 卡片/文本优化弹窗，不是消息气泡，改动收益低、回归面大 |
| iOS | ❌ | 上一轮已完成（`feat/ios-gfm-markdown`） |

**两端并行推进**，互不阻塞（两个独立 git 仓库）。分支：两端各切 `feat/gfm-markdown`，基点 = 各自当前 `personal-ai-chat-hotfix`。

## 2. 现状勘察结论（2026-08-14 实测）

行为 spec 写的「PC 复用 web 渲染」**不成立**。实际是三套独立管线：

| 端 | 解析器 | 入口文件 | 自定义标签预处理 |
|----|--------|---------|-----------------|
| PC | `markdown-it` 14.1.0，`{ html: true }` | `src/lib/markdownUtils.js`（208 行）；消费方 `msg-actioncard.vue` / `msg-reply-poll.vue` / `message-info.vue` | ✅ 已有 `%%CUSTOMTAG_n%%` 占位符机制 |
| 安卓 | Markwon 4.6.2 | `ActionCardMessageItemProvider.java`（1038 行），**4 处各自 `Markwon.builder()`** | ✅ 已有正则提取 ref/illustration |
| web | `marked` 14.1.4 | `AcMarkdown.vue`（346 行） | 本轮不涉及 |

**两端都没有流式打字机链路**（智能体回复整条推送）。→ 行为 spec 第 6 节流式规则本轮 **N/A**，不实现、不验收。

### 2.1 逐条差距

| 行为 spec 条目 | PC 现状 | 安卓现状 |
|---|---|---|
| 表格（T1~T9） | markdown-it 内置 GFM 表格 ✅；**无横滚容器** ❌；边框写死 `rgb(238,238,238)` ❌；无表头底色 ❌ | `TablePlugin` ✅（span 实现）；**无横滚** ❌；配色用 `TableTheme.buildWithDefaults` 默认浅色 ❌ |
| 任务列表 L4 | ❌ 无插件（`node_modules` 里只有裸 `markdown-it`） | ❌ 未装 `ext-tasklist` |
| 删除线 | ✅ default preset 自带 | ❌ 未装 `ext-strikethrough` |
| 裸 URL autolink I7 | ❌ `linkify` 默认 false | ⚠️ `linkify` 依赖已装但 `builder` 里未 `usePlugin` |
| 软换行 I8 | ❌ `breaks` 默认 false，后端单换行被吞成空格 | ⚠️ 待复验（Markwon 聊天场景疑似已按换行显示） |
| 脚注 I13 | ❌ | ❌ Markwon 无官方插件 |
| 内联 HTML（5.1） | ✅ `html: true` 浏览器直出，`<span style="color">` / `<sup>` / `<sub>` / `<u>` 天然支持；未接 sanitizer | ⚠️ `HtmlPlugin` + 自写 `SpanTagHandler`（325 行，含 CSS 命名色表）✅；`<sup>`/`<sub>` 需核实 Markwon 内置 Handler 是否默认注册 |
| 引用角标 5.2 | ✅ 已实现（`replaceSingleTag`，含 `showNum` 去重） | ✅ 已实现（`addKnowledgeDocList` + `ReferencePreviewView`） |
| 插图 5.3 | ✅ 已实现（`<img class="md-illustration">`） | ✅ 已实现（`Glide3ImagePlugin` 异步加载） |
| 收起/展开（7） | ✅ 有；**裁剪按像素硬切，会切断表格** ❌ | ✅ 有；**同样硬切** ❌ |
| 遮罩跟随底色（7） | ✅ `-webkit-mask-image` 透明淡出，天然跟随 | ✅ 4 张 drawable 按 `isSend` × 组织/外链 分好 |
| AI 卡片判定（8） | ❌ `markdownUtils.js:195` 只认 `senderId.indexOf("ga_")===0` | ⚠️ ActionCard 链路未见 `ga_` 判定，疑似不受影响，**实现阶段核实** |
| 长按不被吞（9） | N/A（PC 是右键菜单，无长按） | ⚠️ 段栈改造后新增子 View，**必须防吞** |
| 兜底与开关（10） | ❌ 无异常兜底、无长度阈值、无开关 | ❌ 同上 |

### 2.2 现有收起逻辑（改造基线）

**PC**：`.actioncard-info` 加 `max-h-400px` + `overflow-hidden` 硬截（`msg-actioncard.vue:39`）；是否显示「查看更多」由 `calNeedOpenClose()`（`:356`）判 `scrollHeight !== clientHeight || clientHeight > 400`，`mounted` 跑一次 + `ResizeObserver` 高度变化重跑（图片异步撑高）；展开态由父级 `longMessageExpandList` 按 `message.sentTime` 持有（`isFold`，`:305`）；`needShowFull` prop 可禁用折叠。

**安卓**：`mTvContent.setMaxHeight(dp2px(480))`（阈值常量 `maxHeightDP = 480`，`:114`）；`isReferUnitPrimary` 场景降到 78dp（有标题）/ 123dp（无标题）（`:311`）；`mTvContent.post()` 等一帧拿实测高度决定是否显示 `llExpand`（`:321`）；展开态存消息 bean `setTxtExpand()`。

**阈值三端不统一（PC 400px / 安卓 480dp / iOS 另有一套），本轮不统一** —— 三端字号、行距、屏宽都不同，对齐数值反而不对齐观感。

## 3. 硬约束

| 约束 | 后果 |
|---|---|
| **PC 端禁止 `npm install`**（工作区既定规矩） | 不能引 `markdown-it-task-lists` / `markdown-it-footnote`。任务列表只能自写 renderer rule；脚注本轮不做 |
| 安卓 gradle 缓存只有 `core/image/ext-tables/html/linkify` | `ext-strikethrough`、`ext-tasklist` 需联网 sync 下载（可行，但需一次成功的 gradle sync） |
| PC 端禁用可选链 `?.` / `??` | 新代码一律 `&&` 兜底 |
| PC 提交禁带 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json` | 工作区当前这三个文件已脏，提交前 `git restore` 或确认未 stage |

## 4. PC 端设计（`apps/desktop`）

改动集中两个文件，**不做目录搬迁**（既有代码就地改，符合工作区「修改既有代码不强制挪动」）。

### 4.1 `src/lib/markdownUtils.js`

- 实例配置改为 `new MarkdownIt({ html: true, breaks: true, linkify: true })`
  - `breaks: true` 补 I8 软换行 —— **这会改变所有存量机器人消息的排版**（当前单换行被吞成空格），已确认按三端对齐处理
  - `linkify: true` 补 I7 裸 URL
- 覆盖 `renderer.rules.table_open` / `table_close`，把 `<table>` 包进 `<div class="md-table-wrap">`（横滚容器落点）
- 自写 core ruler 规则实现任务列表 `- [ ]` / `- [x]` → `<input type="checkbox" disabled>`（约 20 行，不引包）
- 现有 `%%CUSTOMTAG_n%%` 占位符机制**保留不动**，它已经是行为 spec 第 5 节要求的做法
- 新增兜底：`convertMarkdownToHtml` 整体 try/catch，异常返回**转义后的原文**（不是空串）；正文 > 20000 字符直接走原文路径；文件顶部留一个 `USE_MARKDOWN` 开关常量

### 4.2 `msg-actioncard.vue`

- 表格样式：边框 `rgba(0,0,0,.12)`、`th` 底色 `rgba(0,0,0,.04)`（替掉写死的 `rgb(238,238,238)`），叠任意气泡底色都协调
- `.md-table-wrap { overflow-x: auto; overscroll-behavior-x: contain; }` —— `contain` 保证横滚到头不把纵向滚动链传给会话列表
- **折叠不切块**：`calNeedOpenClose()` 增强 —— 遍历 `.md-html-wrapper` 的顶层子元素，取最后一个 `offsetTop + offsetHeight <= 400` 的元素底边作为实际 `max-height`（内联 style 覆盖 `max-h-400px`）。若第一个块就超 400px（如一个超高长表格），则该块整体显示，不截
- AI 卡片判定：`senderId.indexOf("ga_") === 0` 改为 `|| (agentKnowledgeList && agentKnowledgeList.length)`，`markdownUtils.js:195` 与组件内判定处一并改

## 5. 安卓端设计（`apps/android`）

### 5.1 先收敛 Markwon 配置

新增 `ZXMarkwonFactory`（单一配置入口），`ActionCardMessageItemProvider` 里 4 处 `Markwon.builder()` 全换过来。插件表：

```
ImagesPlugin + Glide3ImagePlugin + TablePlugin + HtmlPlugin(SpanTagHandler)
  + StrikethroughPlugin  (新增依赖 ext-strikethrough)
  + TaskListPlugin       (新增依赖 ext-tasklist)
  + LinkifyPlugin        (依赖已装，此前未启用)
```

核实 `HtmlPlugin` 是否默认注册了 `<sup>` / `<sub>` 的内置 Handler，未注册则补进 `addHandler`。

### 5.2 正文段栈 + 表格横滚（本轮最大改造）

正文从单个 `TextView` 改为**段栈** `LinearLayout`：

- 解析层按 commonmark AST 把正文切成「富文本段 / 表格段」序列
- 富文本段 → `TextView`（Markwon 渲染）
- 表格段 → `HorizontalScrollView` 包 `TableLayout`（真表格控件，非 span）
- 表格配色同 PC：表头 4% 黑、边框 12% 黑，不写死浅灰
- 列宽 = 该列自然宽最大值，设上限（超出则单元格内换行），上限值实现时按屏宽定
- 横滚容器只吃横向手势，纵向仍归会话列表

**防吞长按**：段栈里所有子 View 一律 `setLongClickable(false)` + `setTextIsSelectable(false)`，长按事件代理回气泡根 View。iOS 上就是栽在这条（`UITextView` 默认可选中抢走长按）。

**无表格的消息不走段栈**，仍走原单 `TextView` 路径 —— 绝大多数消息无表格，保持零回归。

### 5.3 折叠改按段取舍

段栈是块级列表，折叠逻辑从 `setMaxHeight(dp2px(480))` 硬切改为：累加段高度，超过阈值时**最后一段整体取舍**（要么全显示要么全不显示）。这直接满足行为 spec 第 7 节「裁剪线不得把表格切一半」，是段栈改造的附带收益。

阈值仍是 480dp，`isReferUnitPrimary` 的 78/123dp 特例保留。展开态仍存消息 bean `setTxtExpand()`。遮罩 drawable 不动。

### 5.4 兜底

`ZXMarkwonFactory` 渲染入口整体 try/catch，异常显示原文纯文本、只打日志；正文 > 20000 字符走原文；留一个静态开关常量，线上出问题不发版可回退。

## 6. 验收

**两端各建临时用例页，验完删**（iOS 那轮就是这么干的）：

- PC：加一条 debug 路由，页面内置行为 spec 第 4 节 30 条用例
- 安卓：加 debug Activity（入口按钮或摇一摇进），同样 30 条用例

**除用例页外，两端各自跑**：

1. 真实样本三条：含 `**<span style="color:blue;">…</span>**` 的值班播报；含表格 + `<illustration>` + `<reference>` 的长回复（`ZX:ActionCardMsg`，发送人为本人 id）；普通机器人卡片
2. 交互：PC 右键转发/回复 + 表格横滚 + 角标点击 + 收起展开；安卓长按转发/回复 + 表格横滚 + 角标点击 + 收起展开
3. 配色：自己发（淡蓝气泡）与收到（白气泡）两种底色都看
4. 复用场景：合并转发详情页、消息详情弹窗（PC 的 `message-info.vue`、`msg-reply-poll.vue` 都吃同一个 `convertMarkdownToHtml`）
5. 回归：纯文本消息、无表格 markdown 消息与改造前无可感知差异
6. **PC 专项**：`breaks: true` 上线前，拿至少 5 条存量真实消息对比开关前后排版，确认没有出现意外断行

## 7. 本轮不做

| 项 | 原因 |
|----|------|
| 流式表格降级（行为 spec 第 6 节） | 两端均无流式打字机链路，智能体回复整条推送 |
| 脚注 `[^1]` | PC 不能装包、安卓无官方插件；真实消息中未见过 |
| 数学公式 | 与 iOS 同：GFM 无此语法，需引 LaTeX 引擎，且尚无真实样本 |
| 代码块语法高亮 | 只给等宽字体 + 底色 |
| 表格首列固定 | 范围外 |
| 三端折叠阈值统一 | 字号/行距/屏宽不同，对齐数值反而不对齐观感 |
| web 端对齐 | 见第 1 节 |
| 老渲染路径退休 | 两端都是就地增强，无并行双管线，不涉及 |

## 8. 待实现阶段核实

1. 安卓 ActionCard 链路的 AI 卡片判定是否真的不依赖 `ga_` 前缀（行为 spec 第 8 节的坑是否存在）
2. Markwon `HtmlPlugin` 默认是否注册 `<sup>` / `<sub>` Handler
3. 安卓软换行 I8 当前实际表现（是否已按换行显示）
4. PC `message-info.vue` / `msg-reply-poll.vue` 两个复用点是否需要同样的表格横滚容器样式

## 依赖的接口

无新增接口。消费的既有字段：`ZX:ActionCardMsg` 的 `content` / `title` / `agentKnowledgeList`（`docId` / `docName` / `fromType`）、`senderUserId`。契约无变更。
