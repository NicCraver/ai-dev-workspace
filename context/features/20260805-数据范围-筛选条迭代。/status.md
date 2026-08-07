# Status：数据范围-筛选条迭代。

> 最后更新：2026-08-07（旁路：action-center 用 vp 装依赖；desktop 本地调试配置仍勿提交；本功能矩阵仍全 ✅）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 文案规则（类型全部/数据全部·封顶） | ✅ | ✅ | ✅ | ✅ |
| 点击数据：先 get 再开层 | ✅ | ✅ | ✅ | ✅ |
| 接口联调（flags 回传验收） | ✅ | ✅ | ✅ | ✅ |
| 自测通过 | ✅ | ✅ | ✅ | ✅ |

> 本功能矩阵不变。apps 工作区另有**旁路**改动，不记入上表格子。

## 待办 / 阻塞

- (全端) 设置页 / 定时任务文案本期不做（web 用 `persist=false` 隔离）
- (web) 筛选条横向溢出可滚动 + 两端淡出遮罩 + 胶囊间距微调，已推 `personal-ai-chat-hotfix`（`50e5d98`）
- (desktop) 工作区仅有 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json` 本地调试配置改动，**不计入本功能、勿提交**；旁路多选转发三坑已推 `personal-ai-chat-hotfix`，**待真机** → 详见 `20260730`
- (action-center) 旁路：挂载后用 Vite+ `vp i` 装依赖（重写 lock、`devEngines`、`pnpm-workspace.yaml` allowBuilds），**非本功能、勿计入矩阵**；pnpm 11 忽略原 `package.json#pnpm` 的 patches/overrides，后续若异常再迁配置
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
