# Status：三端 markdown 标题上蓝 + 自己发气泡分流

> 最后更新：2026-09-02（iOS 阴影后左上圆角丢失、正文溢出：内层裁切 + 宽度跟内缩）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

2026-09-01 把所有自己发气泡调浅到 `#F0F5FF`。2026-09-02 按验收收窄：

1. markdown 标题 H1–H4 `#3E7EFF` 不动。
2. 普通自己发言退回线上色（PC `#CCE0FE`，安卓 / iOS `#DEE8FF`）。
3. 自己发的 ActionCard（转发 AI 回复、定时用我身份）保留卡体 `#F0F5FF` + 卡头 `#D7E5FF`，并加 `1px #F4F6F8` 描边。卡体阴影三端同一 token：`0 0 4px rgba(31,35,41,.1)`。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 标题色（H1–H4 → `#3E7EFF`） | 基准 | ✅ | ✅ | ✅ |
| 普通自己发退回线上色 | — | 🚧 已 push `9a3b6d172`，待真机 | 🚧 已 push `6e964addc`，待真机 | 🚧 已 push `0d00470c`，待热更新 |
| 自己发 ActionCard 浅底 + `#F4F6F8` 描边 | 描边基准 | 🚧 同左 | 🚧 同左 | 🚧 同左 |
| 自己发 ActionCard 卡体阴影 | — | 🚧 4dp ambient，待真机 | 🚧 内层裁圆角 + 宽度跟内缩，待真机 | 🚧 `0 0 4px rgba(31,35,41,.1)` 待热更新 |
| token 表登记 | ✅ | — | — | — |
| 编译 / lint | — | ✅ `:IM:compileOnTestDebugJavaWithJavac` | — 未单独编译 | ✅ eslint 无输出 |
| 运行时验收 | — | ⬜ | ⬜ | ⬜ |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | synced | 脏：本功能阴影 + 本地调试勿提交 | **本功能** | 配色已 push `0d00470c`；阴影未 commit |
| android | master-3.6.23 | synced | 脏：本功能阴影 + 旁路表格/9-patch | **本功能** | `ActionCardMessageItemProvider` 加 4dp 阴影 |
| ios | feat/ios-agent-date-range | synced | 脏：本功能阴影修圆角 + `ZXIMChatCell` 旁路 | **本功能** | `ZXGroupRobotCell` 内层裁切，正文宽跟 4pt 内缩 |
| web | feat/data-scope-storage-group | synced | 干净 | 未改 | 只当描边基准 |
| context | main | ahead | 本功能 docs | **本功能** | — |

## 本次改动（2026-09-02 阴影移植）

| 端 | 文件 | 改动 |
|---|---|---|
| 安卓 | `ActionCardMessageItemProvider.java` | 自己发组织会话卡：4dp margin + 4dp elevation；API 28+ 关掉 spot、ambient 用 `rgba(31,35,41,.1)`；向上放开 clip |
| iOS | `ZXGroupRobotCell.m` | 阴影后左上变方、正文溢出：内容收到内层按圆角裁；排版宽度 = 气泡宽 − 32（气泡已内缩 8pt） |
| context | impl-notes / status | 阴影从「仅 PC」改为三端同一 token |

## 待办 / 阻塞

- (ios) 真机再验：自己发 AI 卡左上仍是圆角，表格/长文不溢出卡体，四周浅阴影还在
- (android) 2026-09-02 **自己发「查看更多」蒙层色带（已改代码，请再验）**：气泡 solid 已退回 `#DEE8FF`，但 `zu_zhi_robot_card_more_own_send.9.png` 9/1 仍停在 `#F0F5FF`，会在气泡上压出一条浅色带。已从调浅前提交还原 9-patch。收到消息的白色那张没动。
- 三端均未 commit / 未 push；`master-3.4.27` / `master-3.6.23` 是联调主干，走 MR，别直推
- PC 勿提交 `.env.test` / `electron-builder.yml` / `package.json`
- 各端还混着 markdown 表格列宽等旁路脏文件，提交时只挑本功能文件
- (android) API < 28 没有 ambient/spot 色，会退化成系统默认方向阴影，真机若看起来像「底下一条黑」再改自定义 glow

## 关键决策记录

- 2026-09-02 三端阴影对齐 PC：`0 0 4px rgba(31,35,41,.1)`，不要 Material / UIKit 那种向下投影
- 2026-09-02 阴影贴边看不见：外壳不能裁切；四边留约 4px，圆角裁切下放到内层。上阴影原先只有左右留空，紧贴时间条会被盖住
- 2026-09-02 **iOS 自己发卡片**：外壳放开裁切后，直角标题条会盖住左上圆角、正文仍按旧宽度排会溢出。必须内层按圆角裁内容，排版宽度跟着内缩走
- 2026-09-02 分流 = **自己发 + ActionCard**，不用 `fixTaskMessage`（转发会抹掉）
- 2026-09-01 标题只染 H1–H4（仍有效）
- 2026-09-01 PC 自己发气泡色有两层：`chat-box.vue` 的 `!important` 才是真生效（仍有效）
- 2026-09-01 安卓不改 `color_DEE8FF` 资源，只改那张历史命名 drawable 的 solid（仍有效；浅底改走新 drawable）
- 2026-09-02 自己发「查看更多」蒙层：PC 渐变已跟回 `#CCE0FE`；安卓真正露出来的是 9-patch `zu_zhi_robot_card_more_own_send`，气泡退回线上后必须把 9-patch 也退回，不能只改 xml 渐变。收到消息仍用白色那张。
