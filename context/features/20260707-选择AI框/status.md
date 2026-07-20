# Status：选择AI框

> 最后更新：2026-07-20（web `test-202512` `166a962`：显式补回 revert 后丢失的推送刷新；待 push；desktop 仍为本地 test 打包）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| # | 任务 | web | android | ios | desktop |
|---|------|-----|---------|-----|---------|
| T1 | bridge.md 桥协议（5 项含 search） | ✅ | — | ✅ | ✅ |
| T2 | desktop 桥方法（4 项取数 + searchAiBoxPicker + getRecentContacts 字段） | — | — | — | 🚧 |
| T3 | useAiBoxPickerData 取数组合函数 + 单测 | ✅ | — | — | — |
| T4 | SelectAiBoxDialog 骨架（AcDialog + 三 tab + 单选） | ✅ | — | — | — |
| T5 | 群组 tab（组织群/外联群切换 + AiBoxRow） | ✅ | — | — | — |
| T6 | OrgPicker 组织架构钻取（公司→部门→人员 + 面包屑） | ✅ | — | — | — |
| T7 | 搜索 popover（对齐 PC search-box + searchAiBoxPicker + 高亮） | ✅ | — | — | — |
| T8 | 入口接线 + 选中后链路（upsert/sort/24h） | ✅ | 🚧 | 🚧 | — |
| T9 | 联调 + 视觉还原验收 + impl-notes | 🚧 | 🚧 | 🚧 | 🚧 |
| T10 | Home 数据范围 scope（PC H5 多选 / 移动端原生） | 🚧 | 🚧 | 🚧 | — |

> 实现顺序建议：T1（契约）→ T2（desktop）与 T3-T8（web，先用 mock 并行）→ T9（联调）。
> iOS 不走 web H5 弹窗（T3–T7 仍为 —），走原生选择页 + `wnsdk.aiChat.selectAiAgent` 回传。
> **本轮 apps 事实**：web **推送刷列表**已在 `test-202512` 本地 tip `166a962` 显式补回（`personalAiPushRefreshFlow` + PC/移动接线 + adapter；Chat/Home 保留 `saveDataRange`/本地下载）；**待 push**。同源仍在 `personal-ai-chat`。ios/android：融云命中 → 黄角标 **>0 才显示** + 统一 microAppId。**desktop 工作区未提交仍为本地 test 打包**。对照见 `3端AI框角标推送.md` / `推送后列表刷新规则.md`。

## 待办 / 阻塞

- (web) ~~**三点菜单「隐藏」图标**~~：由 `pngHide` 改为 SvgIcon `hide`（`assets/svg/hide.svg` 斜眼）
- (web) ~~**选择 AI 框后侧栏头像/智能体名不刷新**~~：根因——`upsertSelectedAgent` 命中已有项只改 hidden/lastChatAt。已修：upsert 刷新 avatar + 独立 agentName；选中/搜索优先 `agentAvatar`；`preserveAgentDisplayFields` 防 list 空头像/空 name 冲掉本地。**待** PC 弹窗再选同一人/搜索选中 E2E
- (desktop / web / ios / android) **AI框推送 `aiBoxSendMessage`**：desktop ✅ 左侧黄角标（含 0）+ iframe postMessage；web ✅ **听推送 + 刷列表**（`personalAiPushRefreshFlow`；情况2刷 `list`；情况3再刷 History + 当前消息；list 失败保态 / `preserveAgentDisplayFields`）。`test-202512` 因 merge-after-revert 丢树后已用 `166a962` 显式补回（**待 push**）。规则见 `推送后列表刷新规则.md`。**ios/android**：黄角标 **>0 才显示**。**待**：push；真机/PC E2E；点进清角标；验完删调试 UI
- (web) ~~merge-after-revert 丢推送刷新~~ → `test-202512` `166a962` 已从 `personal-ai-chat` 显式检出补回（Chat/Home 定点叠加，保留 test 独有记忆项/下载）
- (web) ~~**模拟角标推送 / 联调次数**~~：PC 侧栏 `testBadgePush` + 推送次数；移动顶栏次数；调试 popover 展示含 `sessionIds` 的规范化 payload。**待** 真机验 refreshViewDate 链路 + 验完删调试 UI
- (多端) ~~**AI框角标拉数 HTTP 已登记**~~：`POST /agentSetBasic/getBadgePushInfo`；ios/android/desktop 均已有调用方
- (web / ios / android) **selectAiAgent 回传延迟修复（代码已落地，待真机 E2E）**：web `App.vue` `runCode` 强制 `isLongCb`；ios dismiss completion 后再 `responseHandler`（工作区未提交）；android `onResult` → `wv.post` 再回调（工作区未提交，test 包已装机）。看打点 `[选择AI框] wnsdk success 距点击 ms=`（扣思考时间应百毫秒级）
- (web) ~~**T10 已选 chip 名/头像**~~：记忆 scope 补齐改走 `recentContactList`（`9a1dd2d`）；「数据范围」仅个人 AI 框；已选叠加小图标改固定 `data-range-icon`（`62dcd87`）。**待 PC 弹窗 E2E 回显**
- (web) **移动端个人 AI 宿主（lifeng）**：`bd1e06c` 基座 `MPersonalAiChatWrapper`（Chat）+ `SelectAiChatPopup`（列表+History）；`16b5835` 改筛先 `saveFilter` 再 `list`（对齐 PC）；`3c055a6` 头部——左 `back` 关页、右 `StartChatButton`(仅图标)+`side-close` 开弹窗（旧「切换AI框」胶囊注释掉）；`Chat` 新增 `#header-right`（有则替换默认设置/全屏/关闭）；弹窗 `h-100vh`；History `openCloseMode` 控关栏按钮与「新对话」文案。**待真机 E2E / 视觉验收**
- (ios / web) **选择数据范围原生多选（T10）**：桥 `selectDataRangeScope` + 复用选择 AI 框页强制多选已接线；web `DataScopeBar` 移动端走原生、PC 仍 H5；回传 scopes → `saveDataRange`。本轮：搜索页底栏对齐主页（已选/清空/**完成**，无取消；不再用转发「发送」栏）；已选展示名本地 DB 补齐；下拉箭头改 chevron；审查修复——搜索内点选/清空**不 live sync**（仅「完成」写回）、群 tab 从已选移除须清群列表、空 id 用同人判断、键盘中间态底栏贴键盘顶。**待真机 E2E**
- (android) **选择数据范围原生多选（T10，编译通过 + test 包已装机）**：`aiChat.selectDataRangeScope`（requestCode 239）→ `SelectDataRangeActivity` → 子页联系人多选 / 群组·搜索 `EXTRA_MULTI` 回主页合并 → 回传 `personal-ai:selected-data-range`。底栏共用 `include_data_range_multi_footer`；回传同 selectAiAgent 走 `wv.post`。Bugbot：**无阻断级问题**。**待真机 E2E**
- (android) **低风险债**：若需 AI 框搜索保持旧交互（右侧取消、不自动弹键盘），应用 `EXTRA_MULTI` 门控返回样式与键盘行为
- (web / desktop) **组织架构进公司**：已按 PC 转发对齐——`getContactTree({isGroup:1})`、公司 `id` 作 corpId、`rootDeptId||id` 作首屏 pid、透传 `corpType/corpAndCorpRelType/labelType`；同名根部门自动跳过。**待 E2E**：点企业应直接见部门+人员（不再多一层企业 / 暂无人员）
- (desktop) ~~待联调确认 `getDeptUsers` 是否必须传 `corpType`/`corpAndCorpRelType`~~ → **已按 PC 转发透传**
- (web) ~~`personal-ai-chat` 已合入本地 `test-202512`（含 saveSelected）~~；推送刷列表丢树已用 `166a962` 补回（待 push）
- (desktop) T2：**handler 已落地并提交**（`1ca7496e` 含组织进公司参数）；工作区未提交仍为本地联调/test 打包（见上）。T2/T9 **待 E2E** 验证微应用 + AiBrowser iframe 全链路
- (desktop) ~~**AiBrowser 循环打 `aiToolList` + `getAuthCode`**~~：根因 `aiId=0` 被 `!activePageId` 当假值，每次 refresh 重走 select；且每次 `loadList` 都打 getAuthCode；`updateRecentlyUsed→ai_tools_cmd→refresh-ai-link` 连发放大。已修——aiId 统一字符串、`pageUrlMap` 命中跳过 getAuthCode、refresh debounce + in-flight 合并。**待** 重开 PC 验网络不再刷屏
- (ios) ~~**会话列表刷 `aiToolList` + `updateRecentlyUsed` 死循环**~~：日志含 `Tabbar-定时器` + UITableView visibleCells 警告。根因同族——`getRecentAITable` 无 `isRecent` 时对列表首项（现为 AI框 `aiId=0`）调 `updateRecentlyUsed` → `ai_tools_cmd` → 再拉列表仍无 isRecent。已修：`isPersonalAiTable` 跳过上报；`setAiTable` 同 id/AI框不报；`refreshAIList` debounce。**待** 真机重进会话列表验网络；UITableView 警告应随风暴消失
- (android) ~~**AI框 `updateRecentlyUsed` 加固**~~：本身不成环（推送 `recentlyUsed` 被丢弃），但 `toUpdateData` 回落首项可能对字符串 `"0"` 误报。已在 `AiToolChatBaseView.saveRecentlyUsed` 对 `"0"` / 空 id 直接 return（与接口回参一致用字符串比）
- (ios / android) ~~**`aiToolList` 中 `aiId=0`「AI框」不出现在 AI 工具 UI**~~：展示层已滤；二审通过。ios 另补：`asyncGetAIList` 展示变空时关 Page/更多。android 首轮中风险已修。**待真机 E2E**
- (desktop) **工作区未提交 = 本地 test 打包**（非功能增量）：`.env.test` 指 localhost、`zhixin-test` 包名、arm64、asarUnpack sqlite3 等；勿当 T2/T9 未完成
- (多端) T9 待视觉对照蓝湖 4 张主 tab + 搜索 popover 截图验收；**列表顶栏**「选择AI框」胶囊样式已按稿调整（见关键决策）
- (desktop) 待联调确认群组 tab `lastChatAt` 来源（groupListApi 不返回，当前填 0，群组不按时间倒序）
- (web) 待联调确认 Home 对话是否支持「24h 恢复 vs 新建」（`resumeChat` 状态已保留并参与 pane key 重挂载，尚未传入 HomeIndex）
- (多端) 待联调确认 `agentName` 是否需独立字段（搜索/群组 tab 当前私聊取昵称、群聊取群名；**最近联系人 tab 已走** `POST /personalAiFrame/recentContactList` 补齐）
- (web) `POST /personalAiFrame/list` **已接入**；入参已对齐契约 `filterTypes`（`null` 沿用记忆）+ `exemptAgentIds`（选中后会话内累加）；desktop / android / ios 尚无调用方
- (web) `POST /personalAiFrame/recentContactList` **已接入**选择弹窗最近联系人：`fetchRecent` 桥取数排序后批量补齐 `agentName`（及 agentId/aiRoleId/agentVersionId）；失败沿用桥侧名称；desktop 仍只负责 `getRecentContacts`
- (web) **筛选记忆**：`getFilter` → 再 `list(filterTypes)` 初始化 **已接线**；底栏「筛选对话」弹层（个人恒勾 / 近15天=1 / 知识库=2）改筛即调 list **已接线**；选中勾 `filter-checkbox-on` 已换实心蓝勾、弹层宽 `200`（原 220）
- (android / ios / desktop) `getFilter` **不受影响**（尚无调用方；改筛仍走 list）
- (web) `POST /personalAiFrame/batchGetAgent` **已接入**选择弹窗：**群组 tab** `getMyGroups` 后 `groupIds` 批量补齐 `agentId/agentAvatar/agentName`（`AiBoxRow` 有 `agentAvatar` 时单头像+上群名下 agentName）；**组织架构人员** 每层 `getDeptUsers` 后 `accountIds` 补齐，选中项带 agent 字段。**待联调** Map 无 key 时兜底展示
- (web) 列表项**私聊/群会话已接真实归属**（`chatType=belongType`、`targetId=belongId`）；**个人AI框(belongType 0) 已改用真实 belongType/belongId**（不再 DEFAULT_CHAT 占位）；`HomeIndex` type 0 分支已有（`belongName=个人AI框`）
- (web) **列表项 UI**：三点左侧图标 = **开启新对话**（`new-chat` → `Chat.startNewChat`；个人框仅此图标无三点）；私聊/群三点菜单：置顶/隐藏/**打开智信私聊|群聊**（`open-private` → `openImChat`）；个人框固定置顶角标
- (web) **三点菜单置顶/隐藏已接线**（`updateSetting` → 从 `exemptAgentIds` 移除该 agentId → `list` 刷新）；编排 `personalAiUpdateSettingFlow`；合成 agentId 跳过接口走本地兜底；**跳转智信已接线**（`openImChat` → 主窗口 `openConversationById`）；**开启新对话已接线**（先选中 → `chat-ready` → `newChatNonce` → `startNewChat`；弹窗历史会收起）；**待 E2E**
- (web) 侧栏搜索**已对齐选择弹窗**：复用 `AiBoxSearchBox` + `POST /personalAiFrame/selectGroupBySearch`；输入框 `rounded-[14px]` / `border #E7E7E7`；点选结果直达 `applySelection`（等同弹窗「确定」）；主列表不再客户端过滤
- (web) `POST /personalAiFrame/selectGroupBySearch` **已接入**选择弹窗与侧栏搜索：`searchPicker` 改走 HTTP（`selectGroupBySearchApi` 动态导入，`accountId` 取登录用户），映射 `privateList`/`groupList`；搜索结果 popover 新增「全部/群组/人员」三 tab（全部=群组在前+人员在后）。web 不再调用桥 `searchAiBoxPicker`；**`AiBoxSearchRow` 有 `agentAvatar` 时优先单头像**（群组对齐 `AiBoxRow`，人员同理）
- (web) 个人 AI 右侧对话面板已改为**组件直渲** `HomeIndex`（`chatType`/`targetId`/`aiRoleId` props + key 重挂载），不再嵌套 `/zx/home/...` iframe；独立 `zx/home` 路由入口仍可用
- (web) **PC 个人 AI 内嵌对话**：历史侧栏随 **Home 自身 `elWidth`** 在弹窗/双栏间切换（`DRAWER_MAX_WIDTH=700`：`≤700` popup 宽 280px，`>700` 双栏）；首次窄屏默认 popup，变宽自动解除并切双栏；独立首页默认收起
- (web) **PC 个人 AI 头栏四按钮**：`hideBuiltinCollapseChrome` 下传至 `Chat` → 全屏 / 设置 / 打开智信私聊·群聊（个人框隐藏）/ 打开独立弹窗；无关闭；移动端 `#header-right` 仍优先。标题 `max-width` 改按实际右侧图标数预留（`rightIconCount`，私聊/群最多 4，不再死写 2/3）。**待桌面 E2E**
- (desktop) 若 web 改走 HTTP 搜索：桥 `search-ai-box-picker` 可保留兜底或后续下线；**仅需回归**弹窗搜索链路
- (android / ios) `selectGroupBySearch` **不受影响**（本期不做 web 侧选择AI框弹窗；ios 走原生选择）
- (web) 选择弹窗底栏「已选：xxx」截断：**已提交**（`6796595`）——`AcDialog` footer `footer-left` 占 `flex-1 min-w-0`、`buttonTip` 限 `max-w-32`；`SelectAiBoxDialog` 已选文案 `max-w-full truncate`
- (web) `POST /personalAiFrame/saveSelected` **已接线并提交**（`6796595` + `588d044`）：确定 → `personalAiSaveSelectedFlow`（`toSaveSelectedItem` 优先 `ownerId`；**跳过** `group:`/`private:` 合成 agentId）→ saveSelected → list（`exemptAgentIds` 仅真实 agentId）→ 刷新侧栏；失败本地 upsert；含单测。**待联调**真实后端 + 无 agentId 项豁免是否仍可见
- (web) 移动端原生回传归一化（`588d044`）：`normalizeNativeSelectAgentResult` 兼容 wnsdk 解包；本地列表可用 `ownerType:ownerId` 作合成 key，save/exempt 仍过滤
- (ios) **`selectAiAgent` 桥+选择页已合入 `836a25327`**：`ZXJSAIChatAPI` 注册 handler；payload 含 `id`/`name`/`ownerType`/`ownerId`/`ownerName`/`agentName`/`avatar`/`lastChatAt`；**无真实 agentId 时省略**（勿传 `ownerType:name`）。web 收后走同一套 saveSelected→list。**待真机联调**；`aiRoleId`/`agentVersionId` 仍缺；`lastChatAt` 恒 0
- (ios) **个人 AI 宿主页 + 会话入口已合入 `836a25327`**：`ZXPersonalAIChatController`（内嵌 Web，`ZXPersonalAIChatPath=ai-chat/m/personal`）；会话列表合成 `ConversationType_PersonalAI` 置顶 Cell（`ZXPersonalAIChatId`）；入口名称「AI框」，角标一期占位，待 A1/A4 接真数据
- (ios) **会话入口图标已合入 `836a25327`**：`zx_personal_ai_icon`（@2x/@3x）→ `ConversationType_PersonalAI` 头像
- (ios) **合入后债（未挡一期验收）**：PersonalAI 副标题 RCIM 短路待接 list 接口；选择页仍转发页拷贝待裁剪；桥重入/dismiss cancel 真机复现再补
- (android) **会话列表入口 WIP（工作区未提交）**：`PersonalAiListCellBinder` 置顶 Cell + 打开 `ai-chat/m/personal`；入口文案「AI框」；图标 `personal_ai_icon`（hdpi~xxxhdpi，替换 `ai_tool_icon`）。本轮 URL query 补 `accountId`（登录用户 id）
- (android) **`selectAiAgent` 桥 + 独立原生选择页已落地（工作区未提交，编译通过）**：`api/AiChat.selectAiAgent`（`aiChat` 别名已注册）→ `addPort` + 跨模块 `CoreApiUtil.selectAiAgent`（新 `CoreApiInterface.SelectAiAgent`，`InitCrossModuleApproach` 注册拉起 `SelectAiAgentActivity`）→ `startActivityForResult(238)` → `WebloaderControl.onResult` 新分支读回选中项 → `AutoCallbackEvent.onSelectAiAgent` 组装 `personal-ai:selected-agent` 载荷回传（取消 `onSelectAiAgentCancel` → code=-1）。选择页 `smart_message/personal_ai_select/`（`SelectAiAgentActivity`+`SelectAiAgentAdapter`，复用 `item_friend_content`，最近会话人+群单选，剥离转发发送）。saveSelected/list 仍在 web H5。**待真机 E2E**
- (android) **选择页补齐搜索/选择联系人/选择已有群组（编译通过）**：对齐 ios 版式——顶部搜索框（进 `SelectSearchActivity`：本地 DB 搜人+群，全部/群组/人员三 tab）+「选择联系人」（复用通讯录 `ChooseAddressMemberFragment` 单选，返回人）+「选择已有群组」（`SelectGroupActivity`：`GROUP_TYPE<10` 组织群 /`>=10` 外协群两 tab，`DataCenter.getGroupList` 客户端拆分）+「最近聊天」列表。子页均把 `GroupInfo`/`EaseUserInfo` 包成 `Conversation` 复用 `SelectAiAgentAdapter`，选中经 `SelectAiAgentResult` 统一 setResult 回传，主页 `onActivityResult` 汇总透传给 WebView。**待真机 E2E**
- (android) **选择页后续债**（未挡本轮）：搜索为**本地 DB**（非 web 的 `selectGroupBySearch` HTTP）；群头像回传暂空串；`agentId`/`aiRoleId`/`lastChatAt` 缺省（与 ios 同）；关键词高亮/空态图未做
- (desktop) **左侧第二项 / AiBrowser tab 列表**：`POST /aiTools/aiToolList` 回参 **`aiId=0`** 为 AI框（`aiName`/`pcLogoJsonStr` 驱动侧栏与 tab 文案图标）；`aiUrl` 空则内嵌 `${APP_AICHAT}/zx/personal` iframe（`getUserCode` 拼参）。**固定排首**，不参与置顶/最近使用/更多菜单。切换 tab → `ai-sider-item` 同步左侧菜单；`pageUrlMap` 首次打开缓存 url，切回不重载。**待 E2E**
- (ios / web) ~~`mapSelectionToAgent` 建会话仍 DEFAULT_CHAT~~ → **`bd1e06c` 已修**：`belongId` 优先 `ownerId`/`id`/`accountId`/`groupId`，有值则 `chatType`/`targetId` 用真实归属（对齐 `mapFrameItemToAgent`）；缺 id 才回退占位

## 关键决策记录

- 2026-07-20 web 推送内容刷新：代码在 `personal-ai-chat`；曾合入 `test-202512`（`27491b2`）后 **revert 并 push**（`e1495a4`）。规则见 `推送后列表刷新规则.md`；**待** 再合入目标分支 + E2E
- 2026-07-20 web 推送内容刷新（实现细节）：共用 `personalAiPushRefreshFlow`；空 `sessionIds` 不刷；有则必刷 `list`；当前 `sessionId` 命中再刷 History + `getMessageList`；**不用** `getLastSessionMessage`；list 失败保态、`preserveAgentDisplayFields`
- 2026-07-20 产品改：**ios/android** AI框会话入口黄角标 **0 不显示**（仅 `yellowUnreadNumber > 0`）；desktop 左侧仍可含 0（未改）
- 2026-07-20 产品确认：移动端 AI 工具快捷栏/Tab/更多列表 **不展示** `aiToolList` 的 `aiId=0`「AI框」（会话列表入口另走）；切 tab 默认选中与快捷图标随最近使用变化逻辑保持。实现：DB 全量同步，读给 UI 时 filter；ios `ZXAIManager.displayAITables` / android `DataCenter.getAiToolsForDisplay`（勿改同步用 `getAiTools`）
- 2026-07-20 融云命中规则收紧：当前账号在 `pushAccountIdSessionIdSetMap` **且** `sessionIds` 非空才处理；传 Web 仅 `{type,source:"zx-pc",sessionIds}`（去掉 cmdMsg/badge）；启动补拉角标不推 Web。已改 ios/android/desktop
- 2026-07-20 web 融云推送落点：统一解析 `sessionIds`（优先顶层；缺失从 Map 回退）；PC/移动写入 `pushSessionIds`
- 2026-07-17 AI框整体角标拉数：`POST /agentSetBasic/getBadgePushInfo`（YApi #14196）；入参仅 `accountId`；回参 `yellowUnreadNumber`（黄标）+ `lastAbbreviationInfo`（缩略，可 null）；与行动中心同模式——推送后 HTTP 拉真数，不用 payload 数字写角标；三端移植对照 `3端AI框角标推送.md`
- 2026-07-17 审查修复移动端 AI框推送 Web 链路：① web `refreshViewDate` 必须传 `id`+`name`（wnsdk 缺 id 直接失败）；② 三端统一 microAppId=`1915674367645798402`；③ iOS `extra` 改为扁平 payload（与 Android/契约一致，勿双层包裹）
- 2026-07-17 移动端 AI框角标对齐呼叫群推送链路；副标题 `lastAbbreviationInfo`；打开中 Web `refreshViewDate`；Android 离线忽略，启动/回前台补拉（展示「含 0」已于 2026-07-20 改回 0 不显示）
- 2026-07-17 web `ec79115`：`PersonalAiChat` 监听 `source===zx-pc && type===aiBoxSendMessage`（本阶段仅 log）；侧栏 `testBadgePush` 联调入口；个人 AI 引导页 `belongType===0` 顶部留白
- 2026-07-17 web `95206f5`：联调推送次数角标（每收一次 `aiBoxSendMessage` +1，显示刷新右侧，验完删）；已 pull `452230b` 移动端选择弹窗窄列竖向布局
- 2026-07-17 web `a89a112`：移动端 `MPersonalAiChatWrapper` 听 zx-pc/`aiBoxSendMessage` postMessage + `wnsdk.page.refreshViewDate`；顶栏联调推送次数常显含 0（验完删）
- 2026-07-17 web `4aca44d`：`refreshViewDate` 注册补 `id=1915674367645798402`；success 校验本应用 id + `type=aiBoxSendMessage` 再 bump（不再对任意回调计数）
- 2026-07-17 `selectAiAgent` / `selectDataRangeScope` 必须长回调（对齐 `chooseAddressBook`）：web `runCode` 内 `this.api.isLongCb=true` + `callInner`；只收 `success`/`error`；移动端勿装 H5 假桥；ios dismiss completion / android `wv.post` 后再灌 JS，避免约 10s 回传延迟
- 2026-07-17 web PC 个人 AI 头栏：内嵌时四按钮（全屏/设置/开 IM/独立窗）；`belongType=0` 隐藏开 IM；独立窗走 `WindowPostWinMessage` → `/home/{type}/{id}`；移动端插槽覆盖不变
- 2026-07-17 web 移动端个人 AI 头部（`3c055a6`）：左返回关页；右「新对话」图标 + `side-close` 开选择弹窗；`Chat` 支持 `#header-right` 整替换默认右侧工具；选择弹窗全屏高；History 按 `openCloseMode` 显隐关栏/改「新对话」文案
- 2026-07-17 web 移动端个人 AI 结构（`bd1e06c`）：基座 Chat 常驻 + 底部弹窗承载 agent 列表与 History；`personal/index` 薄壳等用户数据后再挂 Wrapper
- 2026-07-17 web 移动端改筛（`16b5835`）：与 PC 同源——先 `saveFilter`（失败仅 warn）再 `loadAgentList`
- 2026-07-17 web DataRangeBar 已选叠加图标统一为 `data-range-icon`（`62dcd87`），与胶囊视觉对齐
- 2026-07-17 web 智能体列表副标题（智能体名称行）：`latestMessageBrief.answer` 非空则展示 answer，否则展示 `name`（`agentName` 字段仍保留原名）
- 2026-07-17 web「数据范围」胶囊仅个人 AI 框（belongType=0）展示；私聊/群不显示
- 2026-07-17 web 数据范围已选 chip 记忆回显：补展示字段改走 `recentContactList`（人/群名+头像），不用 `batchGetAgent`（只回有 AI 框的智能体字段）
- 2026-07-17 ios 数据范围搜索：底栏与主页同组件；子页无取消、主按钮文案「完成」；仅「完成」写回父页（返回/清空不 live sync）；已选名本地通讯录/群库补齐；箭头用 chevron 非实心三角
- 2026-07-17 android 选择数据范围底栏：统一「已选弹层 + 清空 + 取消 + 确定(N)」；搜索/群组隐藏取消；箭头对齐 web pull-down；搜索返回图标 + ImmersionBar `keyboardEnable`
- 2026-07-17 android 选择数据范围：独立 `SelectDataRangeActivity`（不改 selectAiAgent 单选）；桥名对齐 ios `selectDataRangeScope`；组织架构走通讯录完整多选钻取；确定 0 项 disabled；底栏仅人/群名与头像
- 2026-07-17 ios 选择数据范围：方案 1——复用选择 AI 框页（最近/联系人/群组/搜索），强制多选；最近+群「全部」；新建桥 `selectDataRangeScope`；不对齐 web OrgPicker 三 tab；android 已对称落地
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
- 2026-07-14 web 初始化改为 `getFilter` → `list(filterTypes)`；getFilter 失败则 list 传 `null` 沿用记忆；后续 save/update 刷新复用本地 `filterTypes`
- 2026-07-14 web 侧栏底栏改为「筛选对话」弹层：个人AI框恒勾；近15天=`1`、有知识库=`2`；勾选变更立刻调 list 落库并刷新列表
- 2026-07-13 web 本功能代码从 `views/home/` 集中迁到独立域目录 `views/personal-ai/`（22 文件，入口 `PersonalAiChat.vue`；仅 desktop/mobile `pages/personal/index.vue` 两处 import 改路径）；并在 root `CLAUDE.md` 立「功能内聚」总则，四端通用
- 2026-07-13 `personal-ai/` 再按子功能细分：`list/` + `picker/`（含 `search/`）+ `selector/` + `tests/`（单测集中）；入口改为 `list/PersonalAiChat.vue`；「功能内可细分子目录、单测归 tests/」写入 root `CLAUDE.md` 总则
- 2026-07-13 web 选择弹窗最近联系人：PC 桥 `getRecentContacts` 之后调用 `POST /personalAiFrame/recentContactList` 按 id/type 批量补齐 `agentName`（群 type=1、人 type=2）；失败不阻断列表
- 2026-07-13 web 弹窗搜索改走 HTTP `POST /personalAiFrame/selectGroupBySearch`（替换桥 `searchAiBoxPicker`）；搜索结果 popover 由「无 tab、人员+群组平铺」改为「全部/群组/人员」三 tab——**更新** 2026-07-08「无搜索内 tab」决策（按最新蓝湖搜索稿）
- 2026-07-13 web 个人 AI **右侧对话面板**改为组件直渲 `HomeIndex`（传 `chatType`/`targetId`/`aiRoleId`，切换时 key 重挂载），去掉内层嵌套 `/zx/home/...` iframe；宿主 AiBrowser 外层 iframe 嵌 personal 页不变；独立 `zx/home` 路由仍可用（`aiRoleId` 可读 URL 或 props）
- 2026-07-13 web 列表顶栏：「选择AI框」入口并入顶栏浅蓝描边胶囊（`bg #EDF6FF` / `border #D8E5FF` / `rounded-3` / `h-6 px-3`；图标 `w-4 h-4`；文案 `text-3.5 font-normal text-black`）；原紫色「选择 AI 框」按钮移除，搜索框单独一行保留
- 2026-07-14 iOS 原生选择回传约定：`selectAiAgent` → `{ type:"personal-ai:selected-agent", payload:{ id, name, ownerType, ownerId, ownerName, agentName, avatar, lastChatAt, agentId? } }`；群 `ownerId=groupId`、人 `ownerId=accountId`；**无真实 agentId 时省略**（勿再拼 `ownerType:name`）
- 2026-07-14 web `AcDialog` footer 布局：`footer-left` 弹性占满剩余宽并 `min-w-0` 截断；右侧 `buttonTip` 限 `max-w-32`，避免与取消/确定按钮争抢空间（选择弹窗「已选」长名称场景）
- 2026-07-14 desktop `.env.test`：`APP_AICHAT` 指向 `localhost:6173` 便于本地调试 personal 微应用 iframe
- 2026-07-14 list 契约更新：入参 `filterTypes` 多选（`null` 沿用记忆 / `[]` 全部落库）；回参 `filterInfo.filterTypes`；列表项新增 `isPersonal`/`latestMessageBrief`；`hasRecentSession` 对齐近15天问答链路
- 2026-07-14 新增契约 `POST /personalAiFrame/saveSelected`（保存选中 AI 框列表；`belongType` 仅 1/3）
- 2026-07-14 iOS 会话列表新增本地合成 `ConversationType_PersonalAI` 置顶 Cell + `ZXPersonalAIChatController` 宿主页入口；选择页复用转发组件 `selectAiAgentOnly` 模式
- 2026-07-14 选中后时序定为 `saveSelected` → `list(exemptAgentIds push agentId)`；编排与 HTTP 解耦，移动端注入即可复用；`filterTypes:null` 沿用记忆
- 2026-07-14 ios `selectAiAgent` 回传去掉合成 `agentId`，补 `id`/`name`/`lastChatAt`；web 跳过 `group:`/`private:` 前缀 id 进 save/exempt；桥协议登记 ios 回传
- 2026-07-14 desktop T2 handler 已合入分支；本地联调仅改 `.env.test` 的 `APP_AICHAT` 指向 localhost（勿当功能未实现）
- 2026-07-14 `toSaveSelectedItem`：`belongId` 优先 `ownerId`（对齐 ios 回传），再回退 `id`/`accountId`/`groupId`；建会话目标仍与 `mapSelectionToAgent` 解耦
- 2026-07-14 web saveSelected 编排 + AcDialog 底栏截断合入 `6796595`；list 入参 `filterTypes:null` + 会话内 `exemptAgentIds` 累加已接线
- 2026-07-14 web `588d044`：`isSyntheticAgentId` 过滤 `group:`/`private:` 前缀；原生归一化优先 `ownerId`、兼容 wnsdk 解包；本地列表合成 key 与 save/exempt 解耦
- 2026-07-14 移动端会话列表「个人 AI 框」入口图标统一为紫蓝渐变 AI 素材：ios `zx_personal_ai_icon`、android `personal_ai_icon`（替换原 `ai_tool_icon`）
- 2026-07-14 移动端会话列表入口显示名统一为「AI框」（原「个人 AI 框」）：ios `ZXConversationListCell`、android `PersonalAiListCellBinder`
- 2026-07-14 web 列表三点菜单：置顶/取消置顶/隐藏 → `POST /personalAiFrame/updateSetting`；成功后若该 `agentId` 在会话 `exemptAgentIds` 中则移除，再 `list` 刷新；编排与 HTTP 解耦（同 saveSelected）
- 2026-07-14 个人 AI 框：list 接口回传（belongType=0）；固定置顶排序+角标；会话跳转改用 `chatType=belongType`/`targetId=belongId`（修复选中后右侧错渲第二项）；列表项 UI 对齐稿：常显打开私聊+更多，更多菜单三项（打开私聊仅 UI）
- 2026-07-14 `getFilter` 对齐 YApi #14169：初始化只读拉取（入参仅 `accountId`）；YApi Body 误列的 `filterTypes` 写入语义不采纳，改筛仍走 list
- 2026-07-14 新增公共契约 `POST /personalAiFrame/batchGetAgent`（YApi #14187）：`groupIds`+`accountIds` → `groupMap`/`accountMap`；不限创建人（次日选择弹窗已接入，见下）
- 2026-07-15 选择弹窗群组/组织架构接入 `batchGetAgent`：群 `groupIds`、人 `accountIds`；群组行优先 `agentAvatar`；组织选中带 `agentId` 等
- 2026-07-15 组织架构进公司对齐 PC 转发：`getContactTree({isGroup:1})`；`corpId=节点id`；首屏 `pid=rootDeptId||id`；透传 `corpType/corpAndCorpRelType/labelType`；同名根部门自动跳过；OrgPicker 公司层勿裸传 `pid:'0'`
- 2026-07-15 web `a7fa5fd` + desktop `1ca7496e` 已提交（筛选/updateSetting/batchGetAgent/组织进公司）；两边均未 push；desktop 本地仍可改 `.env.test` 指 localhost
- 2026-07-15 web 侧栏列表加载：`loadAgentList` 期间 `listLoading` + `v-loading` 转圈（含初始拉取与改筛刷新）
- 2026-07-15 个人 AI 列表：个人框仅「开启新对话」图标（无三点）；私聊/群三点左=新开 AI 框会话、三点内「打开智信私聊/群聊」→ `openImChat`
- 2026-07-15 选择弹窗搜索 `AiBoxSearchRow`：回参含 `agentAvatar` 时优先展示 AI 框头像（群组与 `AiBoxRow` 一致；人员有则覆盖 `avatar`）；`normalizeSearchGroup/Private` 透传 `agentAvatar`/`accountInfoList`
- 2026-07-15 侧栏搜索对齐选择弹窗：复用 `AiBoxSearchBox`/`SearchInput`（`rounded-[14px]`、`border #E7E7E7`、placeholder「搜索联系人、智能体」）；HTTP `selectGroupBySearch`；点选即 `applySelection`（跳过弹窗确定）；主列表始终展示完整 list
- 2026-07-15 PC 个人 AI 默认展开历史：窄屏用 `preferDrawer` 强制 van-popup（280px）；变宽后清掉强制态，按自身 `elWidth` 与 `DRAWER_MAX_WIDTH=700` 在弹窗/双栏间切换
- 2026-07-15 `hasDrawer` 窄屏阈值定为 `DRAWER_MAX_WIDTH=700`
- 2026-07-15 列表开启新对话时序：先选中 AI 框 → 等 `chat-ready`（getChatLastMessages 完成）→ 再 `newChatNonce` 调 `startNewChat`；去掉挂载直开 `openAsNewChat` 避免竞态报错
- 2026-07-16 desktop AiBrowser：`aiToolList` **`aiId=0`** 为 AI框（去内置 tab）；固定首位；tab 切换 `ai-sider-item` 同步左侧菜单；`pageUrlMap` 保活 iframe/webview（`loadList` 刷新不改已挂载 src）
- 2026-07-16 desktop 左侧第二项 AI框：`aiToolList` 中 `aiId=0` 驱动侧栏名称/图标（`ai-sider-item`）；AiBrowser 去掉内置 tab 注入，固定排首且屏蔽置顶/最近使用/更多菜单；`aiUrl` 空走 personal iframe
- 2026-07-16 web 列表顶栏「选择AI框」右侧新增刷新图标（`SvgIcon refresh`），点击 `location.reload()` 整页刷新
- 2026-07-16 web 个人 AI 列表去掉 `createMockAgents` 初始数据：侧栏初始空列表，仅 `list` 接口填充；失败清空不保留 mock；`accountId` 仅取登录用户
- 2026-07-16 web 历史侧栏（History）顶栏：去掉品牌 logo，改为左头像 `w-10 h-10` + `gap-1` + 右上归属名（`belongName`，`text-3.5 text-[#1F2329]`）/ 右下智能体名；Chat 经 `assistant-profile` 同步至 Home `historyAssistant`
- 2026-07-16 android `selectAiAgent` 移植对称 ios：原生只负责「弹选择页→回传选中项」，saveSelected/list 全在 web H5。回传通路复用既有 `getAddressBook` 异步模板（`addPort`/`onResult`/`AutoCallbackEvent`/portMap）；跨模块经新 `CoreApiInterface.SelectAiAgent`（`core_function_api` 不能直接引 `smart_message`）。选择页选**独立复制**方案（用户定），落 `smart_message/personal_ai_select/`，不碰巨型 `TransmitFriendsFragment`（避免与 liuyiling 冲突）；本轮先做「最近会话单选」，群组/组织/搜索子页留后续债
