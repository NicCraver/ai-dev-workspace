# Status：PC 多选超过 20 条时「逐条转发」图标裂图

> 最后更新：2026-09-03（**已收尾关闭**：改动随 desktop 分支已 push，用户验收通过）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

多选消息超过 20 条时，「逐条转发」应禁用（`not-allowed` + 灰字），图标切到不可点资源。模板读的是 `item.noClickIcon`，但现行 `defaultMultSelectOperate` 只挂了 `icon`；注释掉的旧分支里才有 `noClickIcon`。超过 20 条后 `src` 为空，浏览器画裂图占位。资源 `single-send-unclick.png` 一直在仓库里。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 补 `noClickIcon` 指向 unclick 图 | — | — | — | ✅ |
| 运行时多选 >20 看图标 | — | — | — | ✅ 用户验收通过 |

## 本回合各端现状（code-status）

本回合只动 `apps/desktop` 的 `chat-box.vue`。desktop `master-3.4.27` ahead 1 / behind 3，另有 markdown 配色与合并转发宽度的未提交改动，以及本地调试 3 件（勿提交）。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | ahead 1 / behind 3 | 8 项 | **本功能** + 三端 markdown 配色 + 合并转发宽度 | 本功能只改 `chat-box.vue` |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 本次改动

| 文件 | 改动 |
|------|------|
| `chitchat/chat-box.vue` | `single-send` 项补 `noClickIcon: require(.../single-send-unclick.png)` |

## 验证

代码路径：`selectMessageList.length > 20 && type == 'single-send'` → `item.noClickIcon`。资源文件存在。未起 `dev:test` 做运行时多选。

## 待办 / 阻塞

- 无。2026-09-03 收尾：多选 >20 走灰图标已由用户验收，改动随 desktop 分支 push，功能从 ACTIVE 移除。
