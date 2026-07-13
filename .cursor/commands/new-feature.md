# 创建新功能的文档目录并设为活跃功能

为新功能「$ARGUMENTS」初始化迭代上下文：

1. 运行脚手架脚本：

```bash
bash scripts/new-feature.sh "$ARGUMENTS"
```

该脚本会以 `context/features/_template/` 为模板创建 `context/features/<日期>-$ARGUMENTS/`，并把目录名写入 `context/features/ACTIVE`。

2. 向用户复述目录路径，然后**立即启动 brainstorming 流程**梳理需求。注意：brainstorm 最终产出的设计文档必须保存为该目录下的 `spec.md`（覆盖模板占位内容），不要写到其他位置。

3. spec 经用户确认后，继续用 writing-plans 产出 `plan.md`。plan 中每个任务需标注涉及的端（web / android / ios / desktop / 多端）。

4. 根据 plan 初始化 `status.md` 的平台矩阵行（每个主要任务一行），然后执行 wrapup 技能的提交步骤。
