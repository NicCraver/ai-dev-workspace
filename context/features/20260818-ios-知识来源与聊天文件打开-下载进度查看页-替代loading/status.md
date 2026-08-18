# Status：iOS 打开文件的下载进度与取消

> 最后更新：2026-08-18（brainstorm 完成，spec 已提交 `fb6a941`；尚无任何端的代码改动）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

plan.md 尚未产出，下表按 spec 的工作项预置，出 plan 后按 Task 重排。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec 定稿 | ✅ | — | ✅ | — |
| plan 产出 | ⬜ | — | ⬜ | — |
| 浮层升级（环形进度 + 取消） | — | — | ⬜ | — |
| 下载层暴露进度 / 取消（`ZXFileClient`） | — | — | ⬜ | — |
| 三入口接线（知识来源 / 聊天文件 / H5） | — | — | ⬜ | — |
| 新桥 `openKnowledgeDoc`（`ZXJSAIChatAPI`） | — | — | ⬜ | — |
| web 平台分流 + 单测 | ⬜ | — | — | — |
| `bridge.md` 补协议 | ⬜ | — | ⬜ | — |
| 真机自测 | ⬜ | — | ⬜ | — |

> 安卓本期零改动（H5 继续走 `multimediaPreview`）；PC 不涉及。

## 各端工作区现状（2026-08-18，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 135 | 脏 15（scripts / 命令 / 上个功能 status） | 本功能 spec 已提交 | 打包脚本输出对齐未提交；**不 push main** |
| web | `feat/data-scope-secret-tag` | synced | 干净 | **待切新分支** | 本功能要从 `release` 切 `feat/knowledge-file-progress` |
| android | `feat/gfm-markdown` | synced | 脏 1（`ZXMarkdownTableView.java`） | **不涉及** | 属上一个功能「markdown 表格遮罩」，未 commit |
| ios | `feat/ios-gfm-markdown` | synced | 干净 | **待切新分支** | 本功能要从 `release` 切 `feat/ios-file-download-progress` |
| desktop | `feat/gfm-markdown` | synced | 脏 3（`.env.test` 等） | **不涉及** | 本地调试三文件，禁止 stage |

## 待办 / 阻塞

- (context) 等用户 review spec，通过后进 writing-plans 出 `plan.md`
- (ios) 从远端最新 `release` 切 `feat/ios-file-download-progress` 后再动代码；基线若不是 `release` 需先确认
- (web) 从远端最新 `release` 切 `feat/knowledge-file-progress`
- (android / desktop) 工作区脏区属**上一个功能**（markdown 表格遮罩），其 T4 / T7 / T10 真机自测仍欠；别跟本功能混提交
- (desktop) `.env.test` / `electron-builder.yml` / `package.json` 保持脏、勿 stage

## 关键决策记录

- 2026-08-18：放弃复刻安卓 `FileLoadActivity` 独立页——真实痛点是「看不到进度、无法取消」，独立页改动面与回归面不划算
- 2026-08-18：浮层 = 环形进度 + 中心百分比 + 取消，替换现有 `ZXFilePreviewLoadHUD` 横条；绿盾解密链路共用
- 2026-08-18：进度映射 0→8% 前置假进度、8%→100% 真实字节；加密链路 5%→65% 轮询后接下载段；单调不回退
- 2026-08-18：取消 = 中止网络任务 + 删半成品 + 关浮层，不做断点续传 / 暂停继续
- 2026-08-18：三入口收敛于 `ZXFileClient writeToFile:`，进度能力加在下载层
- 2026-08-18：H5 知识来源改走新专用桥 `openKnowledgeDoc`，原生全包元数据 / 授权 / 签名 / 下载
- 2026-08-18：安卓不实现该桥，web 按平台降级，安卓 H5 行为零变化
- 2026-08-18：web 与 ios 各自从 `release` 切独立新分支，不叠在现有功能分支上
