# Status：智能会议室 · 助手 agent 预定

> 最后更新：2026-08-27（补齐 web/server 自动化测试：HTTP 全路由 + 前端纯函数边角） ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 一句话

预定首页 Grok 风格 bot：说话查空房（结果卡）或协助新预定（草稿确认后才写库）。OpenAI 兼容 LLM，工具只在服务端。

## 平台矩阵

本期只改 `apps/meeting`（WebView 内嵌），原生三端不改。

| 任务 | meeting-web | meeting-server | android | ios | desktop |
|------|-------------|----------------|---------|-----|---------|
| 设计（spec） | ✅ | ✅ | — | — | — |
| 契约 `contracts/meeting/agentTurn` | ✅ | ✅ | — | — | — |
| 实现计划（plan） | ✅ | ✅ | — | — | — |
| 空档工具 + draft 门闩 | ✅ | ✅ | — | — | — |
| agent turn SSE | ✅ | ✅ | — | — | — |
| FAB 输入条 / 卡片 / 表情 | ✅ | — | — | — | — |
| 查询卡 + 确认/推荐 | ✅ | — | — | — | — |
| 首屏个性化快捷建议 | ✅ | ✅ | — | — | — |
| 联调与浏览器验收 | 🚧 | ✅ | — | — | — |
| 自动化测试（HTTP + 前端纯函数） | ✅ | ✅ | — | — | — |

## 待办 / 阻塞

- (meeting) LLM 配置：`server/.env.example` 复制为 `server/.env`（gitignore）。变量 `MEETING_LLM_BASE_URL` / `MEETING_LLM_API_KEY` / `MEETING_LLM_MODEL`。key 为空时仍返回 M4000「助手未配置」。
- (meeting) 有 key 后补一轮真实 LLM 联调（理解 + 推荐档 + 确认写库）。
- (meeting) 2026-08-27 助手调试日志带循环轮次：服务端 `[agent] #n cat title`，面板标题 `第n轮 · …`。当前每轮 message 只打一次 LLM，因此多为第1轮；同一次 `complete` 多次调用会递增。
- (meeting) 2026-08-27 自动化测试：`pnpm test` → server 107、web 46，均绿。新增 `server/tests/httpApi.test.ts` 覆盖 CORS/404/房间字典 CRUD/预定冲突释放/中文头/助手 SSE 错误；web 补齐筛选、时间轴、SSE 残帧、debug 开关、确认卡返回。未加 Playwright 浏览器 E2E（现有栈是 node:test + Hono `app.request`）。

## 关键决策记录

- 2026-08-27 确认卡只点改主题；房间/时间靠推荐档或再打一句。
- 2026-08-27 LLM 走会议服务 OpenAI 兼容环境变量，不接公司网关。
- 2026-08-27 范围：查 + 新订；释放/改期不做。
- 2026-08-27 写库仅 `confirm` + 有效 draft；点档不直接预定。
- 2026-08-27 查询不改首页筛选；成功只刷新看板 + toast。
- 2026-08-27 快捷建议按上海时区对齐下一半点；至少两条相同历史偏好后，用常用时段、时长和会议室替换通用下午建议。
