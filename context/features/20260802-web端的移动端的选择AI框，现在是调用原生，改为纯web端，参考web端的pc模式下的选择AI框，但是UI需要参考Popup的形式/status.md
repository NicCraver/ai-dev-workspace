# Status：移动端选择 AI 框 · 纯 Web Popup

> 最后更新：2026-08-03（审查修复：全部+智能体名对齐 PC；v-memo/行高/KeepAlive）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅ | ✅（共用） | ✅（共用） | ✅（共用） |
| T1 模型 memberCount + AiBoxRow 移动展示 | ✅ | — | — | — |
| T2 MobilePickerNav + SelectAiBoxPopup 壳/栈 | ✅ | — | — | — |
| T3 Home + Groups 页 | ✅ | — | — | — |
| T4 Contacts / OrgPicker 复用（hide-outsource） | ✅ | — | — | — |
| T5 搜索页（全部/群组/人员） | ✅ | — | — | — |
| T6 入口接线 PersonalAiChat + MPersonalAiChatWrapper | ✅ | — | — | — |
| T7 手测验收 + impl-notes | 🚧 impl-notes 已写；手测待做 | — | — | — |
| 自测通过 | ⬜ 待真机 | — | — | — |

> PC `SelectAiBoxDialog`：行为不变，已做大数据量性能优化（懒搜索候选 / markRaw / 预拆组织群 / 去掉 normalize 挂 raw）。android/ios 原生选择页不改工程；WebView 内改为 H5。

## 待办 / 阻塞

- (web) ⏳ 真机手测：全部/联系人/群组/搜索四路径；取消不误提交；PC Dialog 无回归
- (web) ⏳ 确认群 `groupNumber` 是否回传（影响 `(人数)` 展示）
- (web) ✅ 审查修复（本地未 commit）：Home「全部」+ 列表/搜索展示智能体名对齐 PC；`matchAgentName` 与 `showAgentName` 拆分（数据范围两者关）；去掉 DataRange 虚拟列表 slot 内 `v-memo`；OrgPicker 定高行对齐；contacts `KeepAlive`；点选防连点
- (web) ✅ 大数据量性能：定高虚拟列表（Dialog/Popup/OrgPicker/Search）+ `shallowRef` + OrgPicker agentLookup Map；本地未 commit
- (web) ✅ 已 push `personal-ai-chat` `8e8e7cf`（移动端 H5 Popup + 虚拟列表）
- (web) ✅ 旁路优化「选择数据范围」：`SelectDataRangeDialog` 选中改 Set、搜索懒挂候选（见 20260729 功能 status）；本地未 commit
- (web) ✅ PC「选择 AI 框」性能：搜索聚焦后才挂 candidates；`markRaw` + 预计算组织群；normalize 去掉整包 `raw`、提升 `agentVersionId`；本地未 commit
- (全端) `selectAgentByNative` 保留作回滚

## 关键决策记录

- 2026-08-02 多级页按原生截图；点行即选；功能对齐 SelectAiBoxDialog
- 2026-08-02 隐藏外联；独立搜索页三 tab；默认 H5、保留 native 回滚
- 2026-08-02 新建 SelectAiBoxPopup，不与 Dialog 自适应混写
- 2026-08-03 入口：`PersonalAiChat` 按 `isMobile()` 挂 Popup；`MPersonalAiChatWrapper` 恒挂 Popup
- 2026-08-03 Popup 主列表文案「全部」、行内展示智能体名与搜索一致（对齐 PC Dialog）；数据范围仍不展示/不匹配智能体名
