# Spec：三端 markdown 表格横滚左右渐变遮罩

> 最后更新：2026-08-18  
> 上游：`context/features/20260814-pc安卓-GFM-Markdown渲染对齐`（表格已能横滚）、`context/features/20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化`（iOS 段栈 + 表格视图）  
> 配色原则：`context/design/markdown-style-tokens.md`（半透明黑叠任意气泡底；遮罩实色端跟气泡，不写死浅灰白）

## 1. 背景与目标

宽 markdown 表格已经可以横向滚动，但滚到中间时左右被裁切的单元格是硬切，看不出「外面还有内容」。

本期给横滚容器左右各加一条渐变遮罩：实色端盖住被裁的字，透明端溶进表格。贴着某一边时，那一侧不画罩。收到的白气泡用白渐变即可；自己发的淡蓝（以及安卓/iOS 外链绿）必须跟真实气泡底色，不能糊一块白。

成功标准：宽表滚动时左右提示存在、触边消失、两种（或三种）气泡底色上遮罩都贴底；窄表完全没有遮罩；手势和长按不被遮罩吃掉。

## 2. 用户流程

1. 用户打开含宽表格的机器人/智能体消息。默认贴左，只看见右侧渐变罩。
2. 向右拖：离开左缘后左侧罩出现；两侧都有罩表示还能往两边滚。
3. 拖到右尽头：右侧罩消失，只留左侧罩。
4. 表格本身不比气泡宽：全程左右都不画罩。
5. 自己发的消息（淡蓝气泡）走同一套交互，罩的实色是气泡蓝而不是白。

## 3. 范围

### 本期做

- PC / 安卓 / iOS 会话气泡里、同一套管线渲染出来的 markdown 表格（含消息详情、合并转发、回复聚合/引用——这些落点复用同一套 cell/组件，不另做实现）。
- 左右渐变遮罩 + 触边隐藏 + 滚动过程中实时更新。
- 遮罩实色跟随当前气泡真实底色。

### 本期不做

- web（`AcMarkdown.vue` 是 AI 卡片弹窗，不是消息气泡）
- 改 markdown 解析、改表格配色 token、改折叠阈值
- 气泡底部「查看更多」的上下淡出（已有、本期不动）
- 首列固定、自定义滚动条、阴影

## 4. 交互与视觉（三端一致）

| 规则 | 值 |
|------|----|
| 溢出判定 | 内容宽 > 可见宽，差值 > 1px 才算溢出 |
| 左罩 | `scrollOffset > 1px` 时显示 |
| 右罩 | `scrollOffset + visibleWidth < contentWidth - 1px` 时显示 |
| 不溢出 | 左右都不画 |
| 宽度 | 24px / 24dp / 24pt |
| 渐变 | 左：实色 → 透明（向右淡出）；右：相反 |
| 实色 | 当前这条气泡的真实底色（见第 6 节） |
| 更新时机 | 滚动过程中实时，不是松手才变；宽度变化（窗口/旋转/折叠）后重算 |
| 手势 | 遮罩不吃点击、横滚、长按转发/回复；`pointer-events: none` 或原生等价（画在 `dispatchDraw` / 外壳 layer 上、不进可点树） |
| 多表 | 一条消息里每张表各自听自己的滚动 |
| 与上下折叠罩 | 各管各的；横滚罩不挡「查看更多」按钮 |

## 5. 方案

左右叠一层渐变（方案 A）。不把表格内容本身 mask 成透明（安卓 `HorizontalScrollView` + mask 容易裁坏滚动；iOS 网格绘制会打架）。不写死白/淡蓝两套图（外链底色对不齐）。

解析管线不动。遮罩是横滚容器的装饰。

## 6. 各端落点

颜色跟现有气泡同一条路，不在遮罩里另写一套色值。三端底色本来就不完全一样，这是跟「真实底色」而不是对齐绝对 hex。

| | 收到 | 自己发（组织） | 自己发（外链/微信） |
|---|---|---|---|
| PC | `#ffffff`（`.msg-box`） | `#d7e5ff`（`.message-item-self .msg-box`） | 无第三套 |
| 安卓 | 白 / 外链收到 `#eff2f6` | `#dee8ff` | `#99f0cb` |
| iOS | `#FFFFFF` | `#DEE8FF` | `#B3ECCF`（`getBubbleColor:`） |

### 6.1 PC（`apps/desktop`）

- 样式：全局 `src/renderer/assets/styles/markdown.scss` 的 `.md-table-wrap`。`position: relative` + 左右伪元素画渐变。颜色吃 CSS 变量 `--md-table-fade-color`。
- 变量落点：`msg-list.vue` 里已经给 `.msg-box` / `.message-item-self .msg-box` 设了气泡底，顺手设这个变量。debug 用例页不在气泡里，变量缺省为白。
- 开关 class：`fade-left` / `fade-right`（或等价命名）。`v-html` 产出的表格用 markdown 容器 **capture 监听 `scroll`**，加上 `ResizeObserver`，给对应 wrap 打/摘 class。
- 消费方：`msg-actioncard.vue`、`msg-reply-poll.vue`、debug `#/debug/markdown`。`message-info.vue` 只出纯文本摘要，不渲染 html，不必接。

硬约束：禁止 `npm install`；禁用可选链 `?.` / `??`；提交不带 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json`。

### 6.2 安卓（`apps/android`）

- `ZXMarkdownTableView` 本身是 `HorizontalScrollView`。在 `dispatchDraw` 里按 `scrollX` 画左右渐变，不另叠可点 View（避免挡手势、抢焦点、RecyclerView 回弹）。`onScrollChanged` 里 `invalidate`。
- 气泡色由 `ActionCardMessageItemProvider` 设 `mLlMessage` 背景的**同一分支**传入（`isSend` × 组织/外链）。`bind` / 新 setter 都必须在复用时重绑，禁止把上一张的淡蓝带到白气泡上。
- 段栈 `ZXMarkdownContentView` 建表时把颜色传下去。其它走段栈的展示位自动带上。

硬约束：子 View 保持 `focusable=false`；长按继续冒泡到气泡根。

### 6.3 iOS（`apps/ios`）

- `ZXMarkdownTableView` 已是「外壳 UIView + 内层 `UIScrollView`」。左右 `CAGradientLayer` 挂在外壳上（**不能**进 scrollView，否则会跟着内容滚）。`scrollViewDidScroll:` 开关 `hidden`；`layoutSubviews` 里更新 frame。
- 颜色：`ZXIMCellLogic getBubbleColor:`（组织 / 微信、发送 / 接收、回复聚合用 `originMessageDirection`）。「查看更多」上下罩已经这么取。
- 接入：`ZXGroupRobotCell` / `ZXIMAgentStreamReplyCell` 绑定时把颜色传给段栈 → 表格。聚合弹窗和合并转发复用这两个 cell，不另改。
- 流式期间表格是纯文本、没有横滚容器，也就没有左右罩；流结束成表后再出现。这是既有规则，不是新行为。

## 7. 依赖的接口

无后端接口。不改 `context/contracts/`。

## 8. 验收

每种气泡底色都要看（PC：收到白 / 自己发蓝；安卓/iOS：再加上外链绿）。

1. 宽表：默认贴左只见右罩；往右拖左罩出现；拖到头右罩消失。
2. 窄表：完全没有遮罩。
3. 自己发的淡蓝（及安卓/iOS 外链绿）上，罩是气泡色不是白块。
4. 表格上长按仍能出菜单（安卓/iOS）；上下滑仍能滚会话。PC 右键菜单不被挡。
5. 一条消息多张宽表，各滚各的罩。
6. 改窗口宽度 / 旋转后，溢出状态和罩的显隐重算正确。
7. PC `#/debug/markdown` 宽表用例同样有左右罩（白底即可）。
8. 详情 / 合并转发 / 回复聚合里的宽表行为与会话一致（复用同一套管线，抽查看一眼）。

## 9. 已确认的问题

- 3 端 = PC + 安卓 + iOS，web 不做
- 实色跟随当前气泡真实底色（含外链）
- 同一套管线的所有 markdown 表格都做
- 方案 = 左右叠渐变层，宽 24，触边阈值 1px
