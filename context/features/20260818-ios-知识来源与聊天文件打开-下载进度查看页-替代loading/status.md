# Status：iOS 打开文件的下载进度与取消

> 最后更新：2026-08-18（T1–T8 代码完成；iOS 未编译、未真机自测，web 单测 6/6 + `vue-tsc` 0）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

行号对应 `plan.md` 的 Task。安卓本期零改动；PC 不涉及。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T0 切分支 | ✅ | — | ✅ | — |
| T1 浮层改环形进度 + 取消 | — | — | ✅ | — |
| T2 下载层暴露进度 / 取消句柄 | — | — | ✅ | — |
| T3 加载会话（假进度 + 阶段映射 + 取消聚合） | — | — | ✅ | — |
| T4 知识来源入口接线 | — | — | ✅ | — |
| T5 聊天文件 / H5 文件 / 解密链路接线 | — | — | ✅ | — |
| T6 新桥 `openKnowledgeDoc` | — | — | ✅ | — |
| T7 平台分流 + 单测 | ✅ | — | — | — |
| T8 文档（bridge.md / impl-notes / status） | ✅ | — | ✅ | — |
| 真机自测 | 🚧 | 🚧 | 🚧 | — |

> ✅ = 代码完成并提交。**iOS 一次都没编译**（本仓库规定 AI 不跑 xcodebuild），编译错误风险由人工首次 build 兜底。

## 各端工作区现状（2026-08-18，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 137 | 脏 17 | 文档已提交 | 打包脚本改动与上个功能残留未提交；**不 push main** |
| web | **`feat/knowledge-file-progress`** | ahead 1（基线 `origin/release`） | 干净 | **本功能** | `a9e78ae`；未 push |
| android | `feat/gfm-markdown` | synced | 脏 1 | **不涉及** | 上个功能（markdown 表格遮罩）残留 |
| ios | **`feat/ios-file-download-progress`** | ahead 7（基线 `origin/release`） | 干净 | **本功能** | `6a9ac02ae`；未 push、未编译 |
| desktop | `feat/gfm-markdown` | synced | 脏 3（禁提交） | **不涉及** | `.env.test` 等勿 stage |

## 待办 / 阻塞

**进行中**：已开两个子代理并行审查代码（iOS `feat/ios-file-download-progress` 7 commit；web `feat/knowledge-file-progress` 1 commit）。审查结论未回，两个分支暂不 push。iOS 关注编译错误 / block 循环引用 / 线程 / 回调漏洞 / 老调用点回归；web 关注安卓与 PC 老路径回归、`agentId` 来源、老版本客户端无该桥时的降级。

**iOS 首次编译（必须先做）**：7 个提交全部没经过编译器。在 Xcode 打开 `zhixinApp.xcworkspace`，选 `zhixinAppTest` + iPhone 15(iOS 17) 模拟器 clean build。重点看 `ZXFilePreviewLoadHUD`（新增 `ZXFileLoadingSession` 同文件双类）、`ZXFileClient`（新增 `ZXFileDownloadTask`、方法返回值由 void 改为对象）、`ZXAgentKnowledgeOpenLogic`（私有方法签名都加了 `session:` / `report:`）。

**iOS 真机 / 模拟器自测清单**：

- (ios) 知识来源大文件（>50MB）：百分比连续爬升、与实际吻合、不回退
- (ios) 下载中点「取消」：立即关浮层、不弹预览、再次点击能重新下载
- (ios) 聊天文件消息：普通文件 / 加密文件 / 微应用分享文件各开一次
- (ios) 绿盾加密文件：5%→65% 轮询后接下载段；**观察二段浮层**（65% 段结束关浮层后是否又起一个从 2% 开始的新浮层，刺眼则改成同一会话贯穿，见 impl-notes）
- (ios) 图片类知识来源：仍走图片浏览器，浮层正常消失
- (ios) 飞书 / WPS 未授权：浮层关闭后弹授权页
- (ios) 本地已缓存文件：**不应**出现浮层，秒开
- (ios) H5 内点知识来源（移动端 AI 会话页）：走新桥 `openKnowledgeDoc`、有进度、可取消
- (ios) 弱网 / 断网：失败 toast 文案正确，浮层不残留

**web 自测**：

- (web) 安卓客户端内点 H5 知识来源：行为与改动前**完全一致**（回归，未走新桥）
- (web) PC 浏览器 / 桌面端点知识来源：行为不变

**其它**：

- (android / desktop) 工作区脏区属上一个功能（markdown 表格遮罩），其 T4 / T7 / T10 真机自测仍欠；勿与本功能混提交
- (desktop) `.env.test` / `electron-builder.yml` / `package.json` 保持脏、勿 stage
- 两个分支均**未 push**，自测通过后再推

## 关键决策记录

- 2026-08-18：放弃复刻安卓 `FileLoadActivity` 独立页——真实痛点是「看不到进度、无法取消」，独立页改动面与回归面不划算
- 2026-08-18：浮层 = 环形进度 + 中心百分比 + 取消，替换 `ZXFilePreviewLoadHUD` 原横条；绿盾解密链路共用同一套
- 2026-08-18：进度映射 0→8% 前置假进度（0.5s 步进）、8%→100% 真实字节；加密链路 5%→65% 轮询后下载段起点改 65%；展示层取 max 保证单调
- 2026-08-18：取消 = 中止下载任务 + 删半成品 + 关浮层 + 丢弃在途回调，不做断点续传 / 暂停继续
- 2026-08-18：三入口收敛于 `ZXFileClient writeToFile:`，进度能力加在下载层；旧 `writeToFile:completion:` 转调新方法，老调用点零改动
- 2026-08-18：`ZXFileLoadingSession` 写进 `ZXFilePreviewLoadHUD.h/.m`（同文件双类），**不新建文件**以避开 `project.pbxproj` 排序噪声
- 2026-08-18：H5 知识来源改走新桥 `openKnowledgeDoc`，原生全包元数据 / 授权 / 签名 / 下载 / 预览
- 2026-08-18：桥结束状态三态 success / cancel / fail，幂等只回一次；**飞书 / WPS 未授权回 cancel**（原生已接管授权）
- 2026-08-18：安卓不实现该桥，web 按 UA（`MTCoreApi` + iPhone/iPad/iPod）降级，安卓 H5 行为零变化
- 2026-08-18：web 仓库无本地 prettier 且无配置，`npx prettier@3` 默认 `trailingComma: all` 会制造整文件噪声——格式化新文件须加 `--trailing-comma none` 对齐既有风格
- 2026-08-18：web 与 ios 各自从 `release` 切独立新分支，不叠在现有功能分支上
