# Spec：iOS 打开文件的下载进度与取消（知识来源 / 聊天文件 / H5 知识来源）

> 由 Superpowers brainstorm 产出。最后更新：2026-08-18

## 背景与目标

iOS 上点开一个文件（智能体回复里的知识来源链接、聊天里的文件消息）后，全程只有一个 `ZXProgressHUD` 在转圈（文案「文件加载中...」）。大文件下载要几十秒到几分钟，用户看不到任何进展，观感等同于「卡死」，也没有任何办法中止。

安卓对应场景是先跳一个独立页 `FileLoadActivity`（文件图标 / 文件名 / 大小 / 横向进度条 + 百分比 / 暂停 / 打开），所以不存在这个问题。

**本期不复刻安卓的独立页**，而是把 iOS 现有的加载浮层升级为「可感知进度 + 可取消」。

成功标准：

1. 上述三个入口点开文件后，浮层显示**随下载字节数实时变化的百分比**，不再是无信息转圈。
2. 用户可随时点「取消」中止，立刻回到原页面。
3. 进度条单调不回退，到 100% 后才弹出预览。

## 用户流程

**主流程（以知识来源为例）**

1. 用户点智能体回复里的知识来源链接（原生卡片）或 H5 里的同类链接。
2. 立刻出现居中浮层：环形进度 + 中心百分比 + 「文件加载中」+ 「取消」。
3. 进度 0→8%：请求文件元数据（`agentFileDataByDocId`）与 OSS 签名阶段，按 0.5s 步进的假进度爬升，8% 封顶。
4. 进度 8%→100%：真实下载字节进度。
5. 到 100% 停 0.25s，浮层消失，弹出文件预览（`QLPreviewController` / 图片浏览器 / 智文 Web 页）。

**关键分支**

- **用户点取消**：中止当前网络任务（元数据请求 / 签名 / 下载 / 解密轮询），删除半成品文件，关闭浮层，不弹 toast（用户主动行为，无需解释）。
- **本地已有缓存**：跳过下载，不显示浮层，直接预览（沿用现有 `readFile` 命中逻辑）。
- **绿盾加密文件**：先解密任务轮询（沿用现有 5%→65% 假进度），下载段接在 65% 之后到 100%。
- **飞书 / WPS 未授权**（错误码 `N_L_C_00001` / `N_L_C_00002`）：关闭浮层，走现有 `presentAgentAuthFromController:` 授权页，在原生内闭环。
- **失败**：先 dismiss 浮层，再弹现有文案的 toast（「查看文件失败，请稍候重试。」/「无查看权限」/「知识已删除，无法访问」）。
- **图片 / 智文 / 飞书 / 公开链接分支**（`fromType` 2/3/4/6）：路径不变，只是加载期间的浮层换成新的。

## 范围

**本期做**

- iOS：`ZXFilePreviewLoadHUD` 升级为环形进度 + 取消按钮。
- iOS：`ZXFileClient` 暴露下载进度与取消能力（新方法，旧方法转调，老调用点零改动）。
- iOS：三个入口接线——① 原生知识来源 `ZXAgentKnowledgeOpenLogic`；② 聊天文件消息（经 `ZXMultiMediaClient openLocalFile:`）；③ H5 知识来源（新桥 `openKnowledgeDoc`）。
- iOS：新增 JSBridge 方法 `openKnowledgeDoc`（`ZXJSAIChatAPI`），原生全包元数据 / 授权 / 签名 / 下载 / 预览。
- web：`previewKnowledgeFile` 加平台分流——iOS 客户端内调 `openKnowledgeDoc`，其余平台维持现状。
- 文档：`context/bridge.md` 补 `openKnowledgeDoc` 协议。

**本期不做**

- 不新建安卓那样的独立「文件查看页」（已评估：改动面大、回归面广，收益不抵成本）。
- 不做断点续传、暂停/继续、后台下载、下载队列。
- 不改安卓端任何代码（安卓 H5 继续走现有 `multimediaPreview` 路径，行为零变化）。
- 不动 iOS 其余打开文件的入口（行动中心 `ZXActionCenterChildController`、`multimediaDownLoad` 桥、视频播放）——它们经 `openLocalFile:` 的部分会顺带受益，但不专门接线与验证。
- PC 端不涉及。

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 知识来源点击后由谁请求元数据 | iOS 客户端内：原生；其余：web 自己 | web 自己（不变） | 原生（`openKnowledgeDoc`） | 不涉及 |
| 加载期 UI | 不涉及（交给原生） | 独立页 `FileLoadActivity`（不变） | 居中浮层：环形进度 + 百分比 + 取消 | 不涉及 |
| 可取消 | — | 有（暂停/返回） | 有（取消按钮，不续传） | — |

> web 的平台分流条件抽成纯函数（判断是否 iOS 客户端容器），单测覆盖。

## 依赖的接口

均为已有接口，本期不新增、不改契约：

- `aiBasic/agentSetKnowledgeDoc/agentFileDataByDocId`（知识来源元数据；iOS 已在 `ZXAgentKnowledgeOpenLogic` 内调用）
- `zhiwen/v1/share/sharefile`（智文分享码）
- 绿盾解密：`API_CreateDecryptTask` / `API_GetDecryptFileByTaskId`
- OSS 签名：`ZXOSSClient getSignedUrl`

> 若 `context/contracts/` 尚无 `agentFileDataByDocId` 的契约文件，实现阶段按现有字段（`agentFileData.url` / `haveAuth` / `userFileId` / `fromType`、`agentFile.docName`）补一份 `contracts/agent-knowledge/agentFileDataByDocId.d.ts`。

## JSBridge 新增协议

**`openKnowledgeDoc`**（web → 原生，iOS 本期实现，安卓暂不实现）

请求：

| 字段 | 类型 | 说明 |
|------|------|------|
| `docId` | string | 必填，知识文档 ID |
| `agentId` | string | 必填，智能体 ID |
| `agentVersionId` | string \| number | 选填，默认 0 |
| `docName` | string | 选填，文件名（用于缓存目录与标题） |
| `fromType` | number | 选填，来源类型（0/1 本地文件、2 智文、3 飞书、4 公开链接、6 WPS）；原生以接口返回为准，此字段仅兜底 |

响应：

| 场景 | code | msg | result |
|------|------|-----|--------|
| 打开成功 | 0 | — | `{ "status": "success" }` |
| 用户取消 | 0 | — | `{ "status": "cancel" }` |
| 失败 | -1 | 错误提示（原生已 toast） | — |

> 授权（飞书 / WPS）分支在原生内闭环，不回抛给 web。

## 实现要点（平台无关）

- **进度映射**：`0→0.08` 前置阶段假进度（0.5s 一跳，封顶 0.08）；`0.08→1.0` 真实字节进度；加密链路 `0.05→0.65` 轮询假进度后接下载段。进度取 `max(上次, 本次)` 保证单调。
- **取消语义**：取消 = cancel 网络任务 + 清理半成品文件 + 关浮层。不保留任何续传状态。
- **收敛点**：三个入口最终都落到 `ZXFileClient writeToFile:`，所以进度能力加在下载层，入口只负责传 progress / cancel 回调。
- **浮层复用**：绿盾解密链路与普通下载链路共用同一个浮层，观感统一（现有横条会被环形替换）。

## 分支约定

- **web**：从 `release` 切新分支 `feat/knowledge-file-progress`（与 `feat/data-scope-secret-tag` 无关，不叠在它上面）。
- **ios**：从 `release` 切新分支 `feat/ios-file-download-progress`（不叠在 `feat/ios-gfm-markdown` 上）。
- 切分支前先 `git fetch`，基线取远端最新 `release`。

## 待用户确认的问题

- 无（brainstorm 中已全部确认）。若切分支时发现 `release` 不是这两个仓库的正确基线，实现前再确认一次。

## 关键决策

- 2026-08-18：放弃「复刻安卓 FileLoadActivity 独立页」方案——真实痛点是「不知道进度、无法取消」，独立页改动面大且回归面广。
- 2026-08-18：浮层形态 = 环形进度 + 中心百分比 + 取消按钮，替换现有 `ZXFilePreviewLoadHUD` 的横条。
- 2026-08-18：H5 知识来源改走新专用桥 `openKnowledgeDoc`，逻辑单点收在原生，避免 web / 原生各维护一套授权与签名分支。
- 2026-08-18：安卓不实现该桥，web 按平台降级，安卓 H5 行为零变化。
- 2026-08-18：不做断点续传 / 暂停继续（YAGNI）。
- 2026-08-18：web 与 ios 各自从 `release` 切独立新分支。
