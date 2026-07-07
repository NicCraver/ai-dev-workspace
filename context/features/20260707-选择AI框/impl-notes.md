# Impl Notes：选择AI框

> 平台无关的实现笔记，是其他端移植的唯一逻辑依据。web 端联调完成后必须填写。
> 写法要求：描述"逻辑"而不是"代码"——禁止出现 React/Kotlin/Swift 具体 API。

## 状态流转
<!-- 状态机：有哪些状态、什么事件触发迁移、初始/终止状态 -->

弹窗状态：`activeTab ∈ {recent, group, org}` · `keyword` · `selectedKey = ${ownerType}:${id}` · `selected`（当前选中项整体）· `loading`。事件：切 tab → 懒取数（每 tab 首次进入拉一次，缓存）→ 前端按 `name+agentName` 过滤 → 点行即选（`selectedKey/selected` 即时更新，底部「已选」即时）→ 确定 → 上抛 `submit(selection)` 并关窗。组织架构 tab 由 OrgPicker 自管钻取状态（公司→部门→人员 + 面包屑），选中人员上抛与其它 tab 同形态 item。

## 接口调用时序
<!-- 什么时机调什么接口、依赖关系、并发/串行、重试策略 -->

## 边界情况
<!-- 空数据、弱网、权限拒绝、切后台、重复点击…每条写"场景 → 预期行为" -->

## 错误处理策略
<!-- 各类错误码/异常的用户可见表现与恢复路径 -->

## 联调坑（实际接口 ≠ 文档之处）
<!-- 每条：现象 → 实际行为 → 契约是否已更新。移植端必看 -->

## 与 bridge 的交互
<!-- 若涉及 WebView↔原生通信，列出用到的 bridge 方法与时序；否则写"无" -->

全部经 `window.webview.*`（PC，desktop 壳），契约见 `context/bridge.md`：
- `getRecentContacts()` → 最近联系人 tab（首入懒拉，缓存）
- `getMyGroups({type})` → 群组 tab（按组织群/外联群二级切换懒拉）
- `getOrgCompanies({type})` / `getDeptUsers({corpId,pid})` → 组织架构钻取
- 桥缺失/失败 → 调用方 `.catch(() => [])` 兜底；旧壳无新方法时 `useAiBoxPickerData` 抛「请升级到最新版本」（当前以空列表降级，T9 联调补提示）。

## web 端视觉/实现备忘（蓝湖还原）

- **弹窗尺寸**：蓝湖稿面板 **440×580**（plan.md 写的 690×540 是近似值，以蓝湖为准）。`AcDialog splitTheme`，`class="!w-440px !h-580px"`。
- **行高**：最近联系人/群组行 60px、组织·公司行 48px、组织·人员行 40px、组织/外联切换头 40px。
- **字号**：名称 `text-3.5`(14px·近黑 `text-black`)、AI框名/人数/面包屑 `text-3`(12px·`text-gray-medium`)、tab `text-3.5`。
- **配色 token**：active tab/面包屑前级 `primary`；inactive tab `gray-dark`；副文案 `gray-medium`；行分隔 `border-gray-light`；搜索框底 `bg-gray-light`；选中行底 `bg-primary-light`。
- **单选图标**：用全局 `CheckboxView` 的 `radio` 模式（`<CheckboxView radio :v="selected" />`，14px 圆形单选），不要用 `SvgIcon name="check"`。
- **SvgIcon 可用名**（`src/assets/svg/`）：`search`（搜索）、`close`（清除/关窗）、`folder`/`folder2`（部门）、`success`（对勾）、`tabs-next`（右箭头，进公司/部门用，plan 里的 `arrow-right` 不存在需替换）。无 `check`/`arrow-right`。
- **全局组件无需 import**：`AcDialog`/`AcAvatar`/`AcGroupAvatar`/`CheckboxView`/`SvgIcon` 已全局注册（参照 `ShareTargetDialog.vue` 直接用）。
- **runtime-only Vue**：`<script setup>` 内勿用 `template:` 字符串定义子组件（Vite 默认 runtime-only 不编译）；行/搜索框标记直接内联模板，T5/T7 再抽 `.vue` SFC。
