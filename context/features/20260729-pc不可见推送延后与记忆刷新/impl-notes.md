# Impl Notes：pc不可见推送延后与记忆刷新

> 平台无关。移植端若做常驻页可见性，照此实现。

## 状态流转

```
pageActive = docVisible && shellActive

初始：docVisible=文档可见；shellActive=true

文档 hidden          → docVisible=false
文档 visible         → docVisible=true；若 shellActive 则「激活」
壳 deactivate        → shellActive=false
壳 checkVersion/激活 → shellActive=true +「激活」
```

推送且 `!pageActive` → **整次延后**（不调 list / History / Chat），合并 `pendingPushSessionIds`。

壳侧（desktop）：用户不在「个人 AI 可见 tab」时 **不向 iframe post**，只更新入口角标；sessionIds 记 `deferredPushSessionIds`，切回再 flush。

## 接口调用时序

**推送（有 sessionIds）且 pageActive**

1. AI框 list + History  
2. 当前会话命中 → getMessageList  

**推送且 !pageActive**

- 不调上述接口；只记 pending（web）/ deferred（壳）

**激活（pageActive 变为 true）**

1. 若有 pending → 按激活态完整跑推送刷新  
2. `getAgentDataRange`（优先 `accountId`+`agentId`）→ **只**回写记忆栏（**不用** `getLastSessionMessage`，避免清未读/角标）  
3. 既有 build_version 验版  

壳 `aiBoxCheckVersion` 可能双发（面板 visible + selectWebview）：web 对激活工作 **300ms 去重**（仍置 `shellActive=true`）。

## 边界情况

| 场景 | 预期 |
|------|------|
| 不可见时推送 | 左侧角标保留；web 不刷，避免清未读导致角标一闪 |
| 停在其它 AiBrowser tab 时系统窗切回 | 不激活冲刷 |
| 关 AI 面板 | 壳 deactivate；后续推送只 deferred |
| 移动端 | 不做延后 |

## 错误处理策略

- 延后刷新失败：打日志，不阻断下次推送  
- 只刷记忆失败：打日志，不改消息  

## 联调坑

- **只延后消息不够**：不可见时仍刷 list/History 也会把未读清掉，角标一闪。须整次延后。  
- AiBrowser 内切 tab 不改 visibility → 靠 deactivate；且壳在非个人 AI 可见态不要 post。  
- `pageActive` 须拆 docVisible / shellActive。  
- **2026-07-31**：激活用 `getLastSessionMessage` 会清当前会话未读 → 角标误清；已改为 `getAgentDataRange`。桌面「推送改 sider 强制切个人 AI」仍可误激活，须桌面另改。

## 与 bridge 的交互

| 方向 | type | 时机 |
|------|------|------|
| 壳→web | `aiBoxDeactivate` | 切离个人 AI tab / 关面板 |
| 壳→web | `aiBoxCheckVersion` | 切回个人 AI（兼激活 + 验版） |
| 壳→web | `aiBoxSendMessage` | **仅**个人 AI 当前可见时；否则壳本地 deferred |
