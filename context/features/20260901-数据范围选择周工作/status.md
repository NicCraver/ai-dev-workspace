# Status：选择数据范围 · 周工作

> 最后更新：2026-09-04 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 周工作 tab + 四级子 tab + 列表勾选 | ✅ 真实数据渲染 + 按设计稿改版，已目视 | — | — | — |
| 已选底栏合并（知识聊天 + 周工作） | 🚧 代码已接，待目视 | — | — | — |
| save 透传记忆中的 weekWork* | ✅ 单测覆盖 | — | — | — |
| 周工作树真实接口 | ✅ 联调通过，四棵树按实际字段渲染 | — | — | — |
| dataRangeList type=5 控制 tab 显隐 | ⬜ 现常显 | — | — | — |
| 自测通过 | 🚧 渲染已目视，勾选/保存未验 | — | — | — |

android / ios / desktop 已内嵌 web 页，不单独做原生选择器。

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| context | main | ahead 19 | 脏(package.json) | 编排 | 本功能 status 待提交 |
| web | feat/data-range-week-work | 无 upstream | 脏(picker + AcDialog) | **本功能** | 周工作列表高度铺满弹层 |
| desktop | feat/data-range-week-work | synced | 干净 | 本功能 | 未改 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 2026-09-03 联调回合

拿真实登录态（userCode 换 token）跑通 `POST /personalAiFrame/weekWorkDataRangeTree`，
真实数据已渲染。实测账号：李权泓（accountId `1880150187008081921`，corpId 6，天津美腾）。

回参规模：28KB，单企业、3 个一级板块（人力资源部 / 信息技术部 / 运维部）、22 人、树深 2 层。

四个子 tab 目视结果，与适配层离线跑出的结果一致：

| tab | 团队 | 人员 |
|---|---|---|
| 全部 | 7 | 22（胶囊「全部 29」） |
| 关注 | 1（人力资源部） | 4 |
| 所属 | 5 | 17 |
| 主管 | 2 | 5 |

**与文档差了四处**（详见 impl-notes 联调坑与契约 Changelog）：回参包了两层、`dataCode`
不能判类型、`userInfo.accountId` 恒 null、所属/主管树带空壳板块。头两条不处理面板会整片空白。

顺带被实测证实的一条：真实数据里有 4 组 id 跨类型撞号（板块与其同名子团队同 id），
行标识用「类型:id」是必要的，不是防御性设计。

## 本次改动

**context** 新增契约 `personalAiFrame/weekWorkDataRangeTree.d.ts`：`POST /personalAiFrame/weekWorkDataRangeTree`（服务 aiBasic）。

一次返回四棵树（allTree / attentionTree / belongTree / manageTree）。前端必知口径写在 Changelog：Jackson 剥 `is` 前缀、`enableState=1` 自行拼「XXX团队工作」、团队/人员个数前端数节点、授权只在全部树、单企业跳过企业层。

## 2026-09-03 按设计稿改版

图标、计数、半选、展开交互四处改到位（详见 impl-notes「行的视觉与交互口径」）：

| 项 | 改前 | 改后 |
|---|---|---|
| 组织图标 | plate=报告 / 名含「组」=o5-group / 其余=dept | 有团队报告=蓝色报告，没有=蓝灰层叠（二分） |
| 行尾数字 | 人数 peopleCount | 范围数 countNumber（含自身那份团队工作） |
| 胶囊「团队」 | 数所有组织节点 | 只数有团队报告的（全部 = 团队 + 人员） |
| 半选 | 三个胶囊都显示 | 只在「全部」胶囊下显示 |
| 展开 | 行首箭头 / 无图标 | 行尾 pack/unfold（有子节点的团队行），点整行展开 |

真实数据目视：全部 25 = 团队 3 + 人员 22；人力资源部 4 / 信息技术部 18 / 运维部 3；
四个无团队报告的组用层叠图标且无「含团队工作」。

## 2026-09-04 周工作列表面板微调

`WeekWorkPicker` 三处视觉：

- 组织图标在周工作列表、统一搜索命中行用 `!w-6 !h-6`（24px，与人员头像同大）；已选底栏仍走组件默认 16px
- 「含团队工作」接到名称右侧，不再被 `flex-1` 顶到行尾
- 筛选胶囊改为 `rounded-full`（高度 24px 的全圆胶囊，左右无竖边）
- 列表到页脚的空白：弹层内容改为 `flex-1 min-h-0` 链（`AcDialog` body / `WeekWorkPicker` / 虚拟列表），短列表也铺满到页脚
- 全部 tab 有子节点的团队行尾加收纳组同款 pack/unfold 图标
- 人员行只显示 nickName，不显示企业名和上级部门
- 企业行图标改用 OrgPicker 公司行 `company_organization.png`
- 周工作 `listResetKey` 去掉展开数，展开/收起不再滚回顶（对齐收纳组 d91a48c7）

## 2026-09-04 勾选口径按胶囊分维

部门行的「全选」判据以前不分胶囊，一律要求「人选齐 + 团队工作勾齐」。团队胶囊下人员行不显示，
于是团队行永远勾不满。改为按胶囊只看一维（`deptCheckState(keys, dept, scope)` 与
`toggleDeptPeople(keys, dept, scope)` 新增 scope 参数，取值 all / team / person）：

| 胶囊 | 全选判据 | 勾整行写入 |
|---|---|---|
| 全部 | 人齐 + 团队工作齐 | 人员 + 板块 + 标记 3、4 |
| 团队 | 只看团队工作 | 板块 + 标记 4 |
| 人员 | 只看人 | 人员 + 标记 3 |

部门联动标记也改为按维度给（有人才 type 3，有团队工作才 type 4），以前团队胶囊会写出
「选了 0 个人的 type 3」。真实数据（李峰，多企业）目视：团队胶囊勾「信息技术部」只 +1（那份
团队工作，行勾选框与「含团队工作」同步）；人员胶囊勾同一行 +16 人且不写板块。
weekWorkModel 单测 19 条绿，`vue-tsc` exit 0。

## 2026-09-04 胶囊过滤行本身

团队胶囊以前列出所有组织节点，含一堆没开独立汇报、勾不动的纯容器。改为
`visibleTreeRows` 按 kind 过滤：team 只留 `enableState=1` 的组织，person 只留人员，
自身不合格但子孙里有的作为层级壳保留。展开图标改用 `hasVisibleDescendants(node, kind)`，
当前胶囊下展开为空就不给图标。

真实数据（李峰）目视：团队胶囊里「信息技术部」展开后无内容（子级只有人和 4 个未开汇报的组），
现在它不再显示展开图标；「矿业研究设计院」「下属分子公司」子树里有开汇报的，箭头保留；
企业行（美腾 / 莱煤智能 / 海纳新）自己不开汇报，作为层级壳保留。单测 22 条绿，`vue-tsc` exit 0。

## 2026-09-04 搜索 tab 常显

「团队工作 / 人员工作」两个 tab 改为**只要本入口带周工作候选就常显**，不再按当前关键字有没有命中。
一条都没搜到时 tab 条也保留（`showTabs` 取代模板里的 `hasResult`）。不带候选的入口不受影响。

真实数据目视：搜「张」五个 tab 齐；搜「zzzz不存在」tab 条仍在，点「团队工作」显示空态图。

## 2026-09-04 周工作搜索并入统一搜索

周工作面板原来自带一个 `SearchInput` 做树内行内过滤，与知识聊天那边的 popover 式搜索两套行为。
现在统一：

- 新增 `dataRange/DataRangeSearchEntry.vue`——PC 出 `AiBoxSearchBox`、移动出搜索按钮，
  两个一级 tab 共用这一个入口（知识聊天那边的内联写法也换成它）
- `WeekWorkPicker` 去掉自带搜索与 `keyword`，子 tab 行改成 `#search` 插槽
- **周工作主列表不再随关键字过滤**（与知识聊天一致），`listResetKey` 也去掉 keyword

目视：周工作 tab 里输入框 placeholder 与知识那边同为「搜索联系人、群组」，
搜「信息」出五个 tab、群组与团队工作混排；点结果里的「信息技术部团队工作」已选 6→7，
关掉搜索后树里该行同步变半选（板块勾了、人没勾）。

## 2026-09-04 所属/主管改树渲染

抓接口回参确认：`belongTree` / `manageTree` 与 `allTree` **同形**（企业 → `corpPlateList` →
`childUnitList` 递归），最大层深分别是 4 和 3；`attentionTree` 才是平的（直接给 unitList）。
之前把所属/主管摊平成「团队 + 人员」两列是错的，丢了层级。

- 适配层新增 `pruneByRelation(nodes, relation)`：自己命中留、子孙命中当层级壳留、两头不沾整枝丢
  （替掉 `flattenToTeamsAndPeople`，后者只剩单测夹具在用）
- `WeekWorkPicker` 用 `isTreeTab` / `currentTree` 取代到处写的 `subTab === 'all'`，
  三个树 tab 共用同一套渲染与勾选；`EMPTY_WEEK_WORK_TREES` 的 belong/manage 改成 `[]`
- 切 tab 时展开态按当前树重置；树 tab 默认「全部」胶囊，关注仍默认「团队」

真实数据（李峰）目视：所属 = 美腾（信息技术部 / 矿业研究设计院）+ 莱煤智能（前端开发），
展开矿业研究设计院能看到 4 个人 + 梯流分选研究分院（再下还有一层）；胶囊「全部 35 = 团队 5 + 人员 30」
与接口统计（人 30）对得上。主管 = 海纳新 → 智能信息事业部，全部 7 = 团队 1 + 人员 6。关注仍是扁平列表。
单测：weekWorkModel 22 绿，weekWorkAdapter 13 绿（改写 1 条、新增 1 条），`vue-tsc` exit 0。

## 2026-09-04 行尾数字随胶囊换口径

团队胶囊下还显示 `countNumber`（人 + 团队工作的混合数）是错的——「美腾 41」里 35 个是人，
这个胶囊一个都勾不到。改成 `rowCountByKind(node, kind)`：全部=`countNumber`，
团队=子树团队工作份数（含自身），人员=`peopleCount`。

抓接口核对了口径：`countNumber` = `peopleCount` + 子树团队工作数（美腾 41=35+6、
矿业研究设计院 14=11+3、下属分子公司 9=7+2、莱煤智能 3=2+1，全对）。

目视三个胶囊同一棵树：

| 行 | 全部 | 团队 | 人员 |
|---|---|---|---|
| 美腾 | 41 | 6 | 35 |
| 信息技术部 | 18 | 1 | 17 |
| 矿业研究设计院 | 14 | 3 | 11 |
| 下属分子公司 | 9 | 2 | 7 |
| 莱煤智能 | 3 | 1 | 2 |
| 海纳新 | 7 | 1 | 6 |

团队胶囊顶层相加 6+1+1 = 8 = 胶囊「团队 8」，两处同源。单测 23 绿，`vue-tsc` exit 0。

## 待办 / 阻塞

- (web) 周工作面板**只走接口、失败即空面板**（按 2026-09-03 决策，不回退 mock）；`weekWorkMock.js` 仅剩单测夹具用途
- (web) 本次联调只覆盖**单企业**（multiCorp=false）与**无孤儿人员**（orphanUserList 空）；多企业分支与孤儿人员分支只有单测覆盖，等有多企业账号再验
- (web) 勾选口径已按胶囊分维并目视；**勾选后点确定是否正确落库仍未验**
- (web) `WeekWorkPicker.vue` 本回合与用户的图标改动同处一文件，未提交（模型层 `weekWorkModel.js` 改动同样未提交，避免拆出不自洽的 commit）
- (web) tab 显隐改为 `dataRangeList` type=5 choose=1 才显示（现常显）
- (web) 确定暂不写 `weekWorkScopeList`，等接口；save 只透传记忆里已有的 weekWork*
- (web) 新分支未 push，需要时 `git push -u origin feat/data-range-week-work`

## 关键决策记录

- 2026-09-01 先做前端界面交互，接口后补；打开即显示周工作 tab
- 2026-09-01 所属、主管与关注同一套扁平列表
- 2026-09-01 周工作 key 用 `ww_{type}_{id}`，与知识聊天 key 隔离
- 2026-09-01 组织图标用行动中心 PNG：团队工作 `mw-report`，部门/板块 `mw-dept`，名称含「组」`o5-group`
- 2026-09-02 表头全选：只有「全部」tab 的「全部」胶囊才人+含团队工作一起勾；其它只勾当前列表
- 2026-09-02 web 周工作改动从 `feat/data-scope-storage-group` 拆到 `feat/data-range-week-work`
- 2026-09-03 树接口契约落地：一次四棵树；授权只在 allTree；「XXX团队工作」前端拼接；team/person 计数前端数节点
- 2026-09-03 后端字段不直接进组件，中间加 `weekWorkAdapter.js`：界面只认内部节点形状，后端字段变动只改适配层
- 2026-09-03 节点行标识与选中 key 分开：行用 `kind:id`（企业/板块/部门 id 跨表撞号），选中 key 仍用原始 id（要回传后端）
- 2026-09-03 接口未上线期间**不回退 mock**，面板显示失败文案——避免假数据被当成联调通过
