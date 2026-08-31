# Impl Notes：数据范围选择改纯 webview

> 平台无关的逻辑提炼。其它端（安卓、web 移动 Home）照这份接，不要回头读 web/iOS 源码。

## 两条入口，不要混

| 宿主 | 怎么开 | 关页 / 落库 |
|------|--------|-------------|
| 原生会话筛选条（iOS/安卓原生胶囊） | 开全屏 webview 加载 `/m/data-range` | web 落库后上报 `{ok:true}`，原生关页再 get |
| **web 个人 AI 框**（Home `DataScopeBar`，含移动 WebView 内嵌） | **页内直调** `SelectDataRangeDialog`（mobile 全屏变体） | 开层前 get 留底，确定时 `buildSaveDataRangePayload` 再 save。**不调** `selectDataRangeScope` |
| 定时任务 persist=false | 命令式 XPopup（`SelectDataRangePopup`） | 只回填触发项，不写记忆 |

个人 AI 框本身就是 H5：再走原生选人页等于套娃，而且会把「请选择时间 / 回填」这类状态拆到两层。

## 交互链路

1. 筛选条点「数据范围」→ 原生开**全屏、无原生导航栏**的 webview
2. URL：`<host>ai-chat/m/data-range?platform=m&agentId=<id>&accountId=<id>`，`needCode=YES` 由容器换 userCode
3. 页等登录态就绪后 `getAgentDataRange` 取完整记忆：回显 scopes，同时把整份记忆留着当 save 的底
4. 确定：以记忆为底，只替换 `dataRangeScopeList` 与三个全选标记，其余字段原样 `saveDataRange`
5. 保存成功才上报 `{type:"data-range:confirm",ok:true}`；失败 toast、不上报、不关页
6. 取消 / 左上返回：上报 `{type:"data-range:cancel"}`，不写任何状态
7. 原生收到即关页；confirm 时重拉记忆刷筛选条，cancel 静默

## 为什么 web 落库，而不是原生落库

`saveDataRange` 是**全量记忆写入**：timeType / startTime / endTime / netSearch / dataRangeList /
dataRangeScopeList 同在一个请求里。少传任何一个，服务端已存的值会被冲掉。

若让原生落库，每个宿主都得记得把时间档、区间、联网搜索一并带上，漏一个字段就静默丢数据。
所以 web 页自己先 get 取底、只替换本次改的 scopes 与全选标记，回传只报 `{ok:true}`。
原生**不要**把 timeType/startTime/endTime 拼进 URL。

三个全选标记是**三态**：未知（候选取数失败/加载中）时省略这三个 key，绝不传 0 冒充——传 0 会把后端已存的全选意图静默清零。timeType 非 0 时区间要显式传 null，防旧自定义区间残留。timeType 可能是字符串 `"0"`，按数值 0 判自定义。

## 为什么页挂 mobile 入口

`/date-range` 栽过：它挂 main 入口，`extendModule("aiChat", …)` 只在 mobile 入口的 `App` 里执行，
main 拿不到注册；且 wnsdk 是 UMD 经打包不挂 `window.wnsdk`。数据范围还要鉴权（get/save 记忆、
会话列表、组织架构），mobile 入口的登录态 / http 拦截 / wnsdk 注册都已经打好。

本页**不要**再自注册 namespace（与 `/date-range` 相反）——就靠 mobile `App` 里的 `reportDataRange`。

## 移动变体只改三处

同一个 Dialog，PC 形态不动。移动变体（显式 `mobile` prop，不靠 UA 自判）：

1. 壳：全屏 + 关掉右上角关闭按钮（自定义导航栏在左）
2. 导航栏：左返回 / 中标题 / 右涉密。涉密气泡文案走 `getSecretButtonTip`，所以原生不能画 nav
3. 搜索：常驻输入框 + 有关键字时结果层盖住主列表。不跳路由、不做搜索子页。点结果只勾选，不关层

tabs / 虚拟列表 / 组织架构 / 已选气泡 / 全选三态一律不动。

安全区：顶栏 `env(safe-area-inset-top)`，底栏 `env(safe-area-inset-bottom)`。浏览器验不到，真机必看。

## 上报桥

方向与多数取数桥相反：web → 原生。三宿主优先级：安卓 `window.WebView.reportDataRange(JSON)` >
iOS `wnsdk.aiChat.reportDataRange` > `parent.postMessage`。

两个必须守住的点（`selectDateRange` 上踩过两次，判定已提到共用模块）：

1. **载荷平铺**在 wnsdk 参数顶层。`success` / `error` / `dataFilter` 是保留回调键（只能放函数）。
   套一层 `data` 会让原生收到 `{"data":{...}}`、顶层没有 `type`，表现为「页关了但结果没生效」。
2. **非 iOS 客户端不得访问 `wnsdk.aiChat`**。判定必须先过 UA `/MTCoreApi/i`，os 不匹配时模块 getter 会弹 `showError`。

非法载荷原生一律按取消收口，不写脏态。

## 浏览器自测（2026-08-31）

同源登录后打开 `/ai-chat/m/data-range?agentId=&accountId=&platform=m`：

- 导航栏三件套、tabs、常驻搜索、底栏「已选 N 个 / 清空已选 / 取消 / 确定」都在
- 有关键字时结果层盖住主列表（不跳路由）
- 无原生桥时点确定：控制台 `[data-range] ...` 提示，页面不崩

未覆盖：键盘顶起、安全区、保存后时间档/联网搜索是否被冲（必须真机，见 status 待办第 6 项）。

自动化往搜索框填字若不先 focus，结果层会出「未搜索到相关结果」——候选取数绑在 focus 上，真人手点输入不会踩。

## 联调坑

1. wnsdk 载荷必须平铺——见上。与 `selectDateRange` 完全同一坑。
2. 页必须挂 mobile 入口，否则 `reportDataRange` 未注册，iOS 通道恒为 none。
3. `saveDataRange` 全量写入，get 失败时禁止打开 Dialog 让用户确定（没有底可合并）。
4. userCode 一次性：浏览器从 env 入口拿的 code 被另一个 origin/端口先兑换后，本页会一直「加载中」。
