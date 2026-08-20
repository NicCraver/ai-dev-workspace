# Spec：安卓 markdown 表格消息被截断且不显示「查看更多」

> 由 Superpowers brainstorm 产出。最后更新：2026-08-20

## 背景与目标

### 现象

安卓会话页，AI 卡片消息（ActionCard）中**含 markdown 表格**的那一类，部分消息出现：

- 内容在某个固定高度处被**像素级硬切**（表格行的文字被切成一半）
- **不显示「查看更多」按钮**
- 卡片高度锁死，用户无法展开看全

线上样本：群 AI 框「报餐统计」卡片 = H1 标题段 +「序号/部门/…」表格（表头 + 13 行数据）。

### 根因（静态定位，已与截图像素对齐）

`ZXMarkdownContentView` 里**折叠判定**和**实际裁剪**用的不是同一个高度量：

| 位置 | 算的是什么 | 含段栈自身 padding？ |
|------|-----------|---------------------|
| `ZXMarkdownContentView.java:185` `onMeasure` 夹外框 | `getMeasuredHeight()` | **含** |
| `ZXMarkdownContentView.java:191-193` `isFoldNeeded` | `totalHeight()` = Σ子段高 + topMargin | **不含** |

`rc_item_action_card_message.xml:80-83` 给 `md_content_stack` 配了 `paddingTop=12dp` + `paddingBottom=12dp`，两个量因此恒差 **24dp**。

当「子段总高 ∈ (456dp, 480dp]」时：

1. `getMeasuredHeight() = Σ + 24 > 480dp` → `onMeasure` 把外框 clamp 到 480dp，内容底部被 clip
2. `isFoldNeeded(480dp)` 拿 `Σ ≤ 480dp` 去比 → 返回 **false**
3. 走 `ActionCardMessageItemProvider.java:377-379` 的 else 分支 → 不显示 `llExpand`（查看更多）
4. 该分支只调 `applyFold(false, ...)`，**没有 `setHeightCap(0)`** → 480dp 的夹子留在原地 = 高度锁死

窗口宽 24dp / 480dp ≈ 5%，所以是「部分消息」；被夹住的一律锁在 480dp，所以「都是相同的高度」。

样本核算：H1 段 ≈55dp + 表格段 topMargin 16dp + 表格 14 行 ×≈28.5dp ≈399dp = **470dp**（≤480，判 false）；
`measuredHeight` = 470+24 = **494dp**（>480，被夹）；可绘区 = 480−12(paddingBottom，`clipToPadding` 默认 true) = 468dp
→ 底部切掉约 14dp = 第 13 行的下半截。与截图一致。

### 为什么不能只补 padding（否决方案 A）

补上 padding 后 `isFoldNeeded` 变 true，`applyFold(true, 456dp)` 会跑起来：

- H1 段占 71dp（含 margin），`used=71`
- 表格段 h=399，`71+399 > 456` → 表格不是 TextView 且不是第 0 段 → `ZXMarkdownContentView.java:244` **`setVisibility(GONE)`**

结果是「只剩一行标题 + 查看更多」，表格整块消失，比现状更糟。

**按段取舍策略在「标题 + 一张大表格」这种最常见结构上根本失效**——表格永远放不下，永远整块消失。

### 目标

含表格的 AI 卡片在超过折叠限高时：**内容被裁到限高 + 正确显示「查看更多」按钮**，点击后完整展开。观感对齐 PC 端（`overflow:hidden` + `max-height`，超限一律裁到限高）。

### 成功标准

1. 样本卡片（报餐统计）折叠态显示「查看更多」，点击后表格完整可见
2. 折叠态卡片高度 = 480dp（引用悬浮场景为 78/123dp），各卡片等高
3. 无论内容总高是 470dp 还是 5000dp，按钮显示与否与「内容是否真的被裁」始终一致
4. 会话页 / 引用悬浮 / 引用预览 / 合并转发详情四个入口行为一致
5. 不回归两条既有成果：翻历史不被拽回最新卡片；气泡长按菜单正常

## 方案：只裁不取舍，对齐 PC

### 决策

| | PC（现状） | 安卓（改后） |
|---|---|---|
| 折叠方式 | `overflow:hidden` + `max-height:400px` | 外框 `heightCap` 夹住 |
| 超限处理 | 一律裁到限高，元素可能切一半 | 同 |
| 判定 | `scrollHeight > limit` | `rawContentHeight > cap` |

**已确认接受的代价**：折叠态表格会切在行中间。换来的是各卡片折叠态等高、判定与裁剪不可能再不一致。

### 改动一：判定与裁剪用同一个量

`onMeasure` 在 clamp **之前**把真高记进 `rawContentHeight`，`isFoldNeeded` 用它比。

> 不能在 post 里直接读 `getMeasuredHeight()`：那时 `setMeasuredDimension(w, heightCapPx)` 已经把它改成 cap 了，判定会恒为 false。

```java
// ZXMarkdownContentView
/** 夹高前的真实内容高（含段栈自身 padding），与 onMeasure 的 clamp 同源 */
private int rawContentHeight = 0;

@Override
protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
    super.onMeasure(widthMeasureSpec, heightMeasureSpec);
    rawContentHeight = getMeasuredHeight();          // clamp 前记真高
    if (heightCapPx > 0 && rawContentHeight > heightCapPx) {
        setMeasuredDimension(getMeasuredWidth(), heightCapPx);
    }
}

public boolean isFoldNeeded(int maxHeightPx) {
    return rawContentHeight > maxHeightPx;
}
```

### 改动二：删掉按段取舍

子段永远完整测量、永远不改可见性与 `maxHeight`；折叠完全由 `heightCap` 完成。

`applyFold` 退化成 `setHeightCap` 的同义词 → **整个方法删除**，连同只服务于它的 `totalHeight()` / `outerHeight()` / `topMarginOf()`。

调用方语义收敛成两句：

- 折叠：`setHeightCap(maxHeightPx)`
- 展开：`setHeightCap(0)`

### 改动三：补齐 provider 的四个入口

**不变量：任何一条路径退出时，段栈的 cap 状态必须与「按钮是否显示」一致。**

| 位置 | 现状问题 | 改法 |
|------|---------|------|
| `ActionCardMessageItemProvider.java:377-379` 不需折叠分支 | 没 `setHeightCap(0)`，夹子留下 = 高度锁死 | 补 `setHeightCap(0)` |
| `:664-677` `referUnitXuanFuPrimaryActionCardView`（引用悬浮） | 段栈完全没处理，只设了 `mTvContent.setMaxHeight` → 表格卡片高度不受限 | 按 78/123dp 设 cap + 判定显示展开图标 |
| `:688-694` `referUnitPrimaryExpandOrFold`（聚合列表首条源消息展开） | 只放开 `tv_content`，段栈没复位 → 含表格的源消息展不开 | 补 `setHeightCap(0)` |
| `:399-401`（展开点击）/ `:419-421`（收起点击）/ `:507-523`（`defaultModuleLongMessageContentExpandOrFold`） | 逻辑已对 | 跟着新语义去掉 `applyFold` 调用 |

### 改动四：异步高度变化后重判

`post{}` 只跑一次。Markwon 的 `Glide3ImagePlugin` 是异步塞图的，图回来后 TextView 变高、`requestLayout`，但折叠判定不会再跑一次 → 同一症状（无按钮 + 被夹死）会从另一条路复现。

做法：段栈提供 `setOnContentHeightChangeListener`，`onMeasure` 发现 `rawContentHeight` 变化时回调（回调本身要 `post` 出去，不能在布局期改 View）。provider 在回调里重跑一次「是否需要折叠 → 显不显按钮」。

**holder 复用必须在 `bind()` 开头清掉上一条消息的监听**，否则旧监听会打到新内容上。

## 待验证：表格 View 自身是否也被限高

截图里那条横滚指示条**可见**。它画在表格 View 自己的底边（`ZXMarkdownTableView.java:150` `top = height - inset - thickness`）。

若表格只是被外框 clip，指示条应当一起被裁掉、看不见。看得见 → 可能是 `HorizontalScrollView` **自身高度**就小于内层 `TableLayout`，即表格内部也在裁。

- 若属实：展开后表格**依然显示不全**，本方案只修好按钮修不好内容，需要作为**第二个独立缺陷**单独修。
- 若不属实（纯外框 clip，指示条可见只是像素估算误差）：本方案已完整覆盖。

**验证手段**：真机打点，同一帧输出三个值——段栈 `rawContentHeight` / 表格 View `getMeasuredHeight()` / 内层 `TableLayout.getMeasuredHeight()`。三者一致 → 纯外框问题；表格 View < TableLayout → 第二个缺陷成立。

这一步必须排在代码改动之前。

## 范围

**本期做（仅安卓）**

- `ZXMarkdownContentView`：`rawContentHeight` + `isFoldNeeded` 改判定源；删 `applyFold` 及其辅助方法
- `ActionCardMessageItemProvider`：四个入口补齐 cap 语义与按钮显示
- 异步高度变化重判（改动四）
- 真机打点验证「表格 View 是否自身被限高」，结论留档

**本期不做**

- web / iOS / desktop：一行不碰。PC 是参照对象，行为已是目标态
- 折叠限高数值调整（`maxHeightDP = 480`、引用悬浮 78/123dp 保持不变）
- 知识来源（`agentKnowledgeList`）的过滤与展示逻辑
- 若「表格 View 自身被限高」成立，其修复另开缺陷，不并入本期改动

**不许动（既有成果，回归红线）**

- `maxHeightDP = 480`
- 段栈子 View 禁获焦（`FOCUS_BLOCK_DESCENDANTS` 等，修「翻历史被拽回最新卡片」的成果）
- `setHeightCap` 当帧硬夹（同上）
- 段栈与表格子 View 的 `setLongClickable(false)`（修「长按被正文吞掉」的成果）

## 各端差异点

本期只改安卓。安卓改后与 PC 行为对齐，故无新增差异。

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 折叠超限处理 | 不涉及 | 裁到限高（改后） | 不涉及，本期不动 | 裁到限高（现状，参照系） |

## 依赖的接口

无。纯客户端渲染缺陷，不涉及 `context/contracts/`。

## 验收方式

本仓库**无单元测试、无 lint**，全部靠真机 onTest 包人工过矩阵：

| 场景 | 期望 |
|------|------|
| 报餐统计卡片（表格，总高约 494dp） | 夹在 480dp，显示「查看更多」，点开表格完整 |
| 超长表格卡片（远超 480dp） | 同上 |
| 刚好不超限的表格卡片 | 不夹、不显示按钮、内容完整 |
| 纯文本长卡片（无表格） | 行为不变 |
| 展开后点「收起」 | 回到 480dp + 按钮重现 |
| 快速上下滚动消息列表 | 不出现按钮错位 / 高度残留（holder 复用） |
| 翻历史 | 不被拽回最新卡片 |
| 气泡长按 | 转发 / 回复菜单正常弹出 |
| 引用悬浮单元 / 引用预览 / 合并转发详情 | 表格卡片限高与展开图标正确 |

## 待用户确认的问题

无。折叠策略已确认走「只裁不取舍，对齐 PC」，接受折叠态表格切在行中间。
