# Status：移动端选择 AI 框 · 纯 Web Popup

> 最后更新：2026-08-03（列表虚拟化性能优化已落地，待真机手测）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

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

> PC `SelectAiBoxDialog` 本期未改行为。android/ios 原生选择页不改工程；WebView 内改为 H5。

## 待办 / 阻塞

- (web) ⏳ 真机手测：最近/联系人/群组/搜索四路径；取消不误提交；PC Dialog 无回归
- (web) ⏳ 确认群 `groupNumber` 是否回传（影响 `(人数)` 展示）
- (web) 本地改动在 `apps/web`，**尚未 commit**（等用户确认后提交 `personal-ai-chat`）
- (全端) `selectAgentByNative` 保留作回滚

## 关键决策记录

- 2026-08-02 多级页按原生截图；点行即选；功能对齐 SelectAiBoxDialog
- 2026-08-02 隐藏外联；独立搜索页三 tab；默认 H5、保留 native 回滚
- 2026-08-02 新建 SelectAiBoxPopup，不与 Dialog 自适应混写
- 2026-08-03 入口：`PersonalAiChat` 按 `isMobile()` 挂 Popup；`MPersonalAiChatWrapper` 恒挂 Popup
