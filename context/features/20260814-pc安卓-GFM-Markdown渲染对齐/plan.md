# PC + 安卓 GFM Markdown 渲染对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 PC（Electron）与安卓两端的机器人/智能体消息，按 GFM 规范正确渲染，并对齐 iOS 上一轮踩出来的行为规则。

**Architecture:** 两套独立管线各自就地补齐，不共享代码。PC 侧改 `markdown-it` 配置 + 自写两条 renderer/core rule + CSS 横滚容器 + 折叠按块取舍；安卓侧先把 4 处散落的 `Markwon.builder()` 收敛成单一工厂，再把正文从单 `TextView` 改成「富文本段 / 表格段」段栈，表格段用 `HorizontalScrollView` 包 `TableLayout`。

**Tech Stack:** PC = Electron 19 + Vue 2.7 + `markdown-it` 14.1.0 + vitest 2；安卓 = Markwon 4.6.2（commonmark-java）+ 原生 View。

## Global Constraints

以下约束适用于**每一个**任务，不再逐条重复：

- **PC 禁止 `npm install` / `pnpm install`，禁止删 `node_modules` 重装。** 不得引入任何新 npm 包。
- **PC 禁用可选链 `?.` 与空值合并 `??`**，一律用 `&&` / `||` 兜底（Electron 19 + Node 14 构建链）。
- **PC 提交禁带** `.env.test`、`electron-builder.yml`、`package.json`、`package-lock.json`。`git add` 时逐个文件点名，不要 `git add -A`。当前工作区这 3 个文件已脏，是切分支带过来的。
- 两端注释一律**中文**。
- PC 分支 `feat/gfm-markdown`（基点 `763cd15e`）；安卓分支 `feat/gfm-markdown`（基点 `f5f2d0ce3`）。两端已切好。
- 行为基准：<https://github.github.com/gfm/>。用例清单见 `spec-port-pc-android.md` 第 4 节（30 条）。
- 两端**均无流式打字机链路**，不实现流式降级。
- 折叠阈值**不做三端统一**：PC 保持 400px，安卓保持 480dp。

---

## 文件结构

### PC（`apps/desktop`）

| 文件 | 责任 | 动作 |
|------|------|------|
| `src/lib/markdownUtils.js` | markdown-it 实例配置、自定义标签占位符、兜底、开关 | 修改 |
| `src/lib/markdownFoldModel.js` | 折叠高度计算的纯函数（无 DOM 依赖，可单测） | 新建 |
| `src/renderer/components/chitchat/message/msgtype/msg-actioncard.vue` | 气泡组件：表格样式、横滚容器、折叠、AI 卡片判定 | 修改 |
| `test/unit/markdown-render.spec.js` | `markdownUtils` 渲染行为单测 | 新建 |
| `test/unit/markdown-fold-model.spec.js` | 折叠高度计算单测 | 新建 |
| `src/renderer/components/debug/MarkdownGfmCases.vue` | 30 条用例对照页（**验完删**） | 新建后删除 |

### 安卓（`apps/android`）

| 文件 | 责任 | 动作 |
|------|------|------|
| `basis_function_api/build.gradle` | Markwon 依赖 | 修改 |
| `IM/src/main/java/com/im/message_type/robot/ZXMarkwonFactory.java` | Markwon 单一配置入口 + 兜底 + 开关 | 新建 |
| `IM/src/main/java/com/im/message_type/robot/ZXMarkdownSegment.java` | 段模型（富文本段 / 表格段） | 新建 |
| `IM/src/main/java/com/im/message_type/robot/ZXMarkdownSegmenter.java` | commonmark AST → 段序列 | 新建 |
| `IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java` | `HorizontalScrollView` + `TableLayout` 表格控件 | 新建 |
| `IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java` | 段栈容器 + 按段折叠 | 新建 |
| `IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java` | 气泡 provider：接段栈、折叠、AI 卡片判定 | 修改（1038 行，4 处 builder） |
| `IM/src/main/res/layout/rc_item_action_card_message.xml` | 布局：`tv_content` 旁挂段栈容器 | 修改 |
| `IM/src/main/java/com/im/debug/MarkdownGfmCasesActivity.java` | 30 条用例对照页（**验完删**） | 新建后删除 |

---

## Task 1 (desktop)：markdown-it 选项补齐 + 兜底 + 开关

**Files:**
- Modify: `apps/desktop/src/lib/markdownUtils.js:1-4`（实例构造）、`:77-108`（`convertMarkdownToHtml`）
- Test: `apps/desktop/test/unit/markdown-render.spec.js`（新建）

**Interfaces:**
- Consumes: 无
- Produces: `convertMarkdownToHtml(markdown, agentKnowledgeList, refList) -> string`（签名不变，行为增强）；模块内常量 `USE_MARKDOWN`（boolean）、`MAX_MARKDOWN_LENGTH`（number = 20000）

- [ ] **Step 1: 写失败的测试**

新建 `apps/desktop/test/unit/markdown-render.spec.js`：

```js
import { describe, expect, test } from "vitest";
import { convertMarkdownToHtml } from "../../src/lib/markdownUtils";

describe("markdown-it 选项", function () {
  test("软换行按 <br> 渲染（spec I8）", function () {
    var html = convertMarkdownToHtml("第一行\n第二行");
    expect(html).toContain("<br>");
  });

  test("裸 URL 自动成链接（spec I7）", function () {
    var html = convertMarkdownToHtml("访问 https://example.com 看看");
    expect(html).toContain('<a href="https://example.com"');
  });

  test("删除线生效", function () {
    var html = convertMarkdownToHtml("~~划掉~~");
    expect(html).toContain("<s>划掉</s>");
  });

  test("内联 HTML 原样透传（spec 5.1）", function () {
    var html = convertMarkdownToHtml('**<span style="color:blue;">值班</span>**');
    expect(html).toContain('<span style="color:blue;">');
    expect(html).toContain("<strong>");
  });
});

describe("兜底", function () {
  test("超长正文直接返回转义原文，不进解析器", function () {
    var long = "a".repeat(20001);
    var html = convertMarkdownToHtml(long);
    expect(html).not.toContain("<p>");
    expect(html).toContain("aaa");
  });

  test("空输入返回空串，不抛", function () {
    expect(convertMarkdownToHtml("")).toBe("");
    expect(convertMarkdownToHtml(null)).toBe("");
  });

  test("含 < > & 的原文在兜底路径下被转义", function () {
    var long = "<script>x</script>" + "b".repeat(20001);
    var html = convertMarkdownToHtml(long);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-render.spec.js`
Expected: FAIL —「软换行」「裸 URL」「删除线」「超长正文」「空输入」几条红。

- [ ] **Step 3: 改实例配置与兜底**

`apps/desktop/src/lib/markdownUtils.js` 顶部，把第 4 行替换为：

```js
// 全局开关：线上出问题时改成 false，所有正文回退纯文本显示，无需发版改逻辑
const USE_MARKDOWN = true;
// 正文超过该长度直接走纯文本，避免超长文本的解析开销
const MAX_MARKDOWN_LENGTH = 20000;

// breaks: 聊天场景单换行按 <br> 显示（GFM 原义是当空格，此处是产品选择，三端一致）
// linkify: 裸 URL 自动成链接
// html: 后端正文混用 <span style="color:x"> 上色，必须原样透传
const md = new MarkdownIt({ html: true, breaks: true, linkify: true });

/** HTML 转义，兜底路径下把原文安全地塞进 DOM */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

再把 `convertMarkdownToHtml`（原 `:77`）整体替换为：

```js
function convertMarkdownToHtml(markdown, agentKnowledgeList, refList) {
  if (!markdown) {
    return "";
  }
  // 兜底 1：开关关闭或正文超长时，不进解析器，直接转义原文
  if (!USE_MARKDOWN || String(markdown).length > MAX_MARKDOWN_LENGTH) {
    return escapeHtml(markdown);
  }
  try {
    markdown = fixMarkdownBlankLines(markdown);
    const refMap = (agentKnowledgeList || []).reduce((acc, cur) => {
      acc[cur.docId] = cur;
      return acc;
    }, {});
    const _refList = refList || [];

    // 将完整的自定义标签对（开+闭）或自闭合标签整体替换为占位符，保护其不被 markdown-it 处理
    const placeholders = [];
    let processed = markdown.replace(
      /<(?:reference|illustration)\s+[^>]*(?:><\/(?:reference|illustration)>|\/>)/gi,
      (match) => {
        placeholders.push(match);
        return `%%CUSTOMTAG_${placeholders.length - 1}%%`;
      }
    );

    let html = md.render(processed);

    // 恢复占位符并替换为最终 HTML
    html = html.replace(/%%CUSTOMTAG_(\d+)%%/g, (_match, idx) => {
      return replaceSingleTag(placeholders[parseInt(idx)], refMap, _refList);
    });

    return html;
  } catch (e) {
    // 兜底 2：解析异常不让消息不可读，静默回退纯文本，只打日志
    console.error("[markdown] 渲染失败，回退纯文本", e);
    return escapeHtml(markdown);
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-render.spec.js`
Expected: PASS，9 条全绿。

- [ ] **Step 5: 提交**

```bash
cd apps/desktop
git add src/lib/markdownUtils.js test/unit/markdown-render.spec.js
git commit -m "feat(markdown): markdown-it 开启 breaks/linkify，补解析兜底与全局开关"
```

---

## Task 2 (desktop)：任务列表 `- [ ]` / `- [x]`

**Files:**
- Modify: `apps/desktop/src/lib/markdownUtils.js`（紧接 Task 1 的 `md` 实例之后）
- Test: `apps/desktop/test/unit/markdown-render.spec.js`（追加 describe）

**Interfaces:**
- Consumes: Task 1 的 `md` 实例
- Produces: 无新导出，`convertMarkdownToHtml` 行为增强

> 不引 `markdown-it-task-lists`（Global Constraints 禁装包），自写 core ruler。

- [ ] **Step 1: 写失败的测试**

在 `test/unit/markdown-render.spec.js` 末尾追加：

```js
describe("任务列表（spec L4）", function () {
  test("未勾选项渲染成 disabled checkbox，不显示原始括号", function () {
    var html = convertMarkdownToHtml("- [ ] 待办事项");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("disabled");
    expect(html).not.toContain("[ ]");
    expect(html).toContain("待办事项");
  });

  test("已勾选项带 checked", function () {
    var html = convertMarkdownToHtml("- [x] 已完成");
    expect(html).toContain("checked");
    expect(html).not.toContain("[x]");
  });

  test("大写 X 同样识别", function () {
    var html = convertMarkdownToHtml("- [X] 已完成");
    expect(html).toContain("checked");
  });

  test("非列表项里的 [ ] 不被改写", function () {
    var html = convertMarkdownToHtml("数组下标写作 [x] 这种形式");
    expect(html).not.toContain("checkbox");
    expect(html).toContain("[x]");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-render.spec.js -t "任务列表"`
Expected: FAIL —「未勾选项渲染成 disabled checkbox」等 3 条红（第 4 条本来就该绿）。

- [ ] **Step 3: 实现 core ruler 规则**

`markdownUtils.js` 里 `const md = new MarkdownIt(...)` 之后插入：

```js
/**
 * 任务列表规则：把列表项开头的 [ ] / [x] 换成 checkbox。
 * markdown-it 本体不含此扩展，工作区禁止新增依赖，故自写一条 core rule。
 * 只作用于 inline token 的首个 text 子 token，且要求其父级是列表项的段落，
 * 避免误伤正文里出现的 "[x]" 字面量。
 */
md.core.ruler.after("inline", "zx_task_list", function (state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "inline") {
      continue;
    }
    // 结构必是：list_item_open -> paragraph_open -> inline
    const isInListItem =
      i >= 2 &&
      tokens[i - 1].type === "paragraph_open" &&
      tokens[i - 2].type === "list_item_open";
    if (!isInListItem) {
      continue;
    }
    const children = tokens[i].children;
    if (!children || !children.length || children[0].type !== "text") {
      continue;
    }
    const matched = children[0].content.match(/^\[([ xX])\]\s+/);
    if (!matched) {
      continue;
    }
    const checked = matched[1] !== " ";
    // 去掉 "[x] " 前缀
    children[0].content = children[0].content.slice(matched[0].length);
    // 插入一个 checkbox html_inline token
    const box = new state.Token("html_inline", "", 0);
    box.content =
      '<input class="md-task-checkbox" type="checkbox" disabled' +
      (checked ? " checked" : "") +
      "> ";
    children.unshift(box);
    // 标记所在 li，供样式去掉列表符号
    tokens[i - 2].attrJoin("class", "md-task-item");
  }
  return true;
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-render.spec.js`
Expected: PASS，13 条全绿。

- [ ] **Step 5: 提交**

```bash
cd apps/desktop
git add src/lib/markdownUtils.js test/unit/markdown-render.spec.js
git commit -m "feat(markdown): 自写 core rule 支持任务列表 checkbox，不引新依赖"
```

---

## Task 3 (desktop)：表格包横滚容器 + 表格配色

**Files:**
- Modify: `apps/desktop/src/lib/markdownUtils.js`（Task 2 规则之后追加 renderer rule）
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msgtype/msg-actioncard.vue:659-712`（非 scoped 的 `<style lang="scss">` 块）
- Test: `apps/desktop/test/unit/markdown-render.spec.js`（追加 describe）

**Interfaces:**
- Consumes: Task 1 的 `md` 实例
- Produces: 渲染产物中表格外层多一层 `<div class="md-table-wrap">`

- [ ] **Step 1: 写失败的测试**

追加到 `test/unit/markdown-render.spec.js`：

```js
describe("表格（spec T1/T7）", function () {
  var TABLE = ["| A | B |", "| --- | ---: |", "| 1 | 2 |"].join("\n");

  test("表格被横滚容器包裹", function () {
    var html = convertMarkdownToHtml(TABLE);
    expect(html).toContain('<div class="md-table-wrap">');
    expect(html.indexOf('<div class="md-table-wrap">')).toBeLessThan(
      html.indexOf("<table>")
    );
    expect(html).toContain("</table></div>");
  });

  test("对齐符生效（spec T4）", function () {
    var html = convertMarkdownToHtml(TABLE);
    expect(html).toContain("text-align:right");
  });

  test("同一条消息两个表格都被包裹（spec T2）", function () {
    var html = convertMarkdownToHtml(TABLE + "\n\n段落\n\n" + TABLE);
    var count = html.split('<div class="md-table-wrap">').length - 1;
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-render.spec.js -t "表格"`
Expected: FAIL —「表格被横滚容器包裹」「两个表格都被包裹」红。

- [ ] **Step 3: 加 renderer rule**

`markdownUtils.js` 追加：

```js
/**
 * 宽表格必须能横向滚动查看（spec T7），markdown-it 直出的 <table> 没有滚动容器，
 * 这里在 table 前后各补一层 div，样式在 msg-actioncard.vue 的非 scoped style 里。
 */
md.renderer.rules.table_open = function () {
  return '<div class="md-table-wrap"><table>';
};
md.renderer.rules.table_close = function () {
  return "</table></div>";
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-render.spec.js`
Expected: PASS，16 条全绿。

- [ ] **Step 5: 改表格样式**

`msg-actioncard.vue` 的**非 scoped** style 块（`:659` 起的 `<style lang="scss">`）里，把现有的

```scss
  table {
    td,
    th {
      border-collapse: collapse;
      border: 1px solid rgb(238, 238, 238);
    }
  }
```

替换为：

```scss
  // 顺手修掉既有 typo：原为 17x
  h2 {
    font-size: 17px;
  }
  // 横滚容器：宽表格自己滚，纵向滚动仍归会话列表（overscroll-behavior-x: contain）
  .md-table-wrap {
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    margin: 8px 0;
  }
  table {
    border-collapse: collapse;
    // 表格配色一律用半透明黑：自己发的消息是淡蓝气泡，写死浅灰白会很突兀
    th {
      background: rgba(0, 0, 0, 0.04);
      font-weight: 600;
    }
    td,
    th {
      border: 1px solid rgba(0, 0, 0, 0.12);
      padding: 4px 8px;
      white-space: nowrap;
    }
  }
  // 任务列表项去掉列表符号，checkbox 自己就是标记
  li.md-task-item {
    list-style: none;
  }
  .md-task-checkbox {
    margin-right: 4px;
    vertical-align: middle;
  }
```

> 注意：原来的 `h2 { font-size: 17x; }`（`:670`）是无效值，一并删掉，由上面这条替代。

- [ ] **Step 6: lint 并提交**

```bash
cd apps/desktop
npm run lint
git add src/lib/markdownUtils.js src/renderer/components/chitchat/message/msgtype/msg-actioncard.vue test/unit/markdown-render.spec.js
git commit -m "feat(markdown): 表格加横滚容器与半透明黑配色，任务列表样式"
```

---

## Task 4 (desktop)：AI 卡片判定放宽

**Files:**
- Modify: `apps/desktop/src/lib/markdownUtils.js:188-200`（`actionCardListSummary`）
- Test: `apps/desktop/test/unit/markdown-render.spec.js`（追加 describe）

**Interfaces:**
- Consumes: 无
- Produces: 新导出 `isAgentCardMessage(message) -> boolean`

> 根因（spec 第 8 节）：个人 AI 框回复推送到本人会话时 `senderUserId` 是**本人 id**，没有 `ga_` 前缀，只看前缀会漏判。

- [ ] **Step 1: 写失败的测试**

追加到 `test/unit/markdown-render.spec.js`（顶部 import 加上 `isAgentCardMessage`）：

```js
import { isAgentCardMessage } from "../../src/lib/markdownUtils";

describe("AI 卡片判定（spec 第 8 节）", function () {
  test("发送人带 ga_ 前缀 → 是 AI 卡片", function () {
    expect(
      isAgentCardMessage({ senderUserId: "ga_123", content: {} })
    ).toBe(true);
  });

  test("发送人是本人 id 但 agentKnowledgeList 非空 → 仍是 AI 卡片", function () {
    expect(
      isAgentCardMessage({
        senderUserId: "u_self",
        content: { agentKnowledgeList: [{ docId: "d1" }] },
      })
    ).toBe(true);
  });

  test("普通机器人卡片（无前缀、无知识来源）→ 不是 AI 卡片", function () {
    expect(
      isAgentCardMessage({ senderUserId: "robot_1", content: { title: "公告" } })
    ).toBe(false);
  });

  test("空消息不抛", function () {
    expect(isAgentCardMessage(null)).toBe(false);
    expect(isAgentCardMessage({})).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-render.spec.js -t "AI 卡片判定"`
Expected: FAIL — `isAgentCardMessage is not a function`。

- [ ] **Step 3: 实现并接进摘要逻辑**

`markdownUtils.js` 里，`actionCardListSummary` 之前插入：

```js
/**
 * 是否按 AI 卡片渲染（解析角标 + 展示知识来源 + 启用折叠）。
 * 不能只看 senderUserId 前缀：个人 AI 框回复推送到本人会话时，
 * 发送人就是本人 id，没有 ga_ 前缀，只看前缀会漏判（spec 第 8 节）。
 */
function isAgentCardMessage(message) {
  if (!message) {
    return false;
  }
  const senderId = message.senderUserId || "";
  if (senderId.indexOf("ga_") === 0) {
    return true;
  }
  const content = message.content || {};
  const list = content.agentKnowledgeList;
  return !!(list && list.length);
}
```

`actionCardListSummary` 里把前缀判定换掉：

```js
  if (!title && isAgentCardMessage(message)) {
```

导出列表加上 `isAgentCardMessage`。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-render.spec.js`
Expected: PASS，20 条全绿。

- [ ] **Step 5: 组件侧接上**

`msg-actioncard.vue` 的 `<script>` 里，把 import 改为：

```js
import { isMarkdown, convertMarkdownToHtml, isAgentCardMessage } from "@/../lib/markdownUtils";
```

computed 里新增：

```js
    isAgentCard() {
      return isAgentCardMessage(this.message);
    },
```

`refListToShow`（`:216`）前置判定改为只在 `isAgentCard` 为真时才返回列表：

```js
    refListToShow() {
      if (!this.isAgentCard) {
        return [];
      }
      return this.refList
        .filter(({ showNum }) => showNum)
        .sort((a, b) => a.showNum - b.showNum);
    },
```

- [ ] **Step 6: lint 并提交**

```bash
cd apps/desktop
npm run lint
git add src/lib/markdownUtils.js src/renderer/components/chitchat/message/msgtype/msg-actioncard.vue test/unit/markdown-render.spec.js
git commit -m "fix(markdown): AI 卡片判定不再只看 ga_ 前缀，知识来源非空亦算"
```

---

## Task 5 (desktop)：折叠不切块

**Files:**
- Create: `apps/desktop/src/lib/markdownFoldModel.js`
- Create: `apps/desktop/test/unit/markdown-fold-model.spec.js`
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msgtype/msg-actioncard.vue:356-367`（`calNeedOpenClose`）、`:37-42`（模板 class）

**Interfaces:**
- Consumes: 无
- Produces: `pickFoldHeight(blocks, limit) -> number`，`blocks` 是 `[{ top: number, height: number }]`（相对内容容器顶部的偏移与自身高度），返回应当采用的裁剪高度（px）

> 现状是 `max-h-400px` 按像素硬切，会把表格截成一半。改成按顶层块边界取舍。

- [ ] **Step 1: 写失败的测试**

新建 `apps/desktop/test/unit/markdown-fold-model.spec.js`：

```js
import { describe, expect, test } from "vitest";
import { pickFoldHeight } from "../../src/lib/markdownFoldModel";

describe("pickFoldHeight", function () {
  test("块边界正好落在限高内 → 取该块底边", function () {
    var blocks = [
      { top: 0, height: 100 },
      { top: 100, height: 100 },
      { top: 200, height: 300 },
    ];
    // 第 3 块底边 500 > 400，取第 2 块底边 200
    expect(pickFoldHeight(blocks, 400)).toBe(200);
  });

  test("所有块都在限高内 → 返回限高（由调用方判定无需折叠）", function () {
    var blocks = [
      { top: 0, height: 50 },
      { top: 50, height: 50 },
    ];
    expect(pickFoldHeight(blocks, 400)).toBe(400);
  });

  test("第一块就超限高 → 整块显示，返回该块底边", function () {
    var blocks = [{ top: 0, height: 900 }];
    expect(pickFoldHeight(blocks, 400)).toBe(900);
  });

  test("空块列表 → 返回限高", function () {
    expect(pickFoldHeight([], 400)).toBe(400);
    expect(pickFoldHeight(null, 400)).toBe(400);
  });

  test("块底边恰好等于限高 → 采用该块", function () {
    var blocks = [
      { top: 0, height: 200 },
      { top: 200, height: 200 },
      { top: 400, height: 100 },
    ];
    expect(pickFoldHeight(blocks, 400)).toBe(400);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-fold-model.spec.js`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现纯函数**

新建 `apps/desktop/src/lib/markdownFoldModel.js`：

```js
/**
 * 折叠裁剪高度计算。
 * 裁剪线不得把表格或图片切一半（spec 第 7 节），所以裁剪高度必须落在
 * 顶层块的边界上，而不是死板的 limit 像素值。
 *
 * @param {Array<{top:number,height:number}>} blocks 顶层块的偏移与高度
 * @param {number} limit 折叠限高（px）
 * @returns {number} 应采用的裁剪高度
 */
function pickFoldHeight(blocks, limit) {
  if (!blocks || !blocks.length) {
    return limit;
  }
  var picked = 0;
  for (var i = 0; i < blocks.length; i++) {
    var bottom = blocks[i].top + blocks[i].height;
    if (bottom <= limit) {
      picked = bottom;
    } else {
      break;
    }
  }
  // 第一块就超限高：整块显示，不切
  if (picked === 0) {
    return blocks[0].top + blocks[0].height;
  }
  // 所有块都在限高内：交回 limit，由调用方判定无需折叠
  var last = blocks[blocks.length - 1];
  if (last.top + last.height <= limit) {
    return limit;
  }
  return picked;
}

export { pickFoldHeight };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-fold-model.spec.js`
Expected: PASS，5 条全绿。

- [ ] **Step 5: 组件接上**

`msg-actioncard.vue` 模板 `:37-42`，把写死的 `max-h-400px` 换成绑定：

```html
      <div
        class="actioncard-info flex flex-col overflow-hidden"
        :style="foldStyle"
        :class="{
          '[-webkit-mask-image:linear-gradient(to_top,transparent_40px,black_60px)]':
            isFold && isNeedOpen,
        }"
        ref="el"
        v-if="msgContent.title || msgContent.content"
      >
```

`data` 加 `foldHeight: 0`；computed 加：

```js
    foldStyle() {
      if (!this.isFold || this.needShowFull || !this.foldHeight) {
        return {};
      }
      return { maxHeight: this.foldHeight + "px" };
    },
```

`calNeedOpenClose`（`:356`）整体替换为：

```js
    // 折叠限高（px）。三端不统一：安卓 480dp、iOS 另有一套，
    // 字号行距屏宽都不同，对齐数值反而不对齐观感。
    calNeedOpenClose() {
      const el = this.$refs.el;
      if (!el || this.needShowFull) {
        this.isNeedOpen = false;
        return;
      }
      const LIMIT = 400;
      // 收集 markdown 正文的顶层块，裁剪线只落在块边界上，不切断表格/图片
      const wrapper = el.querySelector(".md-html-wrapper");
      const blocks = [];
      if (wrapper) {
        const wrapperTop = wrapper.getBoundingClientRect().top;
        const elTop = el.getBoundingClientRect().top;
        const offset = wrapperTop - elTop;
        const children = wrapper.querySelectorAll(":scope > div > *");
        for (let i = 0; i < children.length; i++) {
          const rect = children[i].getBoundingClientRect();
          blocks.push({
            top: rect.top - wrapperTop + offset,
            height: rect.height,
          });
        }
      }
      this.foldHeight = pickFoldHeight(blocks, LIMIT);
      this.isNeedOpen =
        el.scrollHeight > LIMIT || el.scrollHeight !== el.clientHeight;
    },
```

`<script>` 顶部 import 加：

```js
import { pickFoldHeight } from "@/../lib/markdownFoldModel";
```

- [ ] **Step 6: lint 并提交**

```bash
cd apps/desktop
npm run lint
npx vitest run test/unit/markdown-fold-model.spec.js test/unit/markdown-render.spec.js
git add src/lib/markdownFoldModel.js src/renderer/components/chitchat/message/msgtype/msg-actioncard.vue test/unit/markdown-fold-model.spec.js
git commit -m "feat(markdown): 折叠裁剪线落在块边界，不再把表格切一半"
```

---

## Task 6 (desktop)：30 条用例对照页 + 全量自测

**Files:**
- Create: `apps/desktop/src/renderer/components/debug/MarkdownGfmCases.vue`（**验完删**）
- Modify: `apps/desktop/src/renderer/router/index.js`（加一条 debug 路由，**验完删**）

**Interfaces:**
- Consumes: `convertMarkdownToHtml`
- Produces: 无（临时页）

- [ ] **Step 1: 建用例页**

新建 `apps/desktop/src/renderer/components/debug/MarkdownGfmCases.vue`：

```vue
<template>
  <div class="p-4 overflow-auto h-full">
    <div v-for="(c, i) of cases" :key="i" class="mb-6">
      <div class="text-xs text-gray-500 mb-1">{{ c.id }} · {{ c.name }}</div>
      <pre class="bg-gray-100 p-2 text-xs whitespace-pre-wrap">{{ c.src }}</pre>
      <div class="md-html-wrapper border p-2 mt-1" v-html="render(c.src)"></div>
    </div>
  </div>
</template>

<script>
import { convertMarkdownToHtml } from "@/../lib/markdownUtils";

export default {
  name: "MarkdownGfmCases",
  data() {
    return {
      // 用例来自 spec-port-pc-android.md 第 4 节
      cases: [
        { id: "L1", name: "三层无序列表", src: "- 一\n  - 二\n    - 三" },
        { id: "L2", name: "+ 号列表", src: "+ item" },
        { id: "L3", name: "3. 起始有序列表", src: "3. 三\n4. 四" },
        { id: "L4", name: "任务列表", src: "- [ ] 未做\n- [x] 已做" },
        { id: "L5", name: "有序内嵌无序", src: "1. 一\n   - 甲\n   - 乙" },
        { id: "L6", name: "项内行内样式", src: "- **粗** `码` [链接](https://a.com)" },
        { id: "L7", name: "项内多段落", src: "- 第一段\n\n  第二段" },
        { id: "L8", name: "紧凑 vs 松散", src: "- a\n- b\n\n---\n\n- a\n\n- b" },
        { id: "T1", name: "标准 3 列表格", src: "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |" },
        { id: "T2", name: "两个表格", src: "| A |\n| --- |\n| 1 |\n\n中间段落\n\n| B |\n| --- |\n| 2 |" },
        { id: "T3", name: "含空单元格", src: "| A | B |\n| --- | --- |\n| 1 |  |" },
        { id: "T4", name: "对齐符", src: "| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |" },
        { id: "T5", name: "转义竖线", src: "| A |\n| --- |\n| a \\| b |" },
        { id: "T6", name: "单元格行内样式", src: "| A |\n| --- |\n| **粗** `码` |" },
        { id: "T7", name: "8 列宽表", src: "| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| 内容内容 | 内容内容 | 内容内容 | 内容内容 | 内容内容 | 内容内容 | 内容内容 | 内容内容 |" },
        { id: "T8", name: "列数不一致", src: "| A | B |\n| --- | --- |\n| 1 | 2 | 3 |\n| 4 |" },
        { id: "T9", name: "表格紧跟段落", src: "段落\n| A |\n| --- |\n| 1 |" },
        { id: "I1", name: "嵌套强调", src: "**含*星号*的粗体**" },
        { id: "I2", name: "下划线强调", src: "__粗__ 与 _斜_" },
        { id: "I3", name: "中文粘连", src: "中文_不是斜体_中文" },
        { id: "I4", name: "多反引号行内码", src: "``含 ` 反引号``" },
        { id: "I5", name: "4 空格代码块", src: "    code line" },
        { id: "I6", name: "未闭合围栏", src: "```\nunclosed" },
        { id: "I7", name: "裸 URL", src: "访问 https://example.com 看看" },
        { id: "I8", name: "软换行", src: "第一行\n第二行" },
        { id: "I9", name: "空行分段", src: "段一\n\n段二" },
        { id: "I10", name: "嵌套引用块", src: "> 一层\n> > 二层" },
        { id: "I11", name: "反斜杠转义", src: "\\*不是斜体\\* \\_也不是\\_" },
        { id: "I12", name: "标题与 setext", src: "# 一\n## 二\n###### 六\n\nSetext\n===" },
        { id: "H1", name: "内联 HTML 上色", src: '**<span style="color:blue;">值班总负责人：赵富文</span>**' },
        { id: "H2", name: "上下标", src: "x<sup>2</sup> 与 H<sub>2</sub>O" },
      ],
    };
  },
  methods: {
    render(src) {
      return convertMarkdownToHtml(src);
    },
  },
};
</script>
```

- [ ] **Step 2: 加临时路由**

`apps/desktop/src/renderer/router/index.js` 的 routes 数组里加一条：

```js
    {
      path: "/debug/markdown",
      name: "debug-markdown",
      component: require("@/components/debug/MarkdownGfmCases").default,
    },
```

- [ ] **Step 3: 起应用逐条对照**

Run: `cd apps/desktop && npm run dev:test`
访问 `#/debug/markdown`，对照 spec 第 4 节逐条确认。**重点看**：L4 checkbox 不显示原始括号、T4 三种对齐、T7 能横滚且不夺纵向滚动、I3 中文粘连不变斜体、I8 换行生效、H1 蓝字且保持粗体。

- [ ] **Step 4: 真实会话自测**

在测试环境会话里过 spec 第 6 节的 5 类场景：值班播报（内联 HTML）、含表格 + 插图 + 角标的长回复、普通机器人卡片、合并转发详情页、消息详情弹窗。两种气泡底色（自己发的淡蓝 / 收到的白）都看。

**`breaks: true` 专项**：拿至少 5 条存量真实消息，对比开关前后排版，确认没有意外断行。

- [ ] **Step 5: 删用例页与路由**

```bash
cd apps/desktop
rm src/renderer/components/debug/MarkdownGfmCases.vue
# 手工回退 router/index.js 里那条 debug 路由
git add src/renderer/router/index.js
git commit -m "chore(markdown): 移除 GFM 用例对照页与 debug 路由（自测已完成）"
```

- [ ] **Step 6: 确认提交面干净**

Run: `cd apps/desktop && git status --short`
Expected: 只剩 `.env.test`、`electron-builder.yml`、`package.json` 三个**未 stage** 的本地调试配置（Global Constraints 明令禁止提交）。若它们被 stage 了，`git restore --staged <file>`。

---

## Task 7 (android)：Markwon 依赖补齐 + `ZXMarkwonFactory` 收敛

**Files:**
- Modify: `apps/android/basis_function_api/build.gradle:113-121`
- Create: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkwonFactory.java`
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java:242,272,501,531`（4 处 `Markwon.builder()`）

**Interfaces:**
- Consumes: 无
- Produces:
  - `ZXMarkwonFactory.create(Context context, Glide3ImagePlugin imagePlugin) -> Markwon`（`imagePlugin` 可为 null，为 null 时不装图片插件）
  - `ZXMarkwonFactory.USE_MARKDOWN`（`public static boolean`，默认 true）
  - `ZXMarkwonFactory.MAX_MARKDOWN_LENGTH`（`public static final int` = 20000）
  - `ZXMarkwonFactory.renderSafely(Markwon markwon, String markdown) -> Spanned`（异常/超长时回退纯文本）

- [ ] **Step 1: 加依赖**

`basis_function_api/build.gradle`，在 `api 'io.noties.markwon:html:4.6.2'` 之后追加：

```groovy
    //Markdown解析库扩展模块：删除线 ~~x~~
    api 'io.noties.markwon:ext-strikethrough:4.6.2'
    //Markdown解析库扩展模块：任务列表 - [ ] / - [x]
    api 'io.noties.markwon:ext-tasklist:4.6.2'
```

- [ ] **Step 2: 跑 gradle sync 确认依赖能下载**

Run: `cd apps/android && ./gradlew :basis_function_api:dependencies --configuration releaseRuntimeClasspath 2>&1 | grep -i markwon`
Expected: 输出里出现 `io.noties.markwon:ext-strikethrough:4.6.2` 与 `io.noties.markwon:ext-tasklist:4.6.2`。若下载失败，检查网络代理后重试——这两个包不在本机 gradle 缓存里。

- [ ] **Step 3: 写工厂类**

新建 `ZXMarkwonFactory.java`：

```java
package com.im.message_type.robot;

import android.content.Context;
import android.text.Spanned;
import android.text.SpannableString;
import android.util.Log;

import io.noties.markwon.Markwon;
import io.noties.markwon.ext.strikethrough.StrikethroughPlugin;
import io.noties.markwon.ext.tables.TablePlugin;
import io.noties.markwon.ext.tables.TableTheme;
import io.noties.markwon.ext.tasklist.TaskListPlugin;
import io.noties.markwon.html.HtmlPlugin;
import io.noties.markwon.image.ImagesPlugin;
import io.noties.markwon.linkify.LinkifyPlugin;

/**
 * Markwon 单一配置入口。
 * 此前 ActionCardMessageItemProvider 里有 4 处各写一遍 Markwon.builder()，
 * 插件表一旦不一致就会出现「同一条消息在不同入口渲染不同」的怪问题，故收敛到这里。
 */
public class ZXMarkwonFactory {

    private static final String TAG = "ZXMarkwon";

    /** 全局开关：线上出问题时改成 false，正文全部按纯文本显示，无需改业务逻辑 */
    public static boolean USE_MARKDOWN = true;

    /** 正文超过该长度直接走纯文本，避免超长文本的解析开销 */
    public static final int MAX_MARKDOWN_LENGTH = 20000;

    private ZXMarkwonFactory() {
    }

    /**
     * @param imagePlugin 图片插件，可为 null（无图场景不装，省一次 Glide 初始化）
     */
    public static Markwon create(Context context, Glide3ImagePlugin imagePlugin) {
        Markwon.Builder builder = Markwon.builder(context);
        if (imagePlugin != null) {
            builder.usePlugin(ImagesPlugin.create());
            builder.usePlugin(imagePlugin);
        }
        builder.usePlugin(TablePlugin.create(buildTableTheme(context)));
        builder.usePlugin(HtmlPlugin.create().addHandler(new SpanTagHandler()));
        // 以下三个是本轮补齐的：删除线、任务列表、裸 URL 自动成链接
        builder.usePlugin(StrikethroughPlugin.create());
        builder.usePlugin(TaskListPlugin.create(context));
        builder.usePlugin(LinkifyPlugin.create());
        return builder.build();
    }

    /**
     * 表格配色一律用半透明黑：自己发的消息是淡蓝气泡，
     * 写死浅灰白的表头叠上去会很突兀（iOS 上踩过）。
     */
    private static TableTheme buildTableTheme(Context context) {
        return TableTheme.buildWithDefaults(context)
                .tableHeaderRowBackgroundColor(0x0A000000) // 4% 黑
                .tableBorderColor(0x1F000000)              // 12% 黑
                .tableBorderWidth(1)
                .build();
    }

    /**
     * 渲染兜底：任何解析问题都不该让消息不可读。
     * 异常或超长时静默回退纯文本，只打日志，不给用户任何错误提示。
     */
    public static Spanned renderSafely(Markwon markwon, String markdown) {
        if (markdown == null) {
            return new SpannableString("");
        }
        if (!USE_MARKDOWN || markdown.length() > MAX_MARKDOWN_LENGTH) {
            return new SpannableString(markdown);
        }
        try {
            return markwon.toMarkdown(markdown);
        } catch (Throwable t) {
            Log.e(TAG, "markdown 渲染失败，回退纯文本", t);
            return new SpannableString(markdown);
        }
    }
}
```

- [ ] **Step 4: 4 处调用点换成工厂**

`ActionCardMessageItemProvider.java` 的 `:242`、`:272`、`:501`、`:531` 四处 `Markwon markwon = Markwon.builder(...)...build();` 分别替换：

- 带图片插件的两处（`:242`、`:501`，原本装了 `ImagesPlugin` + `glide3ImagePlugin`）：

```java
                    Markwon markwon = ZXMarkwonFactory.create(var1.getContext(), glide3ImagePlugin);
```

- 不带图片插件的两处（`:272`、`:531`）：

```java
                    Markwon markwon = ZXMarkwonFactory.create(var1.getContext(), null);
```

四处后续的 `markwon.setMarkdown(tv, md)` 调用改为：

```java
                    tv.setText(ZXMarkwonFactory.renderSafely(markwon, md));
```

（`tv` / `md` 用各调用点原有的变量名。）

清理 `ActionCardMessageItemProvider` 里因此不再使用的 import（`TablePlugin`、`TableTheme`、`HtmlPlugin`、`ImagesPlugin`、`Markwon.Builder` 相关）。

- [ ] **Step 5: 编译**

Run: `cd apps/android && ./gradlew :IM:assembleDebug`
Expected: `BUILD SUCCESSFUL`。

- [ ] **Step 6: 核实三条 spec 待确认项**

在 `ZXMarkwonFactory` 的 `create` 里临时加一句渲染以下探针文本，装到测试机上看一眼（看完删探针）：

```
上标 x<sup>2</sup>、下标 H<sub>2</sub>O
第一行
第二行
- [ ] 未做
~~划掉~~
访问 https://example.com
```

判定并把结论回填 `spec.md` 第 8 节：
1. `<sup>`/`<sub>` 是否已生效 → 未生效则在 `create` 里补 `.addHandler(new io.noties.markwon.html.tag.SuperScriptHandler())` 与 `SubScriptHandler`
2. 「第一行/第二行」是否分两行显示（spec I8）→ 未分行则需另配 `SoftBreakAddsNewLinePlugin`
3. 在 `ActionCardMessageItemProvider` 里搜 `senderUserId`，确认 AI 卡片判定是否依赖 `ga_` 前缀（spec 第 8 节）→ 若依赖，按 PC 的 `isAgentCardMessage` 同样逻辑放宽

- [ ] **Step 7: 提交**

```bash
cd apps/android
git add basis_function_api/build.gradle IM/src/main/java/com/im/message_type/robot/ZXMarkwonFactory.java IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
git commit -m "refactor(markdown): 4 处 Markwon.builder 收敛成 ZXMarkwonFactory，补删除线/任务列表/linkify 与渲染兜底"
```

---

## Task 8 (android)：AST 切段模型

**Files:**
- Create: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownSegment.java`
- Create: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownSegmenter.java`

**Interfaces:**
- Consumes: `ZXMarkwonFactory.create(...)` 产出的 `Markwon`
- Produces:
  - `ZXMarkdownSegment`：`public final boolean isTable`、`public final Node node`（富文本段是 `Document`，表格段是 `TableBlock`）
  - `ZXMarkdownSegmenter.split(Markwon markwon, String markdown) -> List<ZXMarkdownSegment>`
  - `ZXMarkdownSegmenter.hasTable(List<ZXMarkdownSegment>) -> boolean`

> 无表格的消息不走段栈（Task 9），所以 `hasTable` 是分流判据。

- [ ] **Step 1: 写段模型**

新建 `ZXMarkdownSegment.java`：

```java
package com.im.message_type.robot;

import org.commonmark.node.Node;

/**
 * 正文的一段。表格必须独立成段，才能挂进可横滚的容器；
 * 连续的非表格块合并成一段，避免为每个段落各建一个 TextView。
 */
public class ZXMarkdownSegment {

    /** true = 表格段（node 是 TableBlock），false = 富文本段（node 是 Document） */
    public final boolean isTable;

    public final Node node;

    public ZXMarkdownSegment(boolean isTable, Node node) {
        this.isTable = isTable;
        this.node = node;
    }
}
```

- [ ] **Step 2: 写切段器**

新建 `ZXMarkdownSegmenter.java`：

```java
package com.im.message_type.robot;

import java.util.ArrayList;
import java.util.List;

import io.noties.markwon.Markwon;
import io.noties.markwon.ext.tables.TableBlock;

import org.commonmark.node.Document;
import org.commonmark.node.Node;

/**
 * 把 markdown 正文切成「富文本段 / 表格段」序列。
 * Markwon 的表格是 span 实现，塞不进横滚容器，所以必须在 AST 层把表格摘出来，
 * 单独用真表格控件渲染（ZXMarkdownTableView）。
 */
public class ZXMarkdownSegmenter {

    private ZXMarkdownSegmenter() {
    }

    public static List<ZXMarkdownSegment> split(Markwon markwon, String markdown) {
        List<ZXMarkdownSegment> result = new ArrayList<>();
        if (markdown == null || markdown.length() == 0) {
            return result;
        }
        Node document = markwon.parse(markdown);
        Document buffer = new Document();
        Node child = document.getFirstChild();
        while (child != null) {
            // 先取到下一个兄弟，因为 appendChild 会把 child 从原树摘走
            Node next = child.getNext();
            if (child instanceof TableBlock) {
                if (buffer.getFirstChild() != null) {
                    result.add(new ZXMarkdownSegment(false, buffer));
                    buffer = new Document();
                }
                child.unlink();
                result.add(new ZXMarkdownSegment(true, child));
            } else {
                buffer.appendChild(child);
            }
            child = next;
        }
        if (buffer.getFirstChild() != null) {
            result.add(new ZXMarkdownSegment(false, buffer));
        }
        return result;
    }

    public static boolean hasTable(List<ZXMarkdownSegment> segments) {
        if (segments == null) {
            return false;
        }
        for (int i = 0; i < segments.size(); i++) {
            if (segments.get(i).isTable) {
                return true;
            }
        }
        return false;
    }
}
```

- [ ] **Step 3: 编译**

Run: `cd apps/android && ./gradlew :IM:assembleDebug`
Expected: `BUILD SUCCESSFUL`。

- [ ] **Step 4: 提交**

```bash
cd apps/android
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownSegment.java IM/src/main/java/com/im/message_type/robot/ZXMarkdownSegmenter.java
git commit -m "feat(markdown): 新增 AST 切段器，把表格块从正文中摘出独立成段"
```

---

## Task 9 (android)：可横滚表格控件

**Files:**
- Create: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java`

**Interfaces:**
- Consumes: `ZXMarkdownSegment.node`（`TableBlock`）、`Markwon`
- Produces: `ZXMarkdownTableView(Context)`、`bind(Markwon markwon, TableBlock table, int textColor, float textSizeSp)`

- [ ] **Step 1: 写表格控件**

新建 `ZXMarkdownTableView.java`：

```java
package com.im.message_type.robot;

import android.content.Context;
import android.graphics.Color;
import android.text.Spanned;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.HorizontalScrollView;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;

import io.noties.markwon.Markwon;
import io.noties.markwon.ext.tables.TableBlock;
import io.noties.markwon.ext.tables.TableBody;
import io.noties.markwon.ext.tables.TableCell;
import io.noties.markwon.ext.tables.TableHead;
import io.noties.markwon.ext.tables.TableRow;

import org.commonmark.node.Document;
import org.commonmark.node.Node;
import org.commonmark.node.Paragraph;

/**
 * 宽表格必须能横向滚动查看（spec T7），且只吃横向手势——
 * 纵向仍归会话列表，否则消息列表滚不动。
 */
public class ZXMarkdownTableView extends HorizontalScrollView {

    /** 表头底色 4% 黑、边框 12% 黑：叠在任意气泡底色上都协调，不写死浅灰白 */
    private static final int HEADER_BG = 0x0A000000;
    private static final int BORDER = 0x1F000000;
    /** 单列最大宽度（dp），超出则单元格内换行 */
    private static final int MAX_COL_WIDTH_DP = 220;

    private final TableLayout tableLayout;

    public ZXMarkdownTableView(Context context) {
        super(context);
        setHorizontalScrollBarEnabled(false);
        // 横滚容器不得吞掉会话列表的纵向手势
        setNestedScrollingEnabled(true);
        tableLayout = new TableLayout(context);
        addView(tableLayout, new LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    public void bind(Markwon markwon, TableBlock table, int textColor, float textSizeSp) {
        tableLayout.removeAllViews();
        Node section = table.getFirstChild();
        while (section != null) {
            boolean isHeader = section instanceof TableHead;
            if (isHeader || section instanceof TableBody) {
                Node rowNode = section.getFirstChild();
                while (rowNode != null) {
                    if (rowNode instanceof TableRow) {
                        tableLayout.addView(buildRow(
                                markwon, (TableRow) rowNode, isHeader, textColor, textSizeSp));
                    }
                    rowNode = rowNode.getNext();
                }
            }
            section = section.getNext();
        }
    }

    private android.widget.TableRow buildRow(Markwon markwon, TableRow row, boolean isHeader,
                                             int textColor, float textSizeSp) {
        android.widget.TableRow view = new android.widget.TableRow(getContext());
        Node cellNode = row.getFirstChild();
        while (cellNode != null) {
            if (cellNode instanceof TableCell) {
                view.addView(buildCell(markwon, (TableCell) cellNode, isHeader, textColor, textSizeSp));
            }
            cellNode = cellNode.getNext();
        }
        return view;
    }

    private TextView buildCell(Markwon markwon, TableCell cell, boolean isHeader,
                               int textColor, float textSizeSp) {
        TextView tv = new TextView(getContext());
        tv.setTextColor(textColor);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, textSizeSp);
        tv.setMaxWidth(dp2px(MAX_COL_WIDTH_DP));
        int padH = dp2px(8);
        int padV = dp2px(4);
        tv.setPadding(padH, padV, padH, padV);
        tv.setBackgroundColor(isHeader ? HEADER_BG : Color.TRANSPARENT);
        if (isHeader) {
            tv.setTypeface(tv.getTypeface(), android.graphics.Typeface.BOLD);
        }
        tv.setGravity(alignmentOf(cell));
        // 关键：段栈里的所有子 View 都不能吞掉气泡长按（转发/回复菜单）
        tv.setLongClickable(false);
        tv.setTextIsSelectable(false);
        tv.setClickable(false);

        // 单元格内容仍是 markdown 行内内容，包成 Paragraph 交给 Markwon 渲染
        Document doc = new Document();
        Paragraph p = new Paragraph();
        Node inline = cell.getFirstChild();
        while (inline != null) {
            Node next = inline.getNext();
            inline.unlink();
            p.appendChild(inline);
            inline = next;
        }
        doc.appendChild(p);
        Spanned spanned = markwon.render(doc);
        tv.setText(spanned);
        return tv;
    }

    private int alignmentOf(TableCell cell) {
        TableCell.Alignment alignment = cell.getAlignment();
        if (alignment == TableCell.Alignment.CENTER) {
            return Gravity.CENTER;
        }
        if (alignment == TableCell.Alignment.RIGHT) {
            return Gravity.END | Gravity.CENTER_VERTICAL;
        }
        return Gravity.START | Gravity.CENTER_VERTICAL;
    }

    private int dp2px(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density + 0.5f);
    }

    /** 边框颜色供 ZXMarkdownContentView 画分隔线用 */
    public static int borderColor() {
        return BORDER;
    }
}
```

> 注意：`io.noties.markwon.ext.tables.TableRow` 与 `android.widget.TableRow` 同名，代码里已用全限定名区分。

- [ ] **Step 2: 编译**

Run: `cd apps/android && ./gradlew :IM:assembleDebug`
Expected: `BUILD SUCCESSFUL`。若 `TableHead` / `TableBody` / `TableRow` / `TableCell` 类名对不上，用 `./gradlew :IM:dependencies` 定位 `ext-tables:4.6.2` 的 jar 后 `javap` 查实际类名再改。

- [ ] **Step 3: 提交**

```bash
cd apps/android
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java
git commit -m "feat(markdown): 新增可横滚表格控件，表头 4% 黑、边框 12% 黑"
```

---

## Task 10 (android)：段栈容器 + 按段折叠

**Files:**
- Create: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java`
- Modify: `apps/android/IM/src/main/res/layout/rc_item_action_card_message.xml`（在 `tv_content`（`:62`）下方加一个同位置的段栈容器）

**Interfaces:**
- Consumes: `ZXMarkdownSegmenter.split(...)`、`ZXMarkdownTableView`
- Produces:
  - `ZXMarkdownContentView(Context)`
  - `bind(Markwon markwon, List<ZXMarkdownSegment> segments, int textColor, float textSizeSp)`
  - `applyFold(boolean folded, int maxHeightPx)` — 折叠时按段取舍
  - `isFoldNeeded(int maxHeightPx) -> boolean`

- [ ] **Step 1: 写段栈容器**

新建 `ZXMarkdownContentView.java`：

```java
package com.im.message_type.robot;

import android.content.Context;
import android.text.Spanned;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.List;

import io.noties.markwon.Markwon;
import io.noties.markwon.ext.tables.TableBlock;

/**
 * 正文段栈：富文本段用 TextView，表格段用可横滚的 ZXMarkdownTableView。
 * 折叠按「段」取舍而不是按像素硬切，裁剪线因此永远不会把表格切成一半（spec 第 7 节）。
 */
public class ZXMarkdownContentView extends LinearLayout {

    public ZXMarkdownContentView(Context context) {
        super(context);
        setOrientation(VERTICAL);
        // 段栈本身也不吞长按，长按一路冒泡到气泡根 View
        setLongClickable(false);
    }

    public void bind(Markwon markwon, List<ZXMarkdownSegment> segments,
                     int textColor, float textSizeSp) {
        removeAllViews();
        if (segments == null) {
            return;
        }
        for (int i = 0; i < segments.size(); i++) {
            ZXMarkdownSegment segment = segments.get(i);
            if (segment.isTable) {
                ZXMarkdownTableView table = new ZXMarkdownTableView(getContext());
                table.bind(markwon, (TableBlock) segment.node, textColor, textSizeSp);
                addView(table, new LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));
            } else {
                addView(buildTextSegment(markwon, segment, textColor, textSizeSp),
                        new LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.WRAP_CONTENT));
            }
        }
    }

    private TextView buildTextSegment(Markwon markwon, ZXMarkdownSegment segment,
                                      int textColor, float textSizeSp) {
        TextView tv = new TextView(getContext());
        tv.setTextColor(textColor);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, textSizeSp);
        // 不可选中 + 不可长按：TextView 默认可选中时会装上文本选择长按手势，
        // 抢走气泡的长按（转发/回复菜单）。iOS 上就是栽在这条。
        tv.setTextIsSelectable(false);
        tv.setLongClickable(false);
        tv.setClickable(false);
        Spanned spanned = markwon.render(segment.node);
        markwon.setParsedMarkdown(tv, spanned);
        return tv;
    }

    /** 段底边超过限高即需要折叠 */
    public boolean isFoldNeeded(int maxHeightPx) {
        return computeFoldHeight(maxHeightPx) < totalHeight();
    }

    /**
     * @param folded true = 折叠态；false = 展开态
     * @param maxHeightPx 折叠限高
     */
    public void applyFold(boolean folded, int maxHeightPx) {
        if (!folded) {
            for (int i = 0; i < getChildCount(); i++) {
                getChildAt(i).setVisibility(View.VISIBLE);
            }
            return;
        }
        int used = 0;
        boolean cut = false;
        for (int i = 0; i < getChildCount(); i++) {
            View child = getChildAt(i);
            int h = child.getMeasuredHeight();
            if (cut) {
                child.setVisibility(View.GONE);
                continue;
            }
            if (i > 0 && used + h > maxHeightPx) {
                // 该段整体放不下就整段不显示，绝不切一半
                child.setVisibility(View.GONE);
                cut = true;
                continue;
            }
            child.setVisibility(View.VISIBLE);
            used += h;
        }
    }

    private int computeFoldHeight(int maxHeightPx) {
        int used = 0;
        for (int i = 0; i < getChildCount(); i++) {
            int h = getChildAt(i).getMeasuredHeight();
            if (i > 0 && used + h > maxHeightPx) {
                return used;
            }
            used += h;
        }
        return used;
    }

    private int totalHeight() {
        int total = 0;
        for (int i = 0; i < getChildCount(); i++) {
            total += getChildAt(i).getMeasuredHeight();
        }
        return total;
    }
}
```

> `i > 0` 的判据：第一段就超限高时整段显示，不切——与 PC 的 `pickFoldHeight` 行为一致。

- [ ] **Step 2: 布局加容器**

`rc_item_action_card_message.xml`，在 `android:id="@+id/tv_content"`（`:62`）的 TextView **之后**追加一个同宽同位置的容器：

```xml
    <com.im.message_type.robot.ZXMarkdownContentView
        android:id="@+id/md_content_stack"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_below="@+id/tv_title"
        android:visibility="gone" />
```

> `layout_below` 用 `tv_content` 现有的同一个锚点（打开 xml 确认 `tv_content` 的 `layout_below` 值，照抄）。原 `:154` 的 `layout_below="@+id/tv_content"` 需要改成 `layout_below="@+id/md_content_stack"` 还是保留，取决于走哪条路径——**在 Task 11 里按运行时可见性处理，本步只加容器不动其它锚点**。

- [ ] **Step 3: 编译**

Run: `cd apps/android && ./gradlew :IM:assembleDebug`
Expected: `BUILD SUCCESSFUL`。

- [ ] **Step 4: 提交**

```bash
cd apps/android
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java IM/src/main/res/layout/rc_item_action_card_message.xml
git commit -m "feat(markdown): 新增正文段栈容器，折叠按段取舍不切断表格"
```

---

## Task 11 (android)：气泡接段栈 + 折叠改造

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java`（`ViewHolder`（`:1020`）加字段、`bindView` 里 4 条渲染路径、折叠段 `:308-346`）

**Interfaces:**
- Consumes: `ZXMarkdownSegmenter.split/hasTable`、`ZXMarkdownContentView`、`ZXMarkwonFactory`
- Produces: 无对外接口

> **分流规则**：`hasTable == false` 的消息**仍走原 `tv_content` 单 TextView 路径**，零回归；只有含表格的消息才切到段栈。

- [ ] **Step 1: ViewHolder 加字段**

`ViewHolder`（`:1020`）里加：

```java
        ZXMarkdownContentView mdContentStack;
```

`onCreateViewHolder` 里（`:134` 附近，与 `reference_msg_root` 同处）加：

```java
        holder.mdContentStack = view.findViewById(R.id.md_content_stack);
```

- [ ] **Step 2: 渲染分流**

4 条渲染路径（原 `:242`、`:272`、`:501`、`:531` 所在的分支）里，把「渲染正文」的部分统一改为：

```java
                    java.util.List<ZXMarkdownSegment> segments =
                            ZXMarkdownSegmenter.split(markwon, showTxt);
                    if (ZXMarkdownSegmenter.hasTable(segments)) {
                        // 含表格：走段栈，表格段可横滚
                        holder.mTvContent.setVisibility(View.GONE);
                        holder.mdContentStack.setVisibility(View.VISIBLE);
                        holder.mdContentStack.bind(markwon, segments,
                                holder.mTvContent.getCurrentTextColor(),
                                holder.mTvContent.getTextSize()
                                        / var1.getContext().getResources()
                                        .getDisplayMetrics().scaledDensity);
                    } else {
                        // 无表格：保持原单 TextView 路径，零回归
                        holder.mdContentStack.setVisibility(View.GONE);
                        holder.mTvContent.setVisibility(View.VISIBLE);
                        holder.mTvContent.setText(
                                ZXMarkwonFactory.renderSafely(markwon, showTxt));
                    }
```

- [ ] **Step 3: 折叠分流**

`:308-336` 那段折叠逻辑（`if (!var4.isTxtExpand()) { ... }`）改为按路径分流：

```java
            if (!var4.isTxtExpand()) {
                int maxHeight = WindowUtils.dp2px(maxHeightDP);
                if (isReferUnitPrimary) {
                    if (hasTitle) {
                        maxHeight = WindowUtils.dp2px(78);
                    } else {
                        maxHeight = WindowUtils.dp2px(123);
                    }
                }
                final int finalMaxHeight = maxHeight;
                holder.llExpand.setVisibility(View.GONE);
                holder.rlFold.setVisibility(View.GONE);
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    // 段栈路径：按段取舍，裁剪线不会切断表格
                    holder.mdContentStack.post(() -> {
                        if (holder.mdContentStack.isFoldNeeded(finalMaxHeight)) {
                            holder.mdContentStack.applyFold(true, finalMaxHeight);
                            holder.llExpand.setVisibility(View.VISIBLE);
                            setExpandBackground(holder, style, isSend);
                        } else {
                            holder.mdContentStack.applyFold(false, finalMaxHeight);
                        }
                    });
                } else {
                    // 原单 TextView 路径，保持不变
                    holder.mTvContent.setMaxHeight(maxHeight);
                    holder.mTvContent.post(() -> {
                        if (holder.mTvContent.getHeight() >= finalMaxHeight) {
                            holder.llExpand.setVisibility(View.VISIBLE);
                            setExpandBackground(holder, style, isSend);
                        } else {
                            holder.mTvContent.setMaxHeight(Integer.MAX_VALUE);
                        }
                    });
                }
            }
```

原来内联的两处「查看更多」背景图设置（`:326-330`、以及收起按钮那处）抽成方法，放到类末尾：

```java
    /** 「查看更多」背景：组织会话与外链会话、己方与对方各一套九图 */
    private void setExpandBackground(ViewHolder holder, int style, boolean isSend) {
        if (style == 0) { // 组织会话消息
            holder.llExpand.setBackgroundResource(isSend
                    ? R.drawable.zu_zhi_robot_card_more_own_send
                    : R.drawable.zu_zhi_robot_card_more_else_send);
        } else {
            holder.llExpand.setBackgroundResource(isSend
                    ? R.drawable.wai_lian_robot_card_more_own_send
                    : R.drawable.wai_lian_robot_card_more_else_send);
        }
    }
```

- [ ] **Step 4: 展开/收起按钮同步分流**

`:337`（展开）与 `:344`（收起）两个点击回调里，把只操作 `mTvContent.setMaxHeight` 的部分补上段栈分支：

```java
            //展开按钮点击事件
            holder.llFoldExpand.setOnClickListener(v -> {
                var4.setTxtExpand(true);
                holder.llExpand.setVisibility(View.GONE);
                holder.rlFold.setVisibility(View.VISIBLE);
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    holder.mdContentStack.applyFold(false, 0);
                } else {
                    holder.mTvContent.setMaxHeight(Integer.MAX_VALUE);
                }
            });
```

收起回调同理：`applyFold(true, maxHeight)` 对段栈，`setMaxHeight(maxHeight)` 对 TextView，其余逻辑（`rlFold` 可见性、`getReferMsgExpandOrFoldListener()` 回调）保持原样。

- [ ] **Step 5: 编译**

Run: `cd apps/android && ./gradlew :IM:assembleDebug`
Expected: `BUILD SUCCESSFUL`。

- [ ] **Step 6: 提交**

```bash
cd apps/android
git add IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
git commit -m "feat(markdown): 含表格的消息切段栈渲染，折叠按段取舍；无表格消息保持原路径"
```

---

## Task 12 (android)：30 条用例对照页 + 全量自测

**Files:**
- Create: `apps/android/IM/src/main/java/com/im/debug/MarkdownGfmCasesActivity.java`（**验完删**）
- Modify: `apps/android/IM/src/main/AndroidManifest.xml`（注册 Activity，**验完删**）

**Interfaces:**
- Consumes: `ZXMarkwonFactory`、`ZXMarkdownSegmenter`、`ZXMarkdownContentView`
- Produces: 无（临时页）

- [ ] **Step 1: 建用例页**

新建 `MarkdownGfmCasesActivity.java`，用例文本**逐条照抄 Task 6 的 `cases` 数组**（同样 30 条，同样的 id 与 src），每条用一个 `ZXMarkdownContentView` 渲染，外层 `ScrollView` + `LinearLayout`：

```java
package com.im.debug;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.List;

import io.noties.markwon.Markwon;

import com.im.message_type.robot.ZXMarkdownContentView;
import com.im.message_type.robot.ZXMarkdownSegment;
import com.im.message_type.robot.ZXMarkdownSegmenter;
import com.im.message_type.robot.ZXMarkwonFactory;

/** GFM 用例对照页（临时，自测完删除） */
public class MarkdownGfmCasesActivity extends Activity {

    // 用例来自 spec-port-pc-android.md 第 4 节，与 PC 端用例页一一对应
    private static final String[][] CASES = {
            {"L1", "三层无序列表", "- 一\n  - 二\n    - 三"},
            {"L2", "+ 号列表", "+ item"},
            {"L3", "3. 起始有序列表", "3. 三\n4. 四"},
            {"L4", "任务列表", "- [ ] 未做\n- [x] 已做"},
            {"L5", "有序内嵌无序", "1. 一\n   - 甲\n   - 乙"},
            {"L6", "项内行内样式", "- **粗** `码` [链接](https://a.com)"},
            {"L7", "项内多段落", "- 第一段\n\n  第二段"},
            {"L8", "紧凑 vs 松散", "- a\n- b\n\n---\n\n- a\n\n- b"},
            {"T1", "标准 3 列表格", "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |"},
            {"T2", "两个表格", "| A |\n| --- |\n| 1 |\n\n中间段落\n\n| B |\n| --- |\n| 2 |"},
            {"T3", "含空单元格", "| A | B |\n| --- | --- |\n| 1 |  |"},
            {"T4", "对齐符", "| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |"},
            {"T5", "转义竖线", "| A |\n| --- |\n| a \\| b |"},
            {"T6", "单元格行内样式", "| A |\n| --- |\n| **粗** `码` |"},
            {"T7", "8 列宽表", "| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| 内容内容 | 内容内容 | 内容内容 | 内容内容 | 内容内容 | 内容内容 | 内容内容 | 内容内容 |"},
            {"T8", "列数不一致", "| A | B |\n| --- | --- |\n| 1 | 2 | 3 |\n| 4 |"},
            {"T9", "表格紧跟段落", "段落\n| A |\n| --- |\n| 1 |"},
            {"I1", "嵌套强调", "**含*星号*的粗体**"},
            {"I2", "下划线强调", "__粗__ 与 _斜_"},
            {"I3", "中文粘连", "中文_不是斜体_中文"},
            {"I4", "多反引号行内码", "``含 ` 反引号``"},
            {"I5", "4 空格代码块", "    code line"},
            {"I6", "未闭合围栏", "```\nunclosed"},
            {"I7", "裸 URL", "访问 https://example.com 看看"},
            {"I8", "软换行", "第一行\n第二行"},
            {"I9", "空行分段", "段一\n\n段二"},
            {"I10", "嵌套引用块", "> 一层\n> > 二层"},
            {"I11", "反斜杠转义", "\\*不是斜体\\* \\_也不是\\_"},
            {"I12", "标题与 setext", "# 一\n## 二\n###### 六\n\nSetext\n==="},
            {"H1", "内联 HTML 上色", "**<span style=\"color:blue;\">值班总负责人：赵富文</span>**"},
            {"H2", "上下标", "x<sup>2</sup> 与 H<sub>2</sub>O"},
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (12 * getResources().getDisplayMetrics().density);
        root.setPadding(pad, pad, pad, pad);
        Markwon markwon = ZXMarkwonFactory.create(this, null);
        for (String[] c : CASES) {
            TextView label = new TextView(this);
            label.setText(c[0] + " · " + c[1]);
            label.setTextColor(Color.GRAY);
            label.setTextSize(11);
            root.addView(label);

            ZXMarkdownContentView content = new ZXMarkdownContentView(this);
            List<ZXMarkdownSegment> segments = ZXMarkdownSegmenter.split(markwon, c[2]);
            content.bind(markwon, segments, Color.BLACK, 14f);
            root.addView(content, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        scroll.addView(root);
        setContentView(scroll);
    }
}
```

`AndroidManifest.xml` 里注册（带 launcher 入口便于直接启动）：

```xml
        <activity
            android:name="com.im.debug.MarkdownGfmCasesActivity"
            android:exported="true" />
```

- [ ] **Step 2: 装机逐条对照**

Run:
```bash
cd apps/android
./gradlew :app:installDebug
adb shell am start -n <包名>/com.im.debug.MarkdownGfmCasesActivity
```
（`<包名>` 取 `app/build.gradle` 的 `applicationId`。）

对照 spec 第 4 节逐条确认。**重点看**：L4 checkbox、T4 三种对齐、T7 能横滚且**上下滑动仍能滚动整页**、I3 中文粘连不变斜体、I8 分两行、H1 蓝字且保持粗体、H2 上下标。

- [ ] **Step 3: 真实会话自测**

在测试环境会话里过 spec 第 6 节场景：值班播报（内联 HTML）、含表格 + 插图 + 角标的长回复、普通机器人卡片。两种气泡底色都看。

**交互专项**：
1. 含表格的消息**长按能弹出转发/回复菜单**（这是段栈最容易翻车的地方）
2. 表格横滚时**上下滑动仍能滚动会话列表**
3. 角标点击能跳知识来源
4. 收起展开切换正常，且**折叠时表格不会被切一半**

- [ ] **Step 4: 删用例页**

```bash
cd apps/android
rm IM/src/main/java/com/im/debug/MarkdownGfmCasesActivity.java
# 手工回退 AndroidManifest.xml 里那条 activity 注册
git add IM/src/main/AndroidManifest.xml
git commit -m "chore(markdown): 移除 GFM 用例对照页（自测已完成）"
```

- [ ] **Step 5: 出测试包**

Run: `cd apps/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`，产物路径记进 `impl-notes.md`。

---

## Task 13 (两端)：收尾

**Files:**
- Modify: `context/features/20260814-pc安卓-GFM-Markdown渲染对齐/status.md`
- Create: `context/features/20260814-pc安卓-GFM-Markdown渲染对齐/impl-notes.md`

- [ ] **Step 1: 回填 spec 第 8 节待核实项**

把 Task 7 Step 6 的三条核实结论、以及 Task 10 Step 2 里 `layout_below` 锚点的实际处理，写回 `spec.md` 第 8 节（把「待核实」改成结论）。

- [ ] **Step 2: 写 impl-notes**

`impl-notes.md` 至少记：
- markdown-it 自写 task-list core rule 的判据（为什么要求父级是 `list_item_open`）
- `TableRow` 类名冲突（`io.noties.markwon.ext.tables.TableRow` vs `android.widget.TableRow`）
- 段栈子 View 必须 `setTextIsSelectable(false)` + `setLongClickable(false)`，否则吞掉气泡长按
- 折叠「第一段就超限高则整段显示」的判据两端一致（PC `pickFoldHeight` 的 `picked === 0` 分支 / 安卓 `applyFold` 的 `i > 0`）
- `breaks: true` 对存量消息排版的实际影响

- [ ] **Step 3: 更新 status 矩阵与工作区现状**

Run: `cd /Users/nic/w/ai-dev-workspace && bash scripts/code-status.sh`
据输出更新 status.md 的平台矩阵（全部打 ✅）与各端工作区现状表。

- [ ] **Step 4: 提交 context**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260814-pc安卓-GFM-Markdown渲染对齐
git commit -m "docs(20260814-pc安卓-GFM-Markdown渲染对齐): 两端实现完成，补 impl-notes 与验收结论"
```

---

## 自检记录

**spec 覆盖**：spec 第 4 节 PC 设计 → Task 1-5；第 5 节安卓设计 → Task 7-11；第 6 节验收 → Task 6、12；第 8 节待核实 → Task 7 Step 6 + Task 13 Step 1。第 7 节「本轮不做」无对应任务（正确）。

**已知风险**：
1. Task 9 的 `ext-tables` 类名（`TableHead`/`TableBody`/`TableRow`/`TableCell`）与 `TableCell.getAlignment()` 签名按 Markwon 4.6.2 写；对不上时按 Step 2 的排查方法改。
2. Task 10 Step 2 的 `layout_below` 锚点需打开 xml 确认实际值，plan 里给的是模式不是死值。
3. Task 7 Step 6 的三条核实项结论会影响是否额外加 `SuperScriptHandler` / `SoftBreakAddsNewLinePlugin` / AI 卡片判定改造——这三个是**条件任务**，核实为「需要」时就地补，不另开任务。
