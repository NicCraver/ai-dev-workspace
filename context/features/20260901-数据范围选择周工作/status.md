# Status：选择数据范围 · 周工作

> 最后更新：2026-09-01（web 周工作界面仍在脏区，未 commit、未打开弹窗自测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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

`bash scripts/code-status.sh`：智信 web 脏区全是周工作 picker / 图标，与会议室无关。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| web | feat/data-scope-storage-group | synced | 脏(12) | **本功能** | 弹窗/payload/图标/WeekWorkPicker 未 commit |
| context | main | ahead 124 | 干净 | — | 本功能文档此前已提交 |
| meeting / contact | — | — | 脏 | 会议室其它功能 | 不归本功能 |

## 本次改动

**apps/web**（未 commit）

表头「全部」：所有人 + 树上每一项「含团队工作」都勾上才算全选；只勾所有人是半选。点「全部」会把人与所有板块一起勾上或清掉。部门左勾选同样要求子树里每一项含团队工作都勾上（点支持板块会连带信息技术部的含团队工作）。

| 文件 | 改动 |
|------|------|
| `picker/weekWorkModel.js` | `selectAllState` / `toggleSelectAll`；`deptCheckState` 计入子孙板块 |
| `picker/WeekWorkPicker.vue` | 表头「全部」走整树人+板块 |
| `tests/weekWorkModel.test.mjs` | 覆盖「只选所有人=半选」 |

## 验证

```
apps/web: node --test picker/tests/weekWorkModel.test.mjs picker/tests/dataRangeSavePayload.test.mjs
→ 21 pass / 0 fail
```

## 待办 / 阻塞

- (web) 打开弹窗目视：全部=人+所有含团队工作才全选；只选所有人是半选
- (web) 周工作候选接口未到，tab 常显 + mock；接口到了改为 `dataRangeList` type=5 choose=1 才显示
- (web) 确定暂不写 `weekWorkScopeList`，等接口；save 只透传记忆里已有的 weekWork*
- (web) 本功能改动未 commit

## 关键决策记录

- 2026-09-01 先做前端界面交互，接口后补；打开即显示周工作 tab
- 2026-09-01 所属、主管与关注同一套扁平列表
- 2026-09-01 周工作 key 用 `ww_{type}_{id}`，与知识聊天 key 隔离
- 2026-09-01 组织图标用行动中心 PNG：团队工作 `mw-report`，部门/板块 `mw-dept`，名称含「组」`o5-group`
- 2026-09-01 不要表头「全选含团队工作」；「全部」与部门左勾选都要把子树所有含团队工作算进半选/全选。只勾所有人是半选
