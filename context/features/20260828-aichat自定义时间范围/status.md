# Status：aichat自定义时间范围

> 最后更新：2026-08-31 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

分支：web `dev-date-range` ｜ ios `feat/ios-agent-date-range` ｜ desktop `feat/ai-chat-date-range`

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 记忆条自定义档 + /date-range 页 | ✅ | ✅ | ✅ | ✅ |
| 宿主回传桥接 | ✅ 修 wnsdk 通路（实例注入 + 载荷**平铺**） | ✅ window.WebView | ✅ 平铺优先 + data/success 嵌套兼容 | ✅ parent.postMessage |
| 自定义档选项行 UI（常驻区间框 + 占位） | ⬜ 无值时仍不显框 | ✅ 占位「请选择时间」+ 紧贴档名 | ✅ 占位 | ⬜ 无值时仍不显框 |
| 区间文案「当前年不显示年」 | ✅ 本就如此，未动 | ✅ DateRangeTextUtil | ✅ ZXAIAgentTimeData | ✅ 本就如此，未动 |
| 单测 | ✅ host-bridge 9 例 | — | — | — |
| 真机自测 | ⬜ | ✅ 同事已过 | 🚧 确认回显缺陷已定位并修，待重验 | ✅ 同事已过 |

> 本迭代只动桥接层；功能主体（timeType=0 落库、载荷上送）此前已完成。

## 待办 / 阻塞

- (ios) 待真机复验（web 需重新出包）：确认应关层 + 胶囊显「自定义」+ 重开时间面板 type=0 选中且带 M/D~M/D。
  2026-08-31 真机验出「× 能关、确认无回显」，根因见下（web 载荷套了一层 `data`），web + iOS 均已改。
- (ios) 待人工 Xcode 编译 + 面板自测：自定义行框位置/宽度（面板固定宽 245/225，未真机量过）。
- (web/pc) 待定：无区间时是否也常驻显示占位框，与安卓/iOS 拉齐（当前 `v-if="hasRange"` 隐藏）。
- (web) 自定义档回显：确认后筛选条是「自定义」、再打开列表应仍选中自定义（不要回到近一周）。代码已修，待页面自测。
- (web) 本地 node_modules 缺 prettier，`pnpm format` 未跑（vue-tsc --noEmit 已过，退出 0）。

## 关键决策记录

- 2026-08-31 区间文案口径定为**当前年不显示年份**（每端各自判本年）：跨年 `25/12/10~6/26`、
  同年本年 `5/6~8/31`、同年非本年 `24/5/6~24/8/31`。当天曾短暂改成「跨年两端都带年」，
  已回改；web / PC 的那次改动整体回退，本迭代这两端不再动代码，只动 ios / android。

- 2026-08-31 **推翻 08-28 的「放 data」结论**：wnsdk `callInner` 是把**整个参数对象**（剔除
  `success`/`error`/`dataFilter`）当作 `data` 下发原生，所以业务字段必须**平铺**；套 `data` 会让原生
  收到 `{"data":{...}}`、顶层无 `type`，按取消收口——表现为「弹层关了但区间回不来」。
  与 `selectDataRangeScope` 的平铺写法一致；单测新增一例模拟原生 data 固化该契约。
- 2026-08-28 `/date-range` 页自注册 `selectDateRange` namespace（main 入口拿不到 mobile 的注册、UMD 不挂 window），桥实例显式注入，不再探测 `window.wnsdk`。
- 2026-08-28 非 iOS 客户端不访问 `wnsdk.aiChat`（os 不匹配会弹 showError），已加守卫测试。
- 2026-08-28 iOS 解析平铺优先、保留 `success`/`error` 嵌套兼容分支。
- 2026-08-28 web 回显：`timeType`/`startTime`/`endTime` 在读写边界归一（`"0"`≠丢档、ISO 转毫秒）；`chatBelongs` watch 必须保留自定义区间。
