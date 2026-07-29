# Status：安卓端@个人AI框

> 最后更新：2026-07-28（Task 1–8 已实现并推送 `personal-ai-chat`；`assembleOnTestDebug` 通过；真机 E2E 待手测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | — | ✅ | — | — |
| 接口联调 | — | 🚧 | — | — |
| 自测通过 | — | 🚧 | — | — |

> 本期范围仅 Android；web/ios/desktop 不在本功能迭代。PC 见 `20260727-at个人AI框-先做pc端`；iOS 见 `20260728-ios端at个人AI框`。
>
> Android 无独立 mock 阶段：代码直接接真实接口（对齐 iOS）。联调「进行中」＝调用链已落地、参数按 iOS 联调结论收敛，但**尚未抓包/真机验证**。

## 计划任务（见 plan.md）

| # | 任务 | 状态 | 提交 |
|---|------|------|------|
| 1 | 模型 agentKind + groupAgentRels | ✅ | `4a8cba533` |
| 2 | @ 列表注入个人 AI + 互斥 | ✅ | `9eeb6bf0f` |
| 3 | 筛选条挂载 agentKind 分流 | ✅ | `0ba1bf390` |
| 4 | PersonalAiFilterBar UI | ✅ | `fd6a48dc2` |
| 5 | 挂载 + get/save + SelectDataRange | ✅ | `4931140ae` |
| 6 | aiRobtChat agentId + scopes | ✅ | `fafeb989d` |
| 7 | 群条胶囊「类型+N」 | ✅ | `cd919f70d` |
| 8 | 消息发送人回显 + 个人AI框 tag/菜单 | ✅ | `add2f7719` |
| 9 | E2E 与文档收尾 | 🚧 | 构建已过；手测未做 |
| 复核 | 与 PC/iOS 对齐性审查 + 修正 | ✅ | `f86bd2b38` |

## E2E 验收清单（待手测 · 需真机）

- [ ] 群聊 `@` 列表出现自己的个人 AI；他人个人 AI 不出
- [ ] `@` 个人 → 独立筛选条；DataScope 条件与 `SelectDataRangeActivity` 正常；改筛选会 save
- [ ] 发送后 AI 回复群内可见；请求含 `agentId` + `dataRangeScopeList`（个人 `dataRangeList` 须含 3/4）
- [ ] 回复消息后再 `@` 个人 AI，`referUuid` 有值
- [ ] 群智能体主流程回归：`@` → 改筛选 → 发送 → 回复；胶囊为「类型+N」
- [ ] 互斥：不能同时 `@` 群+个人；已有后再 `@` 不出智能体
- [ ] 取消/清空/发送成功立即藏条；**大输入区**同样成立
- [x] `./gradlew assembleOnTestDebug` 通过（2026-07-28）

**消息列表 · 个人AI框展示（`plan-msg-personal-ai-tag`，代码已合，待手测）**

| # | 步骤 | 期望 |
|---|------|------|
| M1 | 含 `extra.personalAccountId` 的消息 | tag「个人AI框」；名/头像来自 `content.user` |
| M2 | 普通群 AI（无该字段） | tag「群AI框」；菜单仅 @回复 |
| M3 | 本人个人 AI 消息长按 | 仅 @回复 |
| M4 | 他人个人 AI 消息长按 | 仅回复（无 @回复） |

## 待办 / 阻塞

- (android) **真机联调进行中**（设备 `cbaf94cf` 已连）：`@` 个人 AI 发送**无回复**已定位并修复——`RichEditText` 两处 span→MentionBlock 转换（发送 `getAllRichSpansDataWhenSendMsg`、草稿 `getAllRichSpansData`）没带 `agentKind`/`agentId`，导致发送时个人 mention 被当群、DTO 为空、`aiRobtChat` 根本没发。日志实证：`send anyAgent=true personal=false agentId=null dtoNull=true`。**待复现验证**
- (三端) ⚠️ **个人 AI 回复无流式效果**：三端流式判据一致——消息须为 `RC:ReferenceMsg` 且 `extra.fromType == 1` 才轮询 `aiRobtMessageById`（android `UIMessage:117`、desktop `msg-list.vue:429`）。群 AI 正常、个人不流式 → **指向后端下发的个人回复消息类型/extra 不符**；已加临时日志 `AgentMsgDebug` 取实证后反馈后端
- (android) **临时联调日志待移除**：`AiRobtChatDebug`（`ConversationFragmentParent` / `ConversationFragment`）、`AgentMsgDebug`（`UIMessage`），均标了 TODO
- (android) E2E 清单其余项仍未勾；装包 `./gradlew installOnTestDebug`
- (android) **抓包确认**：`aiRobtChat` 个人分支 `dataRangeList` 原样透传 3/4/1/2（勿被群侧 0/1/2 序列化污染）；`saveDataRange` 不得用空列表覆盖
- (android) ⚠️ **群智能体回归**：本期改了 `@` 列表与知识类型胶囊「类型+N」，须回归群主流程并**告知测试**
- (android) 大输入区（`ConversationLargeInputView`）为第二条链路，手测须单独覆盖「大输入内 `@` 个人 AI 发送」
- (android) 分支 `personal-ai-chat` 与 `origin` 同步，工作树干净；`75d77f547`（选人企业列表/组织钻取）属 `20260707-选择AI框`，非本功能
- (ios) `20260728-ios端at个人AI框` 的 E2E 手测清单仍未勾，见该功能 status
- (desktop) 工作区打包/`.env`/DataScope 等本地改动 → **不属于本功能**

## 关键决策记录

- 2026-07-29 **`aiRoleId` 三端统一固定 `"1"`**（群+个人都传，后端靠 `agentId` 判身份）；个人项过滤收紧为 `groupAgentType == 0`，群位置的 rel 不加类型校验（缺省 0 会误杀现网数据）—— `630ff1295`；⚠️ 群路径载荷变更，须回归群智能体主流程
- 2026-07-28 **对齐性复核（对 PC/iOS spec 逐条）**，改 5 处：① 个人路径 `aiRoleId` 由现网值改固定 `"1"`（后于 07-29 扩到群）；② `@` 列表个人项补本地缓存兜底（个人项按「群id_归属人id」+ belongType 0 落库，新增 `AgentDisplayKeyUtil`）；③ 联网胶囊只留图标；④ 时间弹层改右对齐；⑤ 互斥判据 `contains("ga_")` → `startsWith`、个人项加 `groupAgentType != 3` 过滤 —— `f86bd2b38`
- 2026-07-28 **Task 1–8 实现完成**并推送：模型、`@` 列表、分流、独立筛选条、get/save+DataScope、发送载荷、群胶囊文案、消息 tag/菜单；`assembleOnTestDebug` 通过
- 2026-07-28 **本端补充坑**（已写入 impl-notes）：大输入区为第二条对称链路；DataScope 复用 web 同一 requestCode 须按发起方消费；`groupAgentRels` 随群信息落库供 `@` 列表与回显
- 2026-07-28 切换活跃功能：`ACTIVE` 由 `20260728-ios端at个人AI框` 改为本功能
- 2026-07-28 **增量**：消息 `extra.personalAccountId` →「个人AI框」+ `content.user` 名头像；本人只 @回复、他人只回复；群 AI 不变 —— 见 `plan-msg-personal-ai-tag.md`（对齐 PC）
- 2026-07-28 产品目标与 PC/iOS 一致：群聊支持 `@个人AI框`；产品规则整表继承
- 2026-07-28 实现路径：独立个人 AI 筛选条 + `agentKind` 分流（不与 `GroupChatAgentDataCheckView` 共用实例）
- 2026-07-28 DataScope：直接经 `CoreApiUtil.selectDataRangeScope` 打开 `SelectDataRangeActivity`
- 2026-07-28 个人 `agentId`：`group/get` → `groupAgentRels[]` 中 `accountId === 当前登录人`
- 2026-07-28 共享判断对齐 PC/iOS：不能只靠 `ga_`；群行为不变、按 `agentKind` 分支
- 2026-07-28 `spec.md` / `plan.md` 已产出（Task 1–9）
