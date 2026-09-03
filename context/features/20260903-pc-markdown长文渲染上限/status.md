# Status：PC markdown 长文渲染上限（去掉 20000 字符墙）

> 最后更新：2026-09-03 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

用户在**合并转发详情窗**看到一条 AI 卡片（个人 AI 框生成的《交付顺畅工作标准》完整版）渲染成一坨：
`#`、`**`、`<reference data-ref="...">` 全部原样显形，且**换行全部塌掉**挤成一段。同一条消息安卓、iOS 正常。

排查结论：**与合并转发无关**。合并转发只是把整条消息 JSON 传 OSS 再拉回（`chat-box.vue:1446` 上传、
`dialog-ipc.js:55` 读回、`winbox-wrapper.vue:799` 只补 `messageType`），正文一个字没动；详情窗用的
就是会话里那个 `msg-actioncard.vue`。真正的原因是 PC 的 20000 字符上限。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 根因定位（三端行为对比） | — | ✅ | ✅ | ✅ |
| 去掉 20000 字符上限 | — | — | — | ✅ 已提交 push |
| 单测调整（超长渲染 + escapeHtml 覆盖） | — | — | — | ✅ 51 passed |
| lint | — | — | — | ✅ 无告警 |
| 运行时自测（会话内 + 合并转发详情） | — | — | — | 🚧 dev:prod 已起，用户看效果中 |

安卓 / iOS 本回合只读代码做对比，未改。web 不涉及。

## 三端实际行为（排查产物）

| 端 | 长文走哪条路 | 观感 |
|---|---|---|
| 安卓 | **压根不查长度**。AI 卡片主路径 `ActionCardMessageItemProvider.java:265` `ZXMarkdownSegmenter.split` → `markwon.render`；`MAX_MARKDOWN_LENGTH` 只在 `ZXMarkwonFactory.renderSafely`（`:245`）和流式渲染里，卡片主路径没接 | 正常 |
| iOS | 查。`ZXMarkdownManager.m:802` 超 `ZXMarkdownCMarkLengthLimit = 20000` → `zx_legacyBlocksForText`（`:877`）→ 老正则 `renderMarkdownBy:` | 标题/加粗还在，看着正常 |
| PC（修前） | 查。`markdownUtils.js:170` 超 20000 → `escapeHtml(原文)` 经 v-html 塞进 `.md-html-wrapper`（`markdown.scss:15`，无 `white-space`）→ 换行全塌 | 一坨 |

即「三端阈值写了三份，只有 PC 真的挡在长文前，且 PC 的兜底呈现最差」。

## 本次改动（apps/desktop，`master-3.4.27`，commit `3570d8c5` 已 push）

| 文件 | 改动 |
|------|------|
| `src/lib/markdownUtils.js` | 删 `MAX_MARKDOWN_LENGTH = 20000`；兜底判断只留 `if (!USE_MARKDOWN)`；导出 `escapeHtml` 供单测；原地留注释记三端差异 |
| `test/unit/markdown-render.spec.js` | 原「超长→转义原文」反转为「超长照常渲染出标题/段落」＋新增「超长正文里的表格照常出 `md-table-wrap`」；转义回归改为直测 `escapeHtml`（`<` `>` `&` `"` 四种） |

## 实测：解析开销不构成保留上限的理由

| 正文 | 解析耗时 | 产出 HTML |
|---|---|---|
| 1.1 万字符 | 5ms | 2.8 万 |
| 3.7 万字符 | 11ms | 9.5 万 |
| 11 万字符 | 25ms | 28 万 |

线性且很低。真要卡是卡在 DOM 插入与排版，不在 markdown-it。

## 本回合各端现状（code-status）

| 端 | 分支 | 脏区 | 说明 |
|---|---|---|---|
| desktop | `master-3.4.27` | 仅本地调试 3 件 | `3570d8c5` 已 push。rebase 上游 `20edf0e4`（3.4.26→3.4.27）时 `package.json` 冲突，按本地调试约定解成 `name=zhixin-test` / `version=3.4.27-test`，**未 stage 未提交** |
| android / ios | 未切换 | 未改 | 仅读代码做行为对比 |
| context | main | 本功能文档 | |

## 待办 / 阻塞

- **运行时自测未完成**：`npm run dev:prod` 已起（Node 24 会让 webpack4 报 `ERR_OSSL_EVP_UNSUPPORTED`，须用 `~/.vite-plus/js_runtime/node/14.21.3`）。要确认：会话内长卡渲染、「查看更多」展开收起、合并转发详情窗同条、滚动是否卡。
- **兜底走错分支的老问题仍在**（本次只按用户要求去上限）：`msg-actioncard.vue:209` / `msg-reply-poll.vue:136` 的 `isMarkdownText` 只判 `isMarkdown()`，不看 `USE_MARKDOWN` 也不看异常，解析异常时依旧「转义原文 + 无 `pre-wrap`」＝换行塌。建议后续导出 `shouldRenderMarkdown()` 统一判据。
- **上不封顶的风险**：AI 生成长度没有天花板，10 万字级别只测了解析耗时，没测真实 DOM 排版。滚动明显顿的话再定一个大上限（如 20 万字）。
- **安全**：`markdown-it` 开 `html: true` 不做 sanitize。以前超长正文被兜底顺手转义，现在与短文一致原样透传——不是新洞，是把短文早有的面扩到长文，需产品/安全知情。
- **三端不一致待决**：iOS 仍有 20000 上限（超长退老正则）。要不要跟 PC / 安卓对齐，单独立项。
