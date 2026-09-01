# Status：复制 / 修改时个人 AI 框归属分流

> 最后更新：2026-09-01 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

复制或修改带 `@个人AI框` 的消息时，按当前登录人重新分类：自己的走个人 AI（高亮 + 个人筛选条 + 个人回复）；别人的变黑、不走智能体；群 AI 框维持现状。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec | — | ✅ | ✅ | ✅ |
| plan | — | ⬜ | ⬜ | ⬜ |
| 回填分类（复制 / 修改 / 撤回再编辑） | — | 🚧 代码已写，未真机验 | 🚧 粘贴时序已修，未真机验 | ⬜ |
| 自己的补齐 agentKind=personal | — | 🚧 同左 | 🚧 同左 | ⬜ |
| 别人的降级为黑字 | — | 🚧 同左 | 🚧 粘贴先写进框再去高亮 | ⬜ |
| 删 @ 后关掉筛选条 | — | 🚧 软键盘逐字删也会关条 | 🚧 同左 | 🚧 退格误吞正文后已收紧，未起客户端验 |
| 真机 / 客户端自测 | — | ⬜ | ⬜ | ⬜ |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| android | master-3.6.23 | ahead 5 | 脏(7) 回填分类 + 退格关条 | **本功能** | 未 commit |
| ios | feat/ios-agent-date-range | synced | 脏(10) 回填分类叠在数据范围分支 | **本功能** | 未单独开分支、未 commit |
| desktop | master-3.4.27 | synced | 脏(4) | **本功能** + 本地调试 3 件勿提交 | 回填分类未做；只提交 `send-box.vue` |
| web | feat/data-scope-storage-group | synced | 脏(12) | 数据范围选择周工作 | 本回合未改本功能 |
| context | main | ahead 119 | 本功能 impl-notes/status | **本功能** | — |

## 本次改动

**apps/ios**（未 commit）

| 文件 | 改动 |
|------|------|
| `ZXChatTextView paste:` | 粘贴内容写进输入框**之后**再 `didPasteAtModels`。原先先分类去高亮、再把蓝色 paste 盖回去，所以「修改别人」黑、「复制粘贴别人」仍蓝 |
| `ZXRCIMBaseChatController+ToolBar didPasteAtModels` | 去高亮后保住光标 |

**apps/android**（未 commit）

| 文件 | 改动 |
|------|------|
| `RichEditText` type==0 | 软键盘退格逐字删也会 `judgeAtSpanWhenBatchDeleteChars`；空 span 不算还在 |
| `PersonalAiFilterHost.hide` | 条子摘掉且容器无子 view 时 GONE，避免空条占着 |
| `RongExtension` / `ConversationLargeInputView` | 无智能体 @ 时先关个人条再关群条；大输入也把容器 GONE |

## 待办 / 阻塞

- (ios) 真机：复制别人的 `@李权泓的 AI 框 22` 粘贴到对话框应为黑字、无筛选条（修改路径用户已确认没问题）
- (android) 真机：删掉自己的 `@个人AI框` 后筛选条应消失（软键盘退格，不只硬件 DEL）
- (android / ios) 真机：自己的 `@赵彬华个人AI框` 应出个人条「全部类型」
- (desktop) 回填分类未做
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
