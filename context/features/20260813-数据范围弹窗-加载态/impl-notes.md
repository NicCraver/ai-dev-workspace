# Impl Notes：数据范围弹窗-加载态优化

> 平台无关的逻辑提炼，供后续端移植/回归对照。

## 状态流转

```
打开「选择数据范围」
  ├─ 立刻显示列表区加载遮罩（白底 + 转圈 + 「加载中...」）
  ├─ 并行请求：getAgentDataRange（记忆返显） + getAllImDialogue（候选清单）
  ├─ 候选清单成功 → 数据落地 → 列表刷新 → 撤遮罩（先刷列表再撤，避免露空表）
  └─ 候选清单失败 → 撤遮罩 → toast/错误文案 → 列表保持空
保存（确定）中：同一遮罩复用（android），避免重复点击
```

遮罩范围：**只盖列表区**，顶部搜索框 / 「选择联系人」「选择已有群组」入口行保持可点。

## 视觉参数（四端一致，基准 = web `components/common/AcPageLoading.vue`）

| 项 | 值 |
|----|----|
| 底色 | `#F4F6F8` |
| 圆环 | 直径 32、线宽 2、圆形；底环 `#D7E3FF`，旋转头 `#3E7EFF` |
| 转速 | 1s 匀速一圈 |
| 文案 | 「数据加载中...」（web 通用组件 `AcPageLoading` 仍是「页面加载中...」，只有数据范围弹窗这三端用「数据加载中...」），`#8F959E`，14，圆环下方间距 12 |
| 交互 | 遮罩吃掉点击事件，防止误触未填好的列表 |

各端实现：
- web/desktop：CSS 边框环（`border-2 #D7E3FF` + `border-top-color #3E7EFF` + `animate-spin`）
- android：`drawable/bg_page_loading_ring.xml` = `<rotate>` + `ring` shape + sweep 渐变（`#D7E3FF`→`#3E7EFF`），挂 `ProgressBar#indeterminateDrawable`，`indeterminateDuration=1000`。**不要再加 `indeterminateTint`**，会把双色染成单色。
- ios：私有类 `ZXDataScopeLoadingRing`（两层 `CAShapeLayer`：整圈底环 + `strokeEnd=0.25` 的弧头，`transform.rotation.z` 1s 无限旋转）。系统 `UIActivityIndicatorView` 是 12 根辐条，跟 web 不是一个东西，别用。

## 大数据量策略

| 端 | 列表实现 | 策略 |
|----|----------|------|
| web | 虚拟列表（AiBoxVirtualList） | 已有，未改 |
| android | RecyclerView | 天然复用，只补加载态 |
| ios | UITableView | 天然复用，只补加载态 |
| desktop | 全量 DOM（Vue v-for） | **分片渲染**：首屏 60 条，`requestAnimationFrame` 每帧再放 60 条，直到铺完；约 2000 条 ≈ 0.5s 铺满，主线程不长阻塞 |

分片渲染注意：**只截断渲染，不截断数据**。全选状态、三态图标、`selectAllFlags` 上报一律按全量候选清单算，否则会算成「半选」。组件销毁时必须取消 rAF。

## 边界情况

| 场景 | 预期 |
|------|------|
| 候选清单为空 | 撤遮罩后显示「暂无数据」，不停留在转圈 |
| 候选清单请求失败 | 撤遮罩 + 错误文案/toast；全选行隐藏；三个 selectAll 标记按未知态上报（null） |
| 记忆接口先回、清单后回 | 已选先按 id 占位，清单到位后回填 name/avatar（既有逻辑，未改） |
| 加载中点击列表区 | 被遮罩吃掉，不会误勾选 |
| 分片渲染途中快速滚到底（desktop） | 会短暂看到列表还在长；不阻塞、不白屏 |

## 联调坑

- **ios 原来完全没有加载态**：数据范围主列表只在拿到数据后 `reloadData`，接口耗时期间是纯白表格（section header「全部」都不显示），这就是用户报的白屏。
- **撤遮罩必须在 reloadData 之后**，否则会先闪一帧空表。
- **android 裸 ProgressBar 不够**：系统默认转圈颜色随主题、无文案，观感像卡住；改成白底容器 + 蓝色转圈 + 文案。
- **desktop 不引虚拟列表库**：本端已有 element-ui/antd/iview 三套 UI 库，按仓库约定不再引第四套依赖，用分片渲染解决。
