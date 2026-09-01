# Status：PC 合并转发 markdown 宽度溢出

> 最后更新：2026-09-01（重做最小补丁：3 文件锁列宽，单测 9/9 绿，未运行时自测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

群 AI 框 ActionCard 合并转发后，聊天记录窗里正文右侧被裁切，表格没有横滚条。会话列表里同条消息不溢出——8 月已给会话气泡加过宽度锁，合并转发详情是另一套克隆布局，当时漏了。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 根因（克隆气泡未锁列宽） | — | — | — | ✅ |
| 合并转发详情 / 回复列表补宽度锁 | — | — | — | ✅ |
| markdown 单测回归 | — | — | — | ✅ |
| 运行时点开合并记录自测 | — | — | — | ⬜ |

web / android / ios 本回合未改。iOS 横滚功能当时也写过「聚合 / 合并转发看一眼」，不在本回合范围。

## 本回合各端现状（code-status）

本回合只动 `apps/desktop`：重做最小补丁，3 个业务文件（未 commit）。其余脏区与本功能无关。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | behind 1 | 3 业务文件 + 1 单测 + 本地调试 3 件 | **本功能** | 改 `winbox-wrapper` / `reply-msg-list` / `msg-list`；`.env.test`、`electron-builder.yml`、`package.json` 勿 stage |
| contact | feat/meetingroom | 无 upstream | 干净 | 会议室后端 | 未改 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 本次改动

| 文件 | 改动 |
|------|------|
| `popwin/winbox-wrapper.vue` | `.message-wrapper` 加 `min-width:0` + `max-width:100%`；`.msg-box` 加 `max-width:100%`；消息内容行加 `minWidth:0` / `maxWidth:100%` |
| `chitchat/reply-msg-list.vue` | 同上（消息内容行原本只有 `maxWidth`，补 `minWidth:0`） |
| `chitchat/message/msg-list.vue` | 消息内容行补 `minWidth:0`（原本靠 `overflow:hidden` 兜住，显式化，三套一致） |

`markdown.scss` / `msg-actioncard.vue` 无需再改，`d987d746` 的锁已在库里。

## 验证

```
npx vitest run test/unit/markdown-table-overflow.spec.js   # 9 passed
npx eslint <三个文件>                                       # 无输出
```

单测文件 `test/unit/markdown-table-overflow.spec.js` 在工作区里本来就带着未提交的新增用例（断言三套气泡都锁列宽 + `md-table-wrap` 有 `overflow-x:auto`），本回合直接跑它做回归。

## 待办 / 阻塞

- (desktop) 运行时自测未做：`npm run dev:test` 打开合并转发详情、回复列表，确认宽表横条出现且正文不被裁
- (desktop) 三个业务文件 + 单测未 commit
- (desktop) 分支 behind 1，合入前先拉远端，勿 push 到 `master-3.4.27` 联调分支

## 关键决策记录

- 2026-09-01 不重写 markdown 管线。会话列表 `d987d746` 已锁 `min-width:0` + `max-width:100%`；合并转发详情 / 回复列表抄同一套即可
- 2026-09-01 用户不要今日工作区补丁，5 文件已 restore
