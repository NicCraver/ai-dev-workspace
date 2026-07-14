# Status：选择AI框

> 最后更新：2026-07-14（web 弹窗底栏截断修复；desktop 本地 AiChat 配置；iOS 会话列表合成 Cell + 个人 AI 宿主页 WIP；契约 saveSelected）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| # | 任务 | web | android | ios | desktop |
|---|------|-----|---------|-----|---------|
| T1 | bridge.md 桥协议（5 项含 search） | ✅ | — | 🚧 | ✅ |
| T2 | desktop 桥方法（4 项取数 + searchAiBoxPicker + getRecentContacts 字段） | — | — | — | 🚧 |
| T3 | useAiBoxPickerData 取数组合函数 + 单测 | ✅ | — | — | — |
| T4 | SelectAiBoxDialog 骨架（AcDialog + 三 tab + 单选） | ✅ | — | — | — |
| T5 | 群组 tab（组织群/外联群切换 + AiBoxRow） | ✅ | — | — | — |
| T6 | OrgPicker 组织架构钻取（公司→部门→人员 + 面包屑） | ✅ | — | — | — |
| T7 | 搜索 popover（对齐 PC search-box + searchAiBoxPicker + 高亮） | ✅ | — | — | — |
| T8 | 入口接线 + 选中后链路（upsert/sort/24h） | ✅ | — | 🚧 | — |
| T9 | 联调 + 视觉还原验收 + impl-notes | 🚧 | — | 🚧 | 🚧 |

> 实现顺序建议：T1（契约）→ T2（desktop）与 T3-T8（web，先用 mock 并行）→ T9（联调）。
> iOS 不走 web H5 弹窗（T3–T7 仍为 —），走原生选择页 + `wnsdk.aiChat.selectAiAgent` 回传。

## 待办 / 阻塞

- (desktop) T2/T9：**待 E2E 验证**五 channel（含 `search-ai-box-picker`）微应用 + AiBrowser iframe 全链路；`.env.test` 将 `APP_AICHAT` 改为 `http://localhost:6173/ai-chat` 便于本地联调 personal 页，功能 handler 代码无进展
- (多端) T9 待视觉对照蓝湖 4 张主 tab + 搜索 popover 截图验收；**列表顶栏**「选择AI框」胶囊样式已按稿调整（见关键决策）
- (desktop) 待联调确认 `getDeptUsers` 是否必须传 `corpType`/`corpAndCorpRelType`（当前只传 corpId/pid）
- (desktop) 待联调确认群组 tab `lastChatAt` 来源（groupListApi 不返回，当前填 0，群组不按时间倒序）
- (web) 待联调确认 Home 对话是否支持「24h 恢复 vs 新建」（`resumeChat` 状态已保留并参与 pane key 重挂载，尚未传入 HomeIndex）
- (多端) 待联调确认 `agentName` 是否需独立字段（搜索/群组 tab 当前私聊取昵称、群聊取群名；**最近联系人 tab 已走** `POST /personalAiFrame/recentContactList` 补齐）
- (web) `POST /personalAiFrame/list` **已接入** `PersonalAiChat.vue`（`getPersonalAiFrameList` + `mapFrameListToAgents` 替换 mock；入参 `accountId`+`filterType:0`）；desktop / android / ios 尚无调用方
- (web) `POST /personalAiFrame/recentContactList` **已接入**选择弹窗最近联系人：`fetchRecent` 桥取数排序后批量补齐 `agentName`（及 agentId/aiRoleId/agentVersionId）；失败沿用桥侧名称；desktop 仍只负责 `getRecentContacts`
- (web) **筛选记忆接口未就绪**：list 暂固定 `filterType:0`（全部），接口到位后在 `loadAgentList` 先取勾选态再拉列表（代码已留 TODO seam）
- (web) 列表项**私聊/群会话已接真实归属**（`chatType=belongType`、`targetId=belongId`，`HomeIndex` type1→getUserInfo/type3→getGroupInfo），切换列表即刷新到对应会话；**个人AI框(belongType 0) 仍占位 `DEFAULT_CHAT`**：`HomeIndex` 无 type 0 分支会卡 loading、且无外部会话目标——待补 type 0 会话 + 个人AI框真实目标
- (web) 三个点菜单（置顶/隐藏/打开私聊）操作**尚未接线**：`PersonalAiChat.vue` 未处理 `@agent-more`，且置顶/隐藏状态持久化依赖后端操作接口（同筛选记忆域），待接口到位
- (web) list 主列表搜索（顶部搜索框）当前仍走**客户端过滤**，未使用契约 `searchKeyword` 服务端搜索；确认产品是否要求服务端搜索后再改
- (web) `POST /personalAiFrame/selectGroupBySearch` **已接入**选择弹窗搜索：`searchPicker` 改走 HTTP（`selectGroupBySearchApi` 动态导入，`accountId` 取登录用户），映射 `privateList`/`groupList`；搜索结果 popover 新增「全部/群组/人员」三 tab（全部=群组在前+人员在后）。web 不再调用桥 `searchAiBoxPicker`
- (web) 个人 AI 右侧对话面板已改为**组件直渲** `HomeIndex`（`chatType`/`targetId`/`aiRoleId` props + key 重挂载），不再嵌套 `/zx/home/...` iframe；独立 `zx/home` 路由入口仍可用
- (desktop) 若 web 改走 HTTP 搜索：桥 `search-ai-box-picker` 可保留兜底或后续下线；**仅需回归**弹窗搜索链路
- (android / ios) `selectGroupBySearch` **不受影响**（本期不做 web 侧选择AI框弹窗；ios 走原生选择）
- (web) 选择弹窗底栏「已选：xxx」截断：`AcDialog` footer 改为 `footer-left` 占 `flex-1 min-w-0`、`buttonTip` 限宽截断；`SelectAiBoxDialog` 已选文案改 `max-w-full truncate`，避免长名称挤占确定按钮
- (契约) 新增 `POST /personalAiFrame/saveSelected`（`accountId`+`selectedList[{agentId,belongType,belongId}]`）；**四端均未接线**，待选中后持久化时接入
- (ios) **原生选择 WIP（T1/T8/T9）**：已落地 `selectAiAgent` 桥 + `ZXSelectAiAgentController`（复用转发页 `selectAiAgentOnly` 短路，不弹发送确认）；选中成功回传 payload 含 `agentId`/`agentName`/`ownerType`/`ownerId`/`ownerName`/`avatar`；取消 `code=-1`。缺口：`agentId` 现为 `ownerType:显示名`（非真实 id，真实主键在 `ownerId`）；未回传 `aiRoleId`/`agentVersionId`；`agentName` 仍等于群名/昵称
- (ios) **个人 AI 宿主页 + 会话入口 WIP**：新增 `ZXPersonalAIChatController`（内嵌 Web，仿行动中心）；会话列表合成 `ConversationType_PersonalAI(101)` 置顶 Cell（`ZXPersonalAIChatId`），点击 push 宿主页；名称/角标一期占位（固定「个人 AI 框」、无未读），待 A1/A4 接真数据
- (ios / web) web `mapSelectionToAgent` 当前未消费 `ownerId` 建会话目标（仍走 `DEFAULT_CHAT` 占位）——与 ios 已回传 `ownerId` 未对齐，待补

## 关键决策记录

- 2026-07-07 范围聚焦 apps/web + apps/desktop，android / ios 本期不动
- 2026-07-07 AI 框与群/私聊 1:1，列表全显示（不做「有无 AI 框」过滤）
- 2026-07-07 数据全部经 `window.webview.*` 向 desktop 壳取（移动端 `wnsdk.aiChat.*` 预留）
- 2026-07-07 弹窗用 AcDialog 壳，交互对齐 desktop 转发窗，布局按蓝湖稿单栏，单选
- 2026-07-07 选中后复用 `personalAiAgentAdapter`（mapSelectionToAgent/upsertSelectedAgent/sortAgents），24h 判 `lastChatAt`
- 2026-07-07 视觉严格还原蓝湖 4 张截图（UnoCSS 原子类，位图图标换 SvgIcon）
- 2026-07-08 AiBrowser 宿主仍以 **iframe 嵌 `/zx/personal`**（便于调试）+ postMessage 桥取数；微应用仍走 webview preload
- 2026-07-08 最近联系人 tab **排序在 web 端**执行（`sortRecentLikeTransmitMessage`，对齐 `transmit-message.vue`）；PC 桥只返回 `hasMessage`/`messageTime` 等字段，不在宿主侧排序
- 2026-07-08 群 2x2 头像经桥字段 `accountInfoList` 下发，web `normalizeRecentItem` 须透传
- 2026-07-08 搜索对齐 PC 转发 `search-box` + `search-result`：`AiBoxSearchBox` Teleport popover（320×400 max），人员+群组列表，无搜索内 tab；主列表始终可见
- 2026-07-08 `searchAiBoxPicker` 宿主双接口（`getAccountSearchByUserName` + `getGroupBySearch`，不含机器人）
- 2026-07-13 新增后端契约 `POST /personalAiFrame/list`；同步修正 `_common.d.ts` 外层 `code` 为 string（`M0000`）
- 2026-07-13 `/personalAiFrame/list` 入参按最新文档去掉 `selectCorpId`，`accountId` mock 改为 `'280'`
- 2026-07-13 新增后端契约 `POST /personalAiFrame/recentContactList`（入参 `accountId` + `items[{id,type}]`，回参补齐群/人信息与 agent 字段）
- 2026-07-13 新增后端契约 `POST /personalAiFrame/selectGroupBySearch`（选择AI框弹窗搜索；入参 `accountId`+`searchContent`，回参 `groupList`+`privateList`，含 agent 字段与 `selected`）
- 2026-07-13 web 列表取数接入 `/personalAiFrame/list`：`belongType 0/1/3 → personal/private/group`，标题取 `belongName`、副标题取 `name`，`lastChatTime`/`pinTime` 串转毫秒时间戳；`accountId` 取登录用户 `user.id`（回退 defaultQuery）；成功替换 mock，失败保留 mock 兜底
- 2026-07-13 「先筛选记忆、后 list」时序在 web 端保留 seam（`loadAgentList` 内 TODO），筛选记忆接口未就绪期间 `filterType` 固定 0
- 2026-07-13 web 本功能代码从 `views/home/` 集中迁到独立域目录 `views/personal-ai/`（22 文件，入口 `PersonalAiChat.vue`；仅 desktop/mobile `pages/personal/index.vue` 两处 import 改路径）；并在 root `CLAUDE.md` 立「功能内聚」总则，四端通用
- 2026-07-13 `personal-ai/` 再按子功能细分：`list/` + `picker/`（含 `search/`）+ `selector/` + `tests/`（单测集中）；入口改为 `list/PersonalAiChat.vue`；「功能内可细分子目录、单测归 tests/」写入 root `CLAUDE.md` 总则
- 2026-07-13 web 选择弹窗最近联系人：PC 桥 `getRecentContacts` 之后调用 `POST /personalAiFrame/recentContactList` 按 id/type 批量补齐 `agentName`（群 type=1、人 type=2）；失败不阻断列表
- 2026-07-13 web 弹窗搜索改走 HTTP `POST /personalAiFrame/selectGroupBySearch`（替换桥 `searchAiBoxPicker`）；搜索结果 popover 由「无 tab、人员+群组平铺」改为「全部/群组/人员」三 tab——**更新** 2026-07-08「无搜索内 tab」决策（按最新蓝湖搜索稿）
- 2026-07-13 web 个人 AI **右侧对话面板**改为组件直渲 `HomeIndex`（传 `chatType`/`targetId`/`aiRoleId`，切换时 key 重挂载），去掉内层嵌套 `/zx/home/...` iframe；宿主 AiBrowser 外层 iframe 嵌 personal 页不变；独立 `zx/home` 路由仍可用（`aiRoleId` 可读 URL 或 props）
- 2026-07-13 web 列表顶栏：「选择AI框」入口并入顶栏浅蓝描边胶囊（`bg #EDF6FF` / `border #D8E5FF` / `rounded-3` / `h-6 px-3`；图标 `w-4 h-4`；文案 `text-3.5 font-normal text-black`）；原紫色「选择 AI 框」按钮移除，搜索框单独一行保留
- 2026-07-14 iOS 原生选择回传约定：`selectAiAgent` → `{ type:"personal-ai:selected-agent", payload:{ agentId, agentName, ownerType, ownerId, ownerName, avatar } }`；群 `ownerId=groupId`、人 `ownerId=accountId`；`agentId` 暂拼 `ownerType:name`；无 `aiRoleId`/`agentVersionId`（与 web 最近联系人 HTTP 补齐字段不对齐，待后续）
- 2026-07-14 web `AcDialog` footer 布局：`footer-left` 弹性占满剩余宽并 `min-w-0` 截断；右侧 `buttonTip` 限 `max-w-32`，避免与取消/确定按钮争抢空间（选择弹窗「已选」长名称场景）
- 2026-07-14 desktop `.env.test`：`APP_AICHAT` 指向 `localhost:6173` 便于本地调试 personal 微应用 iframe
- 2026-07-14 新增契约 `POST /personalAiFrame/saveSelected`（保存选中 AI 框列表；`belongType` 仅 1/3）
- 2026-07-14 iOS 会话列表新增本地合成 `ConversationType_PersonalAI` 置顶 Cell + `ZXPersonalAIChatController` 宿主页入口；选择页复用转发组件 `selectAiAgentOnly` 模式