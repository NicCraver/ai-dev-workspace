# Status：复制 / 修改时个人 AI 框归属分流

> 最后更新：2026-09-01 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

复制或修改带 `@个人AI框` 的消息时，按当前登录人重新分类：自己的走个人 AI（高亮 + 个人筛选条 + 个人回复）；别人的变黑、不走智能体；群 AI 框维持现状。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec | — | ✅ | ✅ | ✅ |
| plan | — | ⬜ | ⬜ | ⬜ |
| 回填分类（复制 / 修改 / 撤回再编辑） | — | ⬜ | ⬜ | ⬜ |
| 自己的补齐 agentKind=personal | — | ⬜ | ⬜ | ⬜ |
| 别人的降级为黑字 | — | ⬜ | ⬜ | ⬜ |
| 删 @ 后关掉筛选条 | — | 🚧 退格按 chip 收紧，未真机验 | 🚧 同左；粘贴/草稿区间 clamp + 后续输入不再继承 @ 色，未真机验 | 🚧 退格误吞正文后已收紧，未起客户端验 |
| 真机 / 客户端自测 | — | ⬜ | ⬜ | ⬜ |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| android | master-3.6.23 | ahead 5 | 脏(1) `RichEditText.java` | **本功能** | 未 commit；先前 merge 的 startTime/endTime 已在 ahead 里 |
| ios | feat/ios-agent-date-range | synced | 脏(8) 输入框 @ 退格相关 | **本功能**（叠在数据范围分支上） | 未单独开分支、未 commit |
| desktop | master-3.4.27 | synced | 脏(4) | **本功能** + 本地调试 3 件勿提交 | 只提交 `send-box.vue`；`.env.test` / `electron-builder.yml` / `package.json` 勿提交 |
| web | feat/data-scope-storage-group | synced | 脏(8) | 数据范围选择周工作 | 本回合未改 |
| context | main | ahead 115 | 本功能 spec/status/impl-notes | **本功能** | — |

## 本次改动

**apps/android**（未 commit）

| 文件 | 改动 |
|------|------|
| `RichEditText` | @ span 回填时收到「@姓名 」；退格若 span 盖住正文先收回 chip，只在光标贴 chip 末尾才整删 |

**apps/ios**（未 commit）

| 文件 | 改动 |
|------|------|
| `ZXIMCellLogic` | `clampedAtUserChipRange` / `shouldDeleteWholeAtUserOnBackspace` |
| 小输入 / 全屏输入退格 | 只在 chip 末尾整删；中间删只认 chip 内部 |
| 粘贴 / 修改 / 草稿 / 撤回再编辑 | extra 下标过长时收到 chip |
| 插入 @、粘贴、草稿后 | 后续输入用黑字，避免 @ 色撑到「测试1」 |

**apps/desktop**（本回合未再改，仍是上一轮 `send-box.vue`）

## 待办 / 阻塞

- (三端) `@李权泓的AI框22 测试1` 只删末尾「1」应得 `@… 测试`，@ 仍在；光标在 @ 后空格再退格才整颗去掉并关条——代码已按此写，未真机/客户端验
- spec 已补 iOS 真实入口；plan 仍未写
- 复制/修改分流（自己的 personal / 别人的降级）三端代码尚未开始

## 关键决策记录

- 2026-09-01 回填时重新分类，不信任 extra.agentKind，不用 `ga_` 区分群/个人
- 2026-09-01 显示名仍用 agentName，不改成「自己的个人AI框」
- 2026-09-01 群 AI 框复制/修改维持现状（高亮 + 群筛选条 + 群回复）
- 2026-09-01 **iOS extra.atUserList 没有 agentKind**，回填必须对 groupAgentRels，不能从 extra 读 kind
- 2026-09-01 PC 退格关条：列表按 id 比对 + 删整颗 mention；**不得**在 `mentionBox + 正文 + hideSpan` 三节点时把删「测试1」当成删 @
- 2026-09-01 三端退格统一：@ 区块只覆盖 chip；整删仅发生在 chip 末尾，删后面正文不得吃掉 @
