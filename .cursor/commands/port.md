# 将活跃功能从已完成端移植到目标端

跨端移植任务，参数：$ARGUMENTS（第一个词是目标端；第二个词可选，指定功能名，缺省读 `context/features/ACTIVE`）。

严格按以下步骤执行：

## 1. 读取输入（只读这些，不要读源端代码）

- `context/features/<feature>/impl-notes.md` —— 移植的逻辑依据
- `context/features/<feature>/spec.md` —— 需求边界
- `context/contracts/` 中该功能涉及的契约文件
- `context/platforms/<目标端>.md` —— 目标端约定
- 目标端 app 仓库自己的 `CLAUDE.md`
- 若功能涉及 WebView 通信 → `context/bridge.md`

**前置检查**：如果 impl-notes.md 不存在、或缺少本次要移植的部分（无状态流转 / 无接口时序），停下来告诉用户，先提议补全 impl-notes（此时才允许去读 web 源码做提炼），补完并经确认后再继续。

## 2. 探索目标端落点

用 codebase-memory 检索目标端仓库中相关模块（路由/页面注册、网络层、类似功能的现有实现），确定新代码的落点和应复用的现有基础设施。列出落点清单给用户过目。

## 3. 生成移植 plan

用 writing-plans 产出移植计划，追加写入 `context/features/<feature>/plan.md` 的「<目标端> 移植」小节。要求：

- 用目标端的惯用范式实现（MVVM/Compose/SwiftUI 等以 platforms 文档为准），不照搬 web 的组件结构；
- 接口调用严格按 contracts；mock 阶段的开关方式沿用该端现有惯例；
- 覆盖 impl-notes 中列出的全部边界情况和联调坑。

## 4. 执行

plan 经用户确认后按执行流程实施。完成后自动进入 wrapup 技能（更新 status.md 矩阵中该端的格子、提交 context）。
