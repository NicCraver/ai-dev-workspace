# Status：PC 合并转发 markdown 宽度溢出

> 最后更新：2026-09-01 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

群 AI 框 ActionCard 合并转发后，聊天记录窗里正文右侧被裁切，表格没有横滚条。会话列表里同条消息不溢出——8 月已给会话气泡加过宽度锁，合并转发详情是另一套克隆布局，当时漏了。只锁 `.message-wrapper` 不够：头像旁还有一层 `display:flex` 包着气泡，缺 `min-width:0` 时宽表仍按内容撑开，外层 `overflow:hidden` 裁掉右侧。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 根因（克隆气泡未锁列宽） | — | — | — | ✅ |
| 合并转发详情 / 回复列表补宽度锁 | — | — | — | ✅ |
| markdown 单测回归 | — | — | — | ✅ |
| 运行时点开合并记录自测 | — | — | — | ✅ |

web / android / ios 本回合未改。2026-09-01 用户运行时点开该条合并记录确认已修复：气泡不溢出、宽表横滚。

## 本回合各端现状（code-status）

本回合只动 `apps/desktop`（`master-3.4.27`，behind 1）。其余脏区与本功能无关。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | behind 1（未 push） | 仅本地调试 3 件 | **本功能** | 6 文件已提交 `d27bfc41`；`.env.test` / `electron-builder.yml` / `package.json` 未 stage |
| contact | feat/meetingroom | 无 upstream | 干净 | 会议室后端 | 未改 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 本次改动

| 文件 | 改动 |
|------|------|
| `popwin/winbox-wrapper.vue` | 消息列 `flex:1` + `min-width:0`；内容行补 `minWidth:0` / `width:100%`；头像 `flex-shrink:0` |
| `chitchat/reply-msg-list.vue` | 同一套锁（回复列表是另一套克隆） |
| `chitchat/message/msg-list.vue` | 内容行 / `.person-message` 显式 `min-width:0`，三套一致 |
| `msgtype/msg-actioncard.vue` | 去掉 `min-width:200px`（会顶住缩窄）；卡片与 v-html 层跟列宽 |
| `assets/styles/markdown.scss` | `.md-table-wrap` 写 `width:100%`，外壳跟列走、表 `max-content` 才能比外壳宽从而画出横条 |
| `test/unit/markdown-table-overflow.spec.js` | 三套克隆都要锁列宽；O5 三列表仍包在横滚容器里 |

## 验证

```
npx vitest run test/unit/markdown-table-overflow.spec.js   # 9 passed
npx vitest run test/unit/markdown-render.spec.js              # 26 passed
npx vitest run test/unit/markdown-fold-model.spec.js        # 12 passed
```

运行时：用户在 PC 端打开该条合并转发记录，确认气泡不超窗口、正文正常折行、宽表出现横滚条。

## 待办 / 阻塞

- (desktop) 5 个业务文件 + 1 个单测未 commit（`markdown.scss` / `msg-list` / `msg-actioncard` / `reply-msg-list` / `winbox-wrapper` / `markdown-table-overflow.spec.js`）；本地调试三文件保持脏、勿 stage
- (desktop) 分支 behind 1，合入前先拉远端，勿 push 到 `master-3.4.27` 联调分支

## 关键决策记录

- 2026-09-01 不重写 markdown 管线。表仍 `width:max-content`，横滚走既有 `.md-table-wrap`
- 2026-09-01 只锁 `.message-wrapper` 不够，必须连内容行那层 `display:flex` 一起允许缩到列宽
- 2026-09-01 用户不要当日第一版工作区补丁，曾 restore；本回合按截图重做并补内层 flex / 表外壳
