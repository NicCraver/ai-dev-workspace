# Status：会议室前端重构

> 最后更新：2026-08-31（PC 工具栏文字按钮 + AI chip 纵向 + 预约区间距）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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

meeting 仓库 `main` 工作区脏。web 单测 88 通过。已修周模式拖选跨天把钟点折到早上，以及轴上「现在」与选区时刻重叠。

2026-08-31 PC 预定 chrome：快捷 chip 改为纵向；「回到今天」「切换用户」改为文字按钮；「预约会议室」与「我的预定」间距 16px。

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
