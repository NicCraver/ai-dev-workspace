# Status：安卓 ActionCard 卡片消息内容被截断

> 最后更新：2026-08-20（改为对齐 PC 的单容器 + 只裁不取舍；正式包已出，真机验收未做）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

行号对应 `plan.md` 的 Task。本期**只做安卓**，其余三端不涉及。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T0 切分支 `fix/actioncard-content-truncate` | — | ✅ | — | — |
| T1 调试页加两条线上真实样本 | — | ✅ `fac432fbf` | — | — |
| T2 B 缺陷真机打点定位 | — | ✅ 已定位（见下） | — | — |
| T3 段栈记录夹高前真高 + 折叠回调 | — | ✅ `1afffa0f9` | — | — |
| T4 provider 四入口接回调（守 cap 复位不变量） | — | ✅ `d2b028f19` | — | — |
| T5 ~~按假设分支修 B~~ → **改为对齐 PC 重构** | — | ✅ `65f85f2f7` | — | — |
| T6 全入口回归（会话 / 引用 / 合并转发） | — | ❌ **未做**，等真机 | — | — |
| T7 清临时日志 + 文档收尾 | — | ✅ `grep ZXCardDiag` 归零 | — | — |
| T8 正式包 `zx-android-prod_v3.6.21.apk`（82.4 MB） | — | ✅ | — | — |

> T4 比 plan 多改一处：`referUnitPrimaryExpandOrFold`（展开聚合列表首条源消息）原来只放开 `tv_content`，含表格的源消息展不开。
> T3 的 `foldApplied` 标志在 T5 重构后已删除：折叠不再改子段，测到的高度恒为内容全高。

## 缺陷速查

| 编号 | 现象 | 路径 | 样本 messageUId |
|------|------|------|-----------------|
| A | 高度被夹到 480dp，无「查看更多」 | 段栈（含表格） | `D03K-9J2E-FFC7-TSGJ` |
| B | 展开后知识来源仍不显示 | 单 TextView（无表格） | `D03K-EQ8P-HBSE-SIRP` |

## 各端工作区现状（2026-08-20，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 165 | 脏 21 | 本功能文档 | 打包脚本 / 命令文件长期脏，不进提交；**不 push main** |
| web | `feat/gfm-markdown` | synced | 干净 | 不涉及 | |
| android | **`fix/actioncard-content-truncate`** | 无 upstream | 干净 | **本功能** | tip `65f85f2f7`，**未 push**；临时日志已清空 |
| ios | `feat/ios-file-download-progress` | ahead 48 | 脏 6 | 不涉及 | markdown 旁路改动，属另一条 feature |
| desktop | `feat/gfm-markdown` | synced | 脏 3 | 不涉及 | `.env.test` / `electron-builder.yml` / `package.json` **禁提交** |

## 定位结论（T2，真机 logcat）

样本 B（报销制度，`useDocList=1`）：

```
preprocess 入参 docId=_agent_file_doc_id_2079906448088322049| 命中 order 的 docId=[同一个] 过滤后 useDocList=1
气泡·无表格路径 ssb 长度=656 尾部=件或咨询财务部。\n\n知识来源\n[1]员工手册2026.pdf 知识来源条数=1
```

→ 文本已在 ssb 里、条数正确，**不是拼接丢失，是没画出来**。排除假设 1（catch 兜底）与假设 2（过滤为空）。
`KnowledgeItemLineHeightSpan` 只收 4px，压不没两行，所以 plan 里的 B-3 原修法也不成立。
**真因未单独查明**：T5 直接把这条单 TextView 路径整条删掉（对齐 PC 的单容器），缺陷随之消失。若后续在段栈里又见到同类现象，说明真因还在，需重新定位。

同批日志抓到**另一个真实缺陷（B-2 实例）**：

```
preprocess 入参 docId=_agent_file_doc_id_2056623120894918872|…（5 个） 命中 order 的 docId=[toutiao_article] 过滤后 useDocList=0
```

正文 `<reference data-ref="toutiao_article">` 与 `agentKnowledgeList` 的 docId 体系对不上，知识来源被过滤光。
**结论：不改**——PC 未命中 `refMap` 时同样不展示（`replaceSingleTag` 返回空串），两端行为已一致。

## 方案变更（2026-08-20，用户要求「对齐 PC」）

原 plan 的 A1（段栈自报真高 + 按段取舍折叠）与 B 的三分支修法**作废**，改为照搬 PC 模型：

| | PC | 安卓（改后） |
|---|---|---|
| 容器 | 一个 `.actioncard-info`，markdown + 知识来源同在其中 | 一个段栈，正文段 + 知识来源末段 |
| 折叠 | `overflow:hidden` + `max-height:400px`，**超限一律裁到限高** | 外框 `heightCap` 夹住，子段始终完整测量 |
| 判定 | `scrollHeight > limit` | `rawContentHeight > cap`（onMeasure 记的真高） |
| 知识来源 | 只显示正文命中过的（`showNum`），未命中的 ref 标签直接删掉 | 同（`useDocList` 过滤保持不变） |

副产品：
- **B 从结构上消失**——单 TextView 那条路整条删掉了，知识来源不再拼进正文 SSB。
- **A 的失败模式从结构上消失**——折叠不再改子段，`rawContentHeight` 恒为真值，判定不会翻转。
- `toutiao_article` 那条 docId 对不上的**不改**：PC 的 `replaceSingleTag` 未命中 `refMap` 时返回空串，知识来源同样不展示，两端行为一致。
- 渲染异常兜底改为 `Log.w("ZXCard", ...)` 常驻日志 + 切回纯文本控件（段栈可能已挂半截内容）。

## 待办 / 阻塞

- (android) **真机验收一次都没做**：改成 PC 模型后 A / B 是否真好了，未经验证。至少要过：含表格卡片折叠出按钮 + 展开完整、无表格卡片知识来源可见可点、翻历史不被拽回、气泡长按能弹菜单。
- (android) 折叠态**表格会被裁一半**（PC 就是这个行为），若观感不可接受需回头讨论，不是 bug。
- (android) 设备连接不稳，两次 `adb devices` 掉线；`input swipe` 被系统拒（无 `INJECT_EVENTS` 权限），界面操作只能人工做。
- (android) 本仓库无单测，T6 回归全靠真机人工过矩阵。

## 关键决策记录

- 2026-08-20 A 先选 A1（段栈自报真高 + 回调），后按用户要求**改为对齐 PC**：单容器 + 只裁不取舍，按段取舍逻辑删除。
- 2026-08-20 B 的真因未单独查明，改为随路径删除而消失（见「定位结论」小节的说明）。
- 2026-08-20 折叠态允许把表格裁一半——PC 就是这个行为，换来各卡片折叠态等高。
- 2026-08-20 范围含引用悬浮单元、引用预览、合并转发详情——同根因不许漏修（用户明确要求）。
- 2026-08-20 不许动：`maxHeightDP = 480`、段栈子 View 禁获焦、`setHeightCap` 当帧硬夹（后两条是上一轮修「翻历史被拽回」的成果）。
