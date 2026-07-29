# Impl Notes：pc不可见推送延后与记忆刷新

> 平台无关。移植端若做常驻页可见性，照此实现。

## 状态流转

```
pageActive = docVisible && shellActive

初始：docVisible=文档可见；shellActive=true（iframe 加载即在个人 AI 内容页）

文档 hidden          → docVisible=false
文档 visible         → docVisible=true；若 shellActive 则「激活」
壳 deactivate        → shellActive=false
壳 checkVersion/激活 → shellActive=true +「激活」
```

推送命中当前会话且 `!pageActive` → `pendingMessageRefresh=true`（多次合并）。

## 接口调用时序

**推送（有 sessionIds）**

1. 立刻：AI框 list + History  
2. 当前会话命中且 pageActive → 立刻 getMessageList  
3. 命中且 !pageActive → 不调 getMessageList，只记 pending  

**激活（pageActive 变为 true）**

1. 若 pending → getMessageList（当前会话）  
2. getLastSessionMessage → **只**用返回的记忆字段回写记忆栏（不改消息列表 / 不换会话）  
3. 既有 build_version 验版（可与上并行策略由宿主决定；现实现串在激活末尾）

## 边界情况

| 场景 | 预期 |
|------|------|
| 推送未命中当前会话 | 不记 pending；不刷消息 |
| 停在其它 AiBrowser tab 时系统窗切回 | docVisible=true 但 shellActive=false → 不激活冲刷 |
| 关 AI 面板 | 壳发 deactivate |
| 移动端 | 不做延后；始终当 pageActive |

## 错误处理策略

- 延后消息刷新失败：打日志，不阻断下次推送  
- 只刷记忆失败：打日志，不改消息、不弹问候语  

## 联调坑

- AiBrowser 内切 tab **不改** document.visibility → 必须靠壳 deactivate/checkVersion，不能只盯 visibility。  
- 若只用单一 pageActive 布尔，系统窗切回会把 deepseek 态误激活 → 必须拆 docVisible / shellActive。

## 与 bridge 的交互

| 方向 | type | 时机 |
|------|------|------|
| 壳→web | `aiBoxDeactivate` | 切离个人 AI tab / 关面板 |
| 壳→web | `aiBoxCheckVersion` | 切回个人 AI（兼激活 + 验版） |
