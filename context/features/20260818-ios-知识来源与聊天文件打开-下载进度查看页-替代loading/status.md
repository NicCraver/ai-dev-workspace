# Status：iOS 打开文件的下载进度与取消

> 最后更新：2026-08-19（iOS 已人工编译 + 真机自测七轮，反馈全部闭环）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| T5d 浮层与预览同帧收尾（去空窗） | — | — | ✅ | — |
| T5e 缓存命中秒开 + 跳过解密判定 + 延迟展示 | — | — | ✅ | — |
| T6 新桥 `openKnowledgeDoc` | — | — | ✅ | — |
| T7 平台分流 + 单测 | ✅ | — | — | — |
| T8 文档（bridge.md / impl-notes / status） | ✅ | — | ✅ | — |
| 真机自测 | ⬜ | — | 🚧 | — |

> ✅ = 代码完成并提交。iOS 已由人工 clean build 通过并真机自测四轮，反馈见下方「自测反馈闭环」。

## 各端工作区现状（2026-08-19，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 147 | 脏 15 | 文档已提交 | 打包脚本改动与上个功能残留未提交；**不 push main** |
| web | **`feat/knowledge-file-progress`** | ahead 2（基线 `origin/release`） | 干净 | **本功能** | `8bd8db7`；单测 7/7；未 push |
| android | `feat/gfm-markdown` | synced | 脏 1 | **不涉及** | 上个功能（markdown 表格遮罩）残留 |
| ios | **`feat/ios-file-download-progress`** | ahead 16（基线 `origin/release`） | 干净 | **本功能** | `97aa052b2`；已 clean build + 真机自测多轮；未 push |
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

## 自测反馈闭环（2026-08-19，四轮）

| 反馈 | 原因 | 处理 |
|------|------|------|
| 首次 build 报 `Property 'destinationPath' not found` | 审查修取消逻辑时删了该属性，`writeToFile:` 里的赋值没一起删 | 删掉残留赋值（`45f1270` 记录） |
| 聊天中的文件没有进度效果 | 聊天不走 `openLocalFile`；`ZXRCIMChatLogic previewFileByModel:` 自己 readFile→签名→下载，只把本地路径交给预览器 | 在该方法内接会话；加密文件给 `ZXEncryptLogic` 加 `downloadTmpFile:progress:` 重载（`2d1388ba9`） |
| 解密会再转一次圈 | 下载段 finish 关掉浮层后，解密段又新建会话 | 会话可跨阶段复用 `startOrReuseWithTitle:`，只换文案不重置进度（`f699628ee`） |
| 92% 之后直接就打开了 | 终点是「预览弹出时直接关浮层」，100% 没机会出现 | 呈现前先 `finishWithCompletion` 补满；阶段余量 0.9→0.97（`7aa6ac6af`） |
| 100% 后浮层先消失、才打开，中间有空窗 | `finish` 收尾顺序是先 dismiss（0.15s 淡出）再 present | 改同帧：先发起呈现、紧接着淡出，预览从下往上盖住浮层（`342981d32`） |
| 别等 0.25s | 补满 100% 后 `dispatch_after` 卡了一拍才呈现 | 去掉等待，补满动画与呈现动画并行（`4b18cdc52`） |
| 下载过的文件再点开仍有「加载中...」，有时卡住 | ① 调用点一进来就弹普通 HUD，缓存命中也照弹；② `self.controller` 为空仍去 present，handler 永不回调 → HUD 永久残留；③ 绿盾企业里本地已有的普通文件每次仍联网跑解密判定（结果只缓存 24h） | 入口不再弹普通 HUD；`multiMediaPreviewFile` 统一收 HUD + 控制器缺失立即回错；**非加密消息 + 缓存命中跳过解密判定**（`10111d628`、`7bcc9abb6`） |
| 点击完「加载中...」秒关，要延迟 | 快路径（缓存命中、小文件）浮层弹一下就关，闪 | 浮层**延迟 300ms 展示**，期间只记账；未展示过则 finish/dismiss 都不弹（`97aa052b2`） |

**未改（有意为之，自测时留意）**：

- (ios) 飞书 / WPS 授权分支回 `cancel` 后没有第二次通知，web 不知道可以重试；授权本身在原生内闭环，重试靠用户再点一次
- (ios) `fileNoAuth` 打开的是「无权限」提示页却回 `success`（页面确实打开了）
- (web) `KnowledgeListTable.vue`（PC 设置页）不传 `isWnsdkEnable`，本期不覆盖

## 待办 / 阻塞

**下一轮自测重点**：

- (ios) **绿盾企业内的普通文件消息**：跳过解密判定后能否正常打开（这是本次唯一有业务风险的改动，见决策记录）
- (ios) 300ms 延迟展示后：缓存命中应全程无提示；稍慢的应带着 5~10% 直接出现，不从 0 开始
- (ios) 浮层出现前点返回 / 切页，会不会出现「浮层晚到、盖在别的页面上」

**iOS 真机 / 模拟器自测清单（回归用）**：

- (ios) 知识来源大文件（>50MB）：百分比连续爬升、与实际吻合、不回退
- (ios) 下载中点「取消」：立即关浮层、不弹预览、再次点击能重新下载
- (ios) 聊天文件消息：普通文件 / 加密文件 / 微应用分享文件各开一次
- (ios) 绿盾加密文件：下载段走到 ~97% 后切「文件解密中...」继续到 99%，**全程只有一个浮层**
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
- 2026-08-19：进度改为**阶段区间模型**（取代 8/65 那套硬编码）：显示值 = `bandStart + p×(1-bandStart)×0.97`，`bandStart` 为进入本阶段时的已显示值；前置假进度 0→8%，下载真实字节到 ~97%，解密轮询 97→99%，呈现预览前补 100%
- 2026-08-19：浮层跨阶段复用（`startOrReuseWithTitle:`），全程只有一个；收尾与预览呈现同帧、且不再等待，避免空窗与多等一拍
- 2026-08-19：浮层**延迟 300ms 展示**（`ZXFileLoadingSessionShowDelay`），期间只在会话内记账；快路径全程不弹，避免一闪而过
- 2026-08-19：**非加密文件消息 + 本地缓存命中 → 跳过绿盾解密判定**（`params.notDecrypt = YES`）。原因：判定结果只缓存 24h，过期后重开本地已有的文件仍要联网往返，慢网下像卡死。**风险**：若绿盾企业内普通文件消息也需服务端解密，这条会漏解密——用户已确认采用，自测须专门验
- 2026-08-19：聊天入口不再弹无进度的普通 HUD，由 `previewFileByModel` 决定「无提示秒开」还是「起带进度浮层」
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
