# Status：PC 合并转发 markdown 宽度溢出

> 最后更新：2026-09-01（今日 5 文件补丁已 restore）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

群 AI 框 ActionCard 合并转发后，聊天记录窗里正文右侧被裁切，表格没有横滚条。会话列表里同条消息不溢出——8 月已给会话气泡加过宽度锁，合并转发详情是另一套克隆布局，当时漏了。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 根因（克隆气泡未锁列宽） | — | — | — | ✅ |
| 合并转发详情 / 回复列表补宽度锁 | — | — | — | ⬜ |
| markdown 单测回归 | — | — | — | ⬜ |
| 运行时点开合并记录自测 | — | — | — | ⬜ |

web / android / ios 本回合未改。iOS 横滚功能当时也写过「聚合 / 合并转发看一眼」，不在本回合范围。

## 本回合各端现状（code-status）

本回合只动 `apps/desktop`：把今天未提交的 5 个业务文件 `git restore` 回 HEAD。其余脏区与本功能无关。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | behind 1 | 仅本地调试 3 件 | **本功能** | 已还原 `markdown.scss` / `msg-list` / `msg-actioncard` / `reply-msg-list` / `winbox-wrapper`；`.env.test` 等勿 stage |
| contact | feat/meetingroom | 无 upstream | 干净 | 会议室后端 | 未改 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 待办 / 阻塞

- (desktop) 合并转发详情溢出问题仍在，今日补丁已按用户要求撤销，未入库
- (desktop) 分支 behind 1，合入前先拉远端，勿 push 到 `master-3.4.27` 联调分支

## 关键决策记录

- 2026-09-01 不重写 markdown 管线。会话列表 `d987d746` 已锁 `min-width:0` + `max-width:100%`；合并转发详情 / 回复列表抄同一套即可
- 2026-09-01 用户不要今日工作区补丁，5 文件已 restore
