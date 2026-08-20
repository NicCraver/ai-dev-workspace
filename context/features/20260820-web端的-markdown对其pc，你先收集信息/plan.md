# web markdown 表格对齐 PC Implementation Plan

> **For agentic workers:** 本仓库无 web 单测；按任务验收，不要为了 TDD 新加测试框架。步骤用 checkbox 跟踪。

**Goal:** 个人 AI 框与「AI 优化文本」里的 markdown 表格，配色和左右横滚对齐 PC 会话卡片。

**Architecture:** markdown 展示态打开 Tiptap Table 的 `renderWrapper`（每张表一个 `.tableWrapper`）。皮肤与横滚 CSS 只写在 `AcMarkdown.vue`，不改输入框/人格设定。token 抄 `context/design/markdown-style-tokens.md` 表格行。

**Tech Stack:** Vue 3 + Tiptap 3.22 Table + `AcMarkdown.vue` scoped less。

## Global Constraints

- 只改 web；PC / 安卓 / iOS 代码不动。
- 禁止改标题、代码、引用、列表、折叠、`breaks`。
- 禁止左右渐变遮罩。
- `Table.renderWrapper` 仅在 `flags.markdownAsHtml` 为真时打开。
- 不要用 JS 把 table 从 ProseMirror DOM 里挪走再包一层。
- web 无 ESLint / 无测试脚本；类型检查用 `pnpm exec vue-tsc --noEmit`。
- 提交：context 仓库按 wrapup；`apps/web` 等用户决定，本 plan 不强制 commit web。

---

### Task 0: 切 web 功能分支

**Files:** 无代码。仓库 `apps/web`。

**端:** web

- [x] **Step 1:** 从当前 HEAD 切 `feat/web-markdown-table-align-pc`（当前在 `feat/gfm-markdown`，避免和别的 GFM 提交混在一起）。

```bash
cd apps/web
git checkout -b feat/web-markdown-table-align-pc
```

Expected: 当前分支名为 `feat/web-markdown-table-align-pc`。

---

### Task 1: markdown 展示态打开表格外壳

**Files:**

- Modify: `apps/web/src/components/editor/EditorWrapper.vue`（`Table.configure`，约 187–189 行）

**端:** web

**Interfaces:**

- Consumes: 已有 `isMarkdownAsHtml()`（`flags.isMarkdown && flags.markdownAsHtml`）。`AcMarkdown` 已传 `{ isMarkdown: true, markdownAsHtml: true }`。
- Produces: 直播 DOM 在 `resizable: false` 时一律有 `.tableWrapper`（TableView）。`getHTML()`：展示态带外壳，未开 `markdownAsHtml` 的编辑器仍出裸 `<table>`。横滚皮肤只在 `.at-answer` 下生效。

- [x] **Step 1:** 把 Table 配置改成：

```js
Table.configure({
  resizable: false,
  renderWrapper: isMarkdownAsHtml()
})
```

不要给所有 EditorWrapper 开 `renderWrapper`。不要改 `resizable`。

- [x] **Step 2:** 目测 `AiTextOptimizerPopup` / `AiMsgCard` 都用 `AcMarkdown`，无需改调用方。确认人格设定 `EditorWrapper` 没有 `markdownAsHtml`。

---

### Task 2: `AcMarkdown` 表格皮肤 + 横滚

**Files:**

- Modify: `apps/web/src/components/common/AcMarkdown.vue` 的 `.at-answer` 里 `:deep(table)` / `th` / `td` 段（约 272–299 行）

**端:** web

**Interfaces:**

- Consumes: Task 1 的 `.tableWrapper`
- Produces: 与 PC `.md-table-wrap` + `table` 等价的展示样式（无渐变罩、无 `is-h-scroll` JS）

- [x] **Step 1:** 用下面整段替换现有 table / th / td 规则。不要动 h1–h6、ul/ol、`.ProseMirror` 段间距。

```less
  // 横滚只发生在表格外壳，避免整段 Markdown（标题）跟着横移。
  // 类名来自 Tiptap Table renderWrapper（仅 markdownAsHtml 展示态）。
  :deep(.tableWrapper) {
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    margin: 0.5em 0;
    padding-bottom: 8px;

    &::-webkit-scrollbar {
      height: 6px;
      display: block;
    }
    &::-webkit-scrollbar-thumb {
      border-radius: 3px;
      background-color: rgba(0, 0, 0, 0.35);
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }

  :deep(table) {
    width: max-content;
    max-width: none;
    margin: 0;
    border-collapse: collapse;
    table-layout: auto;
    overflow: visible;
    background: transparent;
    border-color: rgba(0, 0, 0, 0.12);
  }

  :deep(th),
  :deep(td) {
    padding: 0.35em 0.6em;
    text-align: left;
    vertical-align: top;
    border: 1px solid rgba(0, 0, 0, 0.12);
    white-space: nowrap;
    word-break: normal;
  }

  :deep(th) {
    font-weight: 600;
    background: rgba(0, 0, 0, 0.04);
  }

  :deep(td > :last-child),
  :deep(th > :last-child) {
    margin-bottom: 0;
  }

  // prose presetTypography 默认斑马纹，PC / 三端 token 都没有
  :deep(tr:nth-child(2n)) {
    background: transparent;
  }
```

- [x] **Step 2:** 确认 `htmlToMarkdown.js` 的 marked/tiptap 序列化管线不依赖旧的 `table-layout: fixed`（复制 markdown 用，不吃这套 CSS）。无需改该文件。

---

### Task 3: token 表补一句适用范围

**Files:**

- Modify: `context/design/markdown-style-tokens.md` 文首「不适用 web」那句

**端:** 文档（context）

- [x] **Step 1:** 改成：token 表仍以 PC/安卓/iOS 消息气泡为主；**web `AcMarkdown` 仅表格行对齐本表**（标题/代码/引用/列表仍是 AI 框自有皮肤）。

---

### Task 4: 类型检查

**Files:** 无新文件。

**端:** web

- [x] **Step 1:** 在 `apps/web` 跑：

```bash
pnpm exec vue-tsc --noEmit
```

Expected: exit 0。本仓库无单测脚本，不要 invent `pnpm test`。

---

### Task 5: status / impl-notes

**Files:**

- Modify: `context/features/20260820-web端的-markdown对其pc，你先收集信息/status.md`
- Modify: `context/features/20260820-web端的-markdown对其pc，你先收集信息/impl-notes.md`

**端:** context

- [x] **Step 1:** 矩阵按本 plan 的 Task 填；代码写完但用户未真机验收的格子标 🚧；待办写明「真机看宽表横滚」。
- [x] **Step 2:** impl-notes 只记平台无关结论：展示态必须有表级横滚外壳，否则气泡 `overflow-hidden` 会裁表；配色用半透明黑；nowrap + 横滚成对出现。
