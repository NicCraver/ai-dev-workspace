# 多端协同开发工作区

这是一个编排仓库：`context/` 是唯一事实来源（文档），`apps/` 下挂着 7 个独立 git 仓库（被调度的代码）。

## 仓库地图

**智信主产品四端**——绝大多数功能迭代在这四个里跨端推进，平台矩阵说的就是它们：

| 路径 | 说明 |
|------|------|
| `apps/web/` | Web 端（React/Vue，其他三端通过 WebView/内嵌方式复用它） |
| `apps/android/` | Android 端（Kotlin） |
| `apps/ios/` | iOS 端（Swift） |
| `apps/desktop/` | PC 端（Electron） |

**另外三个仓库，性质不同，别当成智信的第五第六第七端**：

| 路径 | 说明 |
|------|------|
| `apps/meeting/` | 智能会议室。**目前是个人项目**（远端在 GitHub `NicCraver/zx-meeting-room`，其余仓库都在公司内网 GitLab），正准备推进到公司。pnpm workspace 双包 `web/` + `server/`，内嵌于智信三端 WebView。约定见 `context/platforms/meeting.md` |
| `apps/action-center/` | 行动中心（`zx-operation-center`），**公司的另一个 web 项目**。Vue 3 + Vite MPA 四入口。主要当**参考源**——抄它的交互 / 逻辑 / 界面到智信各端；未来也会直接迭代它自己。约定见 `context/platforms/action-center.md` |
| `apps/contact/` | 通讯录 / 组织架构**后端服务**（`zx-contact`）。Spring Boot + Java 8 + MyBatis-Plus 微服务，四端消费它的接口。会议室后端功能在这里落地。约定见 `context/platforms/contact.md` |

其余路径：

| 路径 | 说明 |
|------|------|
| `context/features/<feature>/` | 每个功能迭代的 spec / plan / status / impl-notes |
| `context/contracts/` | 接口契约（唯一事实来源，mock 与联调都以它为准） |
| `context/platforms/` | 各端的一页纸约定（构建命令、代码规范、常见坑） |
| `context/bridge.md` | WebView ↔ 原生的 JSBridge 协议 |

## 会话启动规则（每次必读）

1. 活跃功能记录在 `context/features/ACTIVE`，**每行一个，支持多个并行任务**；第一行是主功能，`#` 开头与空行忽略。SessionStart hook 只注入主功能的 status.md 全文，其余只列名。
2. 开始任何编码任务前，先确认本次归属哪个活跃功能——不是主功能时**自己去读** `context/features/<名>/status.md`，再明确要推进矩阵中的哪一格。
3. 功能做完从 ACTIVE 里删掉那一行；`/new-feature` 会把新功能插到第一行并保留其余行。
4. 涉及某端代码时，先读 `context/platforms/<端>.md`；查代码结构优先用 codebase-memory 检索，不要盲目大量读文件。
5. Web 端样式规范见 `context/dev-rules/unocss-conventions.mdc`（编辑 `apps/web/**` 时由 Cursor 按 glob 自动注入，其他端不加载）。Cursor 用户见 `.cursor/` 目录（hooks / commands / skills / rules 与 `.claude/` 对齐）。

## 文档产出路径（覆盖 Superpowers 默认行为）

- Superpowers brainstorming 产出的设计文档 → 写入 `context/features/<feature>/spec.md`
- writing-plans 产出的计划 → 写入 `context/features/<feature>/plan.md`
- 不要把设计文档或计划写到 apps/ 内部或其他位置。

## 接口契约规则

- `context/contracts/` 是接口的唯一事实来源。页面先行阶段，mock 数据必须严格按契约类型构造。
- **组织：一域一文件夹、一接口一文件**——`contracts/<域>/<接口>.d.ts`（不要多接口挤一个文件）；域内共享类型放 `<域>/_shared.d.ts`，跨域通用放根级 `_common.d.ts`。仅约束新增契约，既有契约下次改动它时顺手迁移（详见 `contracts/README.md`）。
- 后端接口到位后：先 diff 更新契约文件（在文件头的 Changelog 记录变更），再修改调用代码。
- 任何端发现接口实际行为与契约不符时：先改契约并记录，再改代码，并在活跃功能的 impl-notes.md「联调坑」小节补一条。

## 跨端移植规则（重要）

将已完成端（通常是 web）的功能移植到其他端时：

1. 只读 `context/features/<feature>/impl-notes.md` + `context/contracts/` + 目标端 `context/platforms/<端>.md`。
2. **禁止**直接大量阅读源端（web）代码来移植——impl-notes 是平台无关的逻辑提炼，照它实现，用目标端的惯用范式（不要把 React 状态思维硬搬进 Swift/Kotlin）。
3. 如 impl-notes 缺失或信息不足，先补全 impl-notes（可参考源端代码提炼），再开始移植。
4. 涉及与 WebView 通信的功能，必须同时对照 `context/bridge.md`。

**例外：从 `apps/action-center/` 借鉴时不适用上面第 2 条。** 它不是智信的某一端，没有对应 impl-notes，抄的是现成的交互 / 逻辑 / 界面——这种场景就是要直接读它的源码。做法：

- 先用 codebase-memory 或 Grep 定位，不要整目录漫读。
- 抄过来的东西按目标端惯用范式重写，别把它的 MPA / Vite 结构假设带进智信的端。
- 若抄的实现有非显然的取舍（为什么这么做交互、边界条件），写进当前功能的 impl-notes 并注明来源是 action-center 的哪个文件。

## 收尾规则（wrapup 技能会自动触发，此处为兜底）

完成任何编码任务后、结束回合前，必须：

1. 更新**本次实际推进的那个**活跃功能的 `status.md`（平台矩阵与「待办/阻塞」）。一回合动了多个功能就分别更新；没动的功能不要写空更新。
2. 若本次完成了 web 端接口联调 → 生成/更新该功能的 `impl-notes.md`。
3. 在 context 仓库执行 `git add -A && git commit`（提交信息格式：`docs(<feature>): <一句话>`）。多个功能各提一条，不要混成一个 commit。

> Stop hook 会检查：apps 有代码改动但**所有**活跃功能的 status.md 都未更新时，将阻止结束并提示补齐（任一更新即放行，写对地方靠这条规则自觉）。

## 功能内聚（目录/模块组织，四端通用）

**适用范围**：本规则针对**新增代码**——新功能/新文件按下面的目录组织落地。**修改既有代码时不强制挪动**：就地改即可，不要为了合规去搬迁历史文件（避免大范围 rename 带来的 diff 噪声与回归风险）。历史散落代码只在**顺手且低风险**（或专门做整理任务）时再归拢。

每个功能域/迭代的代码**集中在一个独立目录/模块**，禁止散落到公共目录里与其它功能混放：

- **web**：`apps/web/src/components/views/<功能域>/`（含入口组件、子组件、取数/adapter、该功能私有的工具）。功能私有工具（如高亮、搜索输入框）随功能目录走，不放公共 `utils/`；确实被多功能复用时才上提到公共层。示例：个人AI框在 `views/personal-ai/`，入口 `list/PersonalAiChat.vue` 由 `/personal` 路由引用。
- **android / ios**：一个功能一个 package / group（对应 Kotlin package、Xcode group/文件夹）。
- **desktop**：一个功能一个模块目录。

**子功能细分**：功能目录内可再按子功能拆子目录（如 `personal-ai/` → `list/`、`picker/`（内含 `search/`）、`selector/`）。
**单测归置**：单测集中到该功能的 `tests/` 子目录（web=`tests/`，其它端按各自测试目录惯例），不与源码同级散放。
判据：只被本功能引用的文件 → 放功能目录；被 2+ 功能引用 → 上提公共层。移动后同步更新引用方 import。

## PC 端提交禁忌（apps/desktop）

提交 / push `apps/desktop` 时，**禁止**把本地调试用的环境与构建配置带进分支（已发生过误提交，勿再犯）：

- `.env.test`
- `electron-builder.yml`
- `package.json`
- `package-lock.json`

这些文件可本地改（localhost、`-test` 包名、arm64、leveldown 等），但 **`git add` / commit 一律排除**；功能相关只提交业务源码与单测。若工作区里它们有改动，提交前用 `git restore` / `git checkout --` 还原，或确认未 stage。

## 各仓库内部约定

每个 app 仓库根目录有自己的 CLAUDE.md（构建、测试、lint 命令与代码规范），进入该仓库工作时以它为准。
