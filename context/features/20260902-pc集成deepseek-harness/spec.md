# Spec：PC 端集成 DeepSeek Harness（dsh）

> 2026-09-02 调研 ｜ 状态：**方案阶段，未动任何代码**
> 目标形态：智信 PC（Electron）内嵌 dsh 作为 agent 运行时，**界面用智信自绘**（复用个人 AI 框那套聊天 UI），不加载 dsh 官方 Web UI。

## 一、dsh 是什么（事实核对）

| 项 | 值 |
|---|---|
| 仓库 | `github.com/deepseek-ai/deepseek-harness`，MIT，2026-08-13 开源 |
| 状态 | **Developer Preview**，官方明说会有 breaking change；暂不接受外部 PR |
| npm 包 | `@deepseek-ai/dsh`（主）、`@deepseek-ai/dsh-acp`（ACP server）、`@deepseek-ai/dsh-subagent-acp`（做 ACP 客户端用） |
| 运行时要求 | **Node ^22.19 \|\| >=24**（Node 23 等奇数版不支持） |
| 架构 | Cordis 插件系统，「一切皆插件」；模型/工具/会话/沙箱/存储/调度/UI 全是插件 |
| 集成面 | ① `dsh web` 本地 Web UI ② `--profile headless` 一次性任务 ③ **ACP server（JSON-RPC 2.0 over stdio）** ④ JSON-RPC SDK ⑤ Python SDK |

profile 分层：`dsh-base`（模型适配器 / 工具 / 持久化 / 沙箱 / 审批策略 / 设置 / 凭据）是共同底座，上面叠 `dsh-web-app`（浏览器应用）、`dsh-headless`（无服务器一次性 runner）、`dsh-sdk-app`（JSON-RPC server）、`dsh-acp-app`（**automation-only ACP server**）。

核心服务：`ctx.llm`（模型适配器）、`ctx.tools`（作用域工具注册表）、`ctx.sessions`（append-only 事件日志）、`ctx.sandbox`（进程限制）、`ctx.shell`、`ctx.jobs`。

## 二、选型：走 ACP stdio，不走 Web UI

既然界面自绘，`dsh web` 那条路（起本地 HTTP + WebContentsView 加载官方界面，社区 `deepseek-harness-desktop` 的做法）直接排除，原因：

1. 官方 UI 是整块的，自绘就用不上；
2. `dsh web` 会在 127.0.0.1 开监听端口——企业客户端里多一个本地端口就是多一个攻击面（它拒绝 `--host 0.0.0.0`，只服务本机，但本机其他进程仍可连）；
3. HTTP + 官方 UI 的事件模型不对外承诺稳定。

**选 `@deepseek-ai/dsh-acp`**：主进程 spawn 子进程，stdin/stdout 跑 JSON-RPC 2.0，无端口、生命周期跟随窗口、协议是 ACP 公开规范（比 dsh 内部事件稳）。

握手序列：`initialize`（`protocolVersion`/`capabilities`）→ `session/new`（可声明 mcpServers）→ `session/prompt`，流式收 `agent_message_chunk`。收尾：关子进程 stdin（EOF 宽限 ~6s）→ SIGTERM → SIGKILL。

## 三、**最大阻塞：运行时版本**

`apps/desktop` 现状：`electron: ^19.0.10`（`package.json:93`），Electron 19 内置 **Node 16**。dsh 要 Node ≥22.19。

所以 `ELECTRON_RUN_AS_NODE=1` 复用 Electron 自带 Node 跑 dsh 这条最省事的路 **走不通**。三个出路：

| 方案 | 做法 | 代价 |
|---|---|---|
| **A. 捆 Node 运行时**（推荐） | 随包分发一份 Node 24（macOS arm64/x64 + Windows x64），`extraResources` 放出来，主进程用它 spawn dsh-acp | 安装包 +~50MB/架构；要处理 macOS 签名与公证、Windows 杀软误报 |
| B. 依赖用户机器 Node | 检测 `node -v`，不合格就引导安装 | 企业办公机不现实，几乎必然失败 |
| C. 升 Electron | 升到 Electron 30+ 自带 Node 20/22 | Vue 2.7 + Electron 19 老栈，升级是独立大工程，不该被这个功能绑架 |

**结论：A 是唯一现实路径**，且要立项当独立子任务，不能夹带。

## 四、ACP 事件 → 智信 UI 映射

自绘 UI 要把 ACP 词汇表落到现有消息渲染层：

| ACP 侧 | 智信 PC 侧 |
|---|---|
| `agent_message_chunk`（流式文本） | 复用现有流式 markdown 渲染（三端 markdown 配色那套） |
| 推理 / thinking 流 | 折叠区块，默认收起 |
| `tool_call` / `tool_call_update` | 工具卡片：名称 + 状态 + 耗时；带 diff 的展示 diff，带终端输出的展示终端块 |
| plan（计划） | 任务清单卡片，随更新原地刷新 |
| permission request（权限请求） | **模态审批弹窗**，见下节 |
| session mode / config options | 设置面板；不要暴露给普通用户 |
| slash commands / skills / MCP servers | 先不暴露，二期再说 |

会话模型上 dsh 是 append-only `SessionEvent` 日志 + 投影，天然适合做「历史回放」；智信侧只需存 sessionId，重开窗口用 `ctx.sessions` 的日志重建，不必自己再存一份消息。

## 五、权限与沙箱（安全红线）

dsh **能跑 shell、能改文件**。装进员工 IM 客户端 = 在每台办公机上放了一个任意代码执行面。必须：

- 会话默认 `workspace-write`：bash 与文件修改限制在 session cwd（加共享临时目录）之内。cwd 必须是显式选定的工作区，**不能是用户主目录**。
- **禁用 `danger-full-access`**（它同时关掉沙箱和提示），在配置层锁死，不给 UI 开关。
- 模型请求越权 → 触发 ACP permission request → 弹审批。注意「Always allow (this session)」会把该会话审批策略改成 `never`，等于本会话后续不再问；要不要给这个按钮是产品决策。
- 网络出站：dsh 的 web search / MCP 插件会外连，公司网络策略要过一遍。

## 六、模型端点与凭据

官方默认打 `platform.deepseek.com`，要 API key。公司内网场景两条路：

1. 直连公网 DeepSeek —— 需要走公司出网策略审批，且**代码/文件内容会离开内网**，这是合规问题不是技术问题；
2. 指向内部 OpenAI 兼容端点 —— dsh 的模型配置支持 custom OpenAI-compatible endpoint，注册在 `ctx.llm`。内网有自建推理服务时优先这条。

key 存储走 dsh 自己的 credentials 层（在 harness home），不要塞进智信的配置文件。

## 七、打包分发的现实约束

- dsh 是 npm 包，装出来体积不小；且 dsh 生态里 `node-pty` 一类原生模块需要按目标平台编译（macOS 要 Xcode CLT）。
- Electron 19 + electron-builder 23 打原生模块，和现代 Node 24 的 ABI 不是一回事——**dsh 跑在捆绑的独立 Node 里，不是跑在 Electron 里**，所以它的原生模块按 Node 24 的 ABI 编译，不要走 electron-rebuild。这点必须在实现时守住，否则会踩 ABI 不匹配。
- ⚠️ 落地时必然要改 `package.json` / `electron-builder.yml`，而工作区规则明确**禁止提交** `apps/desktop` 的 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json`。这条规则是为了挡本地调试配置误提交；本功能属于真实构建配置变更，**需要单独跟维护者确认例外口径**，否则打包接入无法进主干。

## 八、分阶段落地建议

1. **P0 可行性验证（不进产品）**：本机装 Node 24 + `npx @deepseek-ai/dsh-acp`，写一个 100 行的 Node 脚本跑通 initialize → session/new → session/prompt，确认流式与工具调用事件形状。产出：事件样本 JSON 存进本目录。
2. **P1 运行时捆绑**：解决 Node 24 随包分发 + 签名/公证，做一个只 spawn 不通信的骨架，验证安装包在真机能拉起子进程。
3. **P2 主进程桥接**：ACP 客户端封装（spawn / 握手 / 请求路由 / 优雅退出），通过 Electron IPC 暴露给渲染层。
4. **P3 渲染层**：按第四节映射表接进自绘聊天 UI，先只做文本流 + 工具卡片。
5. **P4 权限 UI 与沙箱策略**：审批弹窗、工作区选择、配置层锁死危险选项。
6. **P5 模型端点**：接内网 OpenAI 兼容端点或走审批后的公网 key。

## 九、风险清单

| 风险 | 说明 |
|---|---|
| dsh 是 Developer Preview | 官方明示 breaking change；ACP 面相对稳，但 profile/配置层随时变。要锁死版本号，不用 `latest` |
| Electron 19 / Node 16 | 见第三节，必须捆运行时 |
| 安装包体积 | 每架构 +~50MB Node，加上 dsh 依赖树 |
| 合规 | 代码/文件内容外发给模型，需法务与安全过 |
| 提交禁忌冲突 | 见第七节 ⚠️ |
| 官方不收 PR | 遇到 bug 只能自己打补丁或写插件绕，不能指望上游合并 |

## 十、待决策

- [ ] 模型端点走公网 DeepSeek 还是内网 OpenAI 兼容服务？（决定合规路径）
- [ ] 「Always allow (this session)」这个降级审批的按钮给不给用户？
- [ ] `apps/desktop` 的 `package.json` / `electron-builder.yml` 提交禁忌，本功能要不要开例外？
- [ ] 目标平台范围：只 macOS arm64，还是要 Windows x64？（决定捆绑运行时的工作量）

## 参考

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- [官方架构文档](https://deepseek-harness.github.io/deepseek-harness/reference/)
- [官方 Quickstart](https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart)
- [Agent Client Protocol 规范](https://agentclientprotocol.com/get-started/introduction)
- [openma-ai/deepseek-harness-acp（第三方 ACP server 实现，可读其事件映射）](https://github.com/openma-ai/deepseek-harness-acp)
- [deepseek-harness-desktop（社区 Electron 封装，走 web UI 路线，仅作对照）](https://gitcode.com/daxiong12169/deepseek-harness-desktop)
