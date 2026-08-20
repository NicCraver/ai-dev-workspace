# 实现笔记：安卓 AI 卡片 markdown 渲染与折叠

> 平台无关的逻辑提炼。最后更新：2026-08-20

## 一、核心陷阱：LinearLayout 的两轮测量（本次 4 个缺陷的共同根源）

**触发条件**：一个 `match_parent` 宽、且**高度随宽度变化**的子 View，装在 `wrap_content` 宽的
垂直 LinearLayout 里。

LinearLayout 此时会测两轮（`forceUniformWidth`）：

1. **第一轮**：子 View 拿 `AT_MOST(可用上限)`，量出的是「内容自然宽」下的高度 A。宿主用 A 累加总高。
2. **第二轮**：把 `lp.height` 临时设成 A、宽度换成 `EXACTLY(最终宽)` 重测。最终宽通常比第一轮窄，
   文字折行变多、需要的高度大于 A——但 `EXACTLY(A)` 把它钉死在 A。

**宿主的总高只认第一轮，之后不再更新。** 由此派生出四个看起来毫不相干的症状：

| 症状 | 机制 |
|------|------|
| 末段（知识来源）整段消失 | 第二轮 `EXACTLY` 下 LinearLayout 按「剩余空间」逐个测子 View，前面的段吃完额度后末段拿到 `AT_MOST(0)`，高度直接为 0 |
| 展开后「收起」箭头不见 | 容器返回第二轮的新真高，宿主总高对不上，末尾兄弟 View 被排到父容器边界外裁掉 |
| 展开后底部缺一截 | 容器改成听宿主的，但宿主的值是第一轮旧宽度算的，偏小 |
| 折叠遮罩 8ms 一闪 | 折叠判定读的高度被第二轮的限高值污染，`isFoldNeeded` 在 true/false 间反复翻转 |

**解法三条，缺一不可**：

1. **高度恒按 `UNSPECIFIED` 测**——子 View 才不会被「剩余空间」挤压；
2. **宽度锁定为上次布局的实际宽度**（`onLayout` 里记，`AT_MOST` 轮当 `EXACTLY` 用，并且不得
   超过本轮可用上限）——两轮宽度一致，第一轮算出的就是最终高度；
3. **`EXACTLY` 轮必须原样返回父级要的值**，只在值对不上时 `post(requestLayout)` 让父级重算
   （异步内容就绪等场景的兜底）。

普通 TextView 无法重写 `onMeasure`，需要一个只做第 2 条的子类（本仓库为 `ZXStableWidthTextView`）。

**排查提示**：这个 bug 的迷惑性在于「数据全对、只是画不下」——文本长度、行数、颜色、Span 全部正常，
`TextView.getLayout().getHeight() > getHeight()` 才是被裁的铁证。上一轮迭代查了很久没定位到，
就是因为一直在查数据链路。

## 二、折叠策略：只裁不取舍（对齐 PC）

| | PC | 安卓 |
|---|---|---|
| 折叠方式 | `overflow:hidden` + `max-height` | 容器 `heightCap` 在 `onMeasure` 里 clamp |
| 超限处理 | 一律裁到限高，元素可能切一半 | 同 |
| 判定 | `scrollHeight > limit` | 夹高前的真高 > cap |

**「按段取舍」策略是错的**（放不下就整段隐藏）：在「标题 + 一张大表格」这种最常见结构上，
表格永远放不下、永远整块消失，比切一半更糟。已删除。

**判定与裁剪必须用同一个高度量**。曾因容器自身 24dp padding 只被 clamp 计入、不被判定计入，
导致「总高落在 456~480dp 时内容被裁但判定说不用折叠」——夹子留下、按钮不出现、高度锁死。

## 三、Markwon 集成

### 渲染必须走 `setParsedMarkdown`，不能 `setText`

`Markwon.setParsedMarkdown()` = `beforeSetText` + `setText` + `afterSetText`，而
**异步图片的调度器 `AsyncDrawableScheduler` 挂在 `afterSetText` 里**。直接 `tv.setText()`
会整个绕过它 → 不调 `setCallback2` → 不调 `loader.placeholder()` → 图片永远停在 `[OBJ]`
占位符，**哪怕图片文件已经在本地**。

Markwon 4.6.2 的 `afterSetText` 不是 public，公开入口只有 `setParsedMarkdown(TextView, Spanned)`。
后处理（替换角标 / 图片 Span）产出的 `SpannableStringBuilder` 本身就是 `Spanned`，可直接传入。

### 本项目的图片加载是「本地缩略图」模式

`AsyncDrawableLoader.load()` 是空实现，图片**不走网络**，只由 `placeholder()` 从
`Android/data/<pkg>/files/res/md5(url).jpg` 读。文件由 OSS SDK 预下载，下载完发
EventBus 事件触发消息刷新。所以「图片不显示」有三种可能：调度器没跑、文件没落盘、bucket 不在白名单。

落盘那段原本**不建父目录且 `catch` 为空**，目录不存在时图片会静默失败、永远不显示。

## 四、`<reference>` 角标要行内

后端常把 `<reference data-ref="...">` 单独放一行，markdown 会当它是独立块，角标就另起一段。
解析前先折叠标签前的换行，让角标贴住前一个非空白字符；连续多个 reference 之间的换行也吃掉，
几个角标才会连成一串。iOS 的 `zx_collapseIgnorableWhitespaceAroundReferenceTags` 是同一做法：

```
(\S)[ \t]*\r?\n+[ \t]*(?=<reference\s)              → $1
(</reference>|/>)[ \t]*\r?\n+[ \t]*(?=<reference\s) → $1
```

## 五、知识来源的过滤规则

只显示**正文里真的引用过**的文档：用正文中 `data-ref` 命中的 docId 过滤 `agentKnowledgeList`，
并按首次出现顺序排序。

`data-ref` 与 `agentKnowledgeList[].docId` **不保证同体系**——实测存在正文引用了某 docId 但它
不在列表里的情况（如 `toutiao_article`、`_agent_file_doc_id_2052229967831384065`），这类被过滤掉、
不展示。PC 的 `replaceSingleTag` 未命中 `refMap` 时同样返回空串，两端行为一致，**不是缺陷**。

因此「界面上的知识来源条数 < `agentKnowledgeList` 长度」属正常。

## 六、流式打字机（本次未验证，留给后续）

`Event.AgentAnswerContent` → `refreshAgentNewAnswerContent`，每 150ms 一帧：
`substring(0, N)` 按**字符数**硬切 → 整篇重渲染 → 强制滚到底。

抖动三个来源：

1. 按字符数硬切，切点随机，半成品每帧结构不同（`| 表头 |` 这帧是文字、分隔行一到整块变表格）
2. 每帧新建 Markwon 实例（含插件构建）
3. 每帧无条件滚到底

抗抖三条：复用实例、稳定前缀渲染（未出现分隔行的表格块暂按纯文本）、流式期间高度只增不减。

**重要**：`ZX:ActionCardMsg` **没有覆写** `refreshAgentNewAnswerContent`（父类空实现），
实测流式期间它一次都不刷新。上述抗抖只对真正走 `ReferenceMessage` 的消息生效。
ActionCard 流式的实际刷新载体**尚未定位**。

## 七、回归红线（改这块代码必须保住）

- 段栈及子 View 全部禁获焦（`FOCUS_BLOCK_DESCENDANTS` / `setFocusable(false)`）——
  否则 RecyclerView 布局时 `requestChildFocus` 把它滚进可视区，翻历史会被拽回最新卡片
- `setHeightCap` 必须在 bind 当帧生效、clamp 留在 `onMeasure`——否则段栈先以完整高度
  （长回复实测 4.8 万 px）参与一次布局，列表总高暴涨再塌回，视口被顶飞
- 段栈、段 TextView、表格容器与单元格一律 `setLongClickable(false)`——否则正文吞掉气泡长按
- `disableFocusAndLongClick` 必须在 `setMovementMethod` **之后**调用——后者内部会把
  focusable/clickable/longClickable 全部强制设回 true

## 八、联调坑

- `objectName`（顶层）才是消息类型；卡片 JSON 内层还有个 `content.objName: "RC:TxtMsg"`
  是嵌套字段，**不能拿它判断消息类型**。带 `referMsg` 也不代表消息是 ReferenceMessage。
- 验证必须确认装的是哪个包：`com.cnmts.smart_message`（生产）与 `.test`（onTest）是两个
  独立 app，改动只在其中一个里。生产包 `minifyEnabled false`，Log 全保留，同样能抓 logcat。
- 打正式包必须带模块前缀 `:smart_message:assemblePublishRelease`，否则会顺带给 library
  模块打 release，触发孤立资源校验必挂。
- Android 11+ 的 `adb shell` 和 `run-as` 都访问不了 `/sdcard/Android/data/<pkg>/`，
  查文件落盘只能靠应用内日志。
- 设备拔线后 `adb logcat -d` 仍能从 ring buffer 补捞断线期间的日志。
