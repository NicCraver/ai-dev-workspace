# Status：数据范围选择组件合一

> 最后更新：2026-09-03 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | ✅ | ⬜ | ⬜ | ⬜ |
| 接口联调 | ⬜ | ⬜ | ⬜ | ⬜ |
| 自测通过 | 🚧 | ⬜ | ⬜ | ⬜ |

本次是 web 纯重构：PC `SelectDataRangeDialog` 与移动 `SelectDataRangePopup` 收敛到 `useDataRangePicker` + 4 个共用件。android / ios / desktop 不改原生，继续内嵌原 web 页。接口契约与取数口径未动，故「接口联调」仍空白。

web 自测：`useDataRangePicker` 12 条绿；`weekWorkModel` / `dataRangeSavePayload` / `selectDataRangeList` 绿；`pnpm build` exit 0。浏览器目视清单（PC `/zx/data-range`、移动 `/m/data-range`）未做。`dataScopeModel.test.mjs` 因缺少 `apps/.scratch/.../getAllImDialogue-response.json` 整文件加载失败，属预存问题，本次未改该测试。

## 合入 release（2026-09-03，`fcf05a2`）

把 `origin/release`（领先 48 个提交）合进 `feat/data-range-week-work`。冲突只有两个壳
（`SelectDataRangeDialog.vue` / `SelectDataRangePopup.vue`）—— 它们在本分支已被掏空，
冲突段全是搬走的旧代码，故取本分支版本，再把 release 的三处改动搬进新结构：

| release 提交 | 改动 | 落到新结构的哪 |
|---|---|---|
| `9cfe71c0` / `d91a48c7` | 二级 tab「对话列表」改名「对话」 | `dataRange/tabs.js` |
| `d91a48c7` | `listResetKey` 去掉 `expandedStorages.size`，展开/收起不再让虚拟列表滚回顶 | `dataRange/useDataRangePicker.js` |
| `6c18ed55` | `StorageRow` 新增 `expanded` prop（展开/收起图标） | `dataRange/DataRangeBody.vue` 补 `:expanded` |

> 第三条是合并后才暴露的：`StorageRow.vue` 自动合入了新 prop，但调用点在被重构过的
> Body 里，不补就只是图标不切换、不报错。

合并后复验：`useDataRangePicker` 12 条绿，`pnpm build` exit 0（含 vue-tsc 与四入口）。

`DataScopeBar.vue` 也被 release 改过，但传给两个壳的 props 没变，壳的对外接口零改动，无需适配。

## 待办 / 阻塞

- (web) 目视未做：Task 5 Step 3 / Task 6 Step 3 清单（一级 tab、涉密气泡、二/三级 tab、收纳组三态、表头全选、PC 搜索下拉、移动整屏搜索层、周工作、已选 chip、确定落库）
- (web) 真机 iOS webview 上整屏搜索层 `nextTick` 聚焦拉键盘未复验
- (web) `dataScopeModel.test.mjs` 依赖的 scratch json 不在仓库，与本次重构无关

## 关键决策记录

- 2026-09-03 逻辑单点放 composable，接口函数由壳注入，避免 `node --test` 解析不了 `@/`
- 2026-09-03 picker 实例建在壳里、以 prop 传给 body 与 selected-bar，不用 provide/inject
- 2026-09-03 形态差异用 `variant="pc"|"mobile"` 分支；一级 tab 抽小件由壳决定位置
