# Status：三端 markdown 标题上蓝 + 自己发气泡分流

> 最后更新：2026-09-02 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

2026-09-01 把所有自己发气泡调浅到 `#F0F5FF`。2026-09-02 按验收收窄：

1. markdown 标题 H1–H4 `#3E7EFF` 不动。
2. 普通自己发言退回线上色（PC `#CCE0FE`，安卓 / iOS `#DEE8FF`）。
3. 自己发的 ActionCard（转发 AI 回复、定时用我身份）保留卡体 `#F0F5FF` + 卡头 `#D7E5FF`，并加 `1px #F4F6F8` 描边（对齐 web `BaseMsgCard` 白卡，无 box-shadow）。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 标题色（H1–H4 → `#3E7EFF`） | 基准 | ✅ | ✅ | ✅ |
| 普通自己发退回线上色 | — | 🚧 已 push `9a3b6d172`，待真机 | 🚧 已 push `6e964addc`，待真机 | 🚧 已 push `0d00470c`，待热更新 |
| 自己发 ActionCard 浅底 + `#F4F6F8` 描边 | 描边基准 | 🚧 同左 | 🚧 同左 | 🚧 同左 |
| token 表登记 | ✅ | — | — | — |
| 编译 / lint | — | ✅ `:IM:compileOnTestDebugJavaWithJavac` | — 未单独编译 | ✅ eslint 无输出 |
| 运行时验收 | — | ⬜ | ⬜ | ⬜ |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | synced | 脏(3) 本地调试勿提交 | **本功能** | 与表格列宽同一 commit `0d00470c` 已 push |
| android | master-3.6.23 | synced | 干净 | **本功能** | 与表格列宽同一 commit `9a3b6d172` 已 push |
| ios | feat/ios-agent-date-range | synced | 干净 | **本功能** | 与表格列宽同一 commit `6e964addc` 已 push |
| web | feat/data-scope-storage-group | synced | 干净 | 未改 | 只当描边基准 |
| context | main | ahead | 本功能 docs | **本功能** | — |

## 本次改动（2026-09-02）

| 端 | 文件 | 改动 |
|---|---|---|
| PC | `chat-box.vue` | 组织会话自己发退回 `#cce0fe`；`.msg-box-actioncard` `#f0f5ff` + `1px #f4f6f8` |
| PC | `msg-list.vue` / `reply-msg-list.vue` / `winbox-wrapper.vue` | 基底同步；ActionCard 加 `msg-box-actioncard` |
| PC | `msg-txt-fold-expand.vue` / `msg-reply.vue` | 折叠渐变跟回 `#cce0fe` |
| 安卓 | `shape_solid_dee8ff_...16dp.xml` | solid 退回 `#DEE8FF` |
| 安卓 | `shape_solid_f0f5ff_...16dp.xml`（新） | ActionCard 自己发：`#F0F5FF` + stroke `#F4F6F8` |
| 安卓 | `ActionCardMessageItemProvider.java` | `isSend && style==0` 改引新 drawable |
| 安卓 | `shape_vertical_graduated_transf0f5ff_to_f0f5ff.xml` | 文本折叠末端改回 `#DEE8FF`（文件名历史） |
| iOS | `ZXUiMacro.h` | `Color_Chat_ZZ_Send` 退回 `#DEE8FF` |
| iOS | `ZXGroupRobotCell.m` | 自己发覆盖 `#F0F5FF` + `Color_Gray` 描边（CAShapeLayer，避开 mask 裁边） |
| iOS | `zx_chat_cell_bubble_sender.imageset` | 预览填充 `#F0F5FF` → `#DEE8FF` |
| context | token 表 / impl-notes / plan | `#F0F5FF` 只属于自己发 ActionCard |

## 待办 / 阻塞

- 三端真机 / 热更新：自己打的字 = 线上蓝；转发 AI 卡 / 定时用我身份 = 浅底 + `#F4F6F8` 描边
- 三端均未 commit / 未 push；`master-3.4.27` / `master-3.6.23` 是联调主干，走 MR，别直推
- PC 勿提交 `.env.test` / `electron-builder.yml` / `package.json`
- 各端还混着 markdown 表格列宽等旁路脏文件，提交时只挑本功能文件

## 关键决策记录

- 2026-09-02 分流 = **自己发 + ActionCard**，不用 `fixTaskMessage`（转发会抹掉）
- 2026-09-02 不做阴影。web `BaseMsgCard` 白卡只有 `border: 1px solid #F4F6F8`
- 2026-09-01 标题只染 H1–H4（仍有效）
- 2026-09-01 PC 自己发气泡色有两层：`chat-box.vue` 的 `!important` 才是真生效（仍有效）
- 2026-09-01 安卓不改 `color_DEE8FF` 资源，只改那张历史命名 drawable 的 solid（仍有效；浅底改走新 drawable）
