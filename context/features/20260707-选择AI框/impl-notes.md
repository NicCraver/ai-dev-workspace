# Impl Notes：选择AI框

> 平台无关的实现笔记，是其他端移植的唯一逻辑依据。web 端联调完成后必须填写。
> 写法要求：描述"逻辑"而不是"代码"——禁止出现 React/Kotlin/Swift 具体 API。

## 状态流转

弹窗状态：`activeTab ∈ {recent, group, org}` · `keyword` · `selectedKey = ${ownerType}:${id}` · `selected`（当前选中项整体）· `loading`。搜索由 `AiBoxSearchBox` 自管 `open` 状态（focus 开 / blur 延迟关 / 选中关）。

事件：切 tab → 懒取数（每 tab 首次进入拉一次，缓存）→ 点行即选（`selectedKey/selected` 即时更新，底部「已选」即时）→ 确定 → 上抛 `submit(selection)` 并关窗。组织架构 tab 由 OrgPicker 自管钻取状态（公司→部门→人员 + 面包屑），选中人员上抛与其它 tab 同形态 item。

**搜索（已实现，对齐 PC 转发 search-box）**：
- focus 搜索框 → `Teleport` 到 body 的 popover 锚定在输入框下方（宽 320px，高 max 400px 且不超过视口剩余空间）
- 无关键词：popover 内显示空态图 +「未搜索到相关结果」
- 有关键词：300ms 防抖 → HTTP `POST /personalAiFrame/selectGroupBySearch`（`accountId`+`searchContent`）→ 结果分「全部/群组/人员」三 tab（全部=群组在前、人员在后），标题/副标题关键词高亮
- 点选一行 → 写入 `selected`、清空 keyword、关闭 popover；主 tab 列表始终可见、不受 keyword 影响
- popover 内 `mousedown.prevent` + blur 延迟，避免点结果时先关层

## 接口调用时序

1. **弹窗打开**（`open=true`）：并行预取最近联系人 + `getMyGroups({type:'organization'})` → `POST /personalAiFrame/batchGetAgent({groupIds})` 补齐群组 agent 字段。最近联系人时序：`getRecentContacts`（桥）→ web 端 `sortRecentLikeTransmitMessage` → `POST /personalAiFrame/recentContactList`（HTTP，按 id/type 批量补齐 `agentName` 等）；外联群在切到群组 tab 且选「外联群」时懒拉；组织架构由 OrgPicker 在 mount / 切 scope 时拉 `getOrgCompanies`。
2. **群组二级切换**：首次进入某 `type` 时 `getMyGroups({type})` → `batchGetAgent({groupIds})`，结果缓存于内存，不重复请求。
3. **组织钻取**（对齐 PC 转发 `outsource-group-select` → `company-dept-user`）：点公司 → `getDeptUsers({corpId:公司id, pid: rootDeptId||id, corpType, corpAndCorpRelType, labelType})` → `batchGetAgent({accountIds})` 补齐当前层人员 agent 字段；点部门 → 同参换 `pid=deptId` 后再 batch；面包屑回公司层仍用 `rootDeptId||id`。宿主公司列表走 `getContactTree({type, isGroup:1})`。若首屏仅一个与企业同名的根部门则自动钻入（不写入面包屑），避免多一层企业。
4. **搜索**：HTTP `POST /personalAiFrame/selectGroupBySearch({accountId, searchContent})`（300ms 防抖）→ 回参 `groupList`+`privateList`，前端分三 tab 展示；空 keyword 不请求，popover 显示空态图。（旧桥 `searchAiBoxPicker`/宿主 `getAccountSearchByUserName`+`getGroupBySearch` 已由 web 弃用，desktop 侧可保留兜底或后续下线）
5. **确定选中**：`saveSelected` → `list(filterTypes:null, exemptAgentIds push 本次 agentId)` → 用回参刷新主侧栏并激活该项（详见下「选中后持久化」）；失败则本地 upsert 兜底。
6. **失败策略**：各 `fetch*` `.catch(() => [])` 或空结构兜底；`recentContactList` / `batchGetAgent` 失败则保留桥侧名称/头像，不阻断弹窗其它 tab。

## 边界情况

| 场景 | 预期行为 |
|------|----------|
| 桥方法不存在（老壳） | `useAiBoxPickerData` reject → 调用方可 toast「请升级到最新版本」 |
| 列表为空 | 主列表：「暂无数据」/「加载中…」；搜索 popover 无结果：空态图 +「未搜索到相关结果」 |
| 搜索 focus 无输入 | popover 显示空态图（对齐 PC `search-result` no-data） |
| 未选中点确定 | 「确定」按钮 disabled |
| 弹窗关闭 | 重置 keyword；不强制清列表缓存（二次打开秒显） |
| 群 store 无成员 | 宿主并发 `groupInfoApi` 补取后拼 `accountInfoList`（最多 4 人） |
| popover Teleport 到 body | 须用 inline `height`/`maxHeight` 限制高度；勿在根节点用 `h-full`（会按视口撑满） |

## 错误处理策略

桥/HTTP 失败不阻断其它 tab；选中持久化失败走本地 upsert。

- 桥请求超时（iframe postMessage 30s）：reject，搜索 popover 可显示失败重试。
- 单群详情补取失败：不阻塞整表，该群降级为单头像或无 2×2 拼图。
- `getDeptUsers` 缺 `corpType` 等曾致空结果：桥与 web 已按 PC 转发透传；若仍 400/空，对照公司节点是否带齐 `corpType/corpAndCorpRelType/labelType`。

## 推送后内容刷新（`aiBoxSendMessage` → Web）

> 规则全文：`推送后列表刷新规则.md`。角标仍由壳 `getBadgePushInfo` 处理，本文只谈内容列表。

**命中前提**：壳/原生仅在当前账号 map 命中且 `sessionIds` **非空**时通知 Web；Web 收到空数组仍 short-circuit（防御）。

**三层与接口**：

| 层 | 刷新条件 | 接口 |
|----|----------|------|
| AI框列表 | 有非空 `sessionIds` | `POST /personalAiFrame/list`（沿用当前 filterTypes + exemptAgentIds，不重拉 getFilter） |
| 历史会话 | 有非空 `sessionIds`（必刷） | `getSessionList`（soft） |
| 当前消息 | 当前打开的 sessionId ∈ 推送集合 | `getMessageList`（按当前 sessionId）；**不用** `getLastSessionMessage` |

**边界 / 失败策略**：

- 只刷数据：不重挂对话面板（不因推送改选中 key / 不整页 reload）。
- `list` 失败：保留现有列表与当前选中，禁止清空选中导致对话面板被拆掉。
- `list` 成功：合并本地已有展示字段（头像/智能体名），避免接口空字段冲掉刚选中保留的展示。
- 历史未挂载（侧栏收起 / 移动弹窗未开）：跳过 History soft 刷；下次打开再拉。
- 推送刷新路径不改动飞书/WPS 鉴权通用流程。

**双入口**：PC 个人页与移动 `/m/` 个人宿主共用同一套判定编排，仅注入「刷 list / 刷历史 / 刷消息」实现不同。

## 联调坑（实际接口 ≠ 文档之处）

**desktop 侧字段映射（实现时发现，契约以 bridge.md 为准，desktop handler 内部做转换）：**
- `groupListApi` 返回群项用 **`type`**（0/10），契约要求 `groupType` → handler 内 `groupType: g.type` 映射。会话模型里才叫 `groupType`，两套字段名同语义。
- `getContactTree` 公司节点：名在 **`label`**（非 `name`/`corpName`）、人数在 **`num`**（非 `memberCount`）→ handler 映射为 `name/memberCount`。组织树的分组节点（type 1/2）的 `label` 作为公司项 `category`（如「入职企业/我的下级」），web OrgPicker 据此分组显示。选择态须 **`isGroup:1`**（对齐 `organization-list` showType=group）。公司项透传 **`id`/`rootDeptId`/`corpType`/`corpAndCorpRelType`/`labelType`**：`getDeptUsers.corpId` 用节点 **`id`**（同 `company-dept-user`），首屏 pid 用 **`rootDeptId||id`**；曾误用裸 `pid:'0'` 且缺附加参数 → 多一层企业或「暂无人员」。
- `getDeptUserPagelist` 入参除 `corpId/pid` 外，PC 转发还传 `corpType/corpAndCorpRelType/labelType`；桥已透传（与 `company-dept-user.getUsers` 一致）。
- **`agentName` / `agentAvatar`**：桌面桥无独立 AI 框字段时先用昵称/群名/群头像兜底。**最近联系人 tab** 走 `recentContactList`；**群组 tab** 走 `batchGetAgent({groupIds})`（有 `agentAvatar` 时 `AiBoxRow` 用单头像替代 2×2）；**组织架构人员** 每层 `getDeptUsers` 后走 `batchGetAgent({accountIds})`；搜索仍走 `selectGroupBySearch`。
- **`batchGetAgent` Map 无 key**：请求里有 id 但无 AI 框数据时对应 key 不出现在 `groupMap`/`accountMap`，保留桥侧兜底字段，不阻断列表。
- **`lastChatAt` 群组 tab 暂为 0**：`groupListApi` 不返回最近消息时间，handler 当前填 0 → 群组 tab 不按时间倒序。待联调确认是否从 `GetLatestOneMsg`/`lastConversationTime` 补（需知群会话 key 格式）。最近联系人 tab 的 `lastChatAt` 取 `item.lastConversationTime || item.message?.messageTime`，已实现。
- `getRecentContacts` 旧 handler 形参 `(e,data,uuid,webContentsId)` 与 `sendToHost` 实参不匹配（`webContentsId` 实为 undefined，靠 `e.sender.sendTo` 在 Electron 19 退化/兜底跑通）——新增 handler 照搬此既有模式，未改。
- **AiBrowser 个人 AI iframe 桥**：`/zx/personal` 在 iframe 内无 `window.webview`；`useAiBoxPickerData` 检测 iframe 后走 `parent.postMessage(personal-ai:bridge-request)` → AiBrowser `handlePersonalAiMessage` → `aiBoxPickerHost` → `personal-ai:bridge-result` 回传。token 仍走既有 `getToken`/`setToken`（`App.vue`）。
- **最近联系人排序**：与 PC 转发弹窗 `transmit-message.vue` `allConversation` 一致——有 `message` 的项靠前，同有则按 `messageTime` 倒序。**排序在 web 端**（`sortRecentLikeTransmitMessage`）；桥返回 `hasMessage` + `messageTime`（`messageTime` 允许为 0，勿用 falsy 判断）。
- **群 2x2 头像**：桥返回 `accountInfoList`（`[{id,nickName,avatar}]`，最多 4 项）；web 归一化须保留该字段，不可只留 `avatar`。

## 与 bridge 的交互

取数经宿主桥（契约见 `context/bridge.md`），`useAiBoxPickerData` 双通道：
- **微应用 webview**：`window.webview.getXxx()` → preload `sendToHost` → `webview-control` → `aiBoxPickerHost`
- **AiBrowser iframe**：`parent.postMessage(personal-ai:bridge-request)` → AiBrowser → `aiBoxPickerHost` → `personal-ai:bridge-result`

方法映射：
- `getRecentContacts()` → 最近联系人 tab（首入懒拉，缓存；web 端排序后再调 `recentContactList` 补齐 agentName）
- `getMyGroups({type})` → 群组 tab（按组织群/外联群二级切换懒拉）
- `getOrgCompanies({type})` / `getDeptUsers({corpId,pid,corpType?,corpAndCorpRelType?,labelType?})` → 组织架构钻取（公司列表含 `id`/`rootDeptId`；进公司 pid=`rootDeptId||id`）
- ~~`searchAiBoxPicker({search})` → 搜索 popover~~ **已弃用**：搜索改走 HTTP `POST /personalAiFrame/selectGroupBySearch`（见下「弹窗搜索取数」）
- 桥缺失/失败 → 调用方 `.catch(() => [])` 兜底

## 最近联系人 agentName 补齐（`POST /personalAiFrame/recentContactList`）

选择弹窗「最近联系人」在桥取数之后的 **HTTP 补齐**（`baseMap.ai`），与主列表 `list` 接口同域、不同用途。

**时序**：桥 `getRecentContacts` → 归一化 → `sortRecentLikeTransmitMessage` → 构造 `items[{id,type}]`（群 `type='1'`、人 `type='2'`）→ `accountId` 取登录用户 id → `recentContactList` → 按 `type+id` 合并回列表行的 `agentName`（有则覆盖桥兜底）。

**边界**：
- 无登录 `accountId` 或桥列表为空 → 跳过 HTTP，直接展示桥数据。
- 接口失败 / 单项无匹配 → 该行保留桥侧 `agentName`（昵称或群名），不整表失败。
- 同步透传回参中的 `agentId` / `aiRoleId` / `agentVersionId`（若有），供选中后 upsert 对齐主列表。

**PC 个人 AI 框（`/zx/personal`，`main.vue` 内 `AiBrowser`）**：
- 宿主仍用 **外层 `<iframe>`** 嵌 `/zx/personal`（便于 DevTools 调试；web 热更新无需重启 preload）。
- **右侧对话面板**在 personal 页内改为**同页组件直渲** `HomeIndex`（传 `chatType`/`targetId`/`aiRoleId`，切换智能体时整面板重挂载），不再二次嵌套 `/zx/home/...` iframe。
- **HomeIndex 嵌入契约**：`chatType=belongType`、`targetId=belongId`；`aiRoleId` **prop 优先、缺省回退 URL `?aiRoleId=`**。原有入口（`home` 页 `v-bind="$attrs"`、`[chatType]/[targetId]` 路由）**不传 aiRoleId prop → 走 URL**，与改造前逐字等价；只有 personal 嵌入才用 prop → **共享组件向后兼容，不影响原有会话功能**。
- **切换列表即刷新右侧**：重挂载 key 必须并入**选中项唯一 id**（agentId）。list 回参个人/私聊/群均用真实 `belongType`/`belongId` 作 `chatType`/`targetId`；key = `agentId + chatType + targetId + aiRoleId + resume`。本地 upsert 兜底（`mapSelectionToAgent`）已消费 `ownerId` 等派生真实归属，仅缺 id 时才占位——key 仍须带 agentId 防同归属多框冲突。
- 桥请求时序见上「AiBrowser iframe」通路；取数逻辑与微应用共用 `aiBoxPickerHost.js`。
- token：`postMessage("getToken")` → `App.vue` 回 `setToken`（与群 AI 框等 iframe 一致）。
- 群头像成员：取数在主窗口进程，对未缓存群并发 `groupInfoApi` 补取后拼 `accountInfoList`。
- 24h 恢复：列表侧已按 `lastChatAt` 判定 `resume` 并参与面板重挂载；对话侧是否消费「恢复 vs 新建」待联调。

## 弹窗搜索取数（`POST /personalAiFrame/selectGroupBySearch`）

选择弹窗顶部搜索框的取数（**普通 HTTP**，`baseMap.ai`，替换旧桥 `searchAiBoxPicker`）。

**时序**：focus 开 popover → 输入 → 300ms 防抖 → `selectGroupBySearch({accountId, searchContent})`（`accountId` 取登录用户 id）→ 回参 `groupList`+`privateList` → 分 tab 渲染。空关键词不请求（沿用空态图；契约支持「空即全量」，本期未启用）。

**结果 UI（三 tab）**：
- `全部`：群组在前、人员在后（契约回两个独立数组，前端拼接；后端未给统一排序字段）。
- `群组`：仅 `groupList`；`人员`：仅 `privateList`。
- 每次新搜索重置到「全部」；某 tab 子集为空时该 tab 下显示空态图（其它 tab 仍可能有结果）。
- 行内：单选圆点 + 头像 + 名称（关键词高亮）+ 副标题 `agentName`（高亮）。

**回参 → 统一搜索项映射**：
- 私聊项：`nickName`→名称、`accountId`→id、`agentName`（缺省回退 `nickName`），透传 `agentId/aiRoleId/agentVersionId/selected`，`ownerType='private'`。
- 群组项：`groupName`→名称、`groupId`→id、`groupNumber`→人数、`agentName`（缺省回退 `groupName`），透传 agent 字段，`ownerType='group'`。
- **选中**：搜索项与其它 tab 选中项同形态上抛 `submit`；选中后清空 keyword、关闭 popover。

**边界 / 联调坑**：
- 群组项契约**只回单个 `avatar`**（无成员列表）→ 搜索结果群头像用单图，**无 2×2 拼图**（与最近联系人/群组 tab 的 2×2 不同，若产品要求需后端补成员或前端再取群详情）。
- `selected` 字段后端可回；前端选中态以本地 `selectedKey` 为准，`selected` 暂作参考。
- 失败 → popover 显示「搜索失败，重试」；不影响主弹窗其它 tab。

## AI框列表取数（`POST /personalAiFrame/list`）

主侧栏「AI框列表」的数据来源（区别于选择弹窗的桥取数）。这是**普通 HTTP 接口**（`baseMap.ai`），非宿主桥。

**时序**：页面挂载 → `getFilter(accountId)` 取筛选记忆 → `list({ accountId, filterTypes, exemptAgentIds })` → 用回参/记忆同步筛选 UI → 映射为内部 agent → 排序渲染。
- `getFilter` 无记录时 `filterTypes=[]`；失败则 list 传 `null` 由后端沿用记忆。
- **改筛落库**（底栏「筛选对话」弹层）：勾选变更 → `POST /personalAiFrame/saveFilter({ accountId, filterTypes })` 覆盖写记忆 → `list` 刷新（跳过 getFilter，复用本地 `filterTypes`）。`filterTypes` 取值：`[]` 清空附加筛；`[1]` 近15天；`[2]` 有知识库；`[1,2]` 同时勾选。个人 AI 框恒展示，不参与 `filterTypes`。
- `saveFilter` 失败不阻断刷新：仍带当前 `filterTypes` 调 `list`（后端 list 可隐式落库兜底）。
- `accountId` 取当前登录用户 id。
- 成功 → 用回参 `aiFrameList` 整表替换本地列表；失败 → 清空列表（无 mock 兜底）。
- 选中项若不在新列表中 → 回退到排序后首项。
- 后续 saveSelected / updateSetting 刷新 list 时复用本地已同步的 `filterTypes`。

**回参 → 内部 agent 映射**（契约 `PersonalAiFrameItem`）：
- `belongType`：`0→个人AI框`（个人、无三点菜单）/`1→私聊`/`3→群聊`；据此定 ownerType、标签、是否个人。
- **标题** = `belongName`（个人='个人AI框'/群=群名/私聊=对方名）；**副标题** = `name`（AI框名）。
- `lastChatTime` / `pinTime` 是 `"yyyy-MM-dd HH:mm:ss"` 字符串 → 转毫秒时间戳（解析时把 `-` 换 `/` 规避时区差异）；缺失回 0。
- 排序沿用既有规则：个人置顶 → 置顶项按置顶时间 → 其余按 `lastChatAt` 倒序。
- `hasKnowledge`/`aiUnreadYellowNumber`（映射为内部 `unreadCount`，兼容旧名）/`isPinned`/`isPersonal` 透传；`belongType`/`belongId`/`corpId`/`aiRoleId` 原样保留，供后续会话跳转与置顶/隐藏操作使用。
- `latestMessageBrief`：24h 内最新消息缩略（`null` 表示无）；含 `question`/`answer`/`finishAt`/`sender`，可用于列表副文案或 24h 恢复判定（待 web 接线）。
- **筛选 UI**：底栏「筛选对话」弹层（宽 200）；`personalChecked` 恒 true（不可取消）；勾选 `1`→近15天、`2`→有知识库；每次 toggle 走 `saveFilter` → `list`（见上「改筛落库」）。

## 筛选记忆（`getFilter` / `saveFilter`）

个人 AI 框列表侧栏底栏的筛选条件读写，与 list 解耦的专用写入接口。

| 接口 | 时机 | 入参要点 |
|------|------|----------|
| `POST /personalAiFrame/getFilter` | 页面初始化（只读） | 仅 `accountId` |
| `POST /personalAiFrame/saveFilter` | 用户勾选/取消附加筛选项 | `accountId` + `filterTypes`（覆盖式；`[]`=清空） |
| `POST /personalAiFrame/list` | 初始化 / 改筛后刷新 / saveSelected 等 | `filterTypes: null` 沿用记忆；显式传数组可筛+隐式落库 |

**初始化**：`getFilter` → 同步本地 `filterTypes` → `list` 带同步后的值拉表。

**改筛**：弹层 toggle → 更新本地 `filterTypes` → `saveFilter` → `list(skipGetFilter)` 刷新列表与 `filterInfo`。

**后续刷新**（saveSelected / updateSetting）：只调 `list`，`filterTypes` 复用本地已同步记忆，不再调 saveFilter。

**契约**：`getFilter.d.ts` / `saveFilter.d.ts`（YApi #14169 / #14166）；筛选类型 `1|2` 定义见 `_shared.d.ts` `PersonalAiFrameFilterType`。

**移植**：android / ios / desktop 本期无列表筛选 UI；若后续接入，改筛须先 `saveFilter` 再 `list`，与 web 时序一致。

**联调坑 / 待确认**（列表取数）：
- **会话跳转**：右侧 `HomeIndex` 约定 `chatType=belongType`、`targetId=belongId`。list 映射：有 `belongId` 时个人(0)/私聊(1)/群(3) 均用真实归属；缺 `belongId` 才回退占位。`HomeIndex` type 0 分支已有（`belongName=个人AI框`）。**本地选中兜底** `mapSelectionToAgent` 已与 list 映射对齐：`belongId` 优先 `ownerId` → `id`/`accountId`/`groupId`，有值则写真实 `chatType`/`targetId`（与 save 的 `ownerId→belongId` 一致）；仅缺 id 时回退占位。
- 选中列表项后右侧直接挂载对话面板（传 `chatType`/`targetId`/`aiRoleId`），切换时重挂载；不再拼 `/zx/home/...` URL。
- 侧栏搜索与选择弹窗共用 `AiBoxSearchBox` → `POST /personalAiFrame/selectGroupBySearch`（全部/群组/人员 popover）；点选结果侧栏直达 `applySelection`（等同弹窗确定），主列表不再客户端过滤。
- **打开私聊/群聊**：…只用真实 `belongId`/`ownerId`（勿回退 `targetId` 占位）。重建私聊缺 `groupType` 时对齐会话列表：`GetAllOrganizationUserIds`（含自己/机器人）→组织，否则→外联。

## 列表设置（`updateSetting` → 移除 exempt → `list`）

侧栏三点菜单的**置顶 / 取消置顶 / 隐藏**（个人 AI 框无三点菜单）。平台无关编排，调用方注入 `updateSetting` / `fetchList`。

**时序**：
1. 校验真实 `agentId`（空或 `group:`/`private:` 前缀合成 id 不可调接口 → 仅本地改态兜底）。
2. `POST /personalAiFrame/updateSetting({ accountId, agentId, isPinned?: 0|1, isHidden?: 0|1 })`——只传要改的标志。
3. 若该 `agentId` 在会话内 `exemptAgentIds` 中 → **移除**（置顶/隐藏后不再需要筛选豁免）。
4. `POST /personalAiFrame/list({ accountId, filterTypes, exemptAgentIds })` 整表刷新侧栏（`filterTypes` 复用本地记忆）。
5. 当前选中项若不在新列表（如已隐藏）→ 回退到排序后首项。
6. **任一步失败** → 本地改 `isPinned`/`hidden` 并重新排序，不阻断操作反馈。

**边界**：
- 隐藏成功后该项不再出现在 list 回参（由后端过滤）；前端不再依赖本地 `hidden` 长期态。
- 置顶角标跟 `isPinned`（来自 list 的 `isPinned`/`pinTime`），与选中态背景解耦。
- 「打开私聊/群聊」走 `openImChat`（见上），不在本编排内。

**移植**：与 saveSelected 同模式——纯编排 + 注入 HTTP；各端勿在 UI 散写两步时序。

## 选中后持久化（`saveSelected` → `list` + `exemptAgentIds`）

弹窗/原生确定选中后的**平台无关编排**（web 已接线；移动端注入各自 HTTP 即可复用同一逻辑）。

**时序**：
1. 选中项 → `selectedList` 单项：`belongType`（private→1 / group→3）、`belongId`（优先 `ownerId`，否则 `id`/`accountId`/`groupId`）、有则带 `agentId`。无法得到 `belongType+belongId` 时该项为 null，`selectedList` 可为 `[]`。
2. `POST /personalAiFrame/saveSelected({ accountId, selectedList })`。
3. 将本次 **真实** `agentId` **去重 push** 进会话内 `exemptAgentIds`（空或 `group:`/`private:` 合成 id 不追加）。
4. `POST /personalAiFrame/list({ accountId, filterTypes, exemptAgentIds })`——`filterTypes` 复用初始化 getFilter 同步的本地记忆；豁免名单保证新选中项不被当前筛选挡掉。
5. 用 `aiFrameList` 整表替换侧栏；按 `agentId`（其次 `belongType+belongId`）定位并激活；找不到则本地 upsert 兜底。
6. **任一步失败** → 不阻断：本地 `mapSelectionToAgent` + upsert 仍写入侧栏。

**边界**：
- 群组 / 组织架构 tab 可能无 `agentId`（桥侧未补齐）→ save 仍可只带 `belongType+belongId`；`exemptAgentIds` 不追加空 id。新项能否出现在筛选列表依赖后端 save 后是否默认可见。
- **合成 agentId**（前缀 `group:` / `private:`，ios/本地列表兜底）**不得**写入 `saveSelected.agentId` 与 `exemptAgentIds`。
- 最近联系人（HTTP 补齐后）与搜索结果通常带真实 `agentId`，豁免生效。
- `exemptAgentIds` 为**会话内累加**（同页多次选择不断 push），非跨刷新持久化。
- **与建会话解耦**：save 映射已用 `ownerId`；打开右侧会话目标仍走列表项的 `belongType`/`belongId`（或占位），勿在 save 编排里顺手改 chat 目标。

**移植**：纯映射 + 编排与 HTTP 解耦；调用方注入 `saveSelected` / `fetchList` 两个异步函数即可。各端勿在 UI 层散写这两步时序。web 已提交（`6796595` + `588d044` 合成 id 过滤）；**真实后端联调尚未验收**（T9 仍 🚧）。

### 发消息时顺带 saveSelected

每次发起对话 SSE（`/aiChatApi/v1/aiChat`，含续聊）时，用当前会话归属 fire-and-forget 调一次 `saveSelected`：

1. 从当前 `belongType` / `belongId` / `agentId` 构造单项：`belongType∈{0,1,3}` 且 `belongId` 非空（**含个人框 0**；与弹窗/深链选中仅 1|3 不同）。
2. `POST /personalAiFrame/saveSelected`；**不**跟 `list`、**不**改侧栏。
3. 缺 accountId / 缺 belongId / 非法 belongType → 跳过。
4. 失败只记日志，**不阻断**对话发送。

**移植**：对话层在「发 aiChat」出口挂一次即可；勿塞进全局 HTTP 拦截器（避免 list/getFilter 等误触发，也避免 saveSelected 自递归）。

### ios 原生选择 → web 触发 save/list

1. web 调 `wnsdk.aiChat.selectAiAgent`（**必须长回调 `isLongCb`**，对齐 `util.chooseAddressBook`：`runCode` 内 `this.api.isLongCb=true` 再 `callInner`；只收 `success`/`error`，勿 `.then` Promise——长回调打开页即 resolve undefined）。
2. 确定后桥回传 `messagePayload`（见 `bridge.md`）：必含 `ownerType` + `ownerId`（群=groupId、人=accountId）+ `id`/`name`/`lastChatAt`；**无真实 agentId 时省略字段**。
3. **回传时机**：原生须在选择页 **dismiss 完成后再** 灌 JS（ios：`dismiss` completion；android：`onResult` 后 `wv.post`），避免 WebView 仍被盖住/未 resume 时回调推迟约 10s。
4. web 归一化原生回传 → `applySelection`（先本地落库）→ 共用 `saveSelectedAndReloadList`。本地侧栏 upsert 可用 `ownerType:ownerId` 作列表 key；**save/exempt 须过滤** `group:`/`private:` 前缀合成 id。
5. 取消 `code=-1`，不调 save/list。

### android 原生选择（与 ios 对称）

逻辑同上：原生只负责「弹选择页 → 回传选中项」，`saveSelected/list` 全在 web H5。回传载荷形态与 ios 完全一致（`personal-ai:selected-agent`：`ownerType/ownerId/id/name/agentName/avatar/lastChatAt`；**无真实 agentId 时省略**，`lastChatAt=0`，群头像暂空串）。取消回传 `code=-1`。差异仅在移植范式：桥方法异步回结果复用宿主既有「注册端口 → startActivityForResult → onResult 按端口重建回调」模板；**`SELECT_AI_AGENT` / `SELECT_DATA_RANGE_SCOPE` 在 `onResult` 内 `wv.post` 后再 `onSelectAiAgent`**，避开 Activity pause 窗口。选择页为**独立页**（不碰存量转发页），版式对齐 ios：顶部搜索 +「选择联系人」+「选择已有群组」+「最近聊天」。三入口各为独立子页，选中项统一 setResult 回传、主页 onActivityResult 汇总后再回传 WebView：
- **选择联系人** 复用宿主现成通讯录选择（单选返回一个人）。
- **选择已有群组** 独立页，组织群/外协群两 tab（按群类型阈值本地拆分）。
- **搜索** 独立页，本地库搜人+群，全部/群组/人员三 tab（android 走**本地 DB**，非 web 的 HTTP 搜索）。
- 后续债：搜索关键词高亮/空态图、群头像 2×2、`agentId`/`lastChatAt` 缺省（与 ios 同）。

## PC 左侧 AI伙伴入口（AiBrowser · `POST /aiTools/aiToolList`）

智信 PC 主窗口左侧第二项 + AiBrowser 顶栏 tab 列表，共用 **`POST /aiTools/aiToolList`**（`chatPath/aiTools/aiToolList`，入参 `accountId`）。

### 列表项语义（联调实测）

| 字段 | 说明 |
|------|------|
| `aiId` | **`"0"`** = 个人 AI框（系统项）；其余为外链 AI 伙伴（DeepSeek/KIMI 等） |
| `aiName` | 侧栏与 tab 展示名（如「AI框」） |
| `aiUrl` | 外链 webview 地址；**AI框为空**，由宿主拼 personal 页 |
| `pcLogoJsonStr` | JSON：`logoChoosedUrl`（tab 选中/列表）、`logoUnChoosedUrl`（侧栏未选中/tab 未选中） |
| `isSystem` | `1` 系统项不可编辑删除 |
| `sort` | AI框为 **`-1`**，其余递增；宿主仍 **强制 AI框排首**（双保险） |
| `isTop` / `isRecent` | AI框不参与置顶与最近使用排序 |

### 个人 AI框（`aiId=0`）宿主行为

1. **取数**：`aiToolList` 与外链伙伴同一列表；识别 `aiId===0`（**必须转成字符串**再存/比；数字 `0` 是假值，`!activePageId` 会每次 refresh 都当「未选中」重走 select）。
2. **打开地址**：`aiUrl` 空 → `${APP_AICHAT}/zx/personal`，有 `corpId` 时先 `getUserCode` 再拼 `userCode`+`corpId`；以 **iframe** 打开（非 webview），走 `personal-ai:bridge-request` 桥（见上「AiBrowser 个人 AI iframe 桥」）。**`pageUrlMap` 已有 AI框 url 时禁止再打 getAuthCode**（一次性码，重复申请会刷屏且可能导致 iframe 重载）。
3. **固定首位**：从列表拆出 `aiId=0` 置首，其余保持接口顺序；**不**再客户端注入内置 tab。
4. **能力屏蔽**：无置顶/取消置顶、无「最近使用」上报、无右键/更多菜单（与 `isSystem` 外链系统项不同，AI框单独判断 `aiId=0`）。
5. **刷新合并**：`updateRecentlyUsed` 可能触发 `ai_tools_cmd` → `refresh-ai-link` 连发；宿主侧应对 `loadList` 做 **debounce + in-flight 合并**，避免 `aiToolList`/`getAuthCode` 请求风暴。
6. **移动端同坑（ios）**：会话列表 shortcut 取「最近 AI」时，若列表无 `isRecent` 会对首项调 `updateRecentlyUsed`；AI框排首且永不带 `isRecent` 时形成 `updateRecentlyUsed → ai_tools_cmd → aiToolList` 死循环。规则：**aiId=0 禁止报最近使用**；同 tab 重选也不重复上报；列表刷新通知需 debounce。

### 左侧菜单与 tab 同步

- AiBrowser 每次 **切换 tab** 向主窗口上抛当前项（名称 + 图标字段）。
- 主窗口左侧第二项展示 **当前激活 tab** 的 `aiName` 与 `whiteLogo||logo`（非写死「AI框」）。
- 点击左侧第二项仍进入 AiBrowser 路由，不强制重置 tab。

### Tab 保活（避免切回重载）

- 每个 tab **首次选中**时把最终打开 url 写入 **`pageUrlMap[aiId]`**，iframe/webview 的 `src` 只读该缓存，**`loadList` 刷新列表 metadata 时不改已挂载 src**（避免 `getUserCode` 新 token 导致 AI框白屏重载）。
- 非激活 tab 用 `visibility:hidden` + `pointer-events:none` 隐藏（不用 `display:none`），保留页面状态。
- 切换外链 tab 可调 `updateRecentlyUsed`；可能触发宿主 `refresh-ai-link` 重拉列表——因 `pageUrlMap` 已缓存，已打开页不重载。

### 涉及文件（desktop）

- `views/AiBrowser/index.vue` — 列表映射、tab 保活、桥消息
- `views/main.vue` — 接收侧栏同步事件
- `components/layouts/new-aside-menu.vue` — 左侧第二项渲染
- `service/tools.js` — `getAiLinkList` 等 `aiTools/*` 封装

## web 端视觉/实现备忘（蓝湖还原）

- **弹窗尺寸**：蓝湖稿面板 **440×580**。`AcDialog splitTheme`，`class="!w-440px !h-580px"`。
- **底栏「已选」截断**：`AcDialog` footer 为左右两区——`footer-left`（`flex-1 min-w-0 overflow-hidden`）放「已选：xxx」，`footer-right` 固定放取消/确定；`buttonTip`（若有）限 `max-w-32 truncate`。`SelectAiBoxDialog` 已选文案用 `block min-w-0 max-w-full truncate`，长群名/昵称不挤按钮。
- **行高**：最近联系人/群组行 60px、组织·公司行 48px、组织·人员行 40px、组织/外联切换头 40px。
- **字号**：名称 `text-3.5`(14px·近黑 `text-black`)、AI框名/人数/面包屑 `text-3`(12px·`text-gray-medium`)、tab `text-3.5`。
- **配色 token**：active tab/面包屑前级 `primary`；inactive tab `gray-dark`；副文案 `gray-medium`；行分隔 `border-gray-light`；搜索框底 `bg-gray-light`（`#F4F6F8`）；选中行底 `bg-primary-light`；搜索框圆角 **13px**。
- **单选图标**：`CheckboxView` 的 `radio` 模式（14px 圆形单选）。
- **搜索 popover**：对齐 PC `search-box`/`search-result`——320px 宽、max 400px 高、`box-shadow: 0 0 10px rgba(0,0,0,0.3)`、圆角 4px；`Teleport` 到 body 避免 Dialog `overflow:hidden` 裁切。
- **代码目录**：web 本功能全部代码集中在 `apps/web/src/components/views/personal-ai/`，内部再按子功能细分：`list/`（主列表+会话，入口 `list/PersonalAiChat.vue` 由 `/personal` 路由引用）、`picker/`（选择弹窗，内含 `search/` 搜索子模块）、`selector/`（移动端原生选择/共享知识消息）、`tests/`（全部单测集中）。功能私有工具（`highlightKeyword`、`SearchInput`）随 `search/` 目录走，不放公共 `utils/`。对应 root `CLAUDE.md`「功能内聚」总则（其它端按各自 package/模块惯例落地，单测归各自 `tests/`）。
- **组件文件**：`SelectAiBoxDialog` · `SelectDataRangeDialog`（Home 数据范围多选）· `AiBoxSearchBox`（输入+popover 壳）· `AiBoxSearchPanel`（结果列表）· `AiBoxSearchRow` · `AiBoxRow` · `OrgPicker` · `SearchInput`。
- **搜索空态图**：`no-data.png` +「未搜索到相关结果」；关键词高亮 `#3E7EFF`（`text-primary`）。
- **DataRangeBar 已选图标**：已选项叠加小图标固定为 `data-range-icon`（与「数据范围」胶囊同素材），勿再按人/群类型切图标。

## 移动端个人 AI 宿主（web H5）

与 PC 侧栏+右栏不同：移动端为 **基座对话 + 底部弹窗选框**。

**结构**：
- 路由薄壳等用户数据就绪后挂载基座页；基座常驻对话面板，状态/请求/选中编排在基座内。
- 「选择 AI 框 / 历史」走独立底部弹窗（列表 + History）；经弹窗工具打开，History 随选中项重挂载，按会话 id 决定选中。
- 改筛与 PC 同源：更新本地 `filterTypes` → `saveFilter`（失败仅告警不阻断）→ 再刷列表。

**顶栏**：
- 对话面板支持左侧/右侧具名插槽；移动端左侧放返回关页，右侧可整替换默认「设置/全屏/关闭」。
- 当前右侧：开启新对话（仅图标）+ 侧栏入口图标（打开选择弹窗）；旧「切换AI框」文案胶囊已弃用。
- 选择弹窗默认全屏高；History 按开合模式控制关栏按钮显隐，并将新对话按钮文案收敛为短文案（如「新对话」）。

### 角标入口深链（URL → 打开最近消息 agent）

原生会话列表点「AI框」进 `/m/personal` 时：若 `getBadgePushInfo` 回参带了 `agentId`/`belongId`/`belongType`，则拼进 URL（没回不加）。

**web 时序（仅首次 list）**：
1. 读 URL query → 首次 `list` 后按 `agentId`（其次 `belongType+belongId`）匹配并选中。
2. **未命中**且 `belongType∈{1,3}` 且 `belongId` 非空 → 与弹窗确定同编排：`saveSelected` → `exemptAgentIds` push → `list` → 再匹配选中（等于把该 AI 框加入已选并豁免筛选）。
3. 仍失败 / 不能 save（缺字段、`belongType=0`、接口失败）→ **回落个人 AI 框**（个人框始终在 list，契约 save 也不接受 belongType 0）。
4. 无 URL 深链：不走 save，选中回落排序首项（通常即个人框）。
5. one-shot：深链只消费一次，改筛/推送刷 list 不再 save。

## PC 个人 AI 对话头栏（四按钮）

PC `PersonalAiChat` 内嵌 `Home`（`hideBuiltinCollapseChrome=true`）时，`Chat` 默认头栏右侧改为四按钮（有 `#header-right` 插槽时仍整替换，移动端不受影响）：

| 顺序 | 图标 | 行为 |
|------|------|------|
| 1 | `fullscreen-in` / `fullscreen-out` | 全屏（既有 `handleFullscreen` / `zoomType`） |
| 2 | `setting` | 设置（`gotoSettingPage`，仍受 `hasSetting`/`canEditAgent`） |
| 3 | `file-trans-zx` | 打开智信私聊/群聊（`openImChat`）；**`belongType===0` 个人框隐藏**；1→私聊、3→群聊 |
| 4 | `open-independent` | 打开 **系统原生独立窗**：`WindowPostPersonalAiNativeWin` → **`/zx/personal`** + `agentId`/`belongId`/`belongType`/`sessionId`/`aiRoleId`/`title`（desktop 侧 `loadURL`，勿走主应用 `/personal` 空页） |

不显示关闭按钮。设置页等其它入口仍用 `WindowPostWinMessage` → 无边框 `aiChatWin`。

### PC 独立原生窗（desktop + web）

- **窗**：`create/open-personal-ai-win`；`frame: true`；注入 `ipcNativeFrame=true`；关则 hide。
- **URL**：必须 **`APP_AICHAT/zx/personal?...`**（zx MPA，自带裸 `router-view`，无 TheLayout）。主应用 `/ai-chat/personal` 是空 `[...all]`，会白屏。
- **打开方式**：`open-personal-ai-win` 对窗口 `loadURL` 深链（不走主应用 `open-page`）。
- **深链**：`personalAiEntryDeepLink.js` 读 query；首次 list 匹配（可 `saveSelected`）；`chat-ready` 后 `Home.selectSessionById`。
- **标题**：打开可用 query `title`；之后随左侧选中项 `title` 写 `document.title`（并 `setTitle` 首开）。
- **推送**：主窗 iframe `postMessage` 不变；另 `refresh-personal-ai-data` → 独立窗 `runPushRefresh`。

## Home 对话 · 数据范围 scope（`dataRangeScopeList`）

Home 输入区 FilterBar 在**个人 AI 框**（`belongType=0`）且**知识范围**（聊天记录/聊天文件/共享知识，即 `dataRangeType` 1/2/4 任一项 `choose=1`）勾选时，于「数据+N」与时间范围之间展示 **「数据范围」** 胶囊。私聊/群 AI 框不展示。点击打开 `SelectDataRangeDialog`（多选，复用选择 AI 框取数链路，与 `SelectAiBoxDialog` 单选独立）。

### 显隐与本地态

- 胶囊显隐只看 `dataRangeList` 勾选态，与是否已选 scope 无关。
- 会话本地态 `conditionMode.dataRangeScopeList`：`[{ scopeDataType, scopeDataId }]`；`scopeDataType` 1=私聊、3=群聊；`scopeDataId` 为人/群 id。
- 与 `dataRangeList`（知识类型勾选）、`conditionPara.im.timeType`（时间范围）、附件/联网/深度思考并列，发消息时整包 `conditionMode` 带入 aiChat。

### 记忆回显时序

1. 打开 Home / 切 AI 框 → `POST /sessionMsg/getLastSessionMessage`。
2. 回参 **`agentSetDataRangeExpandVo`**（必填）含 `dataRangeList`、`timeType`、`netSearch`、`deepThink`、**`dataRangeScopeList`**。
3. 写入 `conditionMode`（含 scope）；FilterBar 知识勾选与时间范围同步回显。
4. 用户点「数据范围」→ 弹窗用 **`initialScopes=dataRangeScopeList`** 预勾选；scope 仅 id/type 时先 `POST /personalAiFrame/recentContactList`（按 id+type 批量）补齐昵称/头像/群名/`accountInfoList` 再展示。**不要**用 `batchGetAgent`：该接口只回有 AI 框的智能体字段，无 key 时 chip 会退化成数字 id。

### 弹窗多选行为

- **取数**：与选择 AI 框同源——最近联系人/群组/组织架构经宿主桥；搜索走 HTTP `selectGroupBySearch`（与侧栏搜索同接口）。
- **每次打开弹窗**：清空列表缓存，**重新从 PC 拉**最近联系人 + 组织群（外联群切 tab 时懒拉）。
- **最近联系人 / 群组 tab**：列表顶「全部」checkbox，当前 tab 列表全选/取消；半选态支持。
- **组织架构 tab**：无「全部」；人员行多选 checkbox；跨 tab 切换**保留**已选（全局 `selectedMap`，key=`${ownerType}:${id}`）。
- **搜索 popover**：`multi` 模式——点行 toggle 勾选，**不关闭** popover、不清空关键词；行内 checkbox（非 radio）。
- **底栏**：左「已选：N个」可展开 chip 列表删单项；右「清空已选」+ 取消 + 确定(N)（`AcDialog` `#footer-before-actions`）。

### 确定与持久化

1. 选中项 → `{ scopeDataType, scopeDataId }[]`（私聊 ownerType→1，群→3）。
2. 写本地 `conditionMode.dataRangeScopeList`。
3. `POST /agentSetDataRangeExpand/saveDataRange`：`agentId` + 当前 `dataRangeList` + `timeType` + `netSearch` + `deepThink` + **`dataRangeScopeList`**（与 getLastSessionMessage 记忆对称）。
4. save 失败不阻断本地态（仅 warn）；用户仍可发消息带当前 scope。

### 发消息

- `POST /v1/aiChat`（SSE）body 须含 **`dataRangeScopeList`**（与契约对齐，必填）；随 `...conditionMode` 展开带入。

### 边界

| 场景 | 预期 |
|------|------|
| 未勾 1/2/4 知识类型 | 不显示数据范围胶囊；scope 仍可能在 memory 里，但不暴露 UI |
| 非个人 AI 框（belongType≠0） | 不显示数据范围胶囊（私聊/群会话本身已限定归属） |
| 确定时 0 项 | 确定按钮 disabled |
| 记忆 scope 的人/群不在 PC 最近/群列表 | 仍保留勾选；`recentContactList` 按 id 补展示字段 |
| 老壳无桥 | 列表空 + toast；不影响已记忆 scope 的保存/发送 |
| android | **走原生多选**：`wnsdk.aiChat.selectDataRangeScope` → 独立多选页（不改选择 AI 框单选主链路）→ 回传 `personal-ai:selected-data-range`；最近/群「全部」；底栏「已选：N」点开底部弹层（仅人/群名头像，可删单项）+ 清空 + 取消 + 确定(N=0 disabled)；组织架构=通讯录多选钻取；saveDataRange 在 web |
| ios | **走原生多选**：`wnsdk.aiChat.selectDataRangeScope` → 复用选择 AI 框页强制多选 → 回传 `personal-ai:selected-data-range`；web `DataScopeBar` 移动端接桥，PC 仍 H5 弹窗 |

### 移动端桥时序（android / ios 对称）

1. web `DataScopeBar`（`isMobile`）→ `selectDataRangeScopeByNative(wnsdk, initialScopes)`。
2. 原生多选页预勾 `initialScopes`，确认回传 `{ type:"personal-ai:selected-data-range", payload:{ scopes:[{scopeDataType,scopeDataId,name?,avatar?}] } }`；取消 `code=-1`。
3. web 归一化后走与 PC 弹窗相同的 `onSubmit`：本地 `conditionMode` + `saveDataRange`。

### 移动端 UI 约定（数据范围）

- **主页底栏**：左「已选：N个」+ 下拉 chevron（非实心三角；对齐 web `pull-down`）→ 展开底部列表删单项；中「清空已选」；右「取消」关闭不落库、「确定(N)」才回传（N=0 不可点）。
- 展示字段只用归属人名/群名与对应头像，**不展示智能体名/头像**。`initialScopes` / 已选列表若仅有 id：须用本地通讯录/群库补齐展示名，禁止直接把长数字 id 当标题。
- **搜索 / 群组子页底栏**：与主页同结构，但**隐藏「取消」**（用左上返回退出）；主按钮文案用「完成(N)」以免与主页最终「确定」混淆。
- **搜索提交语义（重要）**：子页内点选 / 清空**只改本地草稿**，**不写回主页**；点「完成」才把当前已选合并回主页；点返回 / 系统返回 / 取消退出则主页保持进搜索前状态。勿复用转发搜索「边选边回传 + 发送」底栏。
- 软键盘弹出时底栏须贴键盘顶（含键盘高度变化中间态）；宿主沉浸态需打开键盘适配。
- **跨入口债**：若搜索页被「选择 AI 框」与「选择数据范围」共用，返回图标/自动弹键盘等 UX 会两边生效；多选草稿提交语义仅在数据范围模式启用，单选回传互不串结果。

**联调状态**：web PC 弹窗已贯通（`656ff3a`）；移动端桥+原生页 android/ios/web 已接线；**saveDataRange / aiChat / 真机 E2E 待验收**（T10 🚧）。

## 常驻页 Version 检测与选中恢复（2026-07-21）

### 时序

1. 选中任一 AI 框时，把 `agentId` / `belongId` / `belongType` 写入会话级存储（与入口深链同 shape）。
2. 宿主切回 AI 框页时，向内嵌页发 `source=zx-pc` + `type=aiBoxCheckVersion`。
3. 内嵌页拉线上 `build_version`，与构建时注入的 build 号对比：
   - 相同，或任一端为本地/非 CI 占位标记 → 不刷新
   - 不同 → 静默整页刷新（不弹确认）；5 秒内重复触发合并为一次
4. 刷新后拉 list：优先 URL 入口深链选中；否则读会话存储三元组匹配（未命中且私聊/群可走 saveSelected 再匹配）；再否则默认首项（个人 AI 框）。

### 边界

| 场景 | 预期 |
|------|------|
| 一直停在 AI 框 tab 不切走 | 不触发验版（本期不做轮询） |
| iframe 尚未创建 | 宿主跳过通知；下次切回再发 |
| 恢复只定位「哪个 AI 框」 | 不强制恢复具体 sessionId；续聊仍走 lastChatAt / 24h |
| URL 深链与存储同时有 | URL 优先 |

### 联调坑（2026-07-21）

- **无会话存储时默认选中失败**：读选中三元组无值返回 `null` 后，若用 `hasXxx(d = {})` 判断，传入 `null` 时默认参数不生效，读 `null.agentId` 抛错 → list 已写入但选中同步被 catch 跳过，右侧停在「请选择智能体」。`hasActiveSelection` / `hasEntryDeepLink` 须显式 `d == null → false`。

