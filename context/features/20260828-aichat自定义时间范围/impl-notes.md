# Impl Notes：aichat 自定义时间范围（桥接层）

> 平台无关的逻辑提炼。本功能主体（记忆条 timeType=0、区间落库、载荷上送）已在各端实现，
> 本文只沉淀**桥接层**的坑与定型协议。

## 交互链路

1. 记忆条时间档点「自定义」→ 原生拦截，不走普通 timeType 切换
2. 原生拉起 web 的 `/date-range` 免鉴权独立页（iOS/安卓半屏 webview，PC iframe），
   URL 带 `?platform=m|pc&startTime=<ms>&endTime=<ms>`（有历史区间才带，用于返显）
3. H5 内选完 → **H5 主动上报**结果给宿主（方向与其它桥相反：不是取数，是上报）
4. 宿主收到即关层；confirm 时把毫秒区间写入会话记忆并随后续请求上送

## 定型协议

载荷三端同一份：

```jsonc
{ "type": "date-range:confirm", "startTime": <ms>, "endTime": <ms> }
{ "type": "date-range:cancel" }
```

| 宿主 | 通路 |
|------|------|
| android | `window.WebView.selectDateRange(JSON.stringify(payload))` |
| ios | `wnsdk.aiChat.selectDateRange({ ...payload, success, error })`（平铺，勿套 `data`） |
| PC iframe | `window.parent.postMessage(payload, "*")` |

优先级 android > ios > parent > none。完整契约见 `context/bridge.md`「selectDateRange 上报」。

## 自定义档选项行 UI 约定（四端同一份）

时间面板里 type=0 那一行：档名后面**常驻**一个类 input 的区间框，不把区间拼进档名括号
（固定档才是 `近3天(08/29-08/31)` 这种拼法）。

| 状态 | 框内 | 文字色 |
|------|------|--------|
| 当前档=自定义且有区间 | `M/D~M/D` | 深灰 `#595959` |
| 无区间 / 当前档不是自定义 | `请选择时间` | 浅灰 `#8F959E`（grayMedium） |

框样式：白底、`#E0E0E0` 0.5 描边、圆角 4、高 22、左右内边距 6、字号 12。
整行（含框）可点，点了就拉起 `/date-range`。

**框紧贴档名**（与档名间距 6dp/pt），不要跟着列宽占位跑到最右。安卓这里有坑：行内有个
`tv_zhan_wei`（用最长档名撑列宽的隐藏 TextView），自定义行必须把它设 `GONE`——`INVISIBLE`
仍参与 RelativeLayout 量宽，框会被推到「近一周(08/25-08/31)」那么长之后；其余行保持
`INVISIBLE` 以维持列宽一致。

**区间文案的年份口径**（四端同一份）：**当前年不显示年份**，即每个端点各自判是否本年——
本年 `M/D`，非本年 `YY/M/D`。

| 区间 | 输出 | 说明 |
|------|------|------|
| 跨年（起止年份不同） | `25/12/10~6/26` | 非本年那端带年，本年那端不带 |
| 同年 · 本年 | `5/6~8/31` | 两端都不带年 |
| 同年 · 非本年 | `24/5/6~24/8/31` | 两端都带年 |

唯一被否掉的写法：「同年只在左端带一次年」——起止同为去年时右端漏年，`24/5/6~8/31`
会被读成今年（iOS 原写法，已修）。

> 2026-08-31 曾短暂改成「跨年两端都带年」（`25/12/10~26/6/26`），当天即按「当前年不显示年」
> 回到上表口径。四端都已回改，勿再按 26/6/26 那版实现。

各端落点：web `timeRangeFormat.js`（含 4 例单测；`useTimeData` 只做 re-export，因为它依赖
`@/utils` 别名、node --test 直测不了）+ `TimeSelector.vue`；PC `date-range-format.js`
（含 5 例单测）+ `agent-memory-bar.vue` `.time-range-input`；安卓 `DateRangeTextUtil`
+ `DataTimePopupAdapter` + `item_agent_time_range.xml`（`bg_time_range_input`）；
iOS `ZXAIAgentTimeData customRangeTextWithStartMs:endMs:` + 群条/个人条共用
`ZXAIAgentTimeRangeBoxLabel`（声明在 `ZXAIAgentFilterBar.h`）。

> ⚠️ web / PC 目前**无区间时不显示框**（`v-if="hasRange"`），与安卓/iOS 的常驻占位不一致；
> 要拉齐得改这两处的 `v-if` 并补占位文案。

## 联调坑

### 1. wnsdk 业务载荷必须**平铺**在参数顶层——`success`/`error` 传不下去，套 `data` 也传不下去

wnsdk 真正的行为（`lib/wnsdk.min.js`，两段拼起来看）：

```js
// callInner：整个参数对象复制一份，只把三个保留键置空，然后当作 data
callInner = function (e, a, o) {
  var n = extend({}, stripUndefined(e));
  n.success = void 0; n.error = void 0; n.dataFilter = void 0;
  r({ handlerName, data: n, proto, success: e.success, error: e.error, ... }, a, o);
};
// 派发层：d = a.data → callHandler(proto, handlerName, d, cb)
```

即：**下发原生的 `data` = 整个参数对象（剔除 `success`/`error`/`dataFilter`）**，不是 `params.data`。
两种错法都会让原生解析不出 `type`，按「非法载荷 → 取消」收口：

| 写法 | 原生收到 | 现象 |
|------|---------|------|
| payload 塞 `success` | `{}`（被当回调取走） | 弹窗关不掉、数据回不来 |
| payload 套 `data: payload` | `{"data":{...}}` | **弹层关了但区间回不来**（× 关闭正常，正因为取消路径与它同归一处，看不出差别） |
| payload 平铺 ✅ | `{type,startTime,endTime}` | 正常 |

对照可用范例：`selectDataRangeScope`（`personalAiDataRangeScopeMessage.js`）——业务参数平铺，
`success`/`error` 传函数。**这是同一个坑踩了两次**：第一次只纠正了「别放 `success`」，
误以为要放 `data`，第二次才读 `callInner` 源码定死平铺。

### 2. main 入口页拿不到 wnsdk，必须页面内自注册

- `/date-range` 是 main 入口的免鉴权独立页；`extendModule("aiChat", …)` 只在 mobile 入口
  （`mpa/mobile/App.vue`）执行，**作用不到它**
- `@tjmt/wnsdk` 是 UMD 包，被 Vite 按 CommonJS 分支打包，**不挂 `window.wnsdk`**

→ 任何靠 `window.wnsdk` 探测桥存在性的写法在该页恒为 false。做法：页面 `onMounted` 自注册
`{ namespace: "selectDateRange", os: ["MTCoreApi"] }`（一次性上报，无需 `isLongCb`），
并把 import 进来的实例显式传给桥判定函数。

安卓不受此影响：`window.WebView` 由原生直接注入 window，不经 wnsdk。

### 3. 非 iOS 客户端不得触碰 `wnsdk.aiChat`

wnsdk 的模块 getter 在 os 不匹配（PC/h5 访问 `os:["MTCoreApi"]` 的 api）时会走 `showError`
弹错误提示。判定函数必须先按 UA（`/MTCoreApi/i`）确认是 iOS 客户端，再读 `sdk.aiChat`。
已有守卫测试固化此约束。

### 4. 原生解析用平铺优先

wnsdk 下发给原生 handler 的就是「参数对象剔除回调键」，所以 iOS 侧 `type` 直接在顶层。
解析顺序：顶层有 `type` → 直接用；否则回落 `data` 嵌套（旧 web 包配新客户端）；
再否则回落 `success`/`error` 嵌套（兼容最早写法）。非法载荷一律按取消收口，不写脏态。

### 5. web：筛选条已是「自定义」，打开列表却高亮「近一周」

两处叠加：

1. **接口 `timeType` 可能是字符串 `"0"`**。胶囊用 `=== "0"` 能显示「自定义」，但 `el-radio` 的 `label` 是 number `0`，严格相等失败，列表看起来仍像默认档（近一周）。get 侧 `startTime`/`endTime` 还可能是 ISO 串（含 `+0000`），当 Number prop 会变成 `NaN`，日历也回填不上。
2. **`chatBelongs` 的 deep watch 重建 `im` 时只写了 `timeType`，丢掉 `startTime`/`endTime`**。确认自定义后只要归属对象动一下，区间就被冲掉。

处理：档位/区间在边界统一 `Number` + 毫秒归一；watch 必须 spread 旧 `im`；radio 同时绑 `:value` 与 `:label`。PC 记忆条此前已按同样规则修过。

## 验证

- web：`node --test src/pages/date-range/host-bridge.test.mjs`（9 例：四通路 + 优先级 + 非 iOS 守卫
  + 「模拟 wnsdk 下发原生的 data 里 type 在顶层」，后者固化平铺契约，防再套 `data`）；
  `node --test src/use/timeTypeNormalize.test.mjs`（`"0"` 不回退 7、ISO/`+0000` 转毫秒）
- iOS 链路静态确认：半屏 `ZXJSWebPopoverView` → `ZXJSWebLoader`（UA 追加 `MTCoreApiJS/<ver>`，
  `/MTCoreApi/i` 可匹配）→ `ZXJSWKWebViewBridge` 注册 `aiChat` 模块 → `selectDateRange` handler
