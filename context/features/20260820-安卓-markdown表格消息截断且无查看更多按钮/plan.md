# 安卓 markdown 表格消息截断且无「查看更多」修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 `superpowers:executing-plans` 逐任务执行本计划。步骤用 `- [ ]` 复选框跟踪。
> Spec：同目录 `spec.md`。

**Goal:** 让含 markdown 表格的 AI 卡片在超过折叠限高时，裁到限高并正确显示「查看更多」按钮，点击可完整展开。

**Architecture:** 消灭「折叠判定」与「实际裁剪」之间的高度量差异——`onMeasure` 在 clamp 前把真高记进 `rawContentHeight`，判定改用它；折叠完全由外框 `heightCap` 完成，删除按段取舍逻辑；provider 四个入口统一成「折叠 = `setHeightCap(max)`，展开 = `setHeightCap(0)`」；一次性 `post` 判定换成高度变化监听，覆盖异步图片加载后变高的场景。

**Tech Stack:** 原生 Android，Java 8，Gradle 6.5 + AGP 4.2.2（**必须 JDK 8 或 11**），Markwon 富文本，`smart_message` 多模块工程。

## Global Constraints

- 语言：Java（本文件涉及的类全是 Java），**中文注释**
- 折叠限高常量不许改：`ActionCardMessageItemProvider.maxHeightDP = 480`；引用悬浮 78dp（有标题）/ 123dp（无标题）
- 不许动的既有成果（改动若触碰则视为回归）：
  - 段栈及子 View 禁获焦（`setDescendantFocusability(FOCUS_BLOCK_DESCENDANTS)` / `setFocusable(false)` / `setFocusableInTouchMode(false)`）——修「翻历史被拽回最新卡片」
  - `setHeightCap` 当帧硬夹（`onMeasure` 里 clamp，不许改成 post 里再夹）——同上
  - 段栈、段 TextView、表格容器与单元格的 `setLongClickable(false)`——修「气泡长按被正文吞掉」
  - `disableFocusAndLongClick` 必须留在 `setMovementMethod` 之后调用
- 本仓库**无单元测试、无 lint**（`lintOptions.abortOnError=false`）。每个任务的"测试"= `./gradlew assembleOnTestDebug` 编译通过；行为验证集中在 T6 真机
- 只改安卓。`apps/web` / `apps/ios` / `apps/desktop` 一行不碰
- 提交在 `apps/android` 仓库；context 文档提交在编排仓库，两者分开

## 文件清单

| 文件 | 责任 | 动作 |
|------|------|------|
| `IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java` | 段栈容器：测量真高、外框夹高、高度变化通知 | 改（加 `rawContentHeight`、`isFoldNeeded` 换判定源、加监听、删 `applyFold` 及辅助方法） |
| `IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java` | 表格段 | 只加临时打点日志（T1 加，T7 删），逻辑不动 |
| `IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java` | 卡片绑定与折叠编排 | 改（四个入口统一 cap 语义、换监听、catch 兜底复位） |

段栈的对外接口在 T2 定死，T3/T4 只消费它，不再改签名。

---

### Task 1: 切分支 + 加临时打点日志

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java`（`onMeasure`）
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java`（新增 `onMeasure` 覆写）

**目的：** spec 的「待验证」项——截图里横滚指示条可见，怀疑表格 `HorizontalScrollView` 自身高度就小于内层 `TableLayout`（即表格内部也在裁）。若属实，那是**第二个独立缺陷**，展开后表格仍显示不全，需另行处理，不并入本期。

日志与修复一起进同一个包，T6 装机时一次采集，省一次构建。

**Interfaces:**
- Produces: logcat tag `ZXTableDiag`，两行输出，供 T6 比对

- [ ] **Step 1: 从 `feat/gfm-markdown` 切工作分支**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git status --short          # 期望：空（当前分支干净）
git checkout -b fix/md-table-fold-truncate
git branch --show-current   # 期望：fix/md-table-fold-truncate
```

- [ ] **Step 2: 段栈 `onMeasure` 加真高打点**

在 `ZXMarkdownContentView.onMeasure` 的 `super.onMeasure(...)` 之后插入（此时还没 clamp）：

```java
        // TODO 临时：定位「表格是否自身被限高」，T7 删。adb logcat -s ZXTableDiag
        android.util.Log.d("ZXTableDiag", "段栈 rawHeight=" + getMeasuredHeight()
                + " cap=" + heightCapPx + " 子段数=" + getChildCount());
```

- [ ] **Step 3: 表格段加自身高度打点**

在 `ZXMarkdownTableView` 里新增覆写（放在 `onScrollChanged` 之前）：

```java
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
        // TODO 临时：定位「表格是否自身被限高」，T7 删。adb logcat -s ZXTableDiag
        android.util.Log.d("ZXTableDiag", "表格 self=" + getMeasuredHeight()
                + " 内层 TableLayout=" + tableLayout.getMeasuredHeight()
                + " heightSpec=" + android.view.View.MeasureSpec.toString(heightMeasureSpec));
    }
```

- [ ] **Step 4: 编译验证**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
java -version               # 期望：1.8 或 11。若是 17+ 必须先切 JDK，否则 Gradle 6.5 报错
./gradlew assembleOnTestDebug
```
期望：`BUILD SUCCESSFUL`

- [ ] **Step 5: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java \
        IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java
git commit -m "chore(markdown): 加临时打点，定位表格是否自身被限高"
```

---

### Task 2: 段栈判定源改为 `rawContentHeight`，删除按段取舍

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java`

**Interfaces:**
- Produces（T3/T4 依赖的最终对外签名）：
  - `void setHeightCap(int capPx)` —— 保持不变，0 = 不限
  - `boolean isFoldNeeded(int maxHeightPx)` —— 语义改为「夹高前真高 > maxHeightPx」
  - `interface OnContentHeightChangeListener { void onContentHeightChanged(int rawContentHeightPx); }`
  - `void setOnContentHeightChangeListener(OnContentHeightChangeListener listener)` —— 传 `null` 表示清除
  - `void bind(...)` / `void appendExtraText(...)` —— 保持不变
- 删除：`void applyFold(boolean, int)`、`private int totalHeight()`、`private int outerHeight(View)`、`private int topMarginOf(View)`

- [ ] **Step 1: 加字段**

在 `private int heightCapPx = 0;` 下方加：

```java
    /**
     * 夹高前的真实内容高（含段栈自身 padding），与 onMeasure 的 clamp 用同一个量。
     * 不能在 post 里直接读 getMeasuredHeight()：那时已被 setMeasuredDimension 改成 cap，
     * 判定会恒为 false（正是本次缺陷的成因）。
     */
    private int rawContentHeight = 0;

    //高度变化监听 + 上次已通知的高度，避免同一高度反复回调
    private OnContentHeightChangeListener heightChangeListener;
    private int lastNotifiedHeight = -1;
```

- [ ] **Step 2: 加监听接口与 setter**

放在 `SegmentPostProcessor` 接口下方：

```java
    /**
     * 内容真高变化通知。表格测量、Markwon 异步图片回来都会让高度变，
     * 一次性 post 判定会漏掉这些，折叠判定必须跟着高度重跑。
     */
    public interface OnContentHeightChangeListener {
        void onContentHeightChanged(int rawContentHeightPx);
    }

    /**
     * @param listener 传 null 清除。holder 复用换绑时必须重设或清除，
     *                 否则上一条消息的监听会打到新内容上。
     */
    public void setOnContentHeightChangeListener(OnContentHeightChangeListener listener) {
        this.heightChangeListener = listener;
        this.lastNotifiedHeight = -1;
    }
```

- [ ] **Step 3: 改写 `onMeasure`**

整个方法替换为（含 T1 的临时日志）：

```java
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
        //子 View 照常按完整高度测量；这里先记真高再夹外框，两者必须用同一个量，
        //否则「判定说不用折叠」和「实际被裁了」会同时成立（本次缺陷）
        rawContentHeight = getMeasuredHeight();
        // TODO 临时：定位「表格是否自身被限高」，T7 删。adb logcat -s ZXTableDiag
        android.util.Log.d("ZXTableDiag", "段栈 rawHeight=" + rawContentHeight
                + " cap=" + heightCapPx + " 子段数=" + getChildCount());
        if (heightCapPx > 0 && rawContentHeight > heightCapPx) {
            setMeasuredDimension(getMeasuredWidth(), heightCapPx);
        }
        notifyContentHeightIfChanged();
    }

    /** 高度变了才通知，且回调必须 post 出去——布局期内不能改 View */
    private void notifyContentHeightIfChanged() {
        if (heightChangeListener == null || rawContentHeight == lastNotifiedHeight) {
            return;
        }
        lastNotifiedHeight = rawContentHeight;
        final OnContentHeightChangeListener target = heightChangeListener;
        final int height = rawContentHeight;
        post(() -> {
            //post 期间可能已换绑，监听换了就不再回调旧的
            if (heightChangeListener == target) {
                target.onContentHeightChanged(height);
            }
        });
    }
```

- [ ] **Step 4: 改写 `isFoldNeeded`，删除 `applyFold` 及其辅助方法**

`isFoldNeeded` 整个替换为：

```java
    /** 夹高前的内容真高超过限高即需要折叠 */
    public boolean isFoldNeeded(int maxHeightPx) {
        return rawContentHeight > maxHeightPx;
    }
```

删除下列四个方法（含其 javadoc 注释块）：`applyFold(boolean, int)`、`totalHeight()`、`outerHeight(View)`、`topMarginOf(View)`。

删完后 `import android.view.View;` 仍被 `disableFocusAndLongClick` 之外的代码用到吗？——`bind` 里没用，`applyFold` 删了之后 `View` 只剩不再需要的引用；若编译报 unused 不影响（Java 不报），但 `ViewGroup` 仍被 `segmentLayoutParams` 用到，两个 import 都保留即可，不要动。

- [ ] **Step 5: 更新类头注释**

类顶部注释整块替换（原文写的是「折叠按段取舍」，已作废）：

```java
/**
 * 正文段栈：富文本段用 TextView，表格段用可横滚的 ZXMarkdownTableView。
 *
 * 折叠对齐 PC（overflow:hidden + max-height）：超限一律由外框 heightCap 裁到限高，
 * 子段永远完整测量、永远不改可见性。早先按段取舍的做法已删除——
 * 「标题 + 一张大表格」这种最常见结构下表格永远放不下，会被整块隐藏。
 */
```

- [ ] **Step 6: 编译验证**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug
```
期望：`BUILD SUCCESSFUL`。若报 `cannot find symbol: applyFold`，说明 T3 还没做，属预期——此时先只跑 `:IM:compileOnTestDebugJavaWithJavac` 会失败，**跳过本步，与 T3 合并后再编译**（T3 Step 6 会跑完整编译）。

- [ ] **Step 7: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java
git commit -m "fix(markdown): 段栈折叠判定改用夹高前真高，删除按段取舍"
```

---

### Task 3: provider 四个入口统一 cap 语义

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java`

**Interfaces:**
- Consumes（T2 产出）：`setHeightCap(int)`、`isFoldNeeded(int)`、`setOnContentHeightChangeListener(OnContentHeightChangeListener)`

**不变量：任何一条路径退出时，段栈的 cap 状态必须与「按钮是否显示」一致。**

- [ ] **Step 1: 主 bind 的折叠分支——换成监听驱动**

`bindView` 里，把当前的

```java
                holder.llExpand.setVisibility(View.GONE);
                holder.rlFold.setVisibility(View.GONE);
                int finalMaxHeight = maxHeight;
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    // 折叠判定要等测量，但不能让段栈先以完整高度参与一次布局（长回复实测 4.8 万 px），
                    // 否则滚动中列表内容总高暴涨再塌回，视口被顶飞、翻历史被拽回最新卡片。
                    // 这里当帧先硬顶住外框高度，下面 post 里的按段折叠只做精修。
                    holder.mdContentStack.setHeightCap(finalMaxHeight);
                    // 段栈路径：按段取舍，裁剪线不会把表格切一半
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
```

整块替换为：

```java
                holder.llExpand.setVisibility(View.GONE);
                holder.rlFold.setVisibility(View.GONE);
                int finalMaxHeight = maxHeight;
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    // 当帧先硬顶住外框高度：不能让段栈以完整高度参与一次布局（长回复实测 4.8 万 px），
                    // 否则滚动中列表内容总高暴涨再塌回，视口被顶飞、翻历史被拽回最新卡片。
                    holder.mdContentStack.setHeightCap(finalMaxHeight);
                    // 判定跟着真高走：表格测量、异步图片回来都会改高度，一次性 post 会漏
                    holder.mdContentStack.setOnContentHeightChangeListener(rawHeight -> {
                        if (var4.isTxtExpand()) {
                            //已被用户展开，折叠判定不再介入
                            return;
                        }
                        if (holder.mdContentStack.isFoldNeeded(finalMaxHeight)) {
                            holder.mdContentStack.setHeightCap(finalMaxHeight);
                            holder.llExpand.setVisibility(View.VISIBLE);
                            setExpandBackground(holder, style, isSend);
                        } else {
                            //不需折叠必须把夹子撤掉，否则内容被 padding 顶出限高时会被裁死且无按钮
                            holder.mdContentStack.setHeightCap(0);
                            holder.llExpand.setVisibility(View.GONE);
                        }
                    });
                } else {
```

`else` 分支（单 TextView 路径）**原样保留**，但要在其开头加一行清监听，防 holder 复用残留：

```java
                } else {
                    //单 TextView 路径：段栈不参与，必须清掉上一条消息留下的监听与限高
                    holder.mdContentStack.setOnContentHeightChangeListener(null);
                    holder.mdContentStack.setHeightCap(0);
                    // 原单 TextView 路径，行为保持不变
                    holder.mTvContent.setMaxHeight(maxHeight);
```

（后面 `holder.mTvContent.post(...)` 那段不动。）

- [ ] **Step 2: 主 bind 的展开态分支——补清监听**

把

```java
            if (var4.isTxtExpand()) {
                //holder 会复用，展开态必须清掉上一条卡片留下的同步限高
                holder.mdContentStack.setHeightCap(0);
            }
```

替换为：

```java
            if (var4.isTxtExpand()) {
                //holder 会复用，展开态必须清掉上一条卡片留下的同步限高与折叠监听
                holder.mdContentStack.setOnContentHeightChangeListener(null);
                holder.mdContentStack.setHeightCap(0);
            }
```

- [ ] **Step 3: 展开 / 收起点击——去掉 `applyFold`**

「展开按钮点击事件」里：

```java
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    holder.mdContentStack.setHeightCap(0);
                    holder.mdContentStack.applyFold(false, 0);
                } else {
```
→
```java
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    holder.mdContentStack.setHeightCap(0);
                } else {
```

「收起按钮点击事件」里：

```java
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    holder.mdContentStack.setHeightCap(maxHeight);
                    holder.mdContentStack.applyFold(true, maxHeight);
                } else {
```
→
```java
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    holder.mdContentStack.setHeightCap(maxHeight);
                } else {
```

- [ ] **Step 4: `defaultModuleLongMessageContentExpandOrFold` —— 去掉 `applyFold`**

```java
            if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                holder.mdContentStack.setHeightCap(0);
                holder.mdContentStack.applyFold(false, 0);
            } else {
```
→
```java
            if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                holder.mdContentStack.setHeightCap(0);
            } else {
```

```java
            if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                holder.mdContentStack.setHeightCap(maxHeight);
                holder.mdContentStack.applyFold(true, maxHeight);
            } else {
```
→
```java
            if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                holder.mdContentStack.setHeightCap(maxHeight);
            } else {
```

- [ ] **Step 5: `referUnitXuanFuPrimaryActionCardView`（引用悬浮）—— 补段栈处理**

当前只设了 `mTvContent.setMaxHeight`，含表格的卡片在这里高度完全不受限。把

```java
            holder.mTvContent.setMaxHeight(referUnitMaxHeightDP);
            holder.mTvContent.post(() -> {
                int heightMeasureSpec = holder.mTvContent.getHeight();
                if (heightMeasureSpec >= referUnitMaxHeightDP) {
                    holder.rl_refer_unit_expand.setVisibility(View.VISIBLE);

                }
            });
```

替换为：

```java
            if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                //含表格的源消息也要限高，否则引用悬浮里长表格撑满屏幕
                holder.mdContentStack.setHeightCap(referUnitMaxHeightDP);
                holder.mdContentStack.setOnContentHeightChangeListener(rawHeight -> {
                    if (holder.mdContentStack.isFoldNeeded(referUnitMaxHeightDP)) {
                        holder.mdContentStack.setHeightCap(referUnitMaxHeightDP);
                        holder.rl_refer_unit_expand.setVisibility(View.VISIBLE);
                    } else {
                        holder.mdContentStack.setHeightCap(0);
                        holder.rl_refer_unit_expand.setVisibility(View.GONE);
                    }
                });
            } else {
                //单 TextView 路径：清掉上一条消息可能留下的段栈监听与限高
                holder.mdContentStack.setOnContentHeightChangeListener(null);
                holder.mdContentStack.setHeightCap(0);
                holder.mTvContent.setMaxHeight(referUnitMaxHeightDP);
                holder.mTvContent.post(() -> {
                    int heightMeasureSpec = holder.mTvContent.getHeight();
                    if (heightMeasureSpec >= referUnitMaxHeightDP) {
                        holder.rl_refer_unit_expand.setVisibility(View.VISIBLE);
                    }
                });
            }
```

- [ ] **Step 6: `referUnitPrimaryExpandOrFold`（聚合列表首条源消息展开）—— 补段栈复位**

把

```java
            holder.llExpand.setVisibility(View.GONE);
            holder.mTvContent.setMaxHeight(Integer.MAX_VALUE);
            holder.rlFold.setVisibility(View.VISIBLE);
```

替换为：

```java
            holder.llExpand.setVisibility(View.GONE);
            holder.mTvContent.setMaxHeight(Integer.MAX_VALUE);
            //含表格的源消息走段栈，只放开 tv_content 展不开
            holder.mdContentStack.setOnContentHeightChangeListener(null);
            holder.mdContentStack.setHeightCap(0);
            holder.rlFold.setVisibility(View.VISIBLE);
```

- [ ] **Step 7: 渲染异常兜底复位**

`bindView` 里 `catch (Exception e) {` 之后**第一行**插入（另一处 `catch (Exception e) { holder.mTvContent.setText(var3.getContent()); }` 在 `referUnitXuanFuPrimaryActionCardView` 里，同样处理）：

```java
                //渲染中途抛异常时段栈可能已挂了半截内容，整条退回纯文本控件并复位限高与监听
                android.util.Log.w("ZXCard", "AI 卡片富文本渲染失败，退回纯文本", e);
                holder.mdContentStack.setOnContentHeightChangeListener(null);
                holder.mdContentStack.setHeightCap(0);
                holder.mdContentStack.setVisibility(View.GONE);
                holder.mTvContent.setVisibility(View.VISIBLE);
```

- [ ] **Step 8: 编译验证**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug
```
期望：`BUILD SUCCESSFUL`

- [ ] **Step 9: 确认 `applyFold` 已彻底消失**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
grep -rn 'applyFold' --include='*.java' --include='*.kt' .
```
期望：**无输出**（exit code 1）

- [ ] **Step 10: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git add IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
git commit -m "fix(chat): AI 卡片四个入口统一段栈限高语义，修表格被裁却无查看更多"
```

---

### Task 4: 静态自查——复用与不变量

**Files:**
- Modify（若发现问题才改）：上述两个 java 文件

无自动化测试兜底，这一步用 grep + 人工核对代替单测。

- [ ] **Step 1: 核对每条路径都成对处理了 cap 与监听**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
grep -n 'setHeightCap\|setOnContentHeightChangeListener\|llExpand.setVisibility\|rl_refer_unit_expand.setVisibility' \
  IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
```

逐条核对下表，任一行不成立就回到 T3 补：

| 路径 | cap | 监听 | 按钮 |
|------|-----|------|------|
| 主 bind · 展开态（`isTxtExpand`） | 0 | null | GONE |
| 主 bind · 段栈 · 需折叠 | max | 已设 | VISIBLE |
| 主 bind · 段栈 · 不需折叠 | 0 | 已设 | GONE |
| 主 bind · 单 TextView | 0 | null | 由 tv_content 的 post 决定 |
| 展开点击 | 0 | 保留（有 `isTxtExpand` 守卫） | GONE |
| 收起点击 | max | 保留 | VISIBLE |
| `defaultModule...` 展开 / 收起 | 0 / max | 保留 | GONE / VISIBLE |
| 引用悬浮 · 段栈 | max 或 0 | 已设 | 按判定 |
| 引用悬浮 · 单 TextView | 0 | null | 由 tv_content 的 post 决定 |
| `referUnitPrimaryExpandOrFold` 展开 | 0 | null | GONE |
| catch 兜底 | 0 | null | 不改（段栈已 GONE） |

- [ ] **Step 2: 核对回归红线未被碰**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
grep -n 'FOCUS_BLOCK_DESCENDANTS\|setFocusable(false)\|setLongClickable(false)' \
  IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java \
  IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java
grep -n 'maxHeightDP = 480' IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
```
期望：段栈 3 处禁获焦 + 1 处禁长按、`disableFocusAndLongClick` 内 4 处、表格 3 处禁获焦 + 禁长按、单元格禁长按均在；`maxHeightDP = 480` 未变。

- [ ] **Step 3: 核对 `setHeightCap` 仍是当帧硬夹**

打开 `ZXMarkdownContentView.onMeasure`，确认 clamp 逻辑仍在 `onMeasure` 内（不是挪进 `post`）。

- [ ] **Step 4: 若前三步都通过，无需提交（无改动）；有修正则提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git status --short
# 有改动才执行：
git add -u && git commit -m "fix(chat): 补齐段栈限高与折叠监听在各路径的复位"
```

---

### Task 5: 构建测试包

**Files:** 无

- [ ] **Step 1: 构建 onTest debug 包**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug
ls -lh smart_message/build/outputs/apk/onTest/debug/
```
期望：`BUILD SUCCESSFUL` + apk 文件存在

- [ ] **Step 2: 装机**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
adb devices -l              # 期望：至少一台状态为 device（不是 unauthorized/offline）
bash .cursor/commands/scripts/zhixin-run-android.sh --quick
```
若报 `INSTALL_FAILED_USER_RESTRICTED`：手机上开「USB 安装」后重试。
若设备不可用：**停在这里，向用户报告阻塞**，T6 无法进行。

---

### Task 6: 真机验收 + 采集打点

**Files:** 无（只观察，结论写进 `status.md` / `impl-notes.md`）

- [ ] **Step 1: 开始抓打点日志**

```bash
adb logcat -c
adb logcat -s ZXTableDiag ZXCard
```
（另开一个终端做界面操作。）

- [ ] **Step 2: 打开含报餐统计卡片的会话，比对三个值**

在日志里找同一帧的两行，比对：

| 判断 | 结论 |
|------|------|
| `表格 self` == `内层 TableLayout` | 纯外框问题，本方案已完整覆盖 |
| `表格 self` < `内层 TableLayout` | **第二个独立缺陷成立**——表格 `HorizontalScrollView` 自身被限高，展开后表格仍显示不全。记录 `heightSpec` 的值（`AT_MOST`/`EXACTLY`/`UNSPECIFIED` + 数值），写进 `impl-notes.md`，**本期不修**，另开缺陷 |

- [ ] **Step 3: 过验收矩阵**

逐项人工验证，每项记 ✅/❌：

| # | 场景 | 期望 |
|---|------|------|
| 1 | 报餐统计卡片（表格，总高约 494dp） | 夹在 480dp，显示「查看更多」，点开表格完整 |
| 2 | 超长表格卡片（远超 480dp） | 同上 |
| 3 | 刚好不超限的表格卡片 | 不夹、无按钮、内容完整 |
| 4 | 纯文本长卡片（无表格） | 行为不变 |
| 5 | 展开后点「收起」 | 回到 480dp，按钮重现 |
| 6 | 快速上下滚动消息列表 | 无按钮错位 / 高度残留 |
| 7 | 翻历史 | 不被拽回最新卡片 |
| 8 | 气泡长按 | 转发 / 回复菜单正常弹出 |
| 9 | 引用悬浮单元 / 引用预览 / 合并转发详情的表格卡片 | 限高与展开图标正确 |

- [ ] **Step 4: 任一项 ❌ 则停下报告，不要自行扩大改动范围**

---

### Task 7: 清临时日志 + 文档收尾

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java`
- Modify: `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java`
- Modify: `context/features/20260820-安卓-markdown表格消息截断且无查看更多按钮/status.md`
- Modify: `context/features/20260820-安卓-markdown表格消息截断且无查看更多按钮/impl-notes.md`

- [ ] **Step 1: 删掉 T1 加的临时日志**

删除 `ZXMarkdownContentView.onMeasure` 里那两行 `Log.d("ZXTableDiag", ...)`（含 `// TODO 临时` 注释），以及 `ZXMarkdownTableView` 里整个新增的 `onMeasure` 覆写。

`Log.w("ZXCard", ...)` 是常驻兜底日志，**保留**。

- [ ] **Step 2: 确认已清干净**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
grep -rn 'ZXTableDiag' --include='*.java' .
```
期望：**无输出**

- [ ] **Step 3: 重新编译**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug
```
期望：`BUILD SUCCESSFUL`

- [ ] **Step 4: 提交代码**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java \
        IM/src/main/java/com/im/message_type/robot/ZXMarkdownTableView.java
git commit -m "chore(markdown): 清理定位用临时打点"
```

- [ ] **Step 5: 写 impl-notes**

在 `impl-notes.md` 记下平台无关的结论：

- 折叠判定与实际裁剪必须用同一个高度量；容器自身 padding 是最容易漏掉的差值
- 「按段取舍」在「标题 + 一张大表格」结构上失效（表格永远放不下 → 整块消失），三端统一走「只裁不取舍」
- 一次性 `post` 判定漏掉异步内容（图片、表格测量）导致的高度变化，需改成高度变化监听
- T6 Step 2 的三值比对结论（表格是否自身被限高）

- [ ] **Step 6: 更新 status.md 平台矩阵与待办**

每个 Task 一行，标 ✅/🚧/❌ 与 commit hash。

- [ ] **Step 7: 提交 context 文档**

```bash
cd /Users/nic/w/ai-dev-workspace
git add "context/features/20260820-安卓-markdown表格消息截断且无查看更多按钮"
git commit -m "docs(android-md-table-truncate): 记 T1-T7 进展与真机结论"
```

---

## 任务与端的对应

| Task | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T1 打点 | — | ✔ | — | — |
| T2 段栈判定源 | — | ✔ | — | — |
| T3 provider 四入口 | — | ✔ | — | — |
| T4 静态自查 | — | ✔ | — | — |
| T5 构建装机 | — | ✔ | — | — |
| T6 真机验收 | — | ✔ | — | — |
| T7 清理收尾 | — | ✔ | — | — |
