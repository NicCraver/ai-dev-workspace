# Spec：PC 端集成 DeepSeek Harness（dsh）

> 2026-09-02 ｜ 状态：**已实现，待真机验证**
> 目标：智信 PC（Electron）侧边栏新增入口，点开即可用 dsh；**打包产物在没有 Node 的用户机器上直接可用**。

## 一、dsh 是什么（事实核对）

| 项 | 值 |
|---|---|
| 仓库 | `github.com/deepseek-ai/deepseek-harness`，MIT，2026-08-13 开源 |
| 状态 | **Developer Preview**，官方明说会有 breaking change；暂不接受外部 PR |
| npm 包 | `@deepseek-ai/dsh`（主，本次锁 `0.1.1-rc.2`）、`@deepseek-ai/dsh-acp`、`@deepseek-ai/dsh-subagent-acp` |
| 运行时要求 | **Node ^22.19 \|\| >=24** |
| 架构 | Cordis 插件系统，「一切皆插件」；模型/工具/会话/沙箱/存储/调度/UI 全是插件 |
| CLI | `dsh --profile <name>`；`dsh web` 是 `--profile web` 的别名 |

profile 分层：`dsh-base`（模型适配器 / 工具 / 持久化 / 沙箱 / 审批策略 / 设置 / 凭据）是共同底座，上面叠 `dsh-web-app`、`dsh-headless`、`dsh-sdk-app`（JSON-RPC server）、`dsh-acp-app`（automation-only ACP server）。

profile 存放在 `$DSH_HOME/profiles`，首次启动自动从发行包 seed 模板。

## 二、接入面选型：本地 Web UI + webview

**结论：主进程 spawn `dsh web`，渲染层用 `<webview>` 加载 `http://127.0.0.1:<port>`。**

`dsh web --help` 提供的关键 flag：

```
--host <host>       bind host
--port <port>       listen port; pass 0 to let the OS pick a free one
--no-open           do not open the Web UI in the default browser
--trusted-host      extra authority the /api browser-trust fence accepts
```

`--port 0` + `--no-open` 正好满足内嵌需求：端口由系统分配不冲突，也不会弹系统浏览器。就绪时 stdout 打印一行：

```
dsh web: http://127.0.0.1:64630
```

主进程正则提取这行即可，无需额外探活。

### 为什么不用 ACP

官方 `@deepseek-ai/dsh-acp` 的 README 自述是「**仅面向自动化**的传输适配器，而非 UI 集成或能力 seam」，明确**不提供**：编辑器导航、transcript 回放、命令、模式、配置选择器、信息征集、**推理**、**计划**、标题、**工具展示**。

两条对交互式界面是硬伤：

1. **没有逐 token 流式**。`session/update` 只在每条**已提交的** `assistant/message` 上发 `agent_message_chunk`，README 原话：「有意牺牲逐 token 输出的低延迟，以换取干净的自动化结果」。
2. `initialize` 不公布会话、编辑器、终端、文件系统或 MCP 能力；`session/new` 直接拒绝非空的 `additionalDirectories` 和 `mcpServers`。

社区第三方实现（`openma-ai/deepseek-harness-acp`）能映射完整 ACP 词汇表，是因为它自己在进程内组合 harness、消费 `ctx.sessions` 事件日志，不是靠官方这个包。

ACP 适合的场景是「跑一次性自动化任务拿结果」，不是撑聊天界面。

### 自绘 UI 留作后续

若将来要把 dsh 的能力接进智信自己的聊天界面，正确入口是 `dsh-sdk-app`（JSON-RPC server）或进程内组合 Cordis 消费 `ctx.sessions`——README 提示「推理与工具活动仍保留在会话日志中，以便其他界面观测」。本次不做：工作量与官方 Web UI 不在一个量级，且吃内部 API 会被 Developer Preview 的破坏性变更反复打断。

## 三、运行时：必须捆一份 Node

`apps/desktop` 是 `electron: ^19.0.10`（实测 `node_modules/electron/dist/version` = `19.0.10`），Electron 19 内置 **Node 16**。dsh 要 Node ≥22.19，所以 `ELECTRON_RUN_AS_NODE=1` 复用 Electron 自带 Node 这条路走不通。

选定：**随包分发 Node 24.20.0**，由 `scripts/dsh/prepare-dsh-runtime.js` 在构建机上准备。

只保留可执行文件本体，剔掉官方发行包里的 npm / 头文件 / 文档。

> 升 Electron（30+ 自带 Node 20/22）能省掉这份体积，但 Vue 2.7 + Electron 19 老栈的升级是独立大工程，不该被本功能绑架。

## 四、实现

### 运行时布局

```
resources/dsh-runtime/          # .gitignore 排除，不进版本库
  node/bin/node                 # win32 为 node/node.exe
  app/package.json
  app/node_modules/@deepseek-ai/dsh/lib/bin.js
```

打包后由 afterPack hook 拷到 `<app>/Contents/Resources/dsh-runtime/`（Windows/Linux 为 `resources/dsh-runtime/`）。

### 启动链路

```
侧边栏「Harness」入口
  → 路由 dsh
  → main.vue 懒挂载 DshPanel（首次点击才挂，避免开机就 spawn）
  → ipcRenderer.invoke("dsh-ensure-started")
  → DshController.ensureStarted()
      spawn(<内嵌node>, [<dsh bin>, "web", "--no-open", "--host", "127.0.0.1", "--port", "0"])
      env.DSH_HOME = userData/dsh-home
      监听 stdout，匹配 /https?:\/\/127\.0\.0\.1:(\d+)/
  → 返回 url → <webview :src="url">
```

并发调用共享同一次启动 Promise；90s 超时；进程退出时清空状态；`before-quit` / `will-quit` / `process exit` 三处兜底回收子进程，避免留下占端口的孤儿 Node。

### 为什么走 afterPack 而不是 extraResources

`apps/desktop/.gitignore` 里有 `electron-builder.yml`，且仓库明令禁止提交它（连同 `package.json` / `package-lock.json` / `.env.test`）。改配置的路走不通，afterPack hook 是纯代码路径，可以正常提交。同理没有往 `package.json` 加 npm script，准备脚本直接 `node scripts/dsh/prepare-dsh-runtime.js` 调用。

## 五、权限与沙箱（安全红线，**尚未落实**）

dsh **能跑 shell、能改文件**。装进员工 IM 客户端 = 在每台办公机上放了一个任意代码执行面。上线前必须处理：

- 会话默认 `workspace-write`：bash 与文件修改限制在 session cwd（加共享临时目录）之内。cwd 必须是显式选定的工作区，**不能是用户主目录**。
- **禁用 `danger-full-access`**（它同时关掉沙箱和提示），在配置层锁死，不给 UI 开关。
- 模型请求越权 → 触发权限请求 → 弹审批。「Always allow (this session)」会把该会话审批策略改成 `never`，要不要给这个按钮是产品决策。
- 网络出站：web search / MCP 插件会外连，公司网络策略要过一遍。

> 当前实现直接加载官方 Web UI，上述策略走 dsh 自己的配置层（`$DSH_HOME` 下的 settings / profile patch），尚未做任何锁定。**这是上线前的阻塞项。**

## 六、模型端点与凭据

官方默认打 `platform.deepseek.com`，要 API key。两条路：

1. 直连公网 DeepSeek —— 需过公司出网策略，且**代码/文件内容会离开内网**，是合规问题不是技术问题；
2. 指向内部 OpenAI 兼容端点 —— dsh 模型配置支持 custom OpenAI-compatible endpoint，注册在 `ctx.llm`。内网有自建推理服务时优先这条。

key 存储走 dsh 自己的 credentials 层（在 `$DSH_HOME`），不塞进智信的配置文件。

## 七、体积

实测（macOS arm64）：

| 项 | 未压缩 |
|---|---|
| Node 24.20.0 二进制 | 116MB |
| `@deepseek-ai/dsh` 依赖树（453 包） | 275MB |
| 合计 | ~391MB |

275MB 里大头几乎全是用不到的东西，可裁约 120-150MB：

| 包 | 大小 | 说明 |
|---|---|---|
| `@mistralai/mistralai` | 24M | 别家模型 SDK |
| `node-pty` | 27M | 内含**全平台** prebuilds，只留一个平台 → ~4MB |
| `@img/sharp-libvips-darwin-arm64` | 18M | 多模态图像 |
| `@google/genai` | 14M | 别家模型 SDK |
| `openai` | 13M | 走 OpenAI 兼容端点才要 |
| `@opentelemetry/semantic-conventions` | 12M | 遥测 |
| `web-streams-polyfill` | 8.7M | Node 24 原生已有 |
| `@mixmark-io/domino` | 8.6M | HTML 转换 |
| `@earendil-works/pi-ai` | 8.3M | 别家 |
| `dsh-client-ui-trajectory` | 7.9M | Web UI 轨迹视图 |
| `@anthropic-ai/sdk` | 6.4M | 别家模型 SDK |
| `@smithy/core` | 5.2M | AWS |

**本次不裁**——dsh 是 Cordis 插件架构，运行时动态装载，盲裁容易在某条路径上炸。先保证能跑，裁剪单独做一轮并回归验证。

原生模块全是 **prebuilds**（`node-pty` 带 darwin/win32/linux 五套，`node-addon-require-builtin` 是 napi-v9 稳定 ABI），**不用本机编译**，所以准备脚本用 `--ignore-scripts`。它们跑在独立 Node 24 里，与 Electron 19 的 ABI 无关，**不要走 electron-rebuild**。

## 八、实测数据（2026-09-02，macOS arm64，Node 24.20.0）

| 项 | 值 |
|---|---|
| `dsh web` 冷启动到监听 | ~1s（profile 已 seed） |
| 进程常驻内存 | RSS ~185MB |
| 首页 HTTP | 200，14.5KB |
| stdout 就绪行 | `dsh web: http://127.0.0.1:64630` |
| `DSH_HOME` 隔离 | 有效，自动 seed `profiles/` |

## 九、风险清单

| 风险 | 说明 |
|---|---|
| dsh 是 Developer Preview | 官方明示 breaking change。已锁 `0.1.1-rc.2`，不用 `latest` |
| 安装包体积 +~390MB 未压缩 | 见第七节，可裁但需回归 |
| 安全 | 见第五节，**上线阻塞项** |
| 合规 | 代码/文件内容外发给模型，需法务与安全过 |
| `dsh plugin` 不可用 | 该子命令转发给 pnpm，用户机器没有 pnpm |
| 不支持交叉平台准备 | 依赖树含按平台预编译包，mac 包在 mac 上构建，Windows 包在 Windows 上构建 |
| 官方不收 PR | 遇到 bug 只能自己打补丁或写插件绕 |

## 十、待决策

- [ ] 模型端点走公网 DeepSeek 还是内网 OpenAI 兼容服务？（决定合规路径）
- [ ] 「Always allow (this session)」这个降级审批的按钮给不给用户？
- [ ] 目标平台范围：只 macOS arm64，还是要 Windows x64？（决定准备脚本要在几台机器上跑）
- [ ] 这个入口对所有员工开放，还是灰度 / 白名单？

## 参考

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- [官方架构文档](https://deepseek-harness.github.io/deepseek-harness/reference/)
- [官方 Quickstart](https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart)
- [Agent Client Protocol 规范](https://agentclientprotocol.com/get-started/introduction)
- [openma-ai/deepseek-harness-acp（第三方 ACP server，可读其事件映射）](https://github.com/openma-ai/deepseek-harness-acp)
