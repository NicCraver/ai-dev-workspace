# Impl Notes：定时任务消息 · 气泡下来源 badge

> 平台无关逻辑。实现前占位；编码联调后按 wrapup 补全。最后更新：2026-07-30

## 显隐（仅 badge）

```
isFixTask = (parse(extra).fixTaskMessage === 1)   // 仅数字 1
个人 badge = isFixTask && personalAccountId 有值 && 昵称已解析 && 未撤回
群 badge   = isFixTask && 群AI判据 && !personalAccountId && 未撤回
文案个人 = "来自" + 归属人昵称 + "个人AI框"
文案群   = "来自群AI框"
```

昵称旁 tag **不在本功能范围**。

## 布局

气泡 → 表情 / 快捷操作 →「N条回复」→ 来源 badge

## 联调坑

（实现后补充）
