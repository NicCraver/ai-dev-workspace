# Desktop 转发弹窗（消息转发）组件调研

> 检索来源：codebase-memory MCP（project `Users-nic-w-ai-dev-workspace-apps-desktop`，moderate 索引）。最后更新：2026-07-07
> ⚠️ 行号为索引时快照，改代码后会漂移，用作定位线索而非锚点。
> 🔑 关键词提醒：本端「转发」在代码里几乎都用 **`transmit`**（仅 `getForwardExtraByMsgExtra` 一个例外），检索时优先用 transmit 而非 forward。

## 1. 文件落点

| 文件 | 角色 |
|---|---|
| `components/chitchat/transmit-message.vue` (~1047) | **转发主弹窗**：左选目标 + 右预览/留言 |
| `components/chitchat/transmit-message-app.vue` (~1153) | 转发弹窗的 app/分享版变体（未深挖） |
| `components/chitchat/search-box.vue` (~114) | 搜索输入壳 → `search-result` |
| `components/common/search-result.vue` (~451) | 搜索结果（用户/群/机器人） |
| `components/chitchat/select-group-list.vue` (~228) | 群组选择（分页接口） |
| `components/common/group/outsource-group-select.vue` (~71) | 组织架构壳：切换头 + `organization-list` |
| `components/common/group/company-dept-user.vue` (~450) | 部门人员 + 面包屑 |
| `components/common/organization-outsource.vue` (~112) | 通用「组织/外联」切换头（纯 UI，无数据） |
| `components/contacts/organization-list.vue` | 组织架构公司/群列表主体（经 `$root` 事件总线，未深挖） |
| `components/chitchat/message/transmit-msgs/*` | 转发预览子组件：transmit-sumary / -img / -img-share / -text / -file / -video |
| `components/popwin/winbox-wrapper.vue` | 弹窗容器（WinBox） |

> 路径前缀均为 `apps/desktop/src/renderer/`。

## 2. UI 结构（transmit-message.vue）

容器 **690×540**，标题「转发」，左右分栏各 50%。

**左侧（选目标）**
- `<search-box needRobot placeholder="搜索联系人、群组">`
- 三 tab（懒加载）：最近联系人(1) / 群组(2) / 组织架构(3)
  - tab1：`<RecycleScroller>` 虚拟列表，行 = checkbox + `user-photo`/`group-photo` + 名称 + `group-sign`
  - tab2：`<select-group-list>`
  - tab3：`<outsource-group-select type="organization">`（选公司）→ `<company-dept-user>`（部门/人员 + 面包屑）

**右侧（已选 + 预览 + 留言）**
- 「发送给:」+ `<mt-tag>` 已选标签（可关闭，确定按钮显示数量）
- 预览区按 `messageType` 分支：`TransmitSumary`(transType/ZXCombineMsg) / img / img-share / text / file(**含 tiff**) / video / msg-applink
- 留言 `<textarea maxlength=1000 placeholder="给对方留言">`
- 底部：取消 / 确定(N)（已选为空时 disabled）

## 3. 数据流（五条通道）

| 通道 | 取数方式 | 关键参数/字段 |
|---|---|---|
| 最近联系人 | store getter `GetConversationSort.all`（`store/module/dialogModule/dialogGetters.js`） | 见下「会话对象字段」 |
| 群组 | `$service.groupListApi({accountId, type, pageNum, pageSize:200})` | type **0=组织群 / 10=外联群**；返回 `id/name/groupNumber/type/createAt` |
| 组织架构·公司 | `outsource-group-select` → `organization-list`（`$root` 事件总线） | contactType=organization/outsource；未深挖 |
| 组织架构·部门/人员 | `$service.getDeptUserPagelist({corpId, pid, corpType, pageNum:1, pageSize:1000, corpAndCorpRelType, labelType})` | 返回 `depts.list / users.list` |
| 搜索 | `$service.getAccountSearchByUserName({search})` + `$service.getGroupBySearch({search, accountId})`；`needRobot` 时叠加 store `GetRobotList` | 防抖 300ms |

**GetConversationSort 的输入**：`GetDialoguesList`(会话本体) / `GetTopMap`(置顶) / `GetReminderMap`(未读) / `GetIsHintMap`(免打扰) / `GroupBulletinUnreadAndLastOneMap`(群公告) / `GetLatestOneMsg`(最新消息) / `GetAllOrganizationUserIds`+`GetAllOutsourceUserIds`(组织/外联判定)。
输出 `{topList, normalList, all, organizationList, outsourceList}`，弹窗用 `.all`。

**会话对象字段**（GetConversationSort 加工后）：
- 基础：`id` / `conversationType`(PRIVATE/GROUP) / `name` / `avatar` / `message` / `lastConversationTime` / `showMsgType`
- 状态：`reminderNumber` / `istop` / `isHint` / `isAtMe` / `extraCornerType`+`extraRedNum/YellowNum/PotNum` / `extraLastMsg`
- 分类 **`groupType`**：单聊 `0`(组织·含 robot_) / `10`(外联)；群聊 `<10`(组织群) / `>=10`(外联群)
- 弹窗追加：`type`(group/private) / `key`(`${type}#${id}`)

## 4. 核心逻辑（transmit-message.vue）

**选择目标**：四来源（最近会话 `selectDialogHandle` / 群组 `groupSelectHandle` / 组织架构 `toggleChecked`+`selectOrganizationHandle` / 搜索 `searchSelectHandle`）统一写入 `showSelectedList`，key 格式 `{type}#{id}`，**上限 9**（超限 toast「最多只能选择9个会话」）。

**提交** `confirmHandle()` → `transpondSendHandle()`：
1. `isTranspond` 防重；删 `content.extra["pc-sign-uuid"]`
2. `disposeTranspondContent(data, messageType)` 构造消息体：
   - 文本：`{content, extra, messageName}`
   - 编辑态图片：`{base64, buffer, path, name, size, type, isLocal, content:showUrl, imgUri:showOssUrl}`
   - 其余：原样透传 source
3. 遍历 `showSelectedList`：**dept/company 跳过**；user/private→PRIVATE，其余→GROUP；`sentIds` 去重
4. `sendMessageHandle()` 按 `message.transType` 分发；留言 trim 非空则作为 `TextMessage` 跟发
5. `$message.success("转发成功")` → `cancelHandle({isScuccess:true, addDialog})`

**三种转发模式**（`message.transType`，由上游 `chat-box` 等设置）：
- `'single-send'`：逐条转发，遍历 `message.messageList`
- `'combine-send'`：合并转发，`messageType=ZXCombineMsg`，source 传整个 message
- 默认：原样转发
- 统一走 `this.$service.DistributeSendMessage(...)`

## 5. 智能体/机器人字段（重要结论）

- **会话列表层**：群聊会话项**无智能体字段**；仅单聊靠 `id.startsWith("robot_")` 识别机器人（归 groupType=0 组织）。
- **搜索层**：`search-box` 的 `needRobot=true` 生效时，从 store **`GetRobotList`**（contact 模块）按 name 过滤，作为「用户」类追加（`accountId` 含 `robot_`，`type:0`，`avatar=iconUrl`）。这是转发目标里**唯一**能选到机器人的入口。
- **群内智能体**：独立维度，`groupsModule.GetRobot`（`groupId+robotId` → `GroupsMap[groupId].groupRobots`），底层 sqlite `GROUP_GROUPROBOTS` + `ROBOT` 表；另有 `dialogModule.GetAiAgentAccountInfoMap`（缓存智能体基本详情）。**不在转发目标数据里**。

> 即：转发弹窗能选「机器人单聊」(needRobot 搜索)，但**选不出「群里的某个智能体」**——群成员级智能体不在目标选择数据模型中。

## 6. 子组件契约

| 组件 | 上行事件 | 下行 props / ref 方法 |
|---|---|---|
| search-box | `select(item)` | `placeholder`, `needRobot` |
| search-result | `selectresult({...item, isUser})`, `update:visible` | `search`, `visible`, `needRobot` |
| select-group-list | `changeSelect({item, items, type:"add"/"delete"})` | `selected[]`, `multipleSelect`, `checkedObj`；方法 `cancelSelect(id)` |
| outsource-group-select | `currentType`, `showCompanyDept(company)`, `selectCompany` | `type` |
| company-dept-user | `toggle-dept`, `toggle-user`, `backToCompany`, `update-user-map` | `current`, `type`, `checkedObj`, `disabledObj`, `multipleSelect`；方法 `closeTag` |

注：`outsource-group-select` 与 `organization-list` 之间通过 **`$root` 全局事件总线**（`showGroupCompanyDept`/`selectGroupCompany`）通信，非 props/events——移植时要改为显式父子通信。

## 7. 已知坑
- `select-group-list.groupListByTime` 用了 `list.reverse((a,b)=>...)`——`Array.prototype.reverse` **不接受比较函数**，实际只反转、未按 `createAt` 排序（疑似把 `sort` 写成 `reverse`）。移植时修。
- key 体系不统一：组织架构人员用 `user#${accountId}`、部门用 `${corpId}-${deptId}`、群用 `group#${id}`，与主弹窗 `{type}#{id}` 靠 `toggleChecked`/`cancelSelectHandle` 转换，易踩坑。
- 弹窗内三套 UI 库混用（ant-design-vue 的 `a-button`/`a-checkbox`、自研 `mt-tag`），移植到其他端需替换。
- 搜索结果用 `v-html` 高亮（`<font color>` 注入），存在 XSS 隐患面，移植时建议改用安全高亮。

## 8. 跨端移植要点
1. 目标选择模型统一为 `{type, id, key, name, conversationType}`，type ∈ user/private/group/dept/company；上限 9。
2. 五条取数通道分别对接目标端 store/service；**最近联系人**在桌面端最重（`GetConversationSort` 聚合 7+ getter），移植时不必照搬聚合，直接用目标端已有会话列表即可。
3. 转发发送只依赖一个服务 `DistributeSendMessage` + 三种 `transType` 分支，对接 `context/contracts/` 的消息发送契约即可。
4. 智能体：若目标端需要"转发给群内智能体"，需额外接 `GetRobot`/`GROUP_GROUPROBOTS`，**当前桌面端不支持**。
