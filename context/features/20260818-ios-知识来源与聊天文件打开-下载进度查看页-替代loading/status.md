# Status：iOS 打开文件的下载进度与取消

> 最后更新：2026-08-19（修 iOS 编译：审查删掉 `destinationPath` 后赋值残留；仍未真机自测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| T5b 聊天文件真正的下载点（`ZXRCIMChatLogic`）补接线 | — | — | ✅ | — |
| T5c 下载与解密合并为一个浮层（进度接续） | — | — | ✅ | — |
| T6 新桥 `openKnowledgeDoc` | — | — | ✅ | — |
| T7 平台分流 + 单测 | ✅ | — | — | — |
| T8 文档（bridge.md / impl-notes / status） | ✅ | — | ✅ | — |
| 真机自测 | 🚧 | 🚧 | 🚧 | — |

> ✅ = 代码完成并提交。iOS 首次编译已暴露一处残留赋值（见待办），其余仍待 clean build；真机自测未做。

## 各端工作区现状（2026-08-19，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 141 | 脏 15 | 文档待补本条 | 打包脚本改动与上个功能残留未提交；**不 push main** |
| web | **`feat/knowledge-file-progress`** | ahead 2（基线 `origin/release`） | 干净 | **本功能** | `8bd8db7`；单测 7/7；未 push |
| android | `feat/gfm-markdown` | synced | 脏 1 | **不涉及** | 上个功能（markdown 表格遮罩）残留 |
| ios | **`feat/ios-file-download-progress`** | ahead 8（基线 `origin/release`） | 脏 1 | **本功能** | 修 `ZXFileClient.m` 残留 `destinationPath` 赋值；未 push |
| desktop | `feat/gfm-markdown` | synced | 脏 3（禁提交） | **不涉及** | `.env.test` 等勿 stage |

## 代码审查（2026-08-18，两个子代理并行）

web 8 条（2🔴 5🟡 1❓）、iOS 22 条（4🔴 15🟡 3❓）。已核实并修复的要点：

| 严重度 | 问题 | 处理 |
|--------|------|------|
| 🔴 ios | **取消后 handler 一次都不回调** → 上游 HUD 永久残留 + web promise 永久 pending（3 处：解密链路、`openLocalFile` 两个下载分支） | 定义 `ZXMediaPreviewCancelledCode`，取消时回一次 handler；各出口包 `handleOnce` 幂等（`c12fe5b6e`） |
| 🔴 web | **`agentId` 恒为空** —— `knowledgeList` 的 item 没有 agentId（在 `Assistant.agentId` 上），原生必报错 | 分流时补 `agentId` / `agentVersionId`（`8bd8db7`） |
| 🔴 web | 老版本 iOS 客户端没注册该桥 → 点了完全没反应 | 分流条件加 `typeof === "function"`，否则回落 web 逻辑 |
| 🟡 ios | `cancel` 删的是**最终缓存路径**，会毁掉上次下好的完整文件 | 去掉删除（系统下载完成才 move，无半成品可删） |
| 🟡 ios | 浮层是全局单例，两个会话并发时互相覆盖取消回调 / 互关浮层 / 串写进度 | 浮层加弱引用 `owner`，`update`/`finish`/`dismiss` 按归属隔离 |
| 🟡 ios | 取消句柄装在下载发起之后，中间点取消不会中止下载 | `onCancel` setter 补发 + 拿到句柄后复查 `isCancelled` |
| 🟡 ios | 无 `Content-Length` 时进度恒 0，卡在 8% | 下载层回 -1 通知不确定态，假进度上限放宽到 90% |
| 🟡 ios | `cancelled`/`finished`/下载句柄跨线程无同步；`report` 判重无锁 | 改 `atomic` + `@synchronized` |
| 🟡 ios | 新公开 API 标 `completion` 可空却裸调 | 全部改 `!completion ?:`（16 处） |
| 🟡 ios | 下载浮层与上游「加载中…」小圈叠着显示 | 进下载前补 `[ZXProgressHUD dismiss]` |
| 🟡 web | 失败只 `console.warn`、iframe 路径被误伤、UA 判定重复、未知状态当成功 | 分别补 toast、`!inIframe`、判定单点化、状态严格化 |
| 🟡 web | 分流点太深（web 已发过元数据请求、授权走了 web 弹窗） | 分流上移到 `AcMarkdown.vue` 取元数据之前 |

**未改（有意为之，自测时留意）**：

- (ios) `finishWithCompletion` 先关浮层再弹预览，`openZXPreview` 慢时有短暂空窗——原实现是预览呈现后才关，观感待真机判断
- (ios) 飞书 / WPS 授权分支回 `cancel` 后没有第二次通知，web 不知道可以重试；授权本身在原生内闭环，重试靠用户再点一次
- (ios) `fileNoAuth` 打开的是「无权限」提示页却回 `success`（页面确实打开了）
- (web) `KnowledgeListTable.vue`（PC 设置页）不传 `isWnsdkEnable`，本期不覆盖

## 待办 / 阻塞

**iOS 首次编译（必须先做）**：审查修取消逻辑时去掉了 `ZXFileDownloadTask.destinationPath`（取消不再删目标缓存），但 `writeToFile:` 里 `cancelToken.destinationPath = filePath` 没一起删，首次 build 报 `Property 'destinationPath' not found`。2026-08-19 已删该赋值。其余 8 个提交仍未过编译器。在 Xcode 打开 `zhixinApp.xcworkspace`，选 `zhixinAppTest` + iPhone 15(iOS 17) 模拟器 clean build。重点看 `ZXFilePreviewLoadHUD`（新增 `ZXFileLoadingSession` 同文件双类）、`ZXFileClient`（新增 `ZXFileDownloadTask`）、`ZXAgentKnowledgeOpenLogic`（私有方法签名都加了 `session:` / `report:`）。

**iOS 真机 / 模拟器自测清单**：

- (ios) 知识来源大文件（>50MB）：百分比连续爬升、与实际吻合、不回退
- (ios) 下载中点「取消」：立即关浮层、不弹预览、再次点击能重新下载
- (ios) 聊天文件消息：普通文件 / 加密文件 / 微应用分享文件各开一次
- (ios) 绿盾加密文件：5%→65% 轮询后接下载段；**观察二段浮层**（65% 段结束关浮层后是否又起一个从 2% 开始的新浮层，刺眼则改成同一会话贯穿，见 impl-notes）
- (ios) 图片类知识来源：仍走图片浏览器，浮层正常消失
- (ios) 飞书 / WPS 未授权：浮层关闭后弹授权页
- (ios) 本地已缓存文件：**不应**出现浮层，秒开
- (ios) H5 内点知识来源（移动端 AI 会话页）：走新桥 `openKnowledgeDoc`、有进度、可取消；**注意 iOS 上飞书/WPS 授权已改由原生弹**（不再走 web 弹窗），要专门验一遍
- (ios) 取消后确认：上游没有残留的「加载中…」小圈，且 web 侧不会卡住（H5 入口）
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
- 2026-08-18：进度能力加在下载层（`ZXFileClient writeToFile:progress:`），旧 `writeToFile:completion:` 转调新方法，老调用点零改动
- 2026-08-19：**修正前一条的误判**——聊天文件不经过 `openLocalFile`，`ZXRCIMChatLogic previewFileByModel:` 自己做 readFile→签名→下载，只把本地路径交给预览器，所以第一版聊天文件毫无进度效果。已在该方法内接会话；加密文件另给 `ZXEncryptLogic downloadTmpFile:progress:` 重载
- 2026-08-19：聊天文件取消回 `handler(nil)`（不是取消错误码），这样 6 个调用点零改动、也不会弹错误 toast；知识来源侧仍用 `ZXMediaPreviewCancelledCode` 区分，因为要回传给 web
- 2026-08-18：`ZXFileLoadingSession` 写进 `ZXFilePreviewLoadHUD.h/.m`（同文件双类），**不新建文件**以避开 `project.pbxproj` 排序噪声
- 2026-08-18：H5 知识来源改走新桥 `openKnowledgeDoc`，原生全包元数据 / 授权 / 签名 / 下载 / 预览
- 2026-08-18：桥结束状态三态 success / cancel / fail，幂等只回一次；**飞书 / WPS 未授权回 cancel**（原生已接管授权）
- 2026-08-18：安卓不实现该桥，web 按 UA（`MTCoreApi` + iPhone/iPad/iPod）降级，安卓 H5 行为零变化
- 2026-08-18：web 仓库无本地 prettier 且无配置，`npx prettier@3` 默认 `trailingComma: all` 会制造整文件噪声——格式化新文件须加 `--trailing-comma none` 对齐既有风格
- 2026-08-18：web 与 ios 各自从 `release` 切独立新分支，不叠在现有功能分支上
- 2026-08-19：审查去掉 `destinationPath` 后赋值没删干净，首次编译报 `Property 'destinationPath' not found`；已删该行，取消仍只中止 sessionTask、不碰目标缓存
