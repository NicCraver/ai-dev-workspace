# Status：三端 markdown 标题上蓝 + 自己发气泡调浅

> 最后更新：2026-09-01（三端代码改完，仅安卓编译验证过；PC / iOS 未运行时自测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

两条视觉调整，来源是用户对照 web 端提的：

1. markdown 标题（H1–H4）从正文黑改成 primary `#3E7EFF`，对齐 web `AcMarkdown.vue`。H5 / H6 不上色（web 也没上）。
2. 自己发送消息的气泡底色调浅到 `#F0F5FF`。原值 PC 实际生效 `#CCE0FE`（`msg-list.vue` 那份 `#D7E5FF` 被 `chat-box.vue` 的 `!important` 盖着）、安卓 / iOS `#DEE8FF`，三端本来就不一致，顺手统一。先落了一版 `#EBF2FF`，用户看过实机后要求再浅一档。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 标题色（H1–H4 → `#3E7EFF`） | 基准（早已是） | ✅ | ✅ | ✅ |
| 自己发气泡底 → `#F0F5FF` | 无聊天气泡 | ✅ | ✅ | ✅ |
| token 表登记 | ✅ | — | — | — |
| 编译 / 单测 | — | ✅ `:IM:compileOnTestDebugJavaWithJavac` | ⬜ 未编译 | ⬜ 未跑 |
| 运行时自测 | — | ⬜ | ⬜ | ⬜ |

## 本次改动

| 端 | 文件 | 改动 |
|---|---|---|
| PC | `assets/styles/markdown.scss` | 新增 `h1~h4 { color: #3e7eff }` |
| PC | `chat-box.vue` | **真正生效的那处**：`.chat-box-organization .message-item-self .msg-box` `#cce0fe !important` → `#f0f5ff`。选中行高亮 `#ebf2ff` 按用户要求不动 |
| PC | `msg-list.vue` / `reply-msg-list.vue` / `winbox-wrapper.vue` | 基底色 `#d7e5ff` → `#f0f5ff`（被上面那条 `!important` 盖着，但同步改，免得下次又对不上） |
| PC | `msg-txt-fold-expand.vue` / `msg-reply.vue` | 折叠遮罩渐变 `foldParentBg_Or_Send` 的落色跟气泡走 |
| PC | `msgtype/msg-actioncard.vue` | 自己发的卡头 `#b2cbff` → `#d7e5ff`，与「白底卡 + `#EBF2FF` 头」保持同样的头体对比 |
| 安卓 | `ZXMarkwonFactory.java` | `configureSpansFactory` 里 `appendFactory(Heading.class, …)` 给 H1–H4 追加 `ForegroundColorSpan(0xFF3E7EFF)` |
| 安卓 | `base_util/res/drawable/shape_solid_dee8ff_lefttop_leftbottom_rightbottom_radius_16dp.xml` | `solid` 直接写 `#F0F5FF`（`color_F0F5FF` 定义在上层的 `basis_function_api`，base_util 引不到） |
| 安卓 | `base_util/res/drawable/zu_zhi_robot_card_more_own_send.9.png` | 「查看更多」折叠遮罩重上色 `#DEE8FF` → `#F0F5FF`（保 alpha、保边框；四个 provider 都按 `isSend` 引这一张） |
| 安卓 | `base_util/res/drawable/shape_vertical_graduated_transf0f5ff_to_f0f5ff.xml`（新） + `TextMessageItemProvider.java` | 引用单元折叠遮罩 `rl_refer_unit_expand` 按 `isSend && style==0` 换成淡蓝渐变，其余仍白 |
| 安卓 | `base_util/res/drawable/shape_solid_c5d8ff_lefttop_radius_16dp.xml` | 自己发的卡头 `#C5D8FF` → `#D7E5FF`（只有 ActionCard 一处引用，直接改这张） |
| iOS | `ZXGroupRobotCell.m:815` | 自己发的卡头 `#b2cbff` → `#D7E5FF`；收到的仍 `#EBF2FF` |
| iOS | `ZXMarkdownStyle.h/.m` | 新增 `headerColor`（默认 `#3E7EFF`）与 `headerColorMaxLevel`（默认 4） |
| iOS | `ZXMarkdownAttributedBuilder.m` | `CMARK_NODE_HEADING` 分支按层级染色，跳过已有独立颜色的片段（保住标题里的链接色） |
| iOS | `ZX_Defines/ZXUiMacro.h` | `Color_Chat_ZZ_Send` `DEE8FF` → `F0F5FF` |
| iOS | `zx_chat_cell_bubble_sender.imageset/*.png` | 填充色 `#E5EFFE` → `#F0F5FF`（字号设置页的气泡预览图，跟真实气泡对齐） |
| context | `design/markdown-style-tokens.md` | 加「标题色」token 行；原则 3 补气泡底色变更；样式入口表补气泡色入口 |

## 验证

```
apps/android: ./gradlew :IM:compileOnTestDebugJavaWithJavac --offline   # 通过
```

PC 未跑 `npm run dev:test`，iOS 未 `xcodebuild`。三端都没做真机 / 运行时看色。

## 待办 / 阻塞

- (desktop) 起 `dev:test` 看：标题变蓝、自己发气泡变浅、表格线在更浅底上仍清楚
- (android) `assembleOnTestDebug` 装真机，看群 AI 卡片标题色与右侧气泡
- (ios) Xcode 编译 + 真机；重点看标题里带链接的情况（链接不该被染成标题色）
- 三端改动均未 commit

## 关键决策记录

- 2026-09-01 标题只染 H1–H4，H5/H6 跟正文——照抄 web `AcMarkdown.vue` 的现状，它俩字号不缩小，上色会和正文里的强调混淆
- 2026-09-01 安卓用 `appendFactory` 不用 `setFactory`：`setFactory` 会顶掉 Markwon 默认给标题挂的加粗与字号倍率 span
- 2026-09-01 安卓不改 `color_DEE8FF` 的值，也不新建 `shape_solid_ebf2ff_*`：前者会连累群已读渐变 `shape_group_read_radius_16dp`，后者要改 IM / smart_message 二十多处引用。折中是只换那张 drawable 里 `solid` 的取值，文件名保留历史命名并在文件头注明
- 2026-09-01 iOS 标题染色跳过「已有独立颜色」的片段，否则整段覆盖会把标题里的链接也染成标题色
- 2026-09-01 PC 的自己发气泡色**有两层**：`msg-list.vue` 等三处是基底，`chat-box.vue` 的 `.chat-box-organization` 主题带 `!important` 覆盖，只改基底看不出任何变化（第一版就踩了这个坑）
- 2026-09-01 气泡定 `#F0F5FF`，不再往浅走：PC 会话背景 `#F6F9FF`、iOS `#F5F8FF`，继续调浅气泡就贴到背景上、看不出形状
- 2026-09-01 选中消息的行高亮仍是 `#EBF2FF`，与气泡 `#F0F5FF` 很接近，多选时气泡边界会发虚——用户明确选择不改
- 2026-09-01 卡片标题条统一「比卡体深一档」：收到 = 白体 + `#EBF2FF` 头；自己发 = `#F0F5FF` 体 + `#D7E5FF` 头。三端原值各不同（PC `#B2CBFF`、安卓 `#C5D8FF`、iOS `#b2cbff`）
- 2026-09-01 安卓「查看更多」的渐变是张 9-patch 图 `zu_zhi_robot_card_more_own_send.9.png`（末端写死 `#DEE8FF`），不是 shape，只能重上色；PC 用 `-webkit-mask-image` 渐隐、iOS 也没写死色，所以只有安卓需要改
- 2026-09-01 待办里的 ToDo 卡片仍在用 `color_D7E5FF`（`shape_graduated_d7e5ff_to_d7e5ff_alpha70` 与 moreButton 底），本来就和气泡的 `DEE8FF` 不同色，属历史遗留，本回合不动
