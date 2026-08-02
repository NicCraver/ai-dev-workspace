# Impl Notes：PC 行动中心 empty 强制客户端升级

> 平台无关逻辑笔记。实现落在行动中心仓库（`dev-o5-shortcut`），宿主为智信 PC Electron 独立窗。

## 状态流转

```
启动独立窗 → 加载 /empty
  ├─ UA 含 "3.4.23" → 原停靠：closeWin 隐藏 + 可选 reload
  └─ UA 不含 "3.4.23" → 强更态
        ├─ 展示更新 UI、缩小窗、开始下载
        ├─ 拦截一切 open-page
        ├─ 下载中：禁止 closeWin / location reload
        ├─ 成功：打开安装包 → 退出应用
        └─ 失败：失败态，可重下 / 打开目录
```

## 触发与门闩

- 门闩：`navigator.userAgent` **不包含** 字面量 `3.4.23`
- 路由：仅当 path 为 `/empty` 时进入强更 UI（`isUpgradeEmpty`）
- 宿主侧：PC 创建行动中心独立窗时 `loadURL(.../empty)`，且 `nodeIntegration: true`，页内可用 Node 下载

## 下载逻辑（对齐桌面 upgrade 行为）

- URL（写死）：
  - mac：`.../prod/version/zhixin_v3.4.23-mac-x64.dmg`
  - win：`.../prod/version/zhiwulianxin_v3.4.23-win-x64.exe`
- 保存到系统临时目录，文件名为 URL basename
- 流式下载 + content-length 算进度；支持跳转一次
- 成功条件：本地文件存在且大小 ≥ 1MB（避免把错误页当安装包）
- 成功后：mac 打开路径；win 分离进程启动安装包；约 1s 后退出应用
- 失败：删半截文件，UI 切失败态

## 窗口与交互约束

- 强更态：窗约 480×196，内容白底铺满；文案「系统更新」+「数据维护，请升级智信后再使用」
- 标志位 `__pcClientUpgradeActive`：尽早置位，防止 `/empty` 的 30ms `closeWin` 把刚 show 的窗藏掉
- Windows：创建时带 min 860×600；须先放开 max/resizable → min 降到 0 → 再 `setBounds`/`setContentSize`，并延迟重试
- 取消/恢复：恢复行动中心正常最小尺寸 860×600（若产品后续加取消按钮）

## 边界情况

| 场景 | 预期 |
|------|------|
| 浏览器调试打开 /empty（无 Electron） | 不应用 Node 下载；不误判为可强更业务路径时仍可能因 UA 无 3.4.23 进 UI（仅 Electron 实用） |
| 已是 3.4.23 | 不进强更；`/empty` 照旧关窗停靠 |
| 下载中收到 open-page | 直接忽略 |
| OSS 返回过小/非包文件 | 失败态，不 quit |
| 关窗停靠竞态 | 强更态跳过 closeWin 与 reload |

## 错误处理策略

- 网络/HTTP 非 200/写盘失败 → 失败态 +「重新下载」
- 用户点「打开文件所在位置」：成功后打开目录；失败态时按钮文案变为「重新下载」

## 联调坑

- `/empty` 原逻辑 30ms `closeWin`：若未拦截，更新窗会「闪一下就关」
- Windows `setSize` 在 minWidth=860 时经常无效，必须先降 min 并用 `setBounds`，必要时延迟再设
- 行动中心无 `got`，用 Node `https`/`http` 流式下载即可

## 与 bridge 的交互

- 使用宿主已有能力：`ipcRenderer.send('closeWin')`（取消/隐藏）、`@electron/remote` 调当前 BrowserWindow 改尺寸 / `app.quit`
- 不新增 bridge 协议；不调用桌面 `upgrade-version` IPC（下载在行动中心页内完成）

## 代码锚点（行动中心仓库）

- `src/components/layouts/TheLayout.vue`：门闩、`isUpgradeEmpty`、拦截 open-page / closeWin / reload
- `src/components/layouts/PcClientUpgrade.vue`：UI、下载、改窗尺寸、打开安装包
