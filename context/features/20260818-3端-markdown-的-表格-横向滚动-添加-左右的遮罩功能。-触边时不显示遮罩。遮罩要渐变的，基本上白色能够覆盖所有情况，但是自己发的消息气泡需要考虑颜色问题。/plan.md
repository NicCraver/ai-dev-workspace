# 三端 markdown 表格横滚左右渐变遮罩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 PC / 安卓 / iOS 消息气泡里已能横滚的 markdown 表格加上左右渐变遮罩：触边隐藏，实色跟随当前气泡底色。

**Architecture:** 不改 markdown 解析。遮罩是横滚容器的装饰。PC 用 CSS 伪元素 + capture scroll；安卓在 `HorizontalScrollView.dispatchDraw` 里按 `scrollX` 画渐变（不另叠可点 View）；iOS 把 `CAGradientLayer` 挂在表格外壳上（不进 scrollView）。三端共用同一套显隐公式（见 `computeTableFadeFlags`）。

**Tech Stack:** PC Electron 19 + Vue 2.7（禁止可选链、禁止 npm install）；安卓 Java + Markwon 段栈；iOS 纯 OC `ZXMarkdownTableView`。

## Global Constraints

- 只动 PC / 安卓 / iOS；web `AcMarkdown` 不做
- 在现有 `feat/gfm-markdown`（PC、安卓）和 `feat/ios-gfm-markdown`（iOS）上继续，不要另切分支——横滚容器只在这些分支上
- 遮罩宽 24px/dp/pt；触边阈值 1px；差值 ≤ 1px 当不溢出
- 实色 = 当前气泡真实底色，不写死白/蓝两套图
- 遮罩不吃点击 / 横滚 / 长按；不改「查看更多」上下罩
- PC：禁止 `npm install`；禁用 `?.` / `??`；提交不带 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json`
- 安卓：表格子 View 保持 `focusable=false`；长按冒泡到气泡根
- iOS：AI 不跑 `xcodebuild`；流式期间表格是纯文本，没有横滚罩，属既有规则
- 无后端接口，不改 `context/contracts/`

## File map

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/lib/markdownTableFade.js` | 纯函数 `computeTableFadeFlags` + `bindTableFades`（scroll/resize 打 class） |
| `apps/desktop/test/unit/markdown-table-fade.spec.js` | 显隐公式单测 |
| `apps/desktop/src/renderer/assets/styles/markdown.scss` | `.md-table-wrap` 左右伪元素 |
| `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue` | `--md-table-fade-color` 跟气泡底 |
| `apps/desktop/src/renderer/mixins/markdownTableFade.js` | Vue mixin，三个消费方共用 |
| `apps/desktop/.../msg-actioncard.vue` `msg-reply-poll.vue` `debug/MarkdownGfmCases.vue` | 挂 mixin |
| `apps/android/.../ZXMarkdownTableView.java` | `dispatchDraw` 画左右渐变 |
| `apps/android/.../ZXMarkdownContentView.java` | bind 时把 fadeColor 传给每张表 |
| `apps/android/.../ActionCardMessageItemProvider.java` | 与设气泡背景同一分支算出 fadeColor |
| `apps/ios/.../ZXMarkdownTableView.h/m` | 外壳上左右 `CAGradientLayer` |
| `apps/ios/.../ZXMarkdownContentView.h/m` | `tableFadeColor` 属性，建表时下发 |
| `apps/ios/.../ZXGroupRobotCell.m` `ZXIMAgentStreamReplyCell.m` | `getBubbleColor:` 赋给段栈 |
| `context/design/markdown-style-tokens.md` | 补一行遮罩宽度 token |

---

### Task 1 (desktop)：显隐公式纯函数 + 单测

**Files:**
- Create: `apps/desktop/src/lib/markdownTableFade.js`
- Create: `apps/desktop/test/unit/markdown-table-fade.spec.js`

**Interfaces:**
- Produces: `computeTableFadeFlags(scrollLeft, clientWidth, scrollWidth) → { left: boolean, right: boolean }`
- Produces: `bindTableFades(rootEl) → { destroy, refresh }`（本任务先写函数体，消费方在 Task 3）

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, test } from "vitest";
import { computeTableFadeFlags } from "../../src/lib/markdownTableFade";

describe("computeTableFadeFlags", function () {
  test("不溢出：左右都不显示", function () {
    expect(computeTableFadeFlags(0, 100, 100)).toEqual({ left: false, right: false });
  });

  test("只宽出 1px：当不溢出", function () {
    expect(computeTableFadeFlags(0, 100, 101)).toEqual({ left: false, right: false });
  });

  test("贴左：只显示右罩", function () {
    expect(computeTableFadeFlags(0, 100, 300)).toEqual({ left: false, right: true });
  });

  test("中间：两侧都显示", function () {
    expect(computeTableFadeFlags(50, 100, 300)).toEqual({ left: true, right: true });
  });

  test("贴右：只显示左罩", function () {
    expect(computeTableFadeFlags(200, 100, 300)).toEqual({ left: true, right: false });
  });

  test("scrollLeft 恰好 1px：左罩仍不显示", function () {
    expect(computeTableFadeFlags(1, 100, 300)).toEqual({ left: false, right: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-table-fade.spec.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**

`apps/desktop/src/lib/markdownTableFade.js`（禁止 `?.` / `??`）：

```js
var EDGE = 1;

export function computeTableFadeFlags(scrollLeft, clientWidth, scrollWidth) {
  var left = scrollLeft > EDGE;
  var right = scrollLeft + clientWidth < scrollWidth - EDGE;
  return { left: left, right: right };
}

function applyFlags(wrap) {
  var flags = computeTableFadeFlags(
    wrap.scrollLeft,
    wrap.clientWidth,
    wrap.scrollWidth
  );
  if (flags.left) {
    wrap.classList.add("is-fade-left");
  } else {
    wrap.classList.remove("is-fade-left");
  }
  if (flags.right) {
    wrap.classList.add("is-fade-right");
  } else {
    wrap.classList.remove("is-fade-right");
  }
}

/**
 * 在 root 上 capture 监听 scroll，给内部 .md-table-wrap 打左右 fade class。
 * v-html 表格没有 Vue 实例，只能从外面包。
 */
export function bindTableFades(root) {
  if (!root) {
    return { destroy: function () {}, refresh: function () {} };
  }

  function onScroll(e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains("md-table-wrap")) {
      return;
    }
    applyFlags(t);
  }

  function refresh() {
    var wraps = root.querySelectorAll(".md-table-wrap");
    for (var i = 0; i < wraps.length; i++) {
      applyFlags(wraps[i]);
    }
  }

  root.addEventListener("scroll", onScroll, true);

  var ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(function () {
      refresh();
    });
    var wraps = root.querySelectorAll(".md-table-wrap");
    for (var j = 0; j < wraps.length; j++) {
      ro.observe(wraps[j]);
    }
  }

  refresh();

  return {
    destroy: function () {
      root.removeEventListener("scroll", onScroll, true);
      if (ro) {
        ro.disconnect();
      }
    },
    refresh: refresh,
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd apps/desktop && npx vitest run test/unit/markdown-table-fade.spec.js`
Expected: PASS 6 条

- [ ] **Step 5: Commit**

```bash
cd apps/desktop
git add src/lib/markdownTableFade.js test/unit/markdown-table-fade.spec.js
git commit -m "$(cat <<'EOF'
feat(markdown): 表格横滚遮罩显隐公式与 bind 辅助

EOF
)"
```

---

### Task 2 (desktop)：CSS 伪元素 + 气泡色变量

**Files:**
- Modify: `apps/desktop/src/renderer/assets/styles/markdown.scss`（`.md-table-wrap` 那段，约 133–138 行）
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue`（`.msg-box` 约 3370、`.message-item-self .msg-box` 约 3399）

**Interfaces:**
- Consumes: class 名 `is-fade-left` / `is-fade-right`（Task 1）
- Produces: `--md-table-fade-color`，缺省白

- [ ] **Step 1: 改 `.md-table-wrap`**

把现有块换成（保留 overflow / overscroll / margin）：

```scss
  .md-table-wrap {
    position: relative;
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    margin: 0.5em 0;

    &::before,
    &::after {
      content: "";
      position: sticky;
      top: 0;
      z-index: 1;
      display: none;
      width: 24px;
      height: 100%;
      min-height: 1em;
      pointer-events: none;
      flex-shrink: 0;
    }
    // sticky 伪元素在 overflow 容器里对横向 fade 不稳，改绝对定位叠在视口两侧：
  }
```

**不要用 sticky。** 改用「外层再包一层」会动 HTML 渲染产物。正确做法：伪元素 `position: absolute` **画在 wrap 上盖不住横滚内容**（absolute 相对 wrap 含滚动区域会跟着内容跑）。

因此 PC 不用伪元素跟滚动走，而用 **mask 叠层写在 wrap 上、背景用渐变、背景 attachment 对视口**：

```scss
  .md-table-wrap {
    position: relative;
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    margin: 0.5em 0;

    &.is-fade-left::before,
    &.is-fade-right::after {
      content: "";
      position: sticky;
      z-index: 1;
      display: block;
      width: 24px;
      pointer-events: none;
    }
    &.is-fade-left::before {
      left: 0;
      float: left;
      height: 100%;
      background: linear-gradient(
        to right,
        var(--md-table-fade-color, #ffffff),
        transparent
      );
    }
    &.is-fade-right::after {
      right: 0;
      float: right;
      height: 100%;
      background: linear-gradient(
        to left,
        var(--md-table-fade-color, #ffffff),
        transparent
      );
    }
  }
```

`float` + `sticky` 在 Chromium（Electron 19）里可以把条粘在 overflow 容器视口左右，且 `pointer-events: none` 不挡拖动。若自测发现 float 把表格挤歪：**改成 wrap 的 `box-shadow` 不行（颜色跟不上）**；回退方案是 `bindTableFades` 在 wrap 里插入两个绝对定位空 span（`position:sticky; left:0` / `right:0`），不要用伪元素。计划默认走伪元素，自测失败再插 span。

- [ ] **Step 2: 气泡色变量**

`.msg-box` 已有 `background-color: #ffffff`，紧挨着加：

```scss
      .msg-box {
        overflow: hidden;
        min-width: 40px;
        min-height: 20px;
        border-radius: 0 16px 16px / 16px;
        background-color: #ffffff;
        --md-table-fade-color: #ffffff;
      }
```

`.message-item-self .msg-box` 已有 `#d7e5ff`，加：

```scss
        .msg-box {
          border-radius: 16px 0 16px 16px / 16px;
          background-color: #d7e5ff;
          border-color: #d7e5ff;
          --md-table-fade-color: #d7e5ff;
        }
```

- [ ] **Step 3: Commit**

```bash
cd apps/desktop
git add src/renderer/assets/styles/markdown.scss src/renderer/components/chitchat/message/msg-list.vue
git commit -m "$(cat <<'EOF'
feat(markdown): 表格横滚左右渐变罩样式跟随气泡底色

EOF
)"
```

勿 stage `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json`。

---

### Task 3 (desktop)：三个消费方挂 bind

**Files:**
- Create: `apps/desktop/src/renderer/mixins/markdownTableFade.js`
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msgtype/msg-actioncard.vue`
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msgtype/msg-reply-poll.vue`
- Modify: `apps/desktop/src/renderer/components/debug/MarkdownGfmCases.vue`

**Interfaces:**
- Consumes: `bindTableFades`（Task 1）

- [ ] **Step 1: mixin**

```js
import { bindTableFades } from "../../lib/markdownTableFade";

export default {
  methods: {
    bindMarkdownTableFade: function () {
      this.unbindMarkdownTableFade();
      var root = this.$el;
      if (!root) {
        return;
      }
      this._tableFadeHandle = bindTableFades(root);
    },
    unbindMarkdownTableFade: function () {
      if (this._tableFadeHandle) {
        this._tableFadeHandle.destroy();
        this._tableFadeHandle = null;
      }
    },
  },
  mounted: function () {
    var self = this;
    this.$nextTick(function () {
      self.bindMarkdownTableFade();
    });
  },
  updated: function () {
    var self = this;
    this.$nextTick(function () {
      self.bindMarkdownTableFade();
    });
  },
  beforeDestroy: function () {
    this.unbindMarkdownTableFade();
  },
};
```

注意 mixin 的 `mounted`/`updated` 会和组件已有钩子**合并执行**，不会覆盖 `msg-actioncard` 现有 `mounted`。

- [ ] **Step 2: 三个组件引入 mixin**

`msg-actioncard.vue` / `msg-reply-poll.vue` / `MarkdownGfmCases.vue` 的 `export default` 里加：

```js
import markdownTableFade from "@/mixins/markdownTableFade";
// mixins: [markdownTableFade],
```

路径别写错：desktop 的 `@` 指向 `src/renderer`，mixin 在 `src/renderer/mixins/`，lib 从 mixin 用 `../../lib/markdownTableFade`（renderer/mixins → src/lib）。

若 `@/mixins/...` 解析不到，改相对路径：
`msg-actioncard.vue` → `../../../../mixins/markdownTableFade`
（`msgtype/` 上四层到 `renderer/`）。先试 `@/mixins/markdownTableFade`。

- [ ] **Step 3: lint + 单测**

Run: `cd apps/desktop && npm run lint && npx vitest run test/unit/markdown-table-fade.spec.js test/unit/markdown-render.spec.js`
Expected: lint 干净，单测全绿。

- [ ] **Step 4: Commit**

```bash
cd apps/desktop
git add src/renderer/mixins/markdownTableFade.js \
  src/renderer/components/chitchat/message/msgtype/msg-actioncard.vue \
  src/renderer/components/chitchat/message/msgtype/msg-reply-poll.vue \
  src/renderer/components/debug/MarkdownGfmCases.vue
git commit -m "$(cat <<'EOF'
feat(markdown): 会话与 debug 页表格横滚接上左右遮罩

EOF
)"
```

---

### Task 4 (desktop)：运行时自测（人工）

- [ ] `npm run dev:test` → `#/debug/markdown` 用例 **T7** 宽表：贴左只见右罩，拖到中间两侧都有，拖到头右罩消失。窄表（T1）无罩。
- [ ] 真实会话：收到白气泡 / 自己发蓝气泡各一条宽表。蓝气泡上罩必须是 `#d7e5ff` 不是白块。
- [ ] 右键菜单仍在；会话列表纵滚不被横滚带跑。
- [ ] 若伪元素把表格挤歪或罩跟着内容跑：改 `bindTableFades`，给每个 wrap append 两个 `span.md-table-fade.md-table-fade-left/right`，`position:sticky; left:0/right:0; top:0; width:24px; height:100%; pointer-events:none`。

自测未过保持 🚧，不要标完成。

---

### Task 5 (android)：ZXMarkdownTableView 自绘左右渐变

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java`

**Interfaces:**
- Produces: `bind(..., int fadeColor)` 或 `setFadeColor(int)` + 现有 `bind` 末尾读字段。推荐 **新增字段 + `setFadeColor`，`bind` 不改签名**，避免所有调用方一次性改崩。`setFadeColor` 必须在 `bind` 之后也能 `invalidate`（复用时可能先 bind 再设色，或相反——两次都 invalidate）。

- [ ] **Step 1: 加字段与绘制**

在类里加：

```java
private static final int FADE_WIDTH_DP = 24;
private static final int EDGE_PX = 1;
private int fadeColor = Color.WHITE;
private final Paint fadePaint = new Paint(Paint.ANTI_ALIAS_FLAG);

public void setFadeColor(int color) {
    fadeColor = color;
    invalidate();
}

@Override
protected void onScrollChanged(int l, int t, int oldl, int oldt) {
    super.onScrollChanged(l, t, oldl, oldt);
    invalidate();
}

@Override
protected void onSizeChanged(int w, int h, int oldw, int oldh) {
    super.onSizeChanged(w, h, oldw, oldh);
    invalidate();
}

@Override
protected void dispatchDraw(Canvas canvas) {
    super.dispatchDraw(canvas);
    View child = getChildCount() > 0 ? getChildAt(0) : null;
    int contentWidth = child != null ? child.getWidth() : 0;
    int width = getWidth();
    int height = getHeight();
    int scrollX = getScrollX();
    boolean showLeft = scrollX > EDGE_PX;
    boolean showRight = scrollX + width < contentWidth - EDGE_PX;
    if (!showLeft && !showRight) {
        return;
    }
    int fadeW = dp2px(FADE_WIDTH_DP);
    // View.draw 已把 canvas translate(-scrollX)，视口左缘在 canvas 坐标 scrollX
    if (showLeft) {
        fadePaint.setShader(new LinearGradient(
                scrollX, 0, scrollX + fadeW, 0,
                fadeColor, Color.TRANSPARENT, Shader.TileMode.CLAMP));
        canvas.drawRect(scrollX, 0, scrollX + fadeW, height, fadePaint);
    }
    if (showRight) {
        fadePaint.setShader(new LinearGradient(
                scrollX + width - fadeW, 0, scrollX + width, 0,
                Color.TRANSPARENT, fadeColor, Shader.TileMode.CLAMP));
        canvas.drawRect(scrollX + width - fadeW, 0, scrollX + width, height, fadePaint);
    }
    fadePaint.setShader(null);
}
```

补 import：`android.graphics.LinearGradient`、`android.graphics.Shader`、`android.view.View`（已有 ViewGroup）。

构造函数里 `setWillNotDraw(false)`（有 child 的 ViewGroup 默认会 draw，但显式写上防以后优化）。

**不要**加可点 overlay View。

- [ ] **Step 2: Commit**

```bash
cd apps/android
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java
git commit -m "$(cat <<'EOF'
feat(markdown): 横滚表格按滚动位置自绘左右渐变罩

EOF
)"
```

---

### Task 6 (android)：把气泡色传进表格

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java`
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java`

**Interfaces:**
- Consumes: `ZXMarkdownTableView.setFadeColor(int)`
- Produces: `ZXMarkdownContentView.setTableFadeColor(int)`，默认 `Color.WHITE`；每次 `bind` 读该字段下发给新表

- [ ] **Step 1: ContentView**

```java
private int tableFadeColor = Color.WHITE;

public void setTableFadeColor(int color) {
    tableFadeColor = color;
}

// 在 bind() 建表处，table.bind(...) 之后：
table.setFadeColor(tableFadeColor);
```

`Color` 已在 TableView 用，ContentView 补 `import android.graphics.Color;`。

- [ ] **Step 2: Provider 取色**

`isSend` / `style` 设 `mLlMessage` 背景的同一段下面，算一次：

```java
final int tableFadeColor;
if (isReferUnitPrimary) {
    tableFadeColor = Color.WHITE;
} else if (style == 0) {
    tableFadeColor = Color.parseColor(isSend ? "#DEE8FF" : "#FFFFFF");
} else {
    tableFadeColor = Color.parseColor(isSend ? "#99F0CB" : "#EFF2F6");
}
holder.mdContentStack.setTableFadeColor(tableFadeColor);
```

必须在**每一次** `mdContentStack.bind(...)` 之前调用（文件里至少两处：AI 卡片含表、普通含表）。RecyclerView 复用时上一张的淡蓝不能带到白气泡。

hex 与现有 drawable 文件名一致：`shape_solid_dee8ff` / `ffffff` / `99f0cb` / `eff2f6`。

- [ ] **Step 3: 编译**

Run: `cd apps/android && ./gradlew :IM:assembleDevelopDebug`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
cd apps/android
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java \
  IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
git commit -m "$(cat <<'EOF'
feat(markdown): 表格横滚罩跟随组织/外链气泡底色

EOF
)"
```

---

### Task 7 (android)：运行时自测（真机）

- [ ] 组织会话：收到白气泡宽表、自己发 `#DEE8FF` 宽表，触边规则同 spec 第 8 节
- [ ] 外链会话：自己发绿 `#99F0CB`、收到 `#EFF2F6`，罩不是白块
- [ ] 窄表无罩；长按仍出转发/回复；上下滑仍滚列表
- [ ] 快速滑列表换气泡颜色，确认复用后罩色跟着变

---

### Task 8 (ios)：ZXMarkdownTableView 外壳渐变层

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownTableView.h`
- Modify: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownTableView.m`

**Interfaces:**
- Produces: `- (void)setFadeColor:(UIColor *)color;` 默认 white

- [ ] **Step 1: header**

```objc
- (void)setFadeColor:(UIColor *)color;
```

- [ ] **Step 2: 实现**

`ZXMarkdownTableView` 加 `<UIScrollViewDelegate>`。私有属性：

```objc
@property (nonatomic, strong) CAGradientLayer *leftFadeLayer;
@property (nonatomic, strong) CAGradientLayer *rightFadeLayer;
@property (nonatomic, strong) UIColor *fadeColor;
```

在 `zx_setupViews` 末尾（scrollView 已加到 self 上之后）：

```objc
self.fadeColor = [UIColor whiteColor];
self.scrollView.delegate = self;
self.leftFadeLayer = [self zx_makeFadeLayerStartOpaque:YES];
self.rightFadeLayer = [self zx_makeFadeLayerStartOpaque:NO];
[self.layer addSublayer:self.leftFadeLayer];
[self.layer addSublayer:self.rightFadeLayer];
```

辅助：

```objc
- (CAGradientLayer *)zx_makeFadeLayerStartOpaque:(BOOL)opaqueOnStart {
    CAGradientLayer *layer = [CAGradientLayer layer];
    layer.startPoint = CGPointMake(0, 0.5);
    layer.endPoint = CGPointMake(1, 0.5);
    UIColor *c = self.fadeColor ?: [UIColor whiteColor];
    UIColor *clear = [c colorWithAlphaComponent:0];
    if (opaqueOnStart) {
        layer.colors = @[(id)c.CGColor, (id)clear.CGColor];
    } else {
        layer.colors = @[(id)clear.CGColor, (id)c.CGColor];
    }
    layer.hidden = YES;
    return layer;
}

- (void)setFadeColor:(UIColor *)color {
    _fadeColor = color ?: [UIColor whiteColor];
    UIColor *c = _fadeColor;
    UIColor *clear = [c colorWithAlphaComponent:0];
    self.leftFadeLayer.colors = @[(id)c.CGColor, (id)clear.CGColor];
    self.rightFadeLayer.colors = @[(id)clear.CGColor, (id)c.CGColor];
    [self zx_updateFadeLayers];
}

- (void)zx_updateFadeLayers {
    CGFloat width = CGRectGetWidth(self.bounds);
    CGFloat height = CGRectGetHeight(self.bounds);
    CGFloat fadeW = 24.0;
    CGFloat contentW = self.scrollView.contentSize.width;
    CGFloat offset = self.scrollView.contentOffset.x;
    BOOL showLeft = offset > 1.0;
    BOOL showRight = offset + width < contentW - 1.0;
    self.leftFadeLayer.frame = CGRectMake(0, 0, fadeW, height);
    self.rightFadeLayer.frame = CGRectMake(MAX(width - fadeW, 0), 0, fadeW, height);
    self.leftFadeLayer.hidden = !showLeft;
    self.rightFadeLayer.hidden = !showRight;
}

- (void)scrollViewDidScroll:(UIScrollView *)scrollView {
    [self zx_updateFadeLayers];
}
```

`layoutSubviews` 现有只设 `scrollView.frame`，追加 `[self zx_updateFadeLayers]`。

层挂在 **self.layer** 不是 `scrollView.layer`，否则会跟着内容滚。

- [ ] **Step 3: Commit**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownTableView.h \
  SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownTableView.m
git commit -m "$(cat <<'EOF'
feat(markdown): 表格外壳加左右渐变罩并随横滚显隐

EOF
)"
```

不要跑 `xcodebuild`。不要 `pod install`。

---

### Task 9 (ios)：段栈与两个 cell 下发气泡色

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownContentView.h`
- Modify: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownContentView.m`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXGroupRobotCell.m`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXIMAgentStreamReplyCell.m`

**Interfaces:**
- Consumes: `ZXMarkdownTableView setFadeColor:`
- Produces: `@property (nonatomic, strong) UIColor *tableFadeColor;` 默认 white；`setBlocks:` 里每张表 `setFadeColor:`
- 不改 `setBlocks:` 签名，测量路径（`zx_sharedMeasureContentView`）高度与颜色无关，可不管

- [ ] **Step 1: ContentView**

header：

```objc
@property (nonatomic, strong) UIColor *tableFadeColor;
```

init 里 `_tableFadeColor = [UIColor whiteColor];`

`setBlocks:` 建 `ZXMarkdownTableView` 之后：

```objc
[tableView setFadeColor:self.tableFadeColor ?: [UIColor whiteColor]];
```

- [ ] **Step 2: 两个 cell**

`ZXGroupRobotCell setModel:` 在 `setBlocks:` 之前（约 895 行，此时 `model` 在手边，气泡色 778 行已设过）：

```objc
self.markdownContentView.tableFadeColor = [ZXIMCellLogic getBubbleColor:model];
```

`ZXIMAgentStreamReplyCell` 真正渲染那次 `setBlocks:`（约 414 行，不是 measure 那两次）同样赋 `getBubbleColor:model`。确认该作用域有 `model`；若在 snapshot 方法里，用传入的 `model` 参数。

聚合弹窗 / 合并转发复用这两个 cell，不必再改。

- [ ] **Step 3: Commit**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownContentView.h \
  SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownContentView.m \
  SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXGroupRobotCell.m \
  SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXIMAgentStreamReplyCell.m
git commit -m "$(cat <<'EOF'
feat(markdown): 表格横滚罩走 getBubbleColor 跟随气泡底

EOF
)"
```

---

### Task 10 (ios)：真机自测（人工）

M 芯片模拟器融云无 arm64 slice，必须真机。

- [ ] 组织：白气泡 / `#DEE8FF` 自己发
- [ ] 微信/外链：`#B3ECCF` 自己发，罩不是白块
- [ ] 触边规则、窄表无罩、长按菜单、纵滚、多表
- [ ] 流式智能体：打字期间无表无罩；结束后成表再出现罩
- [ ] 回复聚合 / 合并转发各看一眼

---

### Task 11 (多端)：token 表补一行

**Files:**
- Modify: `context/design/markdown-style-tokens.md` 的 Token 表，表格斑马纹那行后面加：

| token | 值 | PC 13px | 安卓 15sp | iOS 16pt |
|---|---|---|---|---|
| 表格 · 横滚左右遮罩 | 宽 24，实色=气泡底，触边（≤1px）隐藏 | 24px | 24dp | 24pt |

- [ ] 随 context 仓库 wrapup 一起提交，不要单独在 apps 里提交这份文件。

---

## Self-review vs spec

| spec | 任务 |
|------|------|
| 溢出/触边/24 宽/实时/不挡手 | T1 公式 + T2/T5/T8 绘制 |
| 跟真实气泡色（含外链） | T2 变量、T6 parseColor、T9 getBubbleColor |
| 会话+详情+合并+引用 | 复用同一组件/cell，T3/T6/T9 |
| 多表独立、resize、复用换色 | T1 refresh、T5 onSizeChanged、T6 每次 bind 前 set |
| 流式无罩 | T10 验证既有行为 |
| 不做 web / 不做上下折叠罩 / 不改解析 | 无对应任务 |
| PC debug T7 | T3 MarkdownGfmCases + T4 |
| 验收 8 条 | T4 / T7 / T10 |
