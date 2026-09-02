# Status：复制 / 修改时个人 AI 框归属分流

> 最后更新：2026-09-02 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

复制或修改带 `@个人AI框` 的消息时，按当前登录人重新分类：自己的走个人 AI（高亮 + 个人筛选条 + 个人回复）；别人的变黑、不走智能体；群 AI 框维持现状。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec | — | ✅ | ✅ | ✅ |
| plan | — | ⬜ | ⬜ | ⬜ |
| 回填分类（复制 / 修改 / 撤回再编辑） | — | ✅ | ✅ | 🚧 已 push，待客户端验 |
| 自己的补齐 agentKind=personal | — | ✅ | ✅ | 🚧 同左 |
| 别人的降级为黑字 | — | ✅ | ✅ | 🚧 同左 |
| 删 @ 后关掉筛选条 | — | ✅ | ✅ | ✅ 退格只删 chip |
| 真机 / 客户端自测 | — | ✅ | ✅ | 🚧 回填分类待验 |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | synced | 脏(3) 本地调试勿提交 | **本功能** | `e2e8b40b` 已 push |
| android | master-3.6.23 | synced | 干净 | **本功能** | 已 push |
| ios | feat/ios-agent-date-range | synced | 干净 | **本功能** | 已 push |
| web | feat/data-scope-storage-group | synced | 脏(12) | 数据范围选择周工作 | 本回合未改本功能 |
| context | main | ahead 128 | 本功能 impl-notes/status | **本功能** | — |

## 本次改动

**apps/desktop**（`e2e8b40b` 已 push 到 `master-3.4.27`）

复制自己的个人 AI 框到输入框时，粘贴只 `push({id,name})`，没有 `agentKind`。无 kind 的 `ga_` 被当成群智能体，筛选条走群那套，看起来就像没识别成个人 AI。

| 文件 | 改动 |
|------|------|
| `restoreAgentMention.js` + `.test.mjs` | 按 `groupAgentRel` / 本人 `groupAgentRels` / peopleList 分类；6 例全绿 |
| `send-box.vue` paste / 修改 / 草稿 / 回复 @ | 回填写入 `agentKind` + `agentId`；`hasGroupAgentMention` 不再把无 kind 的 `ga_` 当群 |

## 待办 / 阻塞

- (desktop) 客户端：复制自己的 `@个人AI框` → 蓝色 + 个人筛选条「全部类型」；复制别人的 → 黑字无条
- plan 仍未写

## 关键决策记录

- 2026-09-01 回填时重新分类，不信任 extra.agentKind，不用 `ga_` 区分群/个人
- 2026-09-01 显示名仍用 agentName，不改成「自己的个人AI框」
- 2026-09-01 群 AI 框复制/修改维持现状（高亮 + 群筛选条 + 群回复）
- 2026-09-01 **iOS extra.atUserList 没有 agentKind**，回填必须对 groupAgentRels，不能从 extra 读 kind
- 2026-09-01 去掉回填路径上「无 kind + ga_ → 群」兜底，否则自己的个人 AI 会点亮群筛选条
- 2026-09-01 三端退格统一：@ 区块只覆盖 chip；整删仅发生在 chip 末尾
- 2026-09-01 **iOS 粘贴必须先写入再分类去高亮**，否则会把蓝色覆盖回来
- 2026-09-01 **Android 软键盘退格不走 KEYCODE_DEL**，要在逐字删除后检查是否还剩智能体 mention
- 2026-09-02 **PC 粘贴必须带上 agentKind**，只写 id/名字会把本人个人 AI 当成群
