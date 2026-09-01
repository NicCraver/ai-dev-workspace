# Status：aichat自定义时间范围

> 最后更新：2026-09-01（iOS 回填改动已随 `7a96ed086` squash 并 push）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

分支：web `dev-date-range`（HEAD `17b6fc8`，含自定义时间框常显占位）已 merge 进 `feat/data-scope-storage-group`（`d245908`）｜ ios `feat/ios-agent-date-range` ｜ desktop `feat/ai-chat-date-range`

> **2026-09-01**：「三端 markdown 配色」已 ff-only 合回原分支。安卓弹层改动在 `ab9b723b0`（未 push，`master-3.6.23` ahead 3）。iOS 回填判定 `shouldPrefillDateRangeForTimeType:` 已打进 `7a96ed086` 并 push 到 `feat/ios-agent-date-range`（该条还混了数据范围整页 webview 与配色）。真机仍欠：占位「请选择时间」打开日历应为未选。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 记忆条自定义档 + /date-range 页 | ✅ | ✅ | ✅ | ✅ |
| 宿主回传桥接 | ✅ 修 wnsdk 通路（实例注入 + 载荷**平铺**） | ✅ window.WebView | ✅ 平铺优先 + data/success 嵌套兼容 | ✅ parent.postMessage |
| 自定义档选项行 UI（常驻区间框 + 占位） | 🚧 `17b6fc8` 已合入数据范围分支，未页面自测 | ✅ 占位「请选择时间」+ 紧贴档名 | ✅ 占位 | ⬜ 无值时仍不显框 |
| 区间文案（移动端口径：跨年两端带年 + 月日补零） | — 保持原口径，未动 | ✅ DateRangeTextUtil | ✅ ZXAIAgentTimeData | — 保持原口径，未动 |
| 弹层宽度按内容自适应 | — | ✅ 本就 WRAP_CONTENT | ✅ 时间/知识类型两个面板 | — |
| 记忆 save/get 对照安卓补齐 | — | 参照源 | ✅ 4 处（详见 impl-notes） | — |
| 单测 | ✅ host-bridge 9 例 | — | — | — |
| 真机自测 | ⬜ 未自测（代码已改完） | 🚧 时间弹层关闭待复验 | 🚧 回填修复待复验 | ✅ 同事已过 |
| 「请选择时间」打开 webview 不回填旧区间 | — | ✅ 仅 timeType=0 带 query | 🚧 代码已随 `7a96ed086` push，待真机 | — |

> 本迭代只动桥接层；功能主体（timeType=0 落库、载荷上送）此前已完成。

**2026-08-31 时间弹层**：@智能体过滤条选固定档（近一周等）应立刻关 PopupWindow；点「自定义」不关，半屏 /date-range 叠在列表上。原先固定档漏了 dismiss、自定义反而 dismiss。已改 `PersonalAiFilterBar` 与群条 `GroupChatAgentDataCheckView`。

**2026-08-31 回填修复**：iOS 占位「请选择时间」打开 webview 不得带旧区间；已重新列入 ACTIVE 待真机复验。

## 遗留（不阻塞收尾）

- (web) 未做页面自测：确认后筛选条是「自定义」、再打开列表应仍选中自定义（不要回到近一周）。
  代码已修并有单测覆盖归一逻辑，只差人跑一遍页面。
- (web) 本地 node_modules 缺 prettier，`pnpm format` 未跑（`vue-tsc --noEmit` 已过，退出 0）。
- (web/pc) 待定：无区间时是否也常驻显示占位框，与安卓/iOS 拉齐（当前 `v-if="hasRange"` 隐藏）。
  区间文案口径同理有意分叉（移动端整体判当年 + 补零），要不要拉齐是产品决定。
- (ios) 2026-08-31：占位「请选择时间」打开 /date-range 回填旧区间——回填判据改为与框内文案一致（当前档=自定义 **且** 框里有区间文案才带 start/end）；get 回填非有效自定义时清掉本地旧区间。待真机确认日历为未选。
- (ios) 并发 get 无 generation 防护（安卓有），快速连点数据胶囊理论上会被旧响应回写。详见 impl-notes。
- **未 push**：android `master-3.6.23` ahead 3（含本功能 `ab9b723b0`，另有脏 5）。
  iOS `feat/ios-agent-date-range` 已 synced（`7a96ed086`）。
  web `dev-date-range` 已在 origin（`17b6fc8`），并已合入 `feat/data-scope-storage-group`。

## 关键决策记录

- 2026-08-31 区间文案：**ios / android 单独定口径**，起止都在当年才不带年（`05/06~08/31`），
  任一端不在当年则两端都带年（`25/12/10~26/06/26`），月/日补零两位。web / PC 保持原口径
  （每端各自判本年、不补零）不动——本迭代文案只改移动端，端间差异是有意的。

- 2026-08-31 **推翻 08-28 的「放 data」结论**：wnsdk `callInner` 是把**整个参数对象**（剔除
  `success`/`error`/`dataFilter`）当作 `data` 下发原生，所以业务字段必须**平铺**；套 `data` 会让原生
  收到 `{"data":{...}}`、顶层无 `type`，按取消收口——表现为「弹层关了但区间回不来」。
  与 `selectDataRangeScope` 的平铺写法一致；单测新增一例模拟原生 data 固化该契约。
- 2026-08-28 `/date-range` 页自注册 `selectDateRange` namespace（main 入口拿不到 mobile 的注册、UMD 不挂 window），桥实例显式注入，不再探测 `window.wnsdk`。
- 2026-08-28 非 iOS 客户端不访问 `wnsdk.aiChat`（os 不匹配会弹 showError），已加守卫测试。
- 2026-08-28 iOS 解析平铺优先、保留 `success`/`error` 嵌套兼容分支。
- 2026-08-28 web 回显：`timeType`/`startTime`/`endTime` 在读写边界归一（`"0"`≠丢档、ISO 转毫秒）；`chatBelongs` watch 必须保留自定义区间。
