# Status：数据范围弹窗-加载态优化

> 最后更新：2026-08-13 13:50 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 列表区加载动画（对齐 web `AcPageLoading`，不再白屏） | ➖ 已有骨架/文案，本次未改 | ✅ | ✅ | ✅ |
| 大数据量渲染不卡（分片/复用） | ➖ 已有虚拟列表 | ➖ RecyclerView 复用 | ➖ UITableView 复用 | ✅ 分片渲染 |
| 自测通过 | ➖ | 🚧（改成双色环后需再看一眼真机） | 🚧（AI 不构建，待 Xcode 自测） | 🚧（lint 已过，待起 dev 自测） |

## 本次改动落点

- **desktop** `src/renderer/components/chitchat/sendbox/personal-ai-data-scope-dialog.vue`
  - 「全部」/「群组」两个 tab 的 `dialogueLoading` 分支从一行文字 `加载中…` 换成铺满列表区的加载块（对齐 `AcPageLoading`：#F4F6F8 底、32px 双色环、gap 12、14px 灰字、文案「数据加载中...」）。
  - 新增分片渲染：`renderLimit`（首屏 60 条，`requestAnimationFrame` 每帧 +60），列表只渲染 `allRenderList` / `orgGroupRenderList` / `outreachGroupRenderList`；全选、三态图标、上报仍用全量。`beforeDestroy` 取消 rAF。
- **android** `SelectDataRangeActivity` + `SelectContactActivity` + `SelectGroupActivity` + `SelectOrgDrillActivity`（及对应 4 个 layout）
  - 裸 `ProgressBar` 换成铺满列表区的加载容器（#F4F6F8 底 + 32dp 双色环 + 「数据加载中...」），转圈用新增 `drawable/bg_page_loading_ring.xml`（ring + sweep 渐变 #D7E3FF→#3E7EFF，1s 一圈）；字段由 `ProgressBar progressBar` 改为 `View loadingView`，`updateProgressBar()` 更名 `updateLoadingView()`。
- **ios** `ZXPersonalAiPickerController.m`
  - 原来数据范围主列表**完全没有加载态**（白屏直到接口回来）：新增 `dataRangeLoadingView` 遮罩，盖住 tableHeader 以下区域（搜索/入口行仍可点），`applyDialogueItems` reloadData 之后、以及失败分支撤遮罩。转圈不用系统 `UIActivityIndicatorView`，用同文件内私有类 `ZXDataScopeLoadingRing`（两层 `CAShapeLayer`：底环 #D7E3FF + 1/4 圆弧头 #3E7EFF，`transform.rotation.z` 1s 匀速）以对齐 web。

## 待办 / 阻塞

- (ios) 需人工在 Xcode 编译自测（仓库规定 AI 不跑 xcodebuild）。
- (desktop) 需 `npm run dev:test` 起应用，用大数据量账号验证滚动是否跟手（eslint 已过）。
- apps 三端代码（android / ios / desktop）**未提交**；web 本次未改。

## 关键决策记录

- 2026-08-13：加载视觉以 web `apps/web/src/components/common/AcPageLoading.vue` 为准，四端一致——底色 `#F4F6F8`、32 直径圆环、2 线宽、底环 `#D7E3FF`、旋转头 `#3E7EFF`、1s 匀速、间距 12、灰字 `#8F959E` 14、文案「数据加载中...」。
- 2026-08-13：ios 不新增文件（新文件要动 pbxproj，风险大），转圈类以私有类写在 `ZXPersonalAiPickerController.m` 内；android 转圈用 sweep 渐变环近似 web 的「底环 + 高亮头」。
- 2026-08-13：android/ios 列表本身是复用控件，大数据量不卡，只补加载态；desktop 是全量 DOM，额外加分片渲染而非引虚拟列表（避免新依赖，web 端才用虚拟列表）。
