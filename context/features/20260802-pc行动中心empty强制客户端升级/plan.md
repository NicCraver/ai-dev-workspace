# Plan：PC 行动中心 empty 强制客户端升级

> 最后更新：2026-08-02｜实施仓库：`/Users/nic/w/dev-o5-shortcut`（分支 `dev-o5-shortcut`）

## 任务拆分

1. ✅ 新增 `PcClientUpgrade`：对齐 PC `upgrade.vue` 下载行为（进度 / 失败重试 / 打开目录 / 下完打开安装包并 quit）
2. ✅ `TheLayout`：`/empty` + 需强更时只渲染更新组件；跳过 `closeWin` / reload；拦截 `open-page`
3. ✅ 窗口缩到最小尺寸（约 480×196）；Windows 特殊处理尺寸约束
4. ✅ 写死 Mac/Win 安装包 URL；文案「数据维护，请升级智信后再使用」
5. ✅ 文档沉淀到本 feature 目录
