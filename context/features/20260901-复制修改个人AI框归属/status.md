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
| 删 @ 后关掉筛选条 | — | ⬜ | ⬜ | 🚧 代码已改，未起客户端验 |
| 真机 / 客户端自测 | — | ⬜ | ⬜ | ⬜ |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | synced | 脏(4) | **本功能** + 本地调试 3 件勿提交 | 本功能只改 `send-box.vue`；`.env.test` / `electron-builder.yml` / `package.json` 勿提交 |
| ios | — | — | — | 本功能 | 本回合只把 spec 落点写准，未改代码 |
| android | master-3.6.23 | ahead 5 | 干净 | 其它 | 先前 merge 了远端 startTime/endTime，与本功能无关 |
| context | — | — | 本功能 spec/status | **本功能** | — |

## 本次改动

**apps/desktop**（未单独 commit）

| 文件 | 改动 |
|------|------|
| `sendbox/send-box.vue` `checkAtHandler` | 按 `item.id` 从 `aSomeOneList` 移除（原先 `item != spanNode.id`，对象永远删不掉）；`selectNode` 整颗 mention 删掉 |
| `sendbox/send-box.vue` `inputHandle` | mention 壳还在但文案已空，也从列表拿掉，避免点选后删内容留下空壳 |

## 待办 / 阻塞

- (desktop) 起 PC 客户端：@ 自己的个人 AI → 出个人条 → 退格删掉 @ → 条应立刻关；群 AI 同样
- spec 已补 iOS 真实入口（paste / setupInputTextWithSelectModel / ZXChatRecallAtList）及 extra 不带 kind；plan 仍未写
- 复制/修改分流三端代码尚未开始

## 关键决策记录

- 2026-09-01 回填时重新分类，不信任 extra.agentKind，不用 `ga_` 区分群/个人
- 2026-09-01 显示名仍用 agentName，不改成「自己的个人AI框」
- 2026-09-01 群 AI 框复制/修改维持现状（高亮 + 群筛选条 + 群回复）
- 2026-09-01 **iOS extra.atUserList 没有 agentKind**，回填必须对 groupAgentRels，不能从 extra 读 kind
- 2026-09-01 PC 退格关条：列表按 id 比对 + 删整颗 mention，空壳不当还在 @
