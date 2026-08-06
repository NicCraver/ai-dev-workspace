# Status：数据范围-筛选条迭代。

> 最后更新：2026-08-06 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 文案规则（类型全部/数据全部·封顶） | ✅ | ✅ | ✅ | ✅ |
| 点击数据并行 getAgentDataRange | ✅ | ✅ | ✅ | ✅ |
| 接口联调（flags 回传验收） | 🚧 | 🚧 | 🚧 | 🚧 |
| 自测通过 | 🚧 | 🚧 | 🚧 | 🚧 |

## 待办 / 阻塞

- (全端) 待真机确认：全选文案、箭头、n>999 封顶、点数据先开层再刷新胶囊
- (web) 已修：`Number(flag)===1` 兼容字符串；`personal-ai-chat` 已 cherry-pick 功能+修复
- (desktop) 功能代码已提交（`090f73cb` feat + `53dd653c` fix：箭头 + 字符串标记）；工作区未提交改动仅为本地 `.env.test`/`electron-builder`/`package*`，非本功能代码、勿提交
- (android) 测试包 `zx-android-test_v3.6.18.apk` 已重新打出（2026-08-06），待装机验收
- (ios) MemoryModel 三标记依赖 MJ 映射；联调确认后端已回传
- (全端) 设置页 / 定时任务文案本期不做（web 用 `persist=false` 隔离）

## 关键决策记录

- 2026-08-05：缺省 `groupAndAccountSelectAll` 展示当 0；点击数据先开层并行 get；文案「全部类型」「全部数据」；类型含群 AI；真全部只消费现有标记
- 2026-08-05：(web) persist=false 路径保持「数据+n」
- 2026-08-05：三标记判断统一按数值 1（兼容后端字符串 `"1"`）
