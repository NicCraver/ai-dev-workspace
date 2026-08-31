# Plan：会议室前端重构

> 由 Superpowers writing-plans 产出后覆盖本模板。每个任务标注涉及端。

拷贝源：`/Users/nic/w/zhixin-prototype`（运行时不依赖该仓库）。

## Web（meeting 前端）

- [x] (web) 令牌：`web/src/styles/tokens.css` 以 `--zx-*` 为来源；`--color-*` / `--spacing-*` / `--radius-*` 等指向 `--zx-*`。Element / Vant 主题接到 `--zx-*`。Uno 补齐原型同名 theme。
- [x] (web) 按需拷贝 `AcButton` `AcDialog` `XPopup` `AcEmpty` `MEmpty` `NavBarHeader` `AcPageLoading` `AcLoadingBar` `SvgIcon`（仅实际 svg）`ZxStatusTag` 到 `web/src/components/base/`；`popup/commonPopupWrapper.js` 备新弹窗。
- [x] (web) 后台 chrome：`el-button` → `AcButton`，`el-dialog` / 审计抽屉 → `AcDialog`，空态 / 状态标换基础件。表格、表单、分页仍用 Element Plus。
- [x] (web) 预定 PC：`CreateScheduleModal` / `MyBookingsModal` 在非移动下用 `AcDialog`；工具条主操作改 `AcButton`。
- [x] (web) 预定移动：顶栏 `NavBarHeader`；sheet 用 `XPopup`；空态 `MEmpty`；状态 `ZxStatusTag`；需要处 `SvgIcon`。
- [x] (web) `node:test`：令牌别名断言；chrome 源码不再把 `el-button` / `el-dialog` 当主操作外壳。

## 接口联调

- [x] (web) 本期不改接口，无需联调

## Android 移植

<!-- 由 /port android 追加；会议室走 WebView，无原生移植 -->

## iOS 移植

<!-- 由 /port ios 追加 -->

## Desktop 移植

<!-- 由 /port desktop 追加；PC 内嵌同一套 web -->
