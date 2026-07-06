# features/ —— 按功能迭代组织的动态上下文

- 每个功能一个目录，命名：`YYYYMMDD-功能名`（用 /new-feature 自动创建）。
- `ACTIVE` 文件存当前活跃功能的目录名（SessionStart hook 据此注入状态；只有一行；无活跃功能时写 `none`）。
- 四端全部 ✅ 且上线后，把目录名前缀改为 `done-` 归档，并把 ACTIVE 改回 none 或切到下一个功能。
- 目录内四个文件的分工：
  - `spec.md` 需求是什么（人审核的源头）
  - `plan.md` 怎么拆任务
  - `status.md` 现在做到哪了（唯一进度事实，AI 自动维护）
  - `impl-notes.md` 逻辑长什么样（跨端移植的依据，AI 自动维护）
