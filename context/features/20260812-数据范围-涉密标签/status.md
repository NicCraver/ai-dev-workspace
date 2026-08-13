# Status：数据范围-涉密标签

> 最后更新：2026-08-13 18:15（四端 getSecretButtonTip 接入代码均在脏区未提交；android 气泡落位/收窄 20% 同步未提交）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| Tag 接入（全部/群组/搜索/组织架构/已选） | ✅ | ✅ | ✅ | ✅ |
| 涉密说明入口+气泡（标题栏，非底栏） | ✅ | ✅ | ✅ | ✅ |
| 气泡文案改走 getSecretButtonTip | 🚧 | 🚧 | 🚧 | 🚧 |
| 自测通过 | 🚧 | 🚧 | 🚧 | 🚧 |

> 本功能代码侧：web 在 `feat/data-scope-secret-tag`（`origin` synced，HEAD `f99ec77` 加载态；`getSecretButtonTip` **未提交**）。android/ios/desktop 在 `personal-ai-chat-hotfix`（均 synced；涉密 tag/顶栏/已选等已 push，本轮 `getSecretButtonTip` + android 气泡落位/收窄 **均未提交**）。各端旁路脏区（android 相机资源、ios/desktop combine、desktop 本地包配置）勿当本功能提交。

## 视觉验收发现的问题（2026-08-12，均已修复，待用户统一复验）

- (ios) 底部「涉密」按钮应在「已选」右侧紧挨着，原来放在左侧最前 —— **已修**（commit `9afc47fb6`，交换约束顺序，同步修了 `clearButton` 最小间距基准；气泡固定文案逐字核对无误）
- (desktop) ①列表行 tag 被布局挤到行最右边缘，应紧挨姓名/群名右侧 —— **已修**（commit `b81d002d`，根因 `.pa-ds-name`/`.pa-ds-search-name` 用了 `flex: 1` 撑满剩余空间把 tag 推到行尾，改成 `flex: 0 1 auto`；5 处落点逐一排查，全部/群组/搜索行有此 bug 已修，组织架构行/已选 chip 本来就没问题未改）；②底部涉密/已选按钮顺序反了 —— **已修**（commit `77cd791a`，交换两个 `el-popover` 模板顺序，改成已选左、涉密右）
- (web) 涉密说明气泡应深色主题 + 居中弹出 + 文字居中 —— **已修**（commit `268f2bb`，`placement="top"` + `effect="dark"` + 文字 `text-center`）；气泡贴左边缘——先后试了 `preventOverflow`（无效，根因见下）、`offset` skid 32/12，**最终由用户本人手动定稿**（commit `517ae05`：offset skid `[12,12]`，去掉外层负边距，文案加 `-m-1`）
- (android) 复查同款问题：①底部按钮顺序——确实同样反了，**已修**（commit `02ac567a6`，交换 `include_data_range_multi_footer.xml` 里两个 LinearLayout 顺序，`id` 不变，Helper 绑定不受影响）；②列表 tag 贴边——排查后**结构上不存在**该问题（`item_friend_content.xml` 姓名 `layout_weight=1` 是被 4 处其他选择器复用的既有写法，tag 紧跟姓名无额外撑开/靠右对齐，跟 desktop 的反面案例不是一回事，未改动，需你实测确认姓名很短时是否有可感知间隙）；`assembleDevelopDebug` 已重新跑过 BUILD SUCCESSFUL
- （全端追加）用户要求「都按 web 端来」，气泡统一深色 + 文字居中，主线程直接改（未用子agent）：
  - (desktop) 原来 `placement="top-start"` + 浅色文字，改 `placement="top"` + `effect="dark"` + `.pa-secret-info-content{text-align:center}` + `.pa-secret-info-popover{margin-left:12px}` —— **已修**（commit `04239dbe`，eslint 过）
  - (ios) 背景本来就是深色 `Color_HEX(@"1F2329")`，只是文字没居中 —— **已修**（commit `6ac9858bb`，`textLabel.textAlignment = NSTextAlignmentCenter`；大括号/圆括号计数校验通过，未跑 xcodebuild）
  - (android) 原来是白底黑字箭头气泡（`popup_bg_jiantou_bottom_right` 9-patch，采样确认背景 `#FFFFFF`），换成深色圆角 shape `bg_data_range_secret_tip.xml`（`#1F2329` + 6dp 圆角，无箭头）+ 文字白色居中 —— **已修**（commit `fd1655ba6`，`assembleDevelopDebug` BUILD SUCCESSFUL）
  - (desktop) 深色其实没生效——Element UI（Vue2）的 `el-popover` **没有** tooltip 那种 `effect="dark"` 属性，`.el-popover` 基础样式写死白底，之前设的 `effect="dark"` 是个无效属性；改用自定义 class 硬覆盖背景/边框/箭头颜色（`!important`）—— **已修**（commit `ce75f76a`，eslint 过）
- (android) 用户反馈底栏太挤 + 气泡定位不准，改方案：涉密入口从底栏挪到顶部标题栏右侧（5 个落点各自的标题栏：`activity_select_data_range`/`_contact`/`_group`/`_org_drill` 用 FrameLayout 顶栏，`_search` 无独立顶栏、加在搜索框右侧）—— **已改**（commit `faab41320`，`assembleDevelopDebug` BUILD SUCCESSFUL）：
  - 新建共享 `include_data_range_secret_entry.xml`，5 个 activity 顶部各 `<include>` 一份；`DataRangeMultiFooterHelper` 从底栏 `bind()` 里摘掉涉密入口逻辑，新增公开方法 `bindSecretEntry(View)` 供顶栏调用
  - 顺带修了「位置不准」两个真根因：①原代码 `content.measure(UNSPECIFIED, UNSPECIFIED)` 量出来的是文字不换行的单行高度，跟气泡容器 220dp 定宽下多行换行的真实高度对不上；改成按 220dp `EXACTLY` 量；②原代码按「贴底栏」逻辑用负 yoff 把气泡往上顶，入口挪到顶栏后这套算法会把气泡顶到状态栏外面去——改成 `showAsDropDown` 默认方向（挂件正下方）+ 小正 yoff；顺带按钮靠屏幕右侧、气泡 220dp 比按钮宽，加了 `xOff = 按钮宽 - 气泡宽` 让气泡右边缘对齐按钮右边缘，避免探出屏幕右侧
- (android) 用户反馈气泡太宽、没箭头、右边贴死屏幕边缘 —— **已修**（commit `d78c3d4d5`，`assembleDevelopDebug` BUILD SUCCESSFUL）：①宽度 220dp → 180dp；②新建 `ic_data_range_secret_tip_arrow.xml`（12×6dp 向上三角，`#1F2329` 与气泡同色），布局改成「箭头 + 深色气泡体」两层，箭头水平位置在 `adjustSecretTipArrow()` 里按顶栏按钮内容中心运行时算 `marginEnd`（考虑 include 布局左右 12/16dp padding，最小 8dp 兜底）；③`xOff` 再减 12dp（`SECRET_TIP_EDGE_MARGIN_DP`），气泡右边缘不再贴屏幕边；④measure 从「220dp EXACTLY」改成「屏幕宽 AT_MOST」（气泡体自身 180dp 定宽，高度照样量得准）

- (web/desktop) 用户要求跟 android 对齐：涉密图标+文字从底栏挪到标题栏「关闭按钮左侧」—— **已改**：
  - (web) `AcDialog.vue` 新增 `header-right` 具名插槽（插在关闭按钮左侧，`v-if="$slots['header-right']"` 无插槽时不渲染不占位，其它调用方零影响）；`SelectDataRangeDialog.vue` 把涉密 `el-popover` 从 `#footer-left` 移到 `#header-right`，`placement` 由 `top` 改 `bottom-end`（右对齐触发器，避免 280px 气泡探出 440px 弹窗右边缘），去掉原先为底栏左边缘问题加的 `offset [12,12]` hack；commit `7e8cc76`，`vue-tsc --noEmit` 通过
  - (desktop) 涉密入口从 `personal-ai-data-scope-dialog.vue` 底栏移到宿主 `personal-ai-memory-bar.vue` 的 `a-modal` `slot="title"`（该弹窗的标题栏/关闭按钮属于宿主 antd modal，不在子组件内）；`secretInfoVisible` 状态、深色气泡样式、`SvgIcon` 注册一并搬到宿主，子组件里对应的 state/import/样式已清理；箭头颜色覆盖从 `[x-placement^="top"]` 改成 `^="bottom"`；commit `77857e47`，eslint 过
  - 该弹窗仅 `personal-ai-memory-bar.vue` 一处引用，无其它落点需要同步
- (web/desktop) 用户复验：desktop 涉密没贴到关闭按钮左侧 + 两端气泡要「正下方居中」弹出 —— **已修**（web commit `508c329`、desktop commit `55161faf`）：
  - (desktop) 根因是全局 `assets/styles/reset-ui-ifram.scss` 里 `.ant-modal-wrap .ant-modal-header{display:flex;padding:0 20px;height:50px}`——header 被设成 flex 后 `.ant-modal-title` 不再撑满宽度，标题栏内的 `space-between` 没有可分配空间，涉密就紧贴标题文字。修法：①本文件所有弹窗样式的外层选择器由 `.pa-data-scope-modal` 改成 `.ant-modal-wrap.pa-data-scope-modal`（3 个 class 压过全局的 2 个）；②`.ant-modal-title` 加 `flex:1;min-width:0`；③header padding 改 `0 48px 0 24px`（高度/垂直居中沿用全局 50px flex 头部，右侧 48px 让开 56px 宽的关闭按钮命中区）
  - 两端 `placement` 由 `bottom-end` 改 `bottom`（气泡正对触发器居中、向下展开）；注意气泡 280px 宽而触发器靠弹窗右缘，居中弹出时气泡右半会探出弹窗右边界（popper 挂 body、不被弹窗裁剪，视口内可见），这是「居中」要求的必然结果，如不接受需改回 `bottom-end` 或缩窄气泡
- (web) 用户要求「再右移一点」，先误改成气泡偏移（`offset [16,12]`，commit `dec0eef`），实际指的是**触发按钮**本身 —— 已撤掉气泡偏移，改成给按钮加 `-mr-3`（右移 12px，缩短与关闭按钮 48px 命中区之间的视觉留白），气泡跟着按钮走仍保持正下方居中；commit `5b9f15f`，`vue-tsc` 通过。位移量凭手感，继续微调就改 `-mr-*` 这个类

- (ios) 用户要求涉密入口跟 android 一样挪到顶部标题栏右侧，同时反馈「点击涉密没有弹出层」—— **已改**（commit `7b74ce6b8`）：
  - 新建 `ZXDataScopeSecretEntry.h/.m`：独立小类持有按钮 + 深色气泡展示/收起逻辑，供 `initWithCustomView:` 塞进 `navigationItem.rightBarButtonItem`；5 个页面（Controller/ContactPage/GroupPage/OrgDrill/Search）统一改用它，`viewWillDisappear` 里的收起调用同步从 `[self.bottomBar dismissSecretBubble]` 改成 `[self.secretEntry dismissBubble]`
  - `ZXPersonalAiPickerBottomBar` 摘除全部涉密相关代码（按钮/气泡/常量），`clearButton` 的最小间距约束改回挂在 `selectedButton.mas_right`（即涉密功能加入前的原状）
  - 「没有弹出层」反复读代码没找到确凿 bug（target-action、约束、window 兜底逻辑走查都对），这次重写时顺手把两处存疑写法改成更保险的写法：气泡固定用 `[UIApplication sharedApplication].keyWindow`（原来 `self.window ?: keyWindow`，多窗口/悬浮来电条等场景下 `self.window` 可能不是真正的 key window）；按钮位置改成 `[button convertRect:button.bounds toView:window]`（按钮自己转换自己的 bounds，不依赖挂在哪层父视图，比原来 `[self convertRect:secretButton.frame toView:window]` 更不容易因层级变化算错）——**没有真机验证能否根治**，需要你 Xcode 编译后实测
  - 气泡定位同步改造：顶栏按钮下方弹出（不是原来底栏那套往上顶的算法）、右边缘对齐按钮右边缘避免探出屏幕（跟这次 android 顶栏改造的思路一致）
  - `zhixinApp.xcodeproj/project.pbxproj` 手工注册了新增两个源文件（3 个 target 的 PBXBuildFile + Sources 阶段各一份），`plutil -lint` 校验语法通过
  - 大括号/圆括号计数校验通过；仍未跑 `xcodebuild`（仓库规定 AI 不擅自构建），**这是继上次「没有弹出层」反馈之后的第二次未经真机验证的改动**，务必编译后重点复测这一处

- (ios) 用户反馈：①不要用原生 `UIBarButtonItem`；②气泡没有箭头 —— **已改**（commit `bd145c96c`）：
  - 摘掉 `navigationItem.rightBarButtonItem`，改成 5 个页面各自新增一个纯 `UIView`（`secretEntryBar`，高 36pt，内含右对齐 16pt 的涉密按钮）插到系统导航栏与原有内容（`searchHeaderView`/`breadcrumbScroll`/`tableView`/`searchBarContainer`）之间，原来「顶到 `self.view` 顶部」的约束改成挂在这个新 bar 的 `mas_bottom` 下；仅数据范围模式显示（`.hidden` + 高度 0 双重收起，跟 `bottomBar` 现有写法一致）
  - 气泡补了向上箭头：`CAShapeLayer` 画 12×6pt 三角形（不依赖美术资源，同色 `#1F2329`），水平位置对准按钮中心，气泡改挂在箭头下方——对齐 android 现在「箭头+气泡体」的两层结构
  - 大括号/圆括号计数校验通过，仍未跑 `xcodebuild`

- (ios) 用户复验：加了新行是错的，「放到选择数据范围这一行的右侧」（标题栏本行，不要另起一行）—— **已撤回**（commit `b247e8605`）：5 个页面全部撤掉 `secretEntryBar`，改回 `self.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithCustomView:self.secretEntry.button]`，`searchHeaderView`/`breadcrumbScroll`/`tableView`/`searchBarContainer` 的顶部约束还原成直接贴 `self.view`。箭头逻辑（`ZXDataScopeSecretEntry.m`）不受影响，保留。大括号/圆括号计数核对后跟撤回前的版本完全一致（确认改动只是去掉新增部分，没有引入新问题）

- (android) 用户反馈已选弹层：① chip 名字显示成长数字 id，但列表行是真人名；② 接口 `privateInfo.avatar` 有 URL，chip/列表却是默认灰头像 —— **已修**（android 未提交；`DataRangeSelectedDisplayTest` 5/5 + `DataScopeModelTest` 22/22 过）：
  - 名字：记忆返显 `resolve()` 找不到本地资料时把 `name` 填成 `scopeDataId`；已选回填原先只在 `name` 为空时才抄候选清单，id 占位不算空，清单里的 `targetName` 抄不进去（tag 却总能抄上，所以会出现「涉密/已离职对、名字是 id」）。改成候选清单命中后 **覆盖** name/avatar
  - 头像：本地通讯录有这条人但没头像文件/URL 时，`bindPrivateAvatar` 找到 user 就 return，把接口 `privateInfo.avatar` 丢掉。改成本地文件仍优先，没有再用接口 URL
- (android) 用户反馈涉密说明气泡显示了 3 行，要求控制在 2 行 —— **已修**（android 未提交）：180dp 定宽把文案挤成三行；改成逗号处强制换行（「人力部门人员、公司全员群，」/「聊天记录与文件涉密，不参与AI分析」），气泡宽度跟较长那一行走，`maxLines=2`
- (ios) 用户反馈：选择数据范围列表长群名把行内「涉密」tag 挤出右边缘（点「已选」再关闭后尤其明显），只剩一条黄缝 —— **已改**（ios 未提交，未跑 xcodebuild）：
  - 根因：`ZXForwardCell` 姓名压缩优先级写成了 `DefaultHigh`（750，UILabel 默认值），注释却说要低于 tag；长名称和 tag 一起被压，徽标被压成一条缝。trailing 只挂在人数 label 上，群人数为空时人数宽为 0，更留不住 tag
  - 修法：姓名改为 `DefaultLow` + 尾部省略，tag 增加 `right ≤ contentView-15`；`updateTagStackView` 里 `invalidateIntrinsicContentSize`（UIStackView 只改 `hidden` 经常不刷新固有宽，对应「已选关闭后」）
  - 「已选」chip 同步修：原先按姓名全文宽度再叠加 tag，chip 会宽过屏幕；改为先扣掉头像/删除/tag 占位再量姓名，并 cap 在 `kMaxWidth`（chip 姓名压缩优先级后来撤回 DefaultLow，见下条）
  - 大括号/圆括号计数校验通过；未碰仓库里其它未提交文件

- (ios) 用户反馈点「已选」后：① chip 名字几乎全是 `...`；② `privateInfo.avatar` 有 URL 却显示文字头像（如「连佳康」粉底「佳康」）—— **已改**（ios 未提交，未跑 xcodebuild）：
  - 头像：已选 chip 改走 `setAvatarByAccountId:name:avatar:`（文字头像只当占位，有 URL 继续加载）；列表行 `ZXForwardCell` 同样改为有 `avatarURL` 就 `sd_setImage`。用户复验头像已对
  - 名字第一轮只撤了 DefaultLow、stack 宽收 0，用户复验仍全是 `...`。对照 android `item_data_range_selected_row`：chip `wrap_content`、姓名 `wrap_content` + **maxWidth 160dp** 才省略。iOS 改成同一套：`itemSizeForUserModel` 用真实约束间距算宽，姓名最多 160pt；cell 里姓名宽度写死为测量值，有 tag 才加 4pt 间隙。超过 160pt 才尾部省略

## 待办 / 阻塞

- (四端) 涉密气泡文案改走 `POST /personalAiFrame/getSecretButtonTip`：**调用代码已在四端脏区写好、均未 commit/push，也未联调/自测**。打开「选择数据范围」时预拉；`data` 非空才替换展示；失败/空串静默回退「人力部门人员、公司全员群，聊天记录与文件涉密，不参与AI分析」。YApi mock「涉密信息请勿外传」只是占位，联调以配置 `personal.ai.frame.secret.tip.text` 为准。
  - (web) `SelectDataRangeDialog.vue` + `personalAiFrame.js`（`feat/data-scope-secret-tag` 未提交）
  - (android) `AiChatBasicInterface.getSecretButtonTip` + `DataRangeMultiFooterHelper` 预拉/展示（`personal-ai-chat-hotfix` 未提交；与下方气泡落位/收窄同一脏区）
  - (ios) `ZXDataScopeSecretEntry.m` + `ZXAIAgentManager`/`ZXApiMacro.h`（`personal-ai-chat-hotfix` 未提交；同脏区还有 combine 旁路文件，提交时勿混入）
  - (desktop) `personal-ai-memory-bar.vue` + `aiBasic.js`（`personal-ai-chat-hotfix` 未提交）
- (android) 气泡落位重写（显式宽 + `showAtLocation` + 按实际落位反推箭头）与宽度按自然排版 **×0.8 收窄 20%** 均在未提交脏区；`assembleDevelopDebug` 已过，**未真机复测**箭头/右侧 12dp 留白/系统字体放大
- (四端) 箭头形态仍不统一：android/iOS 有向上箭头，web/desktop 无箭头——是否统一由用户定
- (ios) 涉密入口在标题栏 `rightBarButtonItem`；按仓库规定 AI 不擅自跑 `xcodebuild`，**未做真机构建**；尤其复测「点击弹出气泡」、接口文案换行后宽度

- (web) 已 push 的 tag/顶栏/加载态等在 `origin/feat/data-scope-secret-tag`；**未做**真实浏览器联调（含 `getSecretButtonTip` 与 tag 渲染）；本地无测试登录态时无法完整自测
- (web) `pnpm format` 本地 prettier 缺失（非本次引入），需本地补齐依赖后再跑
- (android) 已选名字/头像 + 两行气泡等已 push（`1b65e8aff` 一带）；旁路：`basis_function_api/em_camera_switch_normal.9.png` **勿提交**
- (ios) tag/顶栏/已选 chip 等已 push；旁路：combine 引用快照约 6 文件（`20260730`）**勿当本功能提交**
- (web/desktop) 涉密顶栏 + 气泡朝下弹出**未做**浏览器/dev 视觉验证
- (desktop) 顶栏对齐等已 push；旁路：`.env.test` / `electron-builder.yml` / `package.json` **勿提交**
- (context) 旁路：`hideChat`/`saveAgentSetInfo`/`getAgentSetInfo` 契约改动未提交，勿并入本功能 docs

## 关键决策记录

- 2026-08-12：涉密判定复用契约里已上线的 `getAllImDialogue.ignoreChatType`（`Number(x)===1`），不新增/等待后端；契约文件本身已提前加好该字段说明，无需再改
- 2026-08-12：已离职由「姓名后缀（已离职）」改造为与涉密同款独立 tag，不再用括号写法；两者可共存，涉密在前
- 2026-08-12：涉密/已离职配色 `#FFF3DA`/`#FEAC00`（涉密）、`#E5E5E6`/`#8F959E`（已离职，取自截图采样，非精确设计稿值）
- 2026-08-12：说明气泡入口最终挂在标题栏（底栏只保留「已选」）；行内 tag 本身不可点；纯前端静态文案，无需请求接口
- 2026-08-12：组织架构 tab 数据源不带涉密/离职字段，前端用已拉取的候选清单（getAllImDialogue 全量人+群）按账号 id 本地建查找表回填，不改组织树接口
- 2026-08-12：移动端「选择数据范围」现状 100% 走 wnsdk 桥接原生页面，本期不新建 mobile web 页面，只改 android/ios 原生
- 2026-08-12：工作区另有一批与本功能无关、未提交的 `hideChat`/`saveAgentSetInfo`/`getAgentSetInfo` 契约改动（Agent 设置域），经确认不属于本功能范围，未合并处理，留给对应负责人
- 2026-08-12：desktop/android/ios 三端移植不新开分支，直接 commit 到各自现有的 `personal-ai-chat-hotfix`（工作区里各自还有跟本功能无关的未提交改动，均未触碰）；web 端例外，单独用 `feat/data-scope-secret-tag` 分支
- 2026-08-12：(desktop) tag 组件因被公共组件 `dept-user-check-list.vue`（转发/建群等多功能复用）引用，上提到 `components/common/`；组织架构人员行走新增可选 prop `userTagMap`（默认 null，不传时其它调用方零影响）
- 2026-08-12：(ios) `ZXDataScopeTagView` 因被 `ZXForwardCell`/`ZXUserCollectionCell`（转发等功能复用）引用，放在 Picker 目录被跨模块 import；新增字段默认 `NO`，转发等无关流程视觉零影响；组织架构回填直接复用既有 `dialogueContactMap` 基础设施，未新建查找表类
- 2026-08-12：(android) 说明气泡只在共享的 `include_data_range_multi_footer.xml` + `DataRangeMultiFooterHelper` 实现一次（复用仓库既有 `PopupWindow`/`popup_bg_jiantou_bottom_right` 惯例），5 个必需入口天然全覆盖，不用逐落点重复接；已离职灰色复用既有 `color_8F959E`，涉密配色复用既有 `color_FEAC00`/`color_FFF3DA`；`#E5E5E6` 无既有色值，直接写死在新 drawable 里（未改 `base_color.xml`）
- 2026-08-12：底部「已选」「涉密」两按钮的正确顺序定为「已选在左、涉密在右紧挨」（以 web 实现为准）；四端逐一核实，android/desktop/ios 三端初版顺序都反了并已修正，web 本来就对
- 2026-08-12（后续推翻）：涉密入口最终统一挪到**标题栏**，底栏只保留「已选」；android 先改（顶栏右侧），随后 web/desktop 跟进（标题栏关闭按钮左侧）；ios 最后跟进——用户直接指定「标题栏右侧」（iOS 原生导航栏没有 web/desktop 那种「关闭按钮」概念，右侧对应 `rightBarButtonItem`，四端里最后一个补齐）
- 2026-08-12：说明气泡最终定稿为「深色背景 + 文字居中」四端统一（此前 android 初版是白底黑字箭头气泡、desktop 初版是浅色左对齐，均已改）；android 因没有现成深色 9-patch 箭头资源，改用纯色圆角 `<shape>`，**不带箭头**（跟 web/desktop/iOS 是否要箭头未强制统一，如需要箭头版本再补美术资源）
- 2026-08-12（修订）：android 应用户要求补回箭头，用 vector 三角形自绘（不依赖 9-patch 美术资源），宽度定 180dp；**此时 web/desktop/iOS 三端仍无箭头**，四端箭头形态不再统一——如需统一，另三端各自补一次
- 2026-08-12：web 气泡左侧留白问题反复调试：`preventOverflow` 对该场景无效，根因是 `AcDialog` 内容区被本文件自身 scoped style 显式设了 `overflow: visible`，导致它不再是 popper 的 clipping boundary，实际按浏览器视口计算溢出（视口够大，永远不触发）；改用 `offset` modifier 的 skid 分量做固定像素偏移，最终数值由用户手动调定

## android 代码审查（2026-08-13）

对本迭代 android 侧改动（`f34ef9502..d78c3d4d5`，共 5 个 commit）逐文件审查，3 个问题已修并提交 commit `a3204ec46`（`assembleDevelopDebug` BUILD SUCCESSFUL，`:smart_message:testDevelopDebugUnitTest --tests *DataScopeModelTest*` BUILD SUCCESSFUL）：

1. **（性能，最严重）组织架构行 tag 回填是逐行 O(n) 线性扫**：`SelectOrgDrillActivity.onBindViewHolder` 每绑一行都调 `DataRangeDialogueSession.get()`（该方法返回**整份候选清单的 ArrayList 拷贝**，还带 synchronized 锁）再 `DataScopeModel.findPrivateByAccountId` 线性遍历。候选清单是「全量人 + 群」，量级上千时滑动会明显掉帧，也跟 impl-notes 里写的「建查找表」方案不符。改法：`DataScopeModel.findPrivateByAccountId(List, id)` 换成 `buildPrivateIndex(List)` 返回 `Map<账号id, 私聊项>`，索引在 `DataRangeDialogueSession.set()` 里随缓存一起重建，行绑定改调新增的 `DataRangeDialogueSession.findPrivate(accountId)`（O(1)、无拷贝）。单测同步改成 `buildPrivateIndex_keepsPrivateOnlyAndSkipsGroups`（额外断言群不进表）。
2. **（功能）单选复用链路出现点不动的「涉密」死按钮**：`include_data_range_secret_entry.xml` 在 5 个页面里是无条件 `<include>`（默认 visible），但 `bindSecretEntry()` 只在 `if (multiMode)` 分支里调。`SelectAiAgentActivity` 会以**单选**方式拉起 `SelectContactActivity`/`SelectGroupActivity`/`SelectSearchActivity`（不带 `EXTRA_MULTI`），那条链路顶栏会显示「涉密」但点了没反应，而且这功能本就不属于选人/选群单选流程。改法：include 根节点默认 `visibility="gone"`，由 `bindSecretEntry()` 绑定时置 `VISIBLE`——多选链路照常显示，单选链路自动不出现。
3. **（泄漏）气泡开着时页面销毁会 WindowLeaked**：`secretTipPopup` 只在 `showSelectedSheet()` 里被主动收起，点「确定」保存后 `finish()`（或任何非返回键的 finish）时若气泡还开着，`PopupWindow` 会随 Activity 窗口一起泄漏。改法：`bindSecretEntry()` 里给入口 view 挂 `OnAttachStateChangeListener`，`onViewDetachedFromWindow` 收起气泡；同时抽出 `dismissSecretTip()` 复用（不用逐个 Activity 加 `onDestroy`）。
4. 顺带修了 `toggleSecretTip()` 上方与代码矛盾的过时注释（还写着「220dp 定宽 / EXACTLY 量」，实际已是 180dp + 屏幕宽 AT_MOST）。

审查中确认**没问题、未改动**的点：`ignoreChatType` 用 `isFlagOne` 判定（Integer 拆箱比较，Gson 对字符串 "1" 已按数值解析，逻辑与契约一致）；箭头 `marginEnd` / 气泡 `xOff` 的几何推导逐项验算正确；`item_friend_content.xml` 里姓名 `wrap_content + weight=1` 处在 **wrap_content 的父容器**中，多余空间为 0、溢出时负 delta 只压缩姓名，tag 既不会被推到行尾也不会被挤丢（与 desktop 那个 `flex:1` bug 不同源，此前判断正确）；`SelectContactActivity` 只渲染企业行、无人员行，不是遗漏的 tag 落点；`color_FFF3DA`/`color_FEAC00`/`color_8F959E` 三个色值均已在 `base_color.xml` 既有定义中（工作区里 `base_color.xml` 那条未提交改动是无关的 `color_F0F5FF`，未动）。

> 仍未做：真机走查（本仓库无 UI 自动化），顶栏「涉密」在 5 个页面的实际位置/气泡箭头对齐需实测。

- 2026-08-13：收尾同步——矩阵「涉密说明」行改为标题栏入口表述（底栏方案已废弃）；impl-notes 说明气泡章节对齐顶栏落点与四端箭头差异；apps 脏区仍为旁路，自测状态不变；无关契约改动未提交
- 2026-08-13：android/ios/desktop 涉密代码 push 到各自 `origin/personal-ai-chat`。web 先误 cherry-pick 到 `personal-ai-chat`，后按用户要求 force-with-lease 撤回到 `7163903`，并 push `feat/data-scope-secret-tag`（`5b9f15f`）。android 快进时 hotfix 上未推送的「合并详情」commit `f34ef9502` 会一并进入 `personal-ai-chat`（无法从历史上剥离）
- 2026-08-13：推翻「纯前端静态文案、无需请求接口」——后端新增 `POST /personalAiFrame/getSecretButtonTip`（无入参，`data` 为配置字符串）。契约已落 `getSecretButtonTip.d.ts`。
- 2026-08-13：四端调用代码已接 `getSecretButtonTip`。打开「选择数据范围」时预拉；`data` 非空字符串才替换展示；失败/空串回退旧静态文案，静默不弹错。android 去掉硬编码 `\n` 与 `maxLines=2`，宽度跟实际字符串走。未联调，矩阵标 🚧。
- 2026-08-13：(android) 用户实测截图——气泡整体被推到屏幕左侧、盖住搜索框与「选择联系人」，箭头也脱离「涉密」按钮。根因：`PopupWindow` 用 `WRAP_CONTENT` 建时会**自己再量一遍**内容宽度，跟 `toggleSecretTip()` 里预量的值对不上（宽文案 + 换行时差得更多），负 `xOff` 又叠加系统的屏幕内钳制，气泡被顶到左边缘；箭头 `marginEnd` 是按「预量宽」推的，于是跟着错位。改法（`DataRangeMultiFooterHelper.java`）：①`new PopupWindow(content, tipWidth, WRAP_CONTENT)` 显式给宽，实际宽 = 预量宽；②改用 `showAtLocation(NO_GRAVITY, tipLeft, tipTop)` 按窗口坐标直接落位（`getLocationInWindow` 取按钮位置），气泡右边缘对齐屏幕右侧 12dp 留白、左侧同样留 12dp 钳制；③`adjustSecretTipArrow(content, tipLeft, tipWidth)` 改成用**实际落位**反推箭头 `marginEnd`（按钮视觉中心按 `getPaddingLeft/Right` 实算，不再写死 12/16dp），两端各留 8dp 圆角兜底。`assembleDevelopDebug` BUILD SUCCESSFUL；**未真机复测**，android 工作区仍为旁路脏区（含 `getSecretButtonTip` 接入）未提交。
- 2026-08-13：(android) 用户要求气泡再窄 20%。实现为「两遍 measure」：第一遍按屏幕宽量出文案自然排版宽，再把 `TextView.setMaxWidth(自然宽 * 0.8 - 24dp左右padding)` 后重量一遍，气泡多换一行、整体窄 20%。比例走常量 `SECRET_TIP_WIDTH_RATIO`（想再调只改这一个数）。`assembleDevelopDebug` BUILD SUCCESSFUL，未真机复测。
- 2026-08-13：收尾同步——四端 `getSecretButtonTip` 接入与 android 气泡落位/收窄均在 apps 脏区未提交；矩阵「接口文案」/「自测」仍 🚧；impl-notes 已含接口文案与定位说明，web 未联调故未改 impl-notes；旁路脏区仍排除在本功能 commit 外
