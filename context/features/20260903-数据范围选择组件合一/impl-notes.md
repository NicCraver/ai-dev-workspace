# Impl Notes：数据范围选择组件合一

> 平台无关的实现笔记。本次是 web 端纯重构（不改选择口径、不改接口），记录的是「逻辑放哪、形态差怎么注入」，给后续改 tab / 移植时少踩坑。

## 状态流转

唯一逻辑源：`useDataRangePicker`。

打开 / 挂载 → `init()`：

1. tab 回 `knowledge` / `dialogue` / `all`，周工作选中清空，收纳组全部收起
2. 用 `initialScopes` 回显知识聊天选中（过滤 type=4 收纳组，勾选态由成员 key 派生）
3. 并行拉涉密文案（失败静默，回退兜底文案）
4. `accountId` 为空 → 错误「accountId 未就绪」，不取数
5. 否则拉全量会话并归一化；`autoSelectAll` 为真时覆盖回显做全选

关闭只清瞬时态（关键字、搜索聚焦、已选弹层），选中集合下次 `init` 从记忆重建。

提交：`buildSubmitPayload()` → `{ scopes, flags }`。候选仍在加载或已失败时 `flags` 必须是 `null`（未知态），不能用 0 冒充。

## 接口调用时序

- `getSecretButtonTip`：打开时发一次，失败不阻断选人
- `getAllImDialogue({ accountId, selectModel: 0 })`：打开时发一次，弹窗生命周期内不再拉

这两个函数**不**写进 composable 的模块依赖。壳把真实接口函数作为 `deps` 注入。原因：单测跑在裸 Node，不解析打包器的路径别名；带别名的文件无法被 `node --test` 直接 import。

## 形态差异（variant 分支）

逻辑两端完全共用。只有外观走 `variant="pc" | "mobile"`：

| 点 | pc | mobile |
|---|---|---|
| 搜索 | 输入框 + 下拉面板 | 点入口铺整屏层，聚焦后出候选 |
| 已选 chip 弹层 | 向上弹 | 同一套 popover（底栏位置由壳决定） |
| 已选 chip 上的涉密/离职标 | 显示 | 不显示 |
| 清空按钮文案 | 「清空已选」 | 「清空」 |
| 组织架构人员标 | 传涉密查找表 | 不传 |
| 一级 tab 位置 | 对话框标题栏 | 自绘顶栏 |
| 确定/取消 | 对话框 footer | 自绘底栏 |

整屏搜索层的开关、输入框 ref、开/关函数留在内容区组件内部（形态，不是业务状态）。

## picker 为何用 prop 而不是隐式注入

内容区与已选底栏在 PC 上分处对话框的不同插槽，必须共用**同一份** picker 实例。壳创建实例后显式传入各子件，查状态时顺着 prop 就能找到，不靠跨树隐式注入。

初始化时机也因此留在壳：PC 盯「是否打开」，移动是命令式弹层每次新建实例、挂载时 `init()`。

## 边界情况

- `accountId` 空 → 不取数，列表空态文案「accountId 未就绪」
- 取数失败 → 空态「会话列表加载失败」，提交 `flags=null`
- 收纳组自身 key 永不进选中集合；提交时若组内成员全选，再把该组写成 type=4
- 搜索勾选与列表勾选写同一份选中集合；关搜索层只清关键字，不撤选
- 已选弹层未展开时不物化 chip 列表（避免全选后上千节点同帧创建）

## 错误处理策略

- 涉密文案失败：`console.warn`，界面继续用兜底文案
- 会话列表失败：同上，并置错误文案；确定仍可点，但 flags 为未知

## 联调坑（实际接口 ≠ 文档之处）

本次未改接口、未重新联调。归一化认的原始字段是 `type` / `targetId` / `targetName` / `childrenDialogueList`，不是 `scopeDataType` / `scopeDataId`。

## 与 bridge 的交互

无新增。PC `/zx/data-range`、移动 `/m/data-range` 对宿主的上报协议不变，调用方一行未改。
