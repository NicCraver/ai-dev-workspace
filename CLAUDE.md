# 多端协同开发工作区

这是一个编排仓库：`context/` 是唯一事实来源（文档），`apps/` 下是四个独立 git 仓库（被调度的代码）。

## 仓库地图

| 路径 | 说明 |
|------|------|
| `apps/web/` | Web 端（React/Vue，其他三端通过 WebView/内嵌方式复用它） |
| `apps/android/` | Android 端（Kotlin） |
| `apps/ios/` | iOS 端（Swift） |
| `apps/desktop/` | PC 端（Electron） |
| `context/features/<feature>/` | 每个功能迭代的 spec / plan / status / impl-notes |
| `context/contracts/` | 接口契约（唯一事实来源，mock 与联调都以它为准） |
| `context/platforms/` | 各端的一页纸约定（构建命令、代码规范、常见坑） |
| `context/bridge.md` | WebView ↔ 原生的 JSBridge 协议 |

## 会话启动规则（每次必读）

1. 当前活跃功能记录在 `context/features/ACTIVE` 文件中（SessionStart hook 会自动注入其 status.md）。
2. 开始任何编码任务前，先读活跃功能的 `status.md`，明确本次要推进矩阵中的哪一格。
3. 涉及某端代码时，先读 `context/platforms/<端>.md`；查代码结构优先用 codebase-memory 检索，不要盲目大量读文件。
4. Web 端样式规范见 `context/dev-rules/unocss-conventions.mdc`（编辑 `apps/web/**` 时由 Cursor 按 glob 自动注入，其他端不加载）。Cursor 用户见 `.cursor/` 目录（hooks / commands / skills / rules 与 `.claude/` 对齐）。

## 文档产出路径（覆盖 Superpowers 默认行为）

- Superpowers brainstorming 产出的设计文档 → 写入 `context/features/<feature>/spec.md`
- writing-plans 产出的计划 → 写入 `context/features/<feature>/plan.md`
- 不要把设计文档或计划写到 apps/ 内部或其他位置。

## 接口契约规则

- `context/contracts/` 是接口的唯一事实来源。页面先行阶段，mock 数据必须严格按契约类型构造。
- 后端接口到位后：先 diff 更新契约文件（在文件头的 Changelog 记录变更），再修改调用代码。
- 任何端发现接口实际行为与契约不符时：先改契约并记录，再改代码，并在活跃功能的 impl-notes.md「联调坑」小节补一条。

## 跨端移植规则（重要）

将已完成端（通常是 web）的功能移植到其他端时：

1. 只读 `context/features/<feature>/impl-notes.md` + `context/contracts/` + 目标端 `context/platforms/<端>.md`。
2. **禁止**直接大量阅读源端（web）代码来移植——impl-notes 是平台无关的逻辑提炼，照它实现，用目标端的惯用范式（不要把 React 状态思维硬搬进 Swift/Kotlin）。
3. 如 impl-notes 缺失或信息不足，先补全 impl-notes（可参考源端代码提炼），再开始移植。
4. 涉及与 WebView 通信的功能，必须同时对照 `context/bridge.md`。

## 收尾规则（wrapup 技能会自动触发，此处为兜底）

完成任何编码任务后、结束回合前，必须：

1. 更新活跃功能 `status.md` 的平台矩阵与「待办/阻塞」小节。
2. 若本次完成了 web 端接口联调 → 生成/更新该功能的 `impl-notes.md`。
3. 在 context 仓库执行 `git add -A && git commit`（提交信息格式：`docs(<feature>): <一句话>`）。

> Stop hook 会检查：apps 有代码改动但活跃功能 status.md 未更新时，将阻止结束并提示补齐。

## 功能内聚（目录/模块组织，四端通用）

每个功能域/迭代的代码**集中在一个独立目录/模块**，禁止散落到公共目录里与其它功能混放：

- **web**：`apps/web/src/components/views/<功能域>/`（含入口组件、子组件、取数/adapter、该功能私有的工具与单测）。示例：个人AI框在 `views/personal-ai/`，其入口 `PersonalAiChat.vue` 由 `/personal` 路由引用。功能私有工具（如高亮、搜索输入框）随功能目录走，不放公共 `utils/`；确实被多功能复用时才上提到公共层。
- **android / ios**：一个功能一个 package / group（对应 Kotlin package、Xcode group/文件夹）。
- **desktop**：一个功能一个模块目录。

判据：只被本功能引用的文件 → 放功能目录；被 2+ 功能引用 → 上提公共层。移动后同步更新引用方 import。

## 各仓库内部约定

每个 app 仓库根目录有自己的 CLAUDE.md（构建、测试、lint 命令与代码规范），进入该仓库工作时以它为准。
