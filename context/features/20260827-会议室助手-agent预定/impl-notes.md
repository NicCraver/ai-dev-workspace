# Impl Notes：智能会议室 · 助手 agent 预定

## 首屏快捷建议

- `GET /meetingApi/agent/suggestions` 是普通 `M0000` 信封接口，需现有 corp/user 鉴权头；契约见 `context/contracts/meeting/agentSuggestions.d.ts`。
- 服务端统一按 `Asia/Shanghai` 计算：下一半点、下一半点 30 分钟、今天/明天下午、明天上午。超出 09:00–18:00 时顺延到下一工作日时间窗。
- 历史偏好只统计当前企业、当前用户、未释放的最近 30 条预订；同一“会议室 + 开始时间 + 时长”至少出现 2 次才替换通用建议，避免单次预订造成误推荐。
- 快捷项只包含 `label` 和自然语言 `message`。点击后仍走现有 `POST /agent/turn` 的 `action=message`，不产生 draft，不直接写 booking。
- 建议接口失败时前端静默隐藏选项，输入框仍可使用。

## 联调坑

- 2026-08-27 浏览器验收时，快捷建议接口与点击链路正常；当前本地 `server/.env` 的 Ollama Cloud 凭据返回 401 Unauthorized。该错误属于 LLM 配置，不是建议接口或按钮逻辑错误。
