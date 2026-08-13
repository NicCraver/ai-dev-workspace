# Status：数据范围弹窗-加载态优化

> 最后更新：2026-08-13 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 列表区加载动画（转圈 + 「加载中...」，不再白屏） | ➖ 已有骨架/文案，本次未改 | ✅ | ✅ | ✅ |
| 大数据量渲染不卡（分片/复用） | ➖ 已有虚拟列表 | ➖ RecyclerView 复用 | ➖ UITableView 复用 | ✅ 分片渲染 |
| 自测通过 | ➖ | 🚧（编译已过，待真机） | 🚧（AI 不构建，待 Xcode 自测） | 🚧（lint 已过，待起 dev 自测） |

## 本次改动落点

- **desktop** `src/renderer/components/chitchat/sendbox/personal-ai-data-scope-dialog.vue`
  - 「全部」/「群组」两个 tab 的 `dialogueLoading` 分支从一行文字 `加载中…` 换成铺满列表区的转圈 + 「加载中...」。
  - 新增分片渲染：`renderLimit`（首屏 60 条，`requestAnimationFrame` 每帧 +60），列表只渲染 `allRenderList` / `orgGroupRenderList` / `outreachGroupRenderList`；全选、三态图标、上报仍用全量。`beforeDestroy` 取消 rAF。
- **android** `SelectDataRangeActivity` + `SelectContactActivity` + `SelectGroupActivity` + `SelectOrgDrillActivity`（及对应 4 个 layout）
  - 裸 `ProgressBar` 换成白底铺满列表区的加载容器（32dp 蓝色转圈 + 「加载中...」），字段由 `ProgressBar progressBar` 改为 `View loadingView`，`updateProgressBar()` 更名 `updateLoadingView()`。
- **ios** `ZXPersonalAiPickerController.m`
  - 原来数据范围主列表**完全没有加载态**（白屏直到接口回来）：新增 `dataRangeLoadingView` 遮罩（白底 + 系统转圈 tint 主题蓝 + 「加载中...」），盖住 tableHeader 以下区域（搜索/入口行仍可点），`applyDialogueItems` reloadData 之后、以及失败分支撤遮罩。

## 待办 / 阻塞

- (android) 真机跑一遍：候选清单加载中 / 加载失败 / 保存中三态遮罩是否符合预期（`assembleDevelopDebug` 已 BUILD SUCCESSFUL）。
- (ios) 需人工在 Xcode 编译自测（仓库规定 AI 不跑 xcodebuild）。
- (desktop) 需 `npm run dev:test` 起应用，用大数据量账号验证滚动是否跟手（eslint 已过）。
- 四端代码均**未提交**（仅本 context 仓库提交）。

## 关键决策记录

- 2026-08-13：加载视觉统一按已有宿主 loading 规范走——32px 转圈、主题蓝 `#3E7EFF`、灰字 `#8F959E`、文案「加载中...」。
- 2026-08-13：android/ios 列表本身是复用控件，大数据量不卡，只补加载态；desktop 是全量 DOM，额外加分片渲染而非引虚拟列表（避免新依赖，web 端才用虚拟列表）。
