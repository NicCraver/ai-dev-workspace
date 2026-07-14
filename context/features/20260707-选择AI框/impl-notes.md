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

1. **弹窗打开**（`open=true`）：并行预取最近联系人 + `getMyGroups({type:'organization'})`。最近联系人时序：`getRecentContacts`（桥）→ web 端 `sortRecentLikeTransmitMessage` → `POST /personalAiFrame/recentContactList`（HTTP，按 id/type 批量补齐 `agentName` 等）；外联群在切到群组 tab 且选「外联群」时懒拉；组织架构由 OrgPicker 在 mount / 切 scope 时拉 `getOrgCompanies`。
2. **群组二级切换**：首次进入某 `type` 时 `getMyGroups({type})`，结果缓存于内存，不重复请求。
3. **组织钻取**：点公司 → `getDeptUsers({corpId, pid:'0'})`；点部门 → `getDeptUsers({corpId, pid: deptId})`；面包屑回溯复用已缓存或重新 `getDeptUsers`。
4. **搜索**：HTTP `POST /personalAiFrame/selectGroupBySearch({accountId, searchContent})`（300ms 防抖）→ 回参 `groupList`+`privateList`，前端分三 tab 展示；空 keyword 不请求，popover 显示空态图。（旧桥 `searchAiBoxPicker`/宿主 `getAccountSearchByUserName`+`getGroupBySearch` 已由 web 弃用，desktop 侧可保留兜底或后续下线）
5. **确定选中**：`saveSelected` → `list(filterTypes:null, exemptAgentIds push 本次 agentId)` → 用回参刷新主侧栏并激活该项（详见下「选中后持久化」）；失败则本地 upsert 兜底。
6. **失败策略**：各 `fetch*` `.catch(() => [])` 或空结构兜底；`recentContactList` 失败则保留桥侧名称（昵称/群名），不阻断弹窗其它 tab。

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

- 桥请求超时（iframe postMessage 30s）：reject，搜索 popover 可显示失败重试。
- 单群详情补取失败：不阻塞整表，该群降级为单头像或无 2×2 拼图。
- `getDeptUsers` 若因缺 `corpType` 返回 400：待联调后在契约补参并由 web 透传公司节点的 `corpType`。

## 联调坑（实际接口 ≠ 文档之处）

**desktop 侧字段映射（实现时发现，契约以 bridge.md 为准，desktop handler 内部做转换）：**
- `groupListApi` 返回群项用 **`type`**（0/10），契约要求 `groupType` → handler 内 `groupType: g.type` 映射。会话模型里才叫 `groupType`，两套字段名同语义。
- `getContactTree` 公司节点：名在 **`label`**（非 `name`/`corpName`）、人数在 **`num`**（非 `memberCount`）→ handler 映射为 `name/memberCount`。组织树的分组节点（type 1/2）的 `label` 作为公司项 `category`（如「入职企业/我的下级」），web OrgPicker 据此分组显示。
- `getDeptUserPagelist` 入参除 `corpId/pid` 外，既有调用还传 `corpType/corpAndCorpRelType/labelType`；当前桥只传 `{corpId,pid,pageNum,pageSize}` → **待联调确认是否必需**（若 400/空，需在 bridge.md `getDeptUsers` 入参补 `corpType` 并由 web 透传）。
- **`agentName`**：桌面桥无独立 AI 框名时，私聊/群聊会先用昵称/群名兜底。**最近联系人 tab** 在 web 端再调 `POST /personalAiFrame/recentContactList` 按 `type+id` 批量覆盖 `agentName`（及 agentId/aiRoleId/agentVersionId）；搜索与群组 tab 仍用桥侧兜底，待产品确认是否同样补齐。
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
- `getOrgCompanies({type})` / `getDeptUsers({corpId,pid})` → 组织架构钻取
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
- **切换列表即刷新右侧**：重挂载 key 必须并入**选中项唯一 id**（agentId）。私聊/群现已用真实 `belongType`/`belongId`（各项不同、key 天然变化）；但**个人AI框(0) 仍共用 `DEFAULT_CHAT` 占位**，若 key 不含 agentId，则从个人AI框切到另一占位项时 key 不变、右侧不刷新。key = `agentId + chatType + targetId + aiRoleId + resume`。
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

**时序**：页面挂载 → 拉 `list`（`filterTypes: null` 沿用记忆，或 `[]` 表全部）→ 用回参 `filterInfo.filterTypes` 同步筛选 UI → 映射为内部 agent → 排序渲染。
- 首次/无记忆：`filterTypes` 传 `null` 由后端沿用；显式「全部」传 `[]` 并落库。
- `accountId` 取当前登录用户 id（无则回退页面默认查询参数）。
- 成功 → 用回参 `aiFrameList` 整表替换本地列表；失败 → 保留初始 mock，不清空（保证无后端/老壳环境不白屏）。
- 选中项若不在新列表中 → 回退到排序后首项。

**回参 → 内部 agent 映射**（契约 `PersonalAiFrameItem`）：
- `belongType`：`0→个人AI框`（个人、无三点菜单）/`1→私聊`/`3→群聊`；据此定 ownerType、标签、是否个人。
- **标题** = `belongName`（个人='个人AI框'/群=群名/私聊=对方名）；**副标题** = `name`（AI框名）。
- `lastChatTime` / `pinTime` 是 `"yyyy-MM-dd HH:mm:ss"` 字符串 → 转毫秒时间戳（解析时把 `-` 换 `/` 规避时区差异）；缺失回 0。
- 排序沿用既有规则：个人置顶 → 置顶项按置顶时间 → 其余按 `lastChatAt` 倒序。
- `hasKnowledge`/`unreadCount`/`isPinned`/`isPersonal` 透传；`belongType`/`belongId`/`corpId`/`aiRoleId` 原样保留，供后续会话跳转与置顶/隐藏操作使用。
- `latestMessageBrief`：24h 内最新消息缩略（`null` 表示无）；含 `question`/`answer`/`finishAt`/`sender`，可用于列表副文案或 24h 恢复判定（待 web 接线）。
- **筛选 UI**：`filterInfo.personalChecked` 恒 true；`filterInfo.filterTypes` 含 `1` → 近15天勾选、含 `2` → 有知识库勾选。

**联调坑 / 待确认**：
- **会话跳转**：右侧 `HomeIndex` 约定 `chatType=belongType`、`targetId=belongId`（type 1→`getUserInfo` 私聊、type 3→`getGroupInfo` 群）。**私聊/群已按真实 `belongType`/`belongId` 打开对应会话**——切换列表即换 key 重挂载右侧、内容随之正确。**个人AI框(belongType 0)**：`HomeIndex.getBelongInfo` 只处理 1/3，type 0 会卡在 loading，且个人AI框无外部会话目标 → 列表项暂回退 `DEFAULT_CHAT` 占位。**待联调**：HomeIndex 补 type 0（个人AI/自会话）分支 + 后端给个人AI框真实会话目标。
- 选中列表项后右侧直接挂载对话面板（传 `chatType`/`targetId`/`aiRoleId`），切换时重挂载；不再拼 `/zx/home/...` URL。
- 顶部搜索框当前是**客户端过滤**；list 契约已无 `searchKeyword` 字段。
- 三个点菜单（置顶/隐藏/打开私聊）尚未接线，且状态持久化依赖后端操作接口（与「筛选记忆」同域），待接口到位。

## 选中后持久化（`saveSelected` → `list` + `exemptAgentIds`）

弹窗/原生确定选中后的**平台无关编排**（web 已接线；移动端注入各自 HTTP 即可复用同一逻辑）。

**时序**：
1. 选中项 → `selectedList` 单项：`belongType`（private→1 / group→3）、`belongId`（优先 `ownerId`，否则 `id`/`accountId`/`groupId`）、有则带 `agentId`。
2. `POST /personalAiFrame/saveSelected({ accountId, selectedList })`。
3. 将本次 `agentId` **去重 push** 进会话内 `exemptAgentIds`。
4. `POST /personalAiFrame/list({ accountId, filterTypes: null, exemptAgentIds })`——`filterTypes:null` 沿用筛选记忆；豁免名单保证新选中项不被当前筛选挡掉。
5. 用 `aiFrameList` 整表替换侧栏；按 `agentId`（其次 `belongType+belongId`）定位并激活；找不到则本地 upsert 兜底。
6. **任一步失败** → 不阻断：本地 `mapSelectionToAgent` + upsert 仍写入侧栏。

**边界**：
- 群组 / 组织架构 tab 可能无 `agentId`（桥侧未补齐）→ save 仍可只带 `belongType+belongId`；`exemptAgentIds` 不追加空 id。新项能否出现在筛选列表依赖后端 save 后是否默认可见。
- 最近联系人（HTTP 补齐后）与搜索结果通常带真实 `agentId`，豁免生效。
- `exemptAgentIds` 为**会话内累加**（同页多次选择不断 push），非跨刷新持久化。

**移植**：纯映射 + 编排与 HTTP 解耦；调用方注入 `saveSelected` / `fetchList` 两个异步函数即可。各端勿在 UI 层散写这两步时序。

## web 端视觉/实现备忘（蓝湖还原）

- **弹窗尺寸**：蓝湖稿面板 **440×580**。`AcDialog splitTheme`，`class="!w-440px !h-580px"`。
- **底栏「已选」截断**：`AcDialog` footer 为左右两区——`footer-left`（`flex-1 min-w-0 overflow-hidden`）放「已选：xxx」，`footer-right` 固定放取消/确定；`buttonTip`（若有）限 `max-w-32 truncate`。`SelectAiBoxDialog` 已选文案用 `block min-w-0 max-w-full truncate`，长群名/昵称不挤按钮。
- **行高**：最近联系人/群组行 60px、组织·公司行 48px、组织·人员行 40px、组织/外联切换头 40px。
- **字号**：名称 `text-3.5`(14px·近黑 `text-black`)、AI框名/人数/面包屑 `text-3`(12px·`text-gray-medium`)、tab `text-3.5`。
- **配色 token**：active tab/面包屑前级 `primary`；inactive tab `gray-dark`；副文案 `gray-medium`；行分隔 `border-gray-light`；搜索框底 `bg-gray-light`（`#F4F6F8`）；选中行底 `bg-primary-light`；搜索框圆角 **13px**。
- **单选图标**：`CheckboxView` 的 `radio` 模式（14px 圆形单选）。
- **搜索 popover**：对齐 PC `search-box`/`search-result`——320px 宽、max 400px 高、`box-shadow: 0 0 10px rgba(0,0,0,0.3)`、圆角 4px；`Teleport` 到 body 避免 Dialog `overflow:hidden` 裁切。
- **代码目录**：web 本功能全部代码集中在 `apps/web/src/components/views/personal-ai/`，内部再按子功能细分：`list/`（主列表+会话，入口 `list/PersonalAiChat.vue` 由 `/personal` 路由引用）、`picker/`（选择弹窗，内含 `search/` 搜索子模块）、`selector/`（移动端原生选择/共享知识消息）、`tests/`（全部单测集中）。功能私有工具（`highlightKeyword`、`SearchInput`）随 `search/` 目录走，不放公共 `utils/`。对应 root `CLAUDE.md`「功能内聚」总则（其它端按各自 package/模块惯例落地，单测归各自 `tests/`）。
- **组件文件**：`SelectAiBoxDialog` · `AiBoxSearchBox`（输入+popover 壳）· `AiBoxSearchPanel`（结果列表）· `AiBoxSearchRow` · `AiBoxRow` · `OrgPicker` · `SearchInput`。
- **搜索空态图**：`no-data.png` +「未搜索到相关结果」；关键词高亮 `#3E7EFF`（`text-primary`）。
