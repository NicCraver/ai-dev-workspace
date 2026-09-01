# Status：选择数据范围 · 周工作

> 最后更新：2026-09-01 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 周工作 tab + 四级子 tab + mock 列表勾选 | 🚧 界面已写，待打开弹窗目视 | — | — | — |
| 已选底栏合并（知识聊天 + 周工作） | 🚧 代码已接，待目视 | — | — | — |
| save 透传记忆中的 weekWork* | ✅ 单测覆盖 | — | — | — |
| 周工作树真实接口 | ⬜ | — | — | — |
| dataRangeList type=5 控制 tab 显隐 | ⬜ 现常显 | — | — | — |
| 自测通过 | ⬜ 未在浏览器点开弹窗 | — | — | — |

android / ios / desktop 已内嵌 web 页，不单独做原生选择器。

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| web | feat/data-scope-storage-group | synced | 脏(12) | **本功能** | 未 commit |
| context | main | ahead 121 | 脏(本功能 spec/status) | 本功能 | 本回合改勾选规则 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 本次改动

**apps/web**（未 commit）

去掉表头「全选含团队工作」。有报告的部门左勾选：选一人 / 只勾含团队工作 / 人选齐但没勾板块 → 半选；人选齐且勾了含团队工作 → 全选。点部门左勾选会把子孙人 + 本板块一起勾上或清掉。行尾「含团队工作」仍只切本板块。

| 文件 | 改动 |
|------|------|
| `picker/weekWorkModel.js` | 新增 `deptCheckState`；`toggleDeptPeople` 有报告时连同本板块 |
| `picker/WeekWorkPicker.vue` | 删「全选含团队工作」行；部门勾选态走 `deptCheckState` |
| `tests/weekWorkModel.test.mjs` | 21 例（含半选/全选） |

## 验证

```
apps/web: node --test picker/tests/weekWorkModel.test.mjs picker/tests/dataRangeSavePayload.test.mjs
→ 21 pass / 0 fail
```

未登录 MCP 浏览器，没在弹窗里再点一遍；逻辑由单测覆盖。

## 待办 / 阻塞

- (web) 打开弹窗目视：无「全选含团队工作」；支持板块选一人/只勾含团队工作=半选，人+板块=全选
- (web) 周工作候选接口未到，tab 常显 + mock；接口到了改为 `dataRangeList` type=5 choose=1 才显示
- (web) 确定暂不写 `weekWorkScopeList`，等接口；save 只透传记忆里已有的 weekWork*
- (web) 本功能改动未 commit

## 关键决策记录

- 2026-09-01 先做前端界面交互，接口后补；打开即显示周工作 tab
- 2026-09-01 所属、主管与关注同一套扁平列表
- 2026-09-01 周工作 key 用 `ww_{type}_{id}`，与知识聊天 key 隔离
- 2026-09-01 组织图标用行动中心 PNG：团队工作 `mw-report`，部门/板块 `mw-dept`，名称含「组」`o5-group`
- 2026-09-01 不要表头「全选含团队工作」；有报告部门左勾选要把本板块算进半选/全选
