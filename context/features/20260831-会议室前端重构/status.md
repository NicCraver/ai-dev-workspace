# Status：会议室前端重构

> 最后更新：2026-08-31（当前半格直到结束仍可预约）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 令牌 `--zx-*` + 旧名别名 | ✅ | — | — | — |
| 基础组件按需拷贝 | ✅ | — | — | — |
| 后台 chrome 替换 | ✅ | — | — | — |
| 预定 PC / 移动 chrome 替换 | ✅ | — | — | — |
| 自测通过（`pnpm test`） | ✅ | — | — | — |
| 接口联调 | — | — | — | — |

android / ios / desktop 不单独立项：会议室以内嵌 WebView 复用 meeting web。

meeting 仓库 `main` 工作区脏。web 单测 97 通过。

2026-08-31：当日当前 30 分钟格在结束前仍可点选（17:43 仍可选 17:30）；上一整格才算过期。`TL.nextOpen` 改为向下取整，PC/移动点击「已过期」判断与之一致。

2026-08-31 助手快捷指令走真实接口：找空闲用看板、我的会打开预定列表、取消最近一场走释放确认。

> 2026-08-31 晚：本轮会话只推进了 `20260828-aichat自定义时间范围`（ios / android），
> **未动 meeting 代码**。下面的脏区是上一轮重构留下的，原样待提交，非新产出。

未提交清单（`apps/meeting`，tip `398ae09`）：20 个已改文件（admin 四页 + RoomFilters/RoomTable、
移动预定各 sheet/modal、`booking/time.js` 与其单测、`style.css` / `styles/tokens.css` / `uno.config.js`），
5 项未跟踪（`components/base/`、`components/popup/`、`DialogOrSheet.vue`、
`tests/designChrome.test.js` 与 `tests/tokens.test.js`、`styles/element.css` 与 `styles/vant.css`）。

## 待办 / 阻塞

- (web) 设计系统重构（admin chrome、tokens、base 组件）仍有未提交脏区
- (web) 浏览器过一遍：引导五步、主按钮预约、AI「立即预约」预填提交

## 关键决策记录

- 2026-08-31 设计系统对齐，不改业务流程与接口
- 2026-08-31 按需拷贝进 `apps/meeting/web`，不 submodule、不整库搬
- 2026-08-31 现有弹窗保持 `v-if`；命令式 `showXxx` 只给新弹窗
- 2026-08-31 顺序：令牌 → 组件 → 后台 → 预定 PC → 移动
- 2026-08-31 `AcDialog` 默认禁止点遮罩 / Esc 关闭，视为允许的 UX 差异
- 2026-08-31 周视图跨天拖选保持已定钟点，不随下一列左缘跳到 00:00
- 2026-08-31 手动预约 / AI 找空闲 / driver.js 引导共用同一预约弹窗与 POST /bookings
- 2026-08-31 当日当前半格（含已开始未结束）可预约，整格结束后才禁用
