# Status：安卓 ActionCard 卡片消息内容被截断

> 最后更新：2026-08-20（T0-T4 已提交并装机；B 已定位、A 真机反馈未折叠）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

行号对应 `plan.md` 的 Task。本期**只做安卓**，其余三端不涉及。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T0 切分支 `fix/actioncard-content-truncate` | — | ✅ | — | — |
| T1 调试页加两条线上真实样本 | — | ✅ `fac432fbf` | — | — |
| T2 B 缺陷真机打点定位 | — | ✅ 已定位（见下） | — | — |
| T3 段栈记录夹高前真高 + 折叠回调 | — | ✅ `1afffa0f9` | — | — |
| T4 provider 四入口接回调（守 cap 复位不变量） | — | ✅ `d2b028f19` | — | — |
| T5 修 B（B-2 + B-3 两处都要修） | — | ⬜ | — | — |
| T5b 修 A 的残留：真机反馈「能看全但不自动收起」 | — | 🚧 待日志 | — | — |
| T6 全入口回归（会话 / 引用 / 合并转发） | — | ⬜ | — | — |
| T7 清临时日志 + 文档收尾 | — | ⬜ | — | — |

> T4 比 plan 多改一处：`referUnitPrimaryExpandOrFold`（展开聚合列表首条源消息）原来只放开 `tv_content`，含表格的源消息展不开。
> T3 比 plan 多一个 `foldApplied` 标志：折叠后测到的高度不是内容全高，不隔离会让下一轮判定翻成「不需折叠」，把刚折起的卡片又展平。

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
| android | **`fix/actioncard-content-truncate`** | 无 upstream | 脏 2 | **本功能** | T0-T4 已提交（tip `d2b028f19`）；脏区是追加的判定日志，未提交，Task 7 要删 |
| ios | `feat/ios-file-download-progress` | ahead 48 | 脏 6 | 不涉及 | markdown 旁路改动，属另一条 feature |
| desktop | `feat/gfm-markdown` | synced | 脏 3 | 不涉及 | `.env.test` / `electron-builder.yml` / `package.json` **禁提交** |

## 定位结论（T2，真机 logcat）

样本 B（报销制度，`useDocList=1`）：

```
preprocess 入参 docId=_agent_file_doc_id_2079906448088322049| 命中 order 的 docId=[同一个] 过滤后 useDocList=1
气泡·无表格路径 ssb 长度=656 尾部=件或咨询财务部。\n\n知识来源\n[1]员工手册2026.pdf 知识来源条数=1
```

→ 文本已在 ssb 里、条数正确，**不是拼接丢失，是没画出来**。排除假设 1（catch 兜底）与假设 2（过滤为空）。
`KnowledgeItemLineHeightSpan` 只收 4px，压不没两行，所以 plan 里的 B-3 原修法也不成立，**真因待续查**（下一轮看展开后 `tv_content` 的行数 / layout 高）。

同批日志抓到**另一个真实缺陷（B-2 实例）**：

```
preprocess 入参 docId=_agent_file_doc_id_2056623120894918872|…（5 个） 命中 order 的 docId=[toutiao_article] 过滤后 useDocList=0
```

正文 `<reference data-ref="toutiao_article">` 与 `agentKnowledgeList` 的 docId 体系对不上，知识来源被过滤光。这条要一并修（命中为空时退回全量展示）。

## 待办 / 阻塞

- (android) **A 未修完**：真机反馈含表格卡片「能看全但不自动收起」，即判定给出 `foldNeeded=false`。已加 `段栈判定 raw=/cap=/子段数=/foldNeeded=` 日志并装机，**等真机日志**。
- (android) **B 真因未定**：文本在 ssb 里但不可见，已加「展开后 tv_content 高度 / 行数 / layout高 / 文本尾部」日志，等同一批真机日志。
- (android) 设备连接不稳，两次 `adb devices` 掉线；`input swipe` 被系统拒（无 `INJECT_EVENTS` 权限），界面操作只能人工做。
- (android) 本仓库无单测，T5 / T6 全靠真机人工过矩阵。

## 关键决策记录

- 2026-08-20 A 选方案 A1（段栈自报真高 + 回调），否掉 A2（换 `OnPreDrawListener`，仍依赖时机）与 A3（按文本长度估算，阈值不准）。
- 2026-08-20 B 不预设修法，先真机打点区分三条假设（catch 兜底 / `useDocList` 为空 / 行高 Span 压没尾行），定位后再改。
- 2026-08-20 范围含引用悬浮单元、引用预览、合并转发详情——同根因不许漏修（用户明确要求）。
- 2026-08-20 不许动：`maxHeightDP = 480`、段栈子 View 禁获焦、`setHeightCap` 当帧硬夹（后两条是上一轮修「翻历史被拽回」的成果）。
