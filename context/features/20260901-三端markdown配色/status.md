# Status：三端 markdown 标题上蓝 + 自己发气泡调浅

> 最后更新：2026-09-01（三端代码改完，仅安卓编译验证过；PC / iOS 未运行时自测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

两条视觉调整，来源是用户对照 web 端提的：

1. markdown 标题（H1–H4）从正文黑改成 primary `#3E7EFF`，对齐 web `AcMarkdown.vue`。H5 / H6 不上色（web 也没上）。
2. 自己发送消息的气泡底色调浅到 `#EBF2FF`（web 同款浅蓝）。原值 PC `#D7E5FF`、安卓 / iOS `#DEE8FF`，三端本来就不一致，顺手统一。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 标题色（H1–H4 → `#3E7EFF`） | 基准（早已是） | ✅ | ✅ | ✅ |
| 自己发气泡底 → `#EBF2FF` | 无聊天气泡 | ✅ | ✅ | ✅ |
| token 表登记 | ✅ | — | — | — |
| 编译 / 单测 | — | ✅ `:IM:compileOnTestDebugJavaWithJavac` | ⬜ 未编译 | ⬜ 未跑 |
| 运行时自测 | — | ⬜ | ⬜ | ⬜ |

## 本次改动

| 端 | 文件 | 改动 |
|---|---|---|
| PC | `assets/styles/markdown.scss` | 新增 `h1~h4 { color: #3e7eff }` |
| PC | `msg-list.vue` / `reply-msg-list.vue` / `winbox-wrapper.vue` | `.message-item-self .msg-box` 的 `background-color` / `border-color` `#d7e5ff` → `#ebf2ff`（scss 注释里的旧色号一并改） |
| 安卓 | `ZXMarkwonFactory.java` | `configureSpansFactory` 里 `appendFactory(Heading.class, …)` 给 H1–H4 追加 `ForegroundColorSpan(0xFF3E7EFF)` |
| 安卓 | `base_util/res/drawable/shape_solid_dee8ff_lefttop_leftbottom_rightbottom_radius_16dp.xml` | `solid` 改指 `@color/color_EBF2FF`（该色已存在于 `base_color.xml`，勿重复声明） |
| iOS | `ZXMarkdownStyle.h/.m` | 新增 `headerColor`（默认 `#3E7EFF`）与 `headerColorMaxLevel`（默认 4） |
| iOS | `ZXMarkdownAttributedBuilder.m` | `CMARK_NODE_HEADING` 分支按层级染色，跳过已有独立颜色的片段（保住标题里的链接色） |
| iOS | `ZX_Defines/ZXUiMacro.h` | `Color_Chat_ZZ_Send` `DEE8FF` → `EBF2FF` |
| iOS | `zx_chat_cell_bubble_sender.imageset/*.png` | 填充色 `#E5EFFE` → `#EBF2FF`（字号设置页的气泡预览图，跟真实气泡对齐） |
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
- 2026-09-01 待办里的 ToDo 卡片仍在用 `color_D7E5FF`（`shape_graduated_d7e5ff_to_d7e5ff_alpha70` 与 moreButton 底），本来就和气泡的 `DEE8FF` 不同色，属历史遗留，本回合不动
