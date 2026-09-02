# Status：选择数据范围 · 周工作

> 最后更新：2026-09-02 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| context | main | ahead 130 | 脏(本功能 spec/status) | 本功能 | 本回合收窄表头全选范围 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 本次改动

**apps/web**（未 commit）

表头「全部」只有在二级 tab「全部」+ 胶囊「全部」时才把人与所有含团队工作一起勾。团队胶囊只勾含团队工作，人员胶囊只勾人；关注 / 所属 / 主管仍只勾当前列表。

| 文件 | 改动 |
|------|------|
| `picker/WeekWorkPicker.vue` | 全选范围随 `kindFilter` / 二级 tab 收窄 |
| `tests/weekWorkModel.test.mjs` | 人员只动人、团队只动板块 |

## 验证

```
apps/web: node --test picker/tests/weekWorkModel.test.mjs picker/tests/dataRangeSavePayload.test.mjs
→ 22 pass / 0 fail
```

## 待办 / 阻塞

- (web) 打开弹窗目视：全部胶囊才人+板块一起全选；其他 tab / 胶囊只勾当前列表
- (web) 周工作候选接口未到，tab 常显 + mock；接口到了改为 `dataRangeList` type=5 choose=1 才显示
- (web) 确定暂不写 `weekWorkScopeList`，等接口；save 只透传记忆里已有的 weekWork*
- (web) 本功能改动未 commit

## 关键决策记录

- 2026-09-01 先做前端界面交互，接口后补；打开即显示周工作 tab
- 2026-09-01 所属、主管与关注同一套扁平列表
- 2026-09-01 周工作 key 用 `ww_{type}_{id}`，与知识聊天 key 隔离
- 2026-09-01 组织图标用行动中心 PNG：团队工作 `mw-report`，部门/板块 `mw-dept`，名称含「组」`o5-group`
- 2026-09-02 表头全选：只有「全部」tab 的「全部」胶囊才人+含团队工作一起勾；其它只勾当前列表
