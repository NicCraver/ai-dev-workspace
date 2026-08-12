# Status：数据范围-涉密标签

> 最后更新：2026-08-12（人工视觉验收发现的问题四端均已修完，待用户统一复验）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| Tag 接入（全部/群组/搜索/组织架构/已选） | ✅ | ✅ | ✅ | ✅ |
| 涉密说明气泡（底部图标按钮） | ✅ | ✅ | ✅ | ✅ |
| 自测通过 | 🚧 | ✅ | 🚧 | 🚧 |

## 视觉验收发现的问题（2026-08-12，均已修复，待用户统一复验）

- (ios) 底部「涉密」按钮应在「已选」右侧紧挨着，原来放在左侧最前 —— **已修**（commit `9afc47fb6`，交换约束顺序，同步修了 `clearButton` 最小间距基准；气泡固定文案逐字核对无误）
- (desktop) ①列表行 tag 被布局挤到行最右边缘，应紧挨姓名/群名右侧 —— **已修**（commit `b81d002d`，根因 `.pa-ds-name`/`.pa-ds-search-name` 用了 `flex: 1` 撑满剩余空间把 tag 推到行尾，改成 `flex: 0 1 auto`；5 处落点逐一排查，全部/群组/搜索行有此 bug 已修，组织架构行/已选 chip 本来就没问题未改）；②底部涉密/已选按钮顺序反了 —— **已修**（commit `77cd791a`，交换两个 `el-popover` 模板顺序，改成已选左、涉密右）
- (web) 涉密说明气泡应深色主题 + 居中弹出 + 文字居中 —— **已修**（commit `268f2bb`，`placement="top"` + `effect="dark"` + 文字 `text-center`）；气泡贴左边缘——先后试了 `preventOverflow`（无效，根因见下）、`offset` skid 32/12，**最终由用户本人手动定稿**（commit `517ae05`：offset skid `[12,12]`，去掉外层负边距，文案加 `-m-1`）
- (android) 复查同款问题：①底部按钮顺序——确实同样反了，**已修**（commit `02ac567a6`，交换 `include_data_range_multi_footer.xml` 里两个 LinearLayout 顺序，`id` 不变，Helper 绑定不受影响）；②列表 tag 贴边——排查后**结构上不存在**该问题（`item_friend_content.xml` 姓名 `layout_weight=1` 是被 4 处其他选择器复用的既有写法，tag 紧跟姓名无额外撑开/靠右对齐，跟 desktop 的反面案例不是一回事，未改动，需你实测确认姓名很短时是否有可感知间隙）；`assembleDevelopDebug` 已重新跑过 BUILD SUCCESSFUL
- （全端追加）用户要求「都按 web 端来」，气泡统一深色 + 文字居中，主线程直接改（未用子agent）：
  - (desktop) 原来 `placement="top-start"` + 浅色文字，改 `placement="top"` + `effect="dark"` + `.pa-secret-info-content{text-align:center}` + `.pa-secret-info-popover{margin-left:12px}` —— **已修**（commit `04239dbe`，eslint 过）
  - (ios) 背景本来就是深色 `Color_HEX(@"1F2329")`，只是文字没居中 —— **已修**（commit `6ac9858bb`，`textLabel.textAlignment = NSTextAlignmentCenter`；大括号/圆括号计数校验通过，未跑 xcodebuild）
  - (android) 原来是白底黑字箭头气泡（`popup_bg_jiantou_bottom_right` 9-patch，采样确认背景 `#FFFFFF`），换成深色圆角 shape `bg_data_range_secret_tip.xml`（`#1F2329` + 6dp 圆角，无箭头）+ 文字白色居中 —— **已修**（commit `fd1655ba6`，`assembleDevelopDebug` BUILD SUCCESSFUL）

## 待办 / 阻塞

- (web) `vue-tsc --noEmit` 已过、`dataScopeModel` 单测 20/20 过；**未做**真实浏览器联调可视化验证——本地环境 `getAllImDialogue` 走真实接口（无 mock），未接入测试后端/登录态，无法起 `pnpm dev` 跑通真实弹窗看涉密/已离职 tag 实际渲染效果。建议开发者本地连测试环境跑一遍再合并。
- (web) `pnpm format` 本地环境 `node_modules` 里 prettier 缺失（非本次改动引入的问题），跳过自动格式化，靠手工对齐现有代码风格；如需要请本地补齐依赖后跑一次 `pnpm format`。
- (android) `/port android` 已提交 commit `0f6100be3`（`personal-ai-chat-hotfix`，未 push）；`./gradlew :smart_message:assembleDevelopDebug` BUILD SUCCESSFUL，`DataScopeModelTest` 单测全过；底栏窄屏（如 320pt 级）拥挤情况未做真机视觉核对，气泡垂直偏移量为测量高度+8dp 固定间距估算，非像素级对齐设计稿；未碰原有两个不相关未提交资源文件
- (ios) `/port ios` 已提交 commit `0646ddd6`（`personal-ai-chat-hotfix`，未 push）；按仓库规定 AI 不擅自跑 `xcodebuild`，**未做真实 Xcode 构建验证**，需要人工用 `zhixinAppTest` + iPhone 15(iOS 17) 模拟器 clean build 一次确认；说明气泡宽度/定位为自行设计（无设计稿像素级比对），窄屏（iPhone SE）底栏拥挤未单独适配测试；未碰原有 11 个不相关未提交文件
- (desktop) `/port desktop` 已提交 commit `443a4e85`（`personal-ai-chat-hotfix`，未 push）；eslint + 模板编译通过，**未跑 `npm run dev` 真机交互验证**（弹窗五个落点 + 说明气泡实际点击行为、popover 定位），建议本地起一次 dev 环境走查；说明气泡按钮尺寸/间距为估算值；未碰 `.env.test`/`electron-builder.yml`/`package.json`/`package-lock.json` 禁忌文件

## 关键决策记录

- 2026-08-12：涉密判定复用契约里已上线的 `getAllImDialogue.ignoreChatType`（`Number(x)===1`），不新增/等待后端；契约文件本身已提前加好该字段说明，无需再改
- 2026-08-12：已离职由「姓名后缀（已离职）」改造为与涉密同款独立 tag，不再用括号写法；两者可共存，涉密在前
- 2026-08-12：涉密/已离职配色 `#FFF3DA`/`#FEAC00`（涉密）、`#E5E5E6`/`#8F959E`（已离职，取自截图采样，非精确设计稿值）
- 2026-08-12：说明气泡只挂在弹窗底部工具栏图标按钮，行内 tag 本身不可点；纯前端静态文案，无需请求接口
- 2026-08-12：组织架构 tab 数据源不带涉密/离职字段，前端用已拉取的候选清单（getAllImDialogue 全量人+群）按账号 id 本地建查找表回填，不改组织树接口
- 2026-08-12：移动端「选择数据范围」现状 100% 走 wnsdk 桥接原生页面，本期不新建 mobile web 页面，只改 android/ios 原生
- 2026-08-12：工作区另有一批与本功能无关、未提交的 `hideChat`/`saveAgentSetInfo`/`getAgentSetInfo` 契约改动（Agent 设置域），经确认不属于本功能范围，未合并处理，留给对应负责人
- 2026-08-12：desktop/android/ios 三端移植不新开分支，直接 commit 到各自现有的 `personal-ai-chat-hotfix`（工作区里各自还有跟本功能无关的未提交改动，均未触碰）；web 端例外，单独用 `feat/data-scope-secret-tag` 分支
- 2026-08-12：(desktop) tag 组件因被公共组件 `dept-user-check-list.vue`（转发/建群等多功能复用）引用，上提到 `components/common/`；组织架构人员行走新增可选 prop `userTagMap`（默认 null，不传时其它调用方零影响）
- 2026-08-12：(ios) `ZXDataScopeTagView` 因被 `ZXForwardCell`/`ZXUserCollectionCell`（转发等功能复用）引用，放在 Picker 目录被跨模块 import；新增字段默认 `NO`，转发等无关流程视觉零影响；组织架构回填直接复用既有 `dialogueContactMap` 基础设施，未新建查找表类
- 2026-08-12：(android) 说明气泡只在共享的 `include_data_range_multi_footer.xml` + `DataRangeMultiFooterHelper` 实现一次（复用仓库既有 `PopupWindow`/`popup_bg_jiantou_bottom_right` 惯例），5 个必需入口天然全覆盖，不用逐落点重复接；已离职灰色复用既有 `color_8F959E`，涉密配色复用既有 `color_FEAC00`/`color_FFF3DA`；`#E5E5E6` 无既有色值，直接写死在新 drawable 里（未改 `base_color.xml`）
- 2026-08-12：底部「已选」「涉密」两按钮的正确顺序定为「已选在左、涉密在右紧挨」（以 web 实现为准）；四端逐一核实，android/desktop/ios 三端初版顺序都反了并已修正，web 本来就对
- 2026-08-12：说明气泡最终定稿为「深色背景 + 文字居中」四端统一（此前 android 初版是白底黑字箭头气泡、desktop 初版是浅色左对齐，均已改）；android 因没有现成深色 9-patch 箭头资源，改用纯色圆角 `<shape>`，**不带箭头**（跟 web/desktop/iOS 是否要箭头未强制统一，如需要箭头版本再补美术资源）
- 2026-08-12：web 气泡左侧留白问题反复调试：`preventOverflow` 对该场景无效，根因是 `AcDialog` 内容区被本文件自身 scoped style 显式设了 `overflow: visible`，导致它不再是 popper 的 clipping boundary，实际按浏览器视口计算溢出（视口够大，永远不触发）；改用 `offset` modifier 的 skid 分量做固定像素偏移，最终数值由用户手动调定
