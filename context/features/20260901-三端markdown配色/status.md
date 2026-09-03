# Status：三端 markdown 标题上蓝 + 自己发气泡分流

> 最后更新：2026-09-03（**已收尾关闭**：三端改动全部在 origin，用户验收通过）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

2026-09-01 把所有自己发气泡调浅到 `#F0F5FF`。2026-09-02 按验收收窄：

1. markdown 标题 H1–H4 `#3E7EFF` 不动。
2. 普通自己发言退回线上色（PC `#CCE0FE`，安卓 / iOS `#DEE8FF`）。
3. 自己发的 ActionCard（转发 AI 回复、定时用我身份）保留卡体 `#F0F5FF` + 卡头 `#D7E5FF`，并加 `1px #F4F6F8` 描边。卡体阴影三端同一 token：`0 0 4px rgba(31,35,41,.1)`。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 标题色（H1–H4 → `#3E7EFF`） | 基准 | ✅ | ✅ | ✅ |
| 普通自己发退回线上色 | — | ✅ `9a3b6d172` | ✅ `6e964addc` | ✅ `0d00470c` |
| 自己发 ActionCard 浅底 + `#F4F6F8` 描边 | 描边基准 | ✅ 同左 | ✅ 同左 | ✅ 同左 |
| 自己发 ActionCard 卡体阴影 | — | ✅ `bc532ea3d` | ✅ `master-3.5.32` `abd879309` | ✅ `0ed5a52e` |
| 自己发 ActionCard「查看更多」遮罩贴卡体色 | — | ✅ `bc532ea3d` | 未核 | ✅ `-webkit-mask-image` 渐变透明，天然贴底 |
| token 表登记 | ✅ | — | — | — |
| 折叠态正文不可拖动 | — | ✅ `bc532ea3d` | 未核 | 未核 |
| 编译 / lint | — | ✅ `:IM:compileOnTestDebugJavaWithJavac` | — 未单独编译 | ✅ eslint 无输出 |
| 运行时验收 | — | ✅ 用户验收通过 | ✅ 用户验收通过 | ✅ 用户验收通过 |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | synced | 干净（配置信息） | **本功能** | 阴影已 push `0ed5a52e`；`.env.test` 等未提交 |
| android | master-3.6.23 | synced | 干净 | **本功能** | 表格边框 `b9a928e54`、阴影 `bc532ea3d` 均已按用户指定直推 master-3.6.23（未走 MR）|
| ios | master-3.5.32 | synced | 干净 | **本功能** | `abd879309` 已合入功能分支；冲突取新实现并补回高亮 TextView |
| web | feat/data-scope-storage-group | synced | 干净 | 未改 | 只当描边基准 |
| context | main | ahead | 本功能 docs | **本功能** | — |

## 本次改动（2026-09-03 安卓表格边框修补，`b9a928e54` 已 push）

表体改成不透明白底后，外壳画的左/上线被格子盖住，左边框和上边框消失。`ZXMarkdownTableView` 改成外壳只铺白底；每格仍只画右+下（避免叠成 2px），首列补左、首行补上。

## 上一轮改动（2026-09-03 安卓阴影返工 + 折叠遮罩贴卡体色）

真机看到的两个问题：自己发 AI 卡**没有阴影**；「查看更多」遮罩比卡体深，压出一条色带。

| 文件 | 改动 |
|------|------|
| `base_util/.../drawable-xxhdpi/zu_zhi_robot_card_own_send_glow.9.png` | 新增。四周 4dp 均匀光晕的 9 图，`rgba(31,35,41,.1)`、sigma 2dp、圆角 16dp（右上直角，跟卡体一致）。生成脚本 `tools/gen_glow_9patch.py`，`aapt singleCrunch` 校验通过 |
| `base_util/.../drawable/shape_vertical_graduated_trans_to_f0f5ff.xml` | 新增。折叠遮罩渐变末端 `#F0F5FF`，贴自己发卡体 |
| `ZXNoScrollLinkMovementMethod.java` | 新增。只认链接点击、不滚正文的 MovementMethod，修折叠卡正文被拖走 |
| `ZXGlowCardDrawable.java` | 新增。卡体画在 bounds 内、光晕画到 bounds 外 4dp 的自定义 Drawable，按 holder 缓存 |
| `ActionCardMessageItemProvider.java` | 自己发组织卡背景换成 `ZXGlowCardDrawable`，padding / margin 一律 0；`openClipForGlow()` 向上 12 层放开 clipChildren；`setExpandBackground` 自己发组织卡改用新渐变；**删掉** elevation 方案 |

### 顺带修：折叠态卡片正文能被手指拖走（`ZXNoScrollLinkMovementMethod`）

真机发现：折叠的 AI 卡里上下拖，正文整段滑走（标题被滑没），松手不回弹。与阴影无关，是老问题。

根因：`LinkMovementMethod` 继承 `ScrollingMovementMethod`，没命中链接的手势会落到 `Touch.onTouchEvent`
当文字滚动处理；而单 TextView 折叠路径正是 `mTvContent.setMaxHeight(maxHeight)` 把 View 夹短、
正文比 View 高 —— 正好凑齐 TextView 自滚的条件。段栈路径不受影响（每段都是 wrap_content，自身不超高）。

改法：新增 `ZXNoScrollLinkMovementMethod`，只在命中 `ClickableSpan` 时消费按下/抬手，其余 return false
（顺带 `canSelectArbitrarily()=false`）。正文不再自滚，手势交回气泡与消息列表。bind 时补 `setScrollY(0)`
清掉复用 TextView 的历史偏移。知识来源、图片等 ClickableSpan 点击不受影响。

### 第三轮：光晕不占布局，画到 View 外面

第二轮的负 margin 真机没生效（卡体宽度与上一版一模一样，8dp 的窄没找回来），且 layer-list + padding
这条路只要卡宽被头像位卡死，就一定要从卡体里抠 8dp。换思路：**Drawable 不会被自己的 bounds 裁掉**，
只要父级 clipChildren=false，背景就能画到 View 外面。新增 `ZXGlowCardDrawable`：卡体铺满 bounds，
9 图光晕 `setBounds` 四边各外扩 4dp。于是 padding、margin 全部回到 0，卡体宽度与没有阴影时完全一致。

要点：`openClipForGlow()` 向上 12 层 `setClipChildren(false)`（不碰 `clipToPadding`，免得影响列表内边距）。
若真机仍看不见光晕，那就只剩「某层祖先又把 clipChildren 打开」这一个可能，照这条查。

## 再上一轮改动（2026-09-02 阴影移植）

| 端 | 文件 | 改动 |
|---|---|---|
| PC | `chat-box.vue` / `msg-list.vue` / `reply-msg-list.vue` / `winbox-wrapper.vue` | 自己发 ActionCard：`overflow: visible` + 4px margin + `0 0 4px` 阴影；内层 `.msg-actioncard` 再裁圆角。已 push `0ed5a52e` |
| 安卓 | `ActionCardMessageItemProvider.java` | 自己发组织会话卡：4dp margin + 4dp elevation；API 28+ 关掉 spot、ambient 用 `rgba(31,35,41,.1)`；向上放开 clip。仍未 commit |
| iOS | `ZXIMCellLogic.m` / `ZXGroupRobotCell.m` / `ZXIMChatCell.m` | 已随 `feat/ios-agent-date-range` 合入 `master-3.5.32`（`abd879309`） |
| context | impl-notes / status | 阴影从「仅 PC」改为三端同一 token |

## 待办 / 阻塞

2026-09-03 收尾：三端真机 / 热更新验收通过，功能从 ACTIVE 移除。落地位置：安卓 `bc532ea3d` + 表格边框
`b9a928e54`（按用户指定直推 `master-3.6.23`，未走 MR）；iOS `abd879309` 已在 `master-3.5.32`；PC `0ed5a52e`
在 `master-3.4.27`。均已确认在 origin。

遗留（不阻塞收尾，下次改到再定）：

- (android) 卡头仍是 `shape_solid_c5d8ff_lefttop_radius_16dp`（#C5D8FF），本功能规则写的是 #D7E5FF。验收未提异议，按现状 #C5D8FF 上线；哪个为准仍未正式敲定
- (ios/desktop) 「查看更多」遮罩贴卡体色、折叠态正文不可拖动两项 iOS / PC 未单独核过（PC 走 mask 渐变天然无此问题）
- PC 勿提交 `.env.test` / `electron-builder.yml` / `package.json`（本地仍脏，未进本次提交）

## 关键决策记录

- 2026-09-02 iOS 合入 `master-3.5.32`：冲突四处（ContentView 上间距、Style 表体白底、CellLogic 折叠）取功能分支；段栈 TextView 补回 `zx_makeMarkdownTextView`，否则丢掉 3.5.32 已有的高亮居中
- 2026-09-02 三端阴影对齐 PC：`0 0 4px rgba(31,35,41,.1)`，不要 Material / UIKit 那种向下投影
- 2026-09-02 阴影贴边看不见：外壳不能裁切；四边留约 4px，圆角裁切下放到内层。上阴影原先只有左右留空，紧贴时间条会被盖住
- 2026-09-02 **ActionCard 折叠**：不要求智能体账号或知识来源。别人转发的 AI 卡（发送人是普通账号、知识来源为空）同样超限就要折，对齐安卓所有 ActionCard。微信绿气泡除外。
- 2026-09-02 分流 = **自己发 + ActionCard**，不用 `fixTaskMessage`（转发会抹掉）
- 2026-09-01 标题只染 H1–H4（仍有效）
- 2026-09-01 PC 自己发气泡色有两层：`chat-box.vue` 的 `!important` 才是真生效（仍有效）
- 2026-09-01 安卓不改 `color_DEE8FF` 资源，只改那张历史命名 drawable 的 solid（仍有效；浅底改走新 drawable）
- 2026-09-03 安卓阴影改 9 图：`setOutlineAmbientShadowColor` 的 alpha 是**乘**在系统 ambient 强度上的，给 10% 等于给 0.4%，看不见。要 PC 那种 `0 0 4px` 均匀 halo 就别用 elevation，画进 9 图
- 2026-09-03 安卓折叠遮罩要分两张：普通自己发文本贴 `#DEE8FF`（9 图），自己发 ActionCard 贴卡体 `#F0F5FF`（新 xml 渐变）。PC 用 `-webkit-mask-image` 走透明，天然不吃这个坑
- 2026-09-02 自己发「查看更多」蒙层：PC 渐变已跟回 `#CCE0FE`；安卓真正露出来的是 9-patch `zu_zhi_robot_card_more_own_send`，气泡退回线上后必须把 9-patch 也退回，不能只改 xml 渐变。收到消息仍用白色那张。
