# Status：数据范围-筛选条迭代。

> 最后更新：2026-08-11（旁路：android 合并详情评优+回复弹窗 tag/徽章、ios 合并引用快照仍工作区未提交；多次打 publishRelease 正式包；desktop 仅本地调试配置；矩阵仍全 ✅）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 文案规则（类型全部/数据全部·封顶） | ✅ | ✅ | ✅ | ✅ |
| 点击数据：先 get 再开层 | ✅ | ✅ | ✅ | ✅ |
| 接口联调（flags 回传验收） | ✅ | ✅ | ✅ | ✅ |
| 自测通过 | ✅ | ✅ | ✅ | ✅ |

> 本功能矩阵不变。apps 脏工作区均为**旁路**改动（合并详情评优/引用快照、desktop 本地调试配置、正式包资源补丁），不记入上表格子。

## 待办 / 阻塞

- (全端) 设置页 / 定时任务文案本期不做（web 用 `persist=false` 隔离）
- (web) 工作区干净，已与 `origin/personal-ai-chat-hotfix` 同步；筛选条横向溢出/遮罩等已推（`50e5d98` 及后续）
- (web) 旁路：`TimingDialog` 高度自适应——**当前工作区无本地改动**（曾记「本地已改未提交」；若需恢复见 2026-08-07 决策）；非筛选条范围
- (desktop) 工作区仅有 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json` 本地调试配置改动，**不计入本功能、勿提交**；已与 `origin/personal-ai-chat-hotfix` 同步；旁路多选转发三坑已推，**待真机** → 详见 `20260730`
- (action-center) 旁路：挂载后用 Vite+ `vp i` 装依赖（重写 lock、`devEngines`、`pnpm-workspace.yaml` allowBuilds），**非本功能、勿计入矩阵**；pnpm 11 忽略原 `package.json#pnpm` 的 patches/overrides，后续若异常再迁配置
- (action-center) 旁路：PC 版本升级弹窗已下线（`TheLayout` 中 `needsClientUpgrade = false`），不再按 UA 含 `3.4.23` 触发；**非本功能、勿计入矩阵**；当前在 `release` 工作区**尚未提交**
- (action-center) 旁路：大量 `src/assets/svg/*.svg` 路径末尾 `Z` 被工具改写（与强更无关的格式噪声），**勿当业务提交**；是否还原或一并整理由人决定
- (android) 旁路：筛选条 `saveDataRange` 补传三全选标记（`PersonalAiFilterHost`），**已推** `personal-ai-chat-hotfix`（`d48b5dd9d`）；非矩阵格子但关联个人 AI @ 筛选条
- (ios) 旁路：筛选条 `saveDataRange` 透传三全选标记，**已推** `personal-ai-chat-hotfix`（`48adac034`）；非矩阵格子但关联个人 AI @ 筛选条
- (android) 旁路：合并详情引用点击无响应 + 开弹窗 NPE（合成源消息缺 `objectName`），**已推** `personal-ai-chat-hotfix`（`e6a590558`）→ 详见 `20260730`
- (android) 旁路：合并转发聊天记录页昵称行对齐 iOS——**新增** `CombineAppraisingBinder`（评优徽章+星星）+ `rc_item_combine_message.xml` 布局 + `CombineAdapter` 挂钩，`CombineDetailActivity` 补 `sentTime` 兜底。**工作区未提交**；当日有 onTest 真机装包与多次 `publishRelease` 出包 → 详见 `20260730`
- (android) 旁路：**回复弹窗**（点引用弹出的「N条回复」层）补 AI 框 tag + 评优徽章星星（`ReferMessageUnitFragmentDialog` / `ReferMessageUnitListAdapter` + `rc_item_refer_unit_*.xml`），并对空时间戳隐藏时间胶囊；**本地已改未提交** → 详见 `20260730`
- (android) 旁路：打正式包时补资源——`base_util` 增 `color_F0F5FF`、`basis_function_api` 拷贝 `em_camera_switch_normal.9.png`；`assemblePublishRelease` 需 `-x verifyPublishReleaseResources` 跳过库模块跨模块资源校验。产物：`smart_message-publish-release_v3.6.18.apk`（约 86M）。**资源补丁仍在工作区未提交**
- (ios) 旁路：合并详情引用快照全链路修复（约 11 文件）：打包侧 `zx_packReferMsgDictionaryForModel` 写 `referMsg.user/sentTime/extra/objectName`；读侧 `hydrateCombineReferModelsInList` 同列表回填；`ZXIMCellLogic`/`ZXRCMessageModel`/`UIImageView+Avatar` 等联动。第四轮再补：快照带上**引用正文**（否则群智能体回复合并后整块引用消失）、extra 白名单保 `fromType`、读侧按快照直接建 `referModel`、`sentTime<=0` 隐藏时间（原显示「元旦 08:00」）。**工作区未提交、未构建**，待 Xcode 编译 + 真机自测，**老记录须重新合并** → 详见 `20260730`
- (android) 旁路：群聊 @人/@智能体 退格逐字删除 —— **经确认无需修改，改动已撤回**（`RichEditText` 已 `git restore`，工作区干净）。排查结论留档：整块删除只挂 `View.OnKeyListener`（`RongExtension:545` / `ConversationLargeInputView:162` → `RichEditText.setKeyBordDeleteEvent()`），软键盘若走 `InputConnection.deleteSurroundingText` 则不派发 `KEYCODE_DEL`，TextWatcher `type==0` 分支为空无兜底；该设计自 2019 沿用至今（2024-05-07 `8a2314857`、2025-10 富文本重写 `cdc3dd358`/`a3a24a5e9` 均照搬），非近期回归。若后续要修：`RichEditText` 覆写 `onCreateInputConnection`，用 `InputConnectionWrapper` 拦 `deleteSurroundingText` / `sendKeyEvent(KEYCODE_DEL)` 收敛到 `setKeyBordDeleteEvent()`
- (android) 旁路：合并详情回复引用对齐 PC，**已推** `personal-ai-chat-hotfix`（`56173906a`）→ 详见 `20260730`
- (ios) 旁路：合并转发回复/多选预勾等，**已推** `personal-ai-chat-hotfix`（`e24b0cd4b`）→ 详见 `20260730`

## 关键决策记录

- 2026-08-05：缺省 `groupAndAccountSelectAll` 展示当 0；文案「全部类型」「全部数据」；类型含群 AI；真全部只消费现有标记
- 2026-08-05：(web) persist=false 路径保持「数据+n」
- 2026-08-06：点击数据改为**先 get 再开层**（原「先开并行 get」会导致弹层快照与胶囊不一致）；失败仍用本地开层
- 2026-08-06：(web/desktop) 选择数据范围确定钮：0 可选、文案固定「确定」、主题色 `#3E7DFF`
- 2026-08-06：数据胶囊封顶 **999**（测试用 9 已回滚）
- 2026-08-06：全端自测通过；desktop/web/android/ios 已推 `personal-ai-chat-hotfix`
- 2026-08-06：(web) `DataScopeBar` 下拉箭头图标补 `mr-1`，与胶囊右缘留白对齐
- 2026-08-06：旁路修 iOS 合并聊天记录页（导航圈内图标居中、「N条回复」层下移）；详见 `20260730-…/status.md`
- 2026-08-06：排查确认 PC 多选转发问题**非本迭代引入**；修复记在 `20260730`
- 2026-08-06：三端转发对齐 PC（剥 `referMsgUid`、保留引用类型）；合并转发页回复 android/ios 本地已修——**非筛选条范围**
- 2026-08-06：(android) `ReferencePreviewView` 旁路改动误调 `util.StringUtils.isNotEmptyString`（方法在 `com.im.util`），改为已有 `!isEmpty`；onTest 装真机通过
- 2026-08-06：(android) 旁路合并详情：引用头 decode 兜底 + 点引用专用事件开聚合；须重新合并验证 → `20260730`
- 2026-08-07：(web) 类型胶囊下拉箭头与关闭钮间距收紧：`SelectorClose` 负 margin `!-ml-0.5` → `!-ml-1.5`（容器 `gap-1`=4px，净 -2px；关闭钮 `!w-5` 内 14px 图标左右各 3px 内边距，视觉间距 5px → 1px）
- 2026-08-07：(web) `FilterBar` 内容超出时横向滚动（隐藏滚动条），按 scroll 位置在左右两端显示淡出遮罩；同步微调时间/数据胶囊 `shrink`、内边距与关闭钮间距
- 2026-08-07：旁路挂载 `apps/action-center`，用 `vp i` 装依赖（非筛选条范围）；desktop 本地调试配置改动仍勿提交
- 2026-08-07：旁路关闭 action-center PC 强更弹窗（`TheLayout` 中 `needsClientUpgrade` 固定 false）；同仓另有 SVG 路径格式噪声未提交
- 2026-08-07：(web) 旁路 `TimingDialog` 弹窗高度改自适应（min 480 / max `calc(100vh-100px)`）。**坑**：`AcDialog` 的 body 是 `flex-1`（basis 0 ⇒ 收缩因子 0，不会变矮），其下靠 `h-full` 百分比传高；一旦弹窗根改成 `h-auto + max-h`，body 高度变为非确定值，`height:100%` 退化为 `auto`，内容被 body 的 `overflow-hidden` 裁掉且无滚动条。**不改公共 `AcDialog`** 的解法：弹窗根只留 `!h-auto`，min/max 下沉到内容层 `contentClass="!p-0 flex flex-col min-h-[432px] max-h-[calc(100vh-148px)]"`（148 = 留白 100 + header 48；footer 本组件自绘、已在内容层内，勿重复减），内容根 `h-full` → `flex-1 min-h-0`，滚动区 `flex flex-col flex-1 min-h-0 overflow-y-auto`，列表去掉 `h-full overflow-auto` 只留单一滚动容器。devtools 实测（vh=900）：480 → 559 → 759 → 卡 800 且可滚
- 2026-08-07：(android) 旁路：合并详情引用单击立即开弹窗（跳过双击延迟/空 uid 查库）；`ReferenceMessage` 合并 bindView 补挂引用头；合成源消息补 `objectName` 修弹窗 header NPE；onTest 已装真机 → **已推** `e6a590558`
- 2026-08-11：(android) 旁路：个人 AI @ 筛选条 `saveDataRange` 透传三全选标记 → **已推** `d48b5dd9d`
- 2026-08-11：(ios) 旁路：筛选条 `saveDataRange` 透传三全选标记 → **已推** `48adac034`
- 2026-08-11：(android) 旁路：合并详情评优徽章 + 回复弹窗 AI tag/评优，**工作区未提交**；当日 onTest 装包 + 多次 `publishRelease`（`-x verifyPublishReleaseResources`）
- 2026-08-11：(android) 旁路：正式包资源补丁 `color_F0F5FF` + `em_camera_switch_normal`，**工作区未提交**
- 2026-08-11：(ios) 旁路：合并引用快照打包/读侧回填（约 11 文件），**工作区未提交、未构建**
- 2026-08-11：stop-hook 触发收尾；无 web 新联调，impl-notes 不变
