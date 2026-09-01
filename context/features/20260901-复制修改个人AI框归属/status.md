# Status：复制 / 修改时个人 AI 框归属分流

> 最后更新：2026-09-01 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

复制或修改带 `@个人AI框` 的消息时，按当前登录人重新分类：自己的走个人 AI（高亮 + 个人筛选条 + 个人回复）；别人的变黑、不走智能体；群 AI 框维持现状。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec | — | ✅ | ✅ | ✅ |
| plan | — | ⬜ | ⬜ | ⬜ |
| 回填分类（复制 / 修改 / 撤回再编辑） | — | ✅ | ✅ | ⬜ |
| 自己的补齐 agentKind=personal | — | ✅ | ✅ | ⬜ |
| 别人的降级为黑字 | — | ✅ | ✅ | ⬜ |
| 删 @ 后关掉筛选条 | — | ✅ | ✅ | ✅ 退格只删 chip |
| 真机 / 客户端自测 | — | ✅ | ✅ | ✅ 退格路径 |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| android | master-3.6.23 | synced | 干净 | **本功能** | `f5656de2b` 已 push |
| ios | feat/ios-agent-date-range | synced | 干净 | **本功能** | `db782e3d2` 已 push |
| desktop | master-3.4.27 | synced | 脏(3) 本地调试勿提交 | **本功能** | `77b325c2` 已 push；回填分类未做 |
| web | feat/data-scope-storage-group | synced | 脏(12) | 数据范围选择周工作 | 本回合未改本功能 |
| context | main | ahead 120 | — | **本功能** | — |

## 本次改动

用户已真机验过：iOS 粘贴别人变黑、安卓删 @ 后关筛选条、PC 退格不误吞正文。三端已 commit + push。

| 端 | 分支 | commit |
|---|---|---|
| android | `master-3.6.23` | `f5656de2b` fix(agent): 复制修改个人AI框按当前人重分类，删@后关筛选条 |
| ios | `feat/ios-agent-date-range` | `db782e3d2` fix(agent): 粘贴后再去掉别人个人AI框高亮，按当前人重分类 |
| desktop | `master-3.4.27` | `77b325c2` fix(input): 退格只删紧贴的@芯片，不把删正文当成删@ |

PC 未 stage `.env.test` / `electron-builder.yml` / `package.json`。

## 待办 / 阻塞

- (desktop) 回填分类未做：复制/修改别人的个人 AI 框仍可能按 extra 原样高亮
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
