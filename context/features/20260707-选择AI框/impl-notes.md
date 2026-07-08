# Impl Notes：选择AI框

> 平台无关的实现笔记，是其他端移植的唯一逻辑依据。web 端联调完成后必须填写。
> 写法要求：描述"逻辑"而不是"代码"——禁止出现 React/Kotlin/Swift 具体 API。

## 状态流转

弹窗状态：`activeTab ∈ {recent, group, org}` · `keyword` · `selectedKey = ${ownerType}:${id}` · `selected`（当前选中项整体）· `loading` · `searchOpen`（搜索焦点浮层，**待实现**）。

事件：切 tab → 懒取数（每 tab 首次进入拉一次，缓存）→ 点行即选（`selectedKey/selected` 即时更新，底部「已选」即时）→ 确定 → 上抛 `submit(selection)` 并关窗。组织架构 tab 由 OrgPicker 自管钻取状态（公司→部门→人员 + 面包屑），选中人员上抛与其它 tab 同形态 item。

**搜索（当前实现）**：`keyword` 对最近联系人/群组 tab 的已缓存列表做 `name + agentName` 前端 `includes` 过滤；OrgPicker 同步按 keyword 过滤当前层。

**搜索（计划改造）**：focus 搜索框 → 浮层覆盖主列表区 → 初始空态图 → 输入关键词 300ms 防抖 → 宿主并行搜人+搜群 → 浮层内 tab（全部/群组/人员）展示结果，标题/副标题关键词高亮 → 选中后关浮层并写入 `selected`。主 tab 列表不再受 keyword 影响。

## 接口调用时序

1. **弹窗打开**（`open=true`）：并行预取 `getRecentContacts` + `getMyGroups({type:'organization'})`；外联群在切到群组 tab 且选「外联群」时懒拉；组织架构由 OrgPicker 在 mount / 切 scope 时拉 `getOrgCompanies`。
2. **群组二级切换**：首次进入某 `type` 时 `getMyGroups({type})`，结果缓存于内存，不重复请求。
3. **组织钻取**：点公司 → `getDeptUsers({corpId, pid:'0'})`；点部门 → `getDeptUsers({corpId, pid: deptId})`；面包屑回溯复用已缓存或重新 `getDeptUsers`。
4. **搜索（计划）**：`searchAiBoxPicker({search})` → 宿主 `getAccountSearchByUserName` + `getGroupBySearch` 并行；空 keyword 不请求。
5. **失败策略**：各 `fetch*` `.catch(() => [])` 或空结构兜底，列表显示空态，不阻断弹窗其它 tab。

## 边界情况

| 场景 | 预期行为 |
|------|----------|
| 桥方法不存在（老壳） | `useAiBoxPickerData` reject → 调用方可 toast「请升级到最新版本」 |
| 列表为空 | 无 keyword：「暂无数据」/「加载中…」；有 keyword：「未搜索到相关结果」 |
| 搜索浮层 focus 无输入 | 显示空态图（对齐 PC `search-result` no-data） |
| 未选中点确定 | 「确定」按钮 disabled |
| 弹窗关闭 | 重置 keyword、searchOpen、不强制清缓存（二次打开秒显） |
| 群 store 无成员 | 宿主并发 `groupInfoApi` 补取后拼 `accountInfoList`（最多 4 人） |

## 错误处理策略

- 桥请求超时（iframe postMessage 30s）：reject，搜索浮层可显示失败重试（可选）。
- 单群详情补取失败：不阻塞整表，该群降级为单头像或无 2×2 拼图。
- `getDeptUsers` 若因缺 `corpType` 返回 400：待联调后在契约补参并由 web 透传公司节点的 `corpType`。

## 联调坑（实际接口 ≠ 文档之处）

**desktop 侧字段映射（实现时发现，契约以 bridge.md 为准，desktop handler 内部做转换）：**
- `groupListApi` 返回群项用 **`type`**（0/10），契约要求 `groupType` → handler 内 `groupType: g.type` 映射。会话模型里才叫 `groupType`，两套字段名同语义。
- `getContactTree` 公司节点：名在 **`label`**（非 `name`/`corpName`）、人数在 **`num`**（非 `memberCount`）→ handler 映射为 `name/memberCount`。组织树的分组节点（type 1/2）的 `label` 作为公司项 `category`（如「入职企业/我的下级」），web OrgPicker 据此分组显示。
- `getDeptUserPagelist` 入参除 `corpId/pid` 外，既有调用还传 `corpType/corpAndCorpRelType/labelType`；当前桥只传 `{corpId,pid,pageNum,pageSize}` → **待联调确认是否必需**（若 400/空，需在 bridge.md `getDeptUsers` 入参补 `corpType` 并由 web 透传）。
- **`agentName` 桌面端无独立 store 字段**：私聊取对方昵称、群聊取群名（对齐 `selectAiAgentMapper.js`）。若产品要求 AI 框名与群/人名不同，需后端补字段。
- **`lastChatAt` 群组 tab 暂为 0**：`groupListApi` 不返回最近消息时间，handler 当前填 0 → 群组 tab 不按时间倒序。待联调确认是否从 `GetLatestOneMsg`/`lastConversationTime` 补（需知群会话 key 格式）。最近联系人 tab 的 `lastChatAt` 取 `item.lastConversationTime || item.message?.messageTime`，已实现。
- `getRecentContacts` 旧 handler 形参 `(e,data,uuid,webContentsId)` 与 `sendToHost` 实参不匹配（`webContentsId` 实为 undefined，靠 `e.sender.sendTo` 在 Electron 19 退化/兜底跑通）——新增 3 个 handler 照搬此既有模式，未改。
- **AiBrowser 个人 AI iframe 桥**：`/zx/personal` 在 iframe 内无 `window.webview`；`useAiBoxPickerData` 检测 iframe 后走 `parent.postMessage(personal-ai:bridge-request)` → AiBrowser `handlePersonalAiMessage` → `aiBoxPickerHost` → `personal-ai:bridge-result` 回传。token 仍走既有 `getToken`/`setToken`（`App.vue`）。
- **最近联系人排序**：与 PC 转发弹窗 `transmit-message.vue` `allConversation` 一致——有 `message` 的项靠前，同有则按 `messageTime` 倒序。**排序在 web 端**（`sortRecentLikeTransmitMessage`）；桥返回 `hasMessage` + `messageTime`（`messageTime` 允许为 0，勿用 falsy 判断）。
- **群 2x2 头像**：桥返回 `accountInfoList`（`[{id,nickName,avatar}]`，最多 4 项）；web 归一化须保留该字段，不可只留 `avatar`。

## 与 bridge 的交互

取数经宿主桥（契约见 `context/bridge.md`），`useAiBoxPickerData` 双通道：
- **微应用 webview**：`window.webview.getXxx()` → preload `sendToHost` → `webview-control` → `aiBoxPickerHost`
- **AiBrowser iframe**：`parent.postMessage(personal-ai:bridge-request)` → AiBrowser → `aiBoxPickerHost` → `personal-ai:bridge-result`

方法映射：
- `getRecentContacts()` → 最近联系人 tab（首入懒拉，缓存；web 端 `sortRecentLikeTransmitMessage` 排序）
- `getMyGroups({type})` → 群组 tab（按组织群/外联群二级切换懒拉）
- `getOrgCompanies({type})` / `getDeptUsers({corpId,pid})` → 组织架构钻取
- `searchAiBoxPicker({search})` → **待新增**；搜索浮层（双接口并行，见上）
- 桥缺失/失败 → 调用方 `.catch(() => [])` 兜底

**PC 个人 AI 框（`/zx/personal`，`main.vue` 内 `AiBrowser`）**：
- 内置 tab 使用 **`<iframe>`**（便于 DevTools 调试；web 热更新无需重启 preload）。
- 桥请求时序见上「AiBrowser iframe」通路；取数逻辑与微应用共用 `aiBoxPickerHost.js`。
- token：`postMessage("getToken")` → `App.vue` 回 `setToken`（与群 AI 框等 iframe 一致）。
- 群头像成员：取数在主窗口进程，对未缓存群并发 `groupInfoApi` 补取后拼 `accountInfoList`。

## web 端视觉/实现备忘（蓝湖还原）

- **弹窗尺寸**：蓝湖稿面板 **440×580**（plan.md 写的 690×540 是近似值，以蓝湖为准）。`AcDialog splitTheme`，`class="!w-440px !h-580px"`。
- **行高**：最近联系人/群组行 60px、组织·公司行 48px、组织·人员行 40px、组织/外联切换头 40px。
- **字号**：名称 `text-3.5`(14px·近黑 `text-black`)、AI框名/人数/面包屑 `text-3`(12px·`text-gray-medium`)、tab `text-3.5`。
- **配色 token**：active tab/面包屑前级 `primary`；inactive tab `gray-dark`；副文案 `gray-medium`；行分隔 `border-gray-light`；搜索框底 `bg-gray-light`（`#F4F6F8`）；选中行底 `bg-primary-light`；搜索框圆角 **13px**。
- **单选图标**：用全局 `CheckboxView` 的 `radio` 模式（`<CheckboxView radio :v="selected" />`，14px 圆形单选），不要用 `SvgIcon name="check"`。
- **SvgIcon 可用名**（`src/assets/svg/`）：`search`（搜索）、`close`（清除/关窗）、`folder`/`folder2`（部门）、`success`（对勾）、`tabs-next`（右箭头，进公司/部门用，plan 里的 `arrow-right` 不存在需替换）。无 `check`/`arrow-right`。
- **全局组件无需 import**：`AcDialog`/`AcAvatar`/`AcGroupAvatar`/`CheckboxView`/`SvgIcon` 已全局注册（参照 `ShareTargetDialog.vue` 直接用）。
- **组件文件**：`SelectAiBoxDialog.vue`（壳）· `AiBoxRow.vue`（列表行）· `OrgPicker.vue`（组织钻取）· `SearchInput.vue`（搜索输入）；搜索浮层 `AiBoxSearchPanel.vue` 待建。
- **搜索空态图**：对齐 PC `no-data.png`（160×160）+ 文案「未搜索到相关结果」；关键词高亮色 `#3E7EFF`（`text-primary`）。
