# Status：移动端选择 AI 框 · 纯 Web Popup

> 最后更新：2026-08-03（文档初始化：spec/plan/status）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅ | ✅（共用） | ✅（共用） | ✅（共用） |
| T1 模型 memberCount + AiBoxRow 移动展示 | ⬜ | — | — | — |
| T2 MobilePickerNav + SelectAiBoxPopup 壳/栈 | ⬜ | — | — | — |
| T3 Home + Groups 页 | ⬜ | — | — | — |
| T4 Contacts / OrgPicker 复用（hide-outsource） | ⬜ | — | — | — |
| T5 搜索页（全部/群组/人员） | ⬜ | — | — | — |
| T6 入口接线 PersonalAiChat + MPersonalAiChatWrapper | ⬜ | — | — | — |
| T7 手测验收 + impl-notes | ⬜ | — | — | — |
| 自测通过 | ⬜ | — | — | — |

> PC `SelectAiBoxDialog` 本期不改。android/ios 原生选择页不改工程；WebView 内改为 H5 后不再调起。

## 待办 / 阻塞

- (web) 按 plan T1→T7 实现移动端 `SelectAiBoxPopup`
- (web) 手测：最近/联系人/群组/搜索四路径 + 取消不误提交 + PC Dialog 无回归
- (全端) 原生选择代码 `selectAgentByNative` 保留作回滚，默认不调用

## 关键决策记录

- 2026-08-02 多级页按原生截图；点行即选；功能对齐 SelectAiBoxDialog
- 2026-08-02 隐藏外联；独立搜索页三 tab；默认 H5、保留 native 回滚
- 2026-08-02 新建 SelectAiBoxPopup，不与 Dialog 自适应混写
