# 安卓 ActionCard 卡片内容被截断 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修掉安卓 AI 卡片的两个截断缺陷——含表格卡片被夹高却不出「查看更多」（A）、不含表格卡片展开后知识来源仍不显示（B）。

**Architecture:** A 的修法是把折叠判定收回 `ZXMarkdownContentView` 自己：`onMeasure` 在夹高前记下真实内容高度，判定不再依赖 `post` 时子 View 是否测量完；并强制「不需折叠 ⇒ 复位 heightCap」这条不变量。B 先在真机打点定位（三条假设），再按定位结果修，修法代码本计划已按假设分支写全。

**Tech Stack:** Java 8、Android SDK 28、Markwon 4.6.2、Gradle 6.5 / AGP 4.2.2。**本仓库无单元测试、无 lint 兜底**，每个任务的验证手段是「真机 onTest + logcat 断言 + 肉眼比对」，不是 `./gradlew test`。

## Global Constraints

- 涉及端：**仅 android**。PC / iOS / web 本期不动（三端 markdown 管线不共享）。
- 注释一律中文。语言以 Java 为主，沿用 `IM/src/main/java/com/im/message_type/robot/` 既有风格。
- 构建：`./gradlew assembleOnTestDebug`；装机：`bash .cursor/commands/scripts/zhixin-run-android.sh`（等价 `./gradlew installOnTestDebug`）。JDK 必须是 8 或 11。
- 折叠限高常量不许改：`maxHeightDP = 480`（`ActionCardMessageItemProvider.java:114`）。
- **不许破**：段栈子 View 禁获焦（`ZXMarkdownContentView#init` 的 `FOCUS_BLOCK_DESCENDANTS`）与 `setHeightCap` 当帧硬夹机制——这两条是上一轮修「翻历史被拽回最新 AI 卡片」的成果。
- 诊断日志统一 TAG `ZXCardDiag`，**必须在 Task 7 全部删除**后才算完工。
- 提交信息格式：`fix(actioncard): <一句话>`。

---

### Task 0: 切分支

**Files:**
- 无文件改动（仅 git）

**Interfaces:**
- Consumes: 无
- Produces: 分支 `fix/actioncard-content-truncate`，后续所有任务在其上提交

- [ ] **Step 1: 确认工作区干净**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git status --short
git branch --show-current
```

Expected: `git status --short` 无输出；当前分支 `feat/gfm-markdown`。若有脏文件，先问用户，**不要**自行 stash 或丢弃。

- [ ] **Step 2: 切分支**

```bash
git checkout -b fix/actioncard-content-truncate
git branch --show-current
```

Expected: 输出 `fix/actioncard-content-truncate`。

---

### Task 1: 调试页加两条真实样本（隔离「渲染是否抛异常」）

目的：B 的假设 1 是「渲染过程抛异常 → 走 catch 兜底 → 知识来源根本没拼进去」。调试页只跑渲染管线不跑业务，能一步排除或坐实这条。

**Files:**
- Modify: `IM/src/main/java/com/im/debug/MarkdownGfmCasesActivity.java:26-59`（`CASES` 数组末尾追加两条）

**Interfaces:**
- Consumes: `ZXMarkdownSegmenter.split(Markwon, String)`、`ZXMarkdownContentView#bind(Markwon, List<ZXMarkdownSegment>, int, float)`（均已存在）
- Produces: 用例 ID `R1`（含表格样本正文）、`R2`（不含表格样本正文），供 Task 2 复现使用

- [ ] **Step 1: 在 CASES 数组末尾追加两条真实样本**

在 `{"H3", "删除线", "~~划掉的内容~~"},` 之后、`};` 之前插入：

```java
            // R1/R2 是线上真实卡片正文（feature 20260820）。R1 含 17 行表格，R2 含 reference 标签。
            {"R1", "真实卡片·报餐统计（含表格）",
                    "## 今日午餐报餐统计（2026-08-20）\n\n" +
                    "| 序号 | 部门 | 标准餐（人） | 清真餐（人） | 合计（人） | 提报时间 |\n" +
                    "|:---:|:---|:---:|:---:|:---:|:---:|\n" +
                    "| 1 | 采购品质部 | 8 | 0 | 8 | 08:50 |\n" +
                    "| 2 | 预算经济部 | 4 | 0 | 4 | 09:07 |\n" +
                    "| 3 | 信息技术部 | 8 | 0 | 8 | 08:53 |\n" +
                    "| 4 | 市场总部 | 3 | 1 | 4 | 09:06 |\n" +
                    "| 5 | 合同法务部 | 6 | 0 | 6 | 09:07 |\n" +
                    "| 6 | 美腾工程公司（工业设计研究院） | 15 | 0 | 15 | 09:31 |\n" +
                    "| 7 | 鲸航工业科技 | 6 | 0 | 6 | 09:20 |\n" +
                    "| 8 | 人力资源部 | 6 | 0 | 6 | 09:00 |\n" +
                    "| 9 | 总部财务中心 | 10 | 0 | 10 | 08:52 |\n" +
                    "| 10 | 美腾工程（项目板块） | — | — | — | 未报餐 |\n" +
                    "| 11 | 合同中心经销部 | 5 | 0 | 5 | 09:33 |\n" +
                    "| 12 | 董事会办公室（董办） | — | — | — | 未报餐 |\n" +
                    "| 13 | 工业智能研究院 | 26 | 1 | 27 | 09:38 |\n" +
                    "| 14 | 系统运营事业部 | 16 | 0 | 16 | 09:38 |\n" +
                    "| 15 | 矿业院 | 7 | 0 | 7 | 09:03 |\n" +
                    "| 16 | 资源院 | 2 | 0 | 2 | 09:03 |\n" +
                    "| **合计** | **14个已报餐部门** | **122** | **2** | **124** | — |\n\n" +
                    "### ⚠️ 未报餐部门提示\n\n" +
                    "以下 **2个** 部门尚未提交今日午餐报餐，请尽快提报：\n\n" +
                    "1. **美腾工程（项目板块）**\n" +
                    "2. **董事会办公室（董办）**\n\n" +
                    "> 说明：宋瑞珍提报的\"工业智能研究\"按部门清单对应为\"工业智能研究院\"；资源院标准餐2人中含外包1人。"},
            {"R2", "真实卡片·报销制度（无表格 + reference）",
                    "根据《员工手册2026.pdf》，公司报销制度的核心要点如下：\n\n" +
                    "## 一、日常费用报销\n\n" +
                    "**1. 费用范围**\n" +
                    "日常费用主要包括差旅费、交通费、办公费、低值易耗品、业务招待费等。" +
                    "<reference data-ref=\"_agent_file_doc_id_2079906448088322049\"></reference>\n\n" +
                    "**2. 报销流程**\n" +
                    "员工通过线上系统或线下申请单提交报销单 → 财务人员进行费用单据审核。" +
                    "<reference data-ref=\"_agent_file_doc_id_2079906448088322049\"></reference>\n\n" +
                    "**4. 发票粘贴规范**\n" +
                    "- 发票粘贴要整齐有序，同一类发票放一起粘贴；\n" +
                    "- **不允许使用订书钉**。" +
                    "<reference data-ref=\"_agent_file_doc_id_2079906448088322049\"></reference>\n\n" +
                    "---\n\n" +
                    "> 以上内容来源于《员工手册2026.pdf》第5章费用报销相关条款。"},
```

- [ ] **Step 2: 编译**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug
```

Expected: `BUILD SUCCESSFUL`。

- [ ] **Step 3: 装机并打开调试页，看 R1 / R2**

装机：`bash .cursor/commands/scripts/zhixin-run-android.sh`
打开 `MarkdownGfmCasesActivity`（入口见 `IM/src/main/java/com/im/debug/` 既有调起方式；找不到入口就用 `adb shell am start -n <包名>/com.im.debug.MarkdownGfmCasesActivity`，包名取 onTest flavor 的 `.test` 后缀包名）。

同时开日志：

```bash
adb logcat -s AndroidRuntime:E ZXCardDiag:D
```

Expected 判定：
- R1、R2 都渲染出来且无异常 → **B 的假设 1（渲染抛异常）排除**，把结论记进 Task 2 的 impl-notes 草稿。
- 任一条崩或 logcat 出现异常栈 → 假设 1 坐实，Task 5 走分支 B-1。

- [ ] **Step 4: 提交**

```bash
git add IM/src/main/java/com/im/debug/MarkdownGfmCasesActivity.java
git commit -m "fix(actioncard): 调试页加两条线上真实卡片正文用例，隔离渲染异常"
```

---

### Task 2: B 缺陷真机打点定位

目的：区分 B 的三条假设。**只加日志，不改行为。**

**Files:**
- Modify: `IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java`（`:295` 前后、`:324` catch 块、`:890` 附近）

**Interfaces:**
- Consumes: `MarkDownProcessResult#getAgentKnowledgeList()`、`addKnowledgeDocList(SpannableStringBuilder, List<KnowledgeDoc>)`
- Produces: logcat TAG `ZXCardDiag` 的三行诊断输出，Task 5 依据它选分支

- [ ] **Step 1: 在 preprocess 结尾打点 useDocList**

在 `result.setAgentKnowledgeList(useDocList);`（`ActionCardMessageItemProvider.java:890`）之前插入：

```java
        // TODO 临时诊断（feature 20260820），定位知识来源丢失，Task 7 删除
        StringBuilder diagIds = new StringBuilder();
        for (KnowledgeDoc item : agentKnowledgeList) {
            diagIds.append(item.getDocId()).append('|');
        }
        android.util.Log.d("ZXCardDiag", "preprocess 入参 docId=" + diagIds
                + " 命中 order 的 docId=" + docIdToOrder.keySet()
                + " 过滤后 useDocList=" + useDocList.size());
```

- [ ] **Step 2: 在单 TextView 路径打点最终文本尾部**

在 `holder.mTvContent.setText(ssb);`（`:296`）之前插入：

```java
                        // TODO 临时诊断（feature 20260820），Task 7 删除
                        int diagTailFrom = Math.max(0, ssb.length() - 30);
                        android.util.Log.d("ZXCardDiag", "无表格路径 ssb 长度=" + ssb.length()
                                + " 尾部=" + ssb.subSequence(diagTailFrom, ssb.length())
                                + " 知识来源条数=" + result.getAgentKnowledgeList().size());
```

- [ ] **Step 3: 在 catch 兜底分支打点**

在 `} catch (Exception e) {`（`:324`）之后的第一行插入：

```java
                // TODO 临时诊断（feature 20260820），Task 7 删除
                android.util.Log.d("ZXCardDiag", "走了 catch 兜底，知识来源会丢失", e);
```

- [ ] **Step 4: 编译装机，打开含样本 B 的会话，抓日志**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug && bash .cursor/commands/scripts/zhixin-run-android.sh
adb logcat -c && adb logcat -s ZXCardDiag:D
```

在真机上滑到「报销制度」那条卡片（`messageUId` `D03K-EQ8P-HBSE-SIRP`），点「查看更多」展开。

判定表：

| logcat 观察 | 结论 | Task 5 走哪个分支 |
|-------------|------|-------------------|
| 出现「走了 catch 兜底」 | 渲染抛异常 | B-1 |
| `过滤后 useDocList=0` | docId 没对上 | B-2 |
| `useDocList=1` 且 `尾部=...员工手册2026.pdf` 但屏幕上看不到 | 文本在、没画出来 | B-3 |

- [ ] **Step 5: 记录结论**

把观察到的原始日志行与结论写进 `context/features/20260820-安卓-ActionCard卡片消息内容被截断/impl-notes.md` 的「定位过程」小节（文件此时可能还是模板，直接补写该小节）。

- [ ] **Step 6: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git add IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
git commit -m "fix(actioncard): 加临时诊断日志定位知识来源丢失（Task 7 删）"
```

---

### Task 3: 段栈自报真实高度 + 折叠状态回调（A 的核心修法）

**Files:**
- Modify: `IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java:36`（新增字段）、`:181-193`（`onMeasure` / `isFoldNeeded`）

**Interfaces:**
- Consumes: 无
- Produces:
  - `public interface OnFoldStateListener { void onFoldStateResolved(boolean foldNeeded); }`
  - `public void setOnFoldStateListener(OnFoldStateListener l)`
  - `public boolean isFoldNeeded(int maxHeightPx)`（签名不变，实现改为用 `rawContentHeight`）
  - `public int getRawContentHeight()`

- [ ] **Step 1: 加字段与回调接口**

在 `private int heightCapPx = 0;`（`:36`）之后插入：

```java
    //夹高之前的真实内容高度。折叠判定只认它，不再累加子 View 的 measuredHeight——
    //表格段是 HorizontalScrollView，post 里去读子 View 高度可能读到还没测量完的 0。
    private int rawContentHeight = 0;
    //上一次上报过的折叠判定结果，用于去重，避免每次 measure 都回调
    private Boolean lastFoldNeeded = null;
    private int lastFoldThreshold = -1;
    private OnFoldStateListener foldStateListener;

    /** 段栈测量完成后上报「是否需要折叠」，调用方据此显/隐「查看更多」 */
    public interface OnFoldStateListener {
        void onFoldStateResolved(boolean foldNeeded);
    }

    public void setOnFoldStateListener(OnFoldStateListener listener) {
        this.foldStateListener = listener;
        //换绑新消息时旧判定作废
        this.lastFoldNeeded = null;
        this.lastFoldThreshold = -1;
    }

    public int getRawContentHeight() {
        return rawContentHeight;
    }
```

- [ ] **Step 2: onMeasure 记录真实高度并上报判定**

把 `onMeasure`（`:181-188`）整体替换为：

```java
    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
        //夹高之前先把真高存下来。展开态（heightCapPx == 0）也会走这里，值同样有效。
        int measured = getMeasuredHeight();
        if (measured > 0) {
            rawContentHeight = measured;
        }
        //子 View 照常按完整高度测量，isFoldNeeded / applyFold 的判定不受影响；这里只夹外框
        if (heightCapPx > 0 && measured > heightCapPx) {
            setMeasuredDimension(getMeasuredWidth(), heightCapPx);
        }
        notifyFoldStateIfNeeded();
    }

    /**
     * 测量完成后上报折叠判定。
     * 阈值取当前的 heightCapPx；展开态不上报（此时没有阈值可言）。
     * 同一阈值下结果没变就不重复回调，避免 measure 抖动引发布局风暴。
     */
    private void notifyFoldStateIfNeeded() {
        if (foldStateListener == null || heightCapPx <= 0 || rawContentHeight <= 0) {
            return;
        }
        boolean foldNeeded = rawContentHeight > heightCapPx;
        if (lastFoldNeeded != null && lastFoldNeeded == foldNeeded && lastFoldThreshold == heightCapPx) {
            return;
        }
        lastFoldNeeded = foldNeeded;
        lastFoldThreshold = heightCapPx;
        final boolean result = foldNeeded;
        //回调里会改 visibility / 触发 requestLayout，不能在 measure 过程中同步做
        post(() -> {
            if (foldStateListener != null) {
                foldStateListener.onFoldStateResolved(result);
            }
        });
    }
```

- [ ] **Step 3: isFoldNeeded 改用真高**

把 `isFoldNeeded`（原 `:191-193`）替换为：

```java
    /**
     * 内容总高超过限高即需要折叠。
     * 用夹高前记录的 rawContentHeight，而不是现算子 View 高度——
     * 后者在表格段尚未完成第二轮测量时会得到 0，判成「不需折叠」，
     * 于是按钮不出、heightCap 还留着，卡片被夹死且无展开入口（feature 20260820 的 A 缺陷）。
     */
    public boolean isFoldNeeded(int maxHeightPx) {
        return rawContentHeight > maxHeightPx;
    }
```

- [ ] **Step 4: setHeightCap 复位时清判定缓存**

把 `setHeightCap`（`:174-179`）的方法体替换为：

```java
    public void setHeightCap(int capPx) {
        if (heightCapPx != capPx) {
            heightCapPx = capPx;
            //阈值变了，上一次的判定结果作废
            lastFoldNeeded = null;
            lastFoldThreshold = -1;
            requestLayout();
        }
    }
```

- [ ] **Step 5: 编译**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug
```

Expected: `BUILD SUCCESSFUL`。（此时 provider 还没接回调，界面行为不变，属正常。）

- [ ] **Step 6: 提交**

```bash
git add IM/src/main/java/com/im/message_type/robot/ZXMarkdownContentView.java
git commit -m "fix(actioncard): 段栈记录夹高前真实高度并上报折叠判定"
```

---

### Task 4: provider 三个入口改接回调，守住「不折叠必复位 cap」

**Files:**
- Modify: `IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java:365-382`（气泡绑定）、`:501-524`（`defaultModuleLongMessageContentExpandOrFold`）、`:528` 起的 `referUnitXuanFuPrimaryActionCardView` 中对应段落

**Interfaces:**
- Consumes: Task 3 的 `setOnFoldStateListener(OnFoldStateListener)`、`isFoldNeeded(int)`、`applyFold(boolean, int)`、`setHeightCap(int)`
- Produces: 三处入口行为一致；「不需折叠 ⇒ `setHeightCap(0)`」不变量成立

- [ ] **Step 1: 气泡绑定路径改回调**

把 `:365-382` 的段栈分支：

```java
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    holder.mdContentStack.setHeightCap(finalMaxHeight);
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

替换为：

```java
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    // 折叠判定要等测量，但不能让段栈先以完整高度参与一次布局（长回复实测 4.8 万 px），
                    // 否则滚动中列表内容总高暴涨再塌回，视口被顶飞、翻历史被拽回最新卡片。
                    // 这里当帧先硬顶住外框高度，判定结果由段栈测量完成后回调回来。
                    holder.mdContentStack.setHeightCap(finalMaxHeight);
                    holder.mdContentStack.setOnFoldStateListener(foldNeeded -> {
                        if (foldNeeded) {
                            holder.mdContentStack.applyFold(true, finalMaxHeight);
                            holder.llExpand.setVisibility(View.VISIBLE);
                            setExpandBackground(holder, style, isSend);
                        } else {
                            // ⚠️ 不变量：不需折叠时必须复位 heightCap，
                            // 否则外框继续被夹在限高上，且按钮不出 —— 内容被切死没有展开入口。
                            holder.mdContentStack.setHeightCap(0);
                            holder.mdContentStack.applyFold(false, finalMaxHeight);
                            holder.llExpand.setVisibility(View.GONE);
                        }
                    });
                } else {
```

- [ ] **Step 2: 「收起内容」悬浮入口补同一套判定**

把 `defaultModuleLongMessageContentExpandOrFold` 的折叠分支（`:515-523` 附近，`else` 里那段）：

```java
            holder.llExpand.setVisibility(View.VISIBLE);
            int maxHeight = WindowUtils.dp2px(maxHeightDP);
            if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                holder.mdContentStack.setHeightCap(maxHeight);
                holder.mdContentStack.applyFold(true, maxHeight);
            } else {
                holder.mTvContent.setMaxHeight(maxHeight);
            }
```

替换为：

```java
            int maxHeight = WindowUtils.dp2px(maxHeightDP);
            if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                holder.mdContentStack.setHeightCap(maxHeight);
                // 内容本来就没超限时不该出按钮，也不该继续夹高（同气泡绑定路径的不变量）
                if (holder.mdContentStack.isFoldNeeded(maxHeight)) {
                    holder.mdContentStack.applyFold(true, maxHeight);
                    holder.llExpand.setVisibility(View.VISIBLE);
                } else {
                    holder.mdContentStack.setHeightCap(0);
                    holder.mdContentStack.applyFold(false, maxHeight);
                    holder.llExpand.setVisibility(View.GONE);
                }
            } else {
                holder.mTvContent.setMaxHeight(maxHeight);
                holder.llExpand.setVisibility(View.VISIBLE);
            }
```

- [ ] **Step 3: 展开入口清掉监听，避免复用串台**

在「展开按钮点击事件」（`:396` 起的 `holder.llFoldExpand.setOnClickListener`）里，把段栈分支：

```java
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    holder.mdContentStack.setHeightCap(0);
                    holder.mdContentStack.applyFold(false, 0);
                } else {
```

替换为：

```java
                if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                    // 展开态没有阈值可言，先摘监听再复位，免得回调把按钮又点亮
                    holder.mdContentStack.setOnFoldStateListener(null);
                    holder.mdContentStack.setHeightCap(0);
                    holder.mdContentStack.applyFold(false, 0);
                } else {
```

在 `defaultModuleLongMessageContentExpandOrFold` 的 `toExpand == true` 分支里（`:506-508`），同样在 `setHeightCap(0)` 之前加一行：

```java
                holder.mdContentStack.setOnFoldStateListener(null);
```

- [ ] **Step 4: 引用悬浮单元路径同步**

在 `referUnitXuanFuPrimaryActionCardView`（`:528` 起）里找到对 `holder.mdContentStack.setHeightCap(...)` / `applyFold(...)` 的调用（`:660` 附近的限高段落），确保它也遵守同一不变量。若该路径当前只压 `holder.mTvContent.setMaxHeight(referUnitMaxHeightDP)`，则在其后补：

```java
            // 引用悬浮单元同样可能是含表格的卡片，只压 tv_content 压不动段栈
            if (holder.mdContentStack.getVisibility() == View.VISIBLE) {
                holder.mdContentStack.setHeightCap(referUnitMaxHeightDP);
                if (!holder.mdContentStack.isFoldNeeded(referUnitMaxHeightDP)) {
                    holder.mdContentStack.setHeightCap(0);
                    holder.mdContentStack.applyFold(false, referUnitMaxHeightDP);
                } else {
                    holder.mdContentStack.applyFold(true, referUnitMaxHeightDP);
                }
            }
```

- [ ] **Step 5: 编译装机，验 A**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug && bash .cursor/commands/scripts/zhixin-run-android.sh
```

真机验收（样本 A，`messageUId` `D03K-9J2E-FFC7-TSGJ`）：

| 检查项 | 期望 |
|--------|------|
| 折叠态 | 卡片高约 480dp，底部**有**「查看更多」按钮，裁剪线不切在表格中间 |
| 点「查看更多」 | 表格完整展开，可横滑，底部出现收起箭头 |
| 右侧悬浮「收起内容」 | 收回 480dp，「查看更多」按钮回来 |
| 短卡片（任意一条 3 行以内的 AI 卡片） | 无按钮，且高度不被夹（不留白） |
| 快速上滑翻历史 | **不被拽回**最新 AI 卡片 |

任一项不符：停下，用 `adb logcat -s ZXCardDiag:D` 复查，不要叠补丁。

- [ ] **Step 6: 提交**

```bash
git add IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
git commit -m "fix(actioncard): 含表格卡片折叠改用段栈回调判定，修被夹高却无展开入口"
```

---

### Task 5: 修 B（按 Task 2 的定位结果择一执行）

**Files:**
- Modify: `IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java`（具体位置见各分支）

**Interfaces:**
- Consumes: Task 2 的 logcat 结论
- Produces: 样本 B 展开后知识来源可见可点

**只做与结论匹配的那个分支。** 三个分支互斥，做完直接跳到 Step 4。

- [ ] **分支 B-1（logcat 出现「走了 catch 兜底」）：兜底也要带知识来源**

catch 块里当前只 `setText(showTxt)`。在 catch 分支给 `holder.mTvContent.setText(...)` 的三处调用之后，统一补挂知识来源。做法：把 catch 块内构造出的 `showTxt` / `ss` 改为先包成 `SpannableStringBuilder`，再追加：

```java
                // 渲染失败兜底也要保留知识来源，否则用户看不到引用出处
                SpannableStringBuilder fallbackSsb = new SpannableStringBuilder(
                        holder.mTvContent.getText());
                if (var3.getAgentKnowledgeList() != null && !var3.getAgentKnowledgeList().isEmpty()) {
                    addKnowledgeDocList(fallbackSsb, var3.getAgentKnowledgeList());
                    holder.mTvContent.setText(fallbackSsb);
                    holder.mTvContent.setMovementMethod(LinkMovementMethod.getInstance());
                }
```

放在 catch 块末尾（三条 setText 分支之后）。同时把异常本身按现有日志规范打出来（`android.util.Log.w("ZXCard", "AI 卡片渲染失败，走兜底", e);`），这条**留下不删**——它是线上定位入口，不属于 Task 7 要清的临时日志。

- [ ] **分支 B-2（`过滤后 useDocList=0`）：docId 匹配放宽**

`preprocess` 里的过滤（`:859-864`）用 `docIdToOrder.containsKey(item.getDocId())` 精确匹配。若日志显示两侧 docId 因空白/大小写对不上，改为：

```java
        //过滤掉没使用的。docId 两侧可能带空白（服务端拼接产物），比较前统一 trim
        List<KnowledgeDoc> useDocList = new ArrayList<>();
        for (KnowledgeDoc item : agentKnowledgeList) {
            String docId = item.getDocId() == null ? "" : item.getDocId().trim();
            if (docIdToOrder.containsKey(docId)) {
                useDocList.add(item);
            }
        }
```

并在 `docIdToOrder.put(docId, orderCounter);` 之前把 key 也 trim：`docId = docId.trim();`。

若日志显示的是**正文里根本没有 reference 标签**（`命中 order 的 docId=[]`），则不是匹配问题而是产品语义问题：此时知识来源应无条件展示。把过滤逻辑改为「命中为空时退回全量」：

```java
        if (useDocList.isEmpty()) {
            //正文没有 reference 角标时不该丢掉知识来源，退回全量展示
            useDocList.addAll(agentKnowledgeList);
        }
```

- [ ] **分支 B-3（`useDocList=1` 且尾部文本正确，但屏幕看不到）：行高 Span 压没了尾行**

`KnowledgeItemLineHeightSpan(lineShrinkPx)` 用负偏移收紧行高。若它把最后一行压到高度 ≤ 0，改为只收紧行间距、保住最小行高。改 `IM/src/main/java/com/im/message_type/robot/KnowledgeItemLineHeightSpan.java:18` 的 `chooseHeight`，加下限保护：

```java
        //收紧后的行高不能小于字体本身的高度，否则最后一行会被压没
        int minHeight = fm.descent - fm.ascent;
        if (fm.descent - fm.ascent - shrinkPx < minHeight / 2) {
            return;   // 收得过狠就不收
        }
```

- [ ] **Step 4: 编译装机，验 B**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
./gradlew assembleOnTestDebug && bash .cursor/commands/scripts/zhixin-run-android.sh
```

真机验收（样本 B，`messageUId` `D03K-EQ8P-HBSE-SIRP`）：

| 检查项 | 期望 |
|--------|------|
| 折叠态 | 有「查看更多」 |
| 展开后 | 底部出现「知识来源」+「[1]员工手册2026.pdf」 |
| 点「[1]员工手册2026.pdf」 | 走 `toGetAgentFileDataByDocId`，打开文档 |
| 正文里的 `[1]` 角标 | 仍可点，行为不变 |

- [ ] **Step 5: 提交**

```bash
git add IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
git commit -m "fix(actioncard): 修无表格卡片知识来源不显示"
```

---

### Task 6: 全入口回归

**Files:**
- 无代码改动（纯验证）；若发现问题，回到对应 Task 修，不在本任务里补丁

**Interfaces:**
- Consumes: Task 4、Task 5 的成果
- Produces: 回归结论，写进 impl-notes

- [ ] **Step 1: 跑完回归矩阵**

装的还是 Task 5 那个包。逐格验：

| 入口 | 含表格卡片 | 无表格 + 知识来源卡片 |
|------|-----------|----------------------|
| 会话页气泡（对方发） | 折叠出按钮 / 展开完整 / 收起复原 | 同左 + 知识来源可见 |
| 会话页气泡（己方发） | 背景九图正确，不发灰 | 同左 |
| 右侧悬浮「收起内容」 | 收回限高且按钮回来 | 同左 |
| 引用悬浮单元 | 限高正确，不夹死 | 同左 |
| 引用预览小卡 | 显示「[卡片]+标题」，不受影响 | 同左 |
| 合并转发详情 | 内容完整可读 | 知识来源可见 |
| 列表快速翻历史 | **不被拽回**最新 AI 卡片 | 同左 |
| 气泡长按 | 转发/回复菜单能弹出（正文不吞长按） | 同左 |

- [ ] **Step 2: 记录结论**

把每格的实际结果（尤其不符预期的）补进 impl-notes 的「自测反馈闭环」小节。

---

### Task 7: 清理临时日志并收尾

**Files:**
- Modify: `IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java`（删 `ZXCardDiag` 三处）
- Modify: `context/features/20260820-安卓-ActionCard卡片消息内容被截断/status.md`、`impl-notes.md`

**Interfaces:**
- Consumes: 前面所有任务
- Produces: 干净的分支 + 更新完的功能文档

- [ ] **Step 1: 删光临时诊断日志**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
grep -rn "ZXCardDiag" IM/src/main/java/
```

Expected: 无输出。有输出就把对应代码块（含 `// TODO 临时诊断（feature 20260820）` 注释）整段删掉后再跑一次。

分支 B-1 补的 `Log.w("ZXCard", ...)` 不在清理范围内，保留。

- [ ] **Step 2: 重新编译确认没删坏**

```bash
./gradlew assembleOnTestDebug
```

Expected: `BUILD SUCCESSFUL`。

- [ ] **Step 3: 提交代码**

```bash
git add IM/src/main/java/com/im/message_type/robot/ActionCardMessageItemProvider.java
git commit -m "fix(actioncard): 删除定位用临时日志"
git log --oneline -6
```

- [ ] **Step 4: 更新 context 文档并提交**

更新 `status.md` 平台矩阵（Task 0-7 每行一格）与「待办/阻塞」；impl-notes 补齐：A 的根因（判定依赖 post 时子 View 测量 + 不折叠不复位 cap）、不变量、B 的定位结论与修法。然后：

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/
git commit -m "docs(android-actioncard-truncate): 记录 A/B 缺陷根因、修法与真机回归结论"
```

---

## 端标注汇总

| Task | 端 |
|------|-----|
| 0 切分支 | android |
| 1 调试页真实样本 | android |
| 2 B 打点定位 | android |
| 3 段栈真高 + 回调 | android |
| 4 provider 三入口接回调 | android |
| 5 修 B | android |
| 6 全入口回归 | android |
| 7 清日志 + 文档 | android（文档在 context 仓库） |
