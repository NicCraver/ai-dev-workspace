# Spec：选择数据范围 · 群拼图无头像用名字末字

> 由 Superpowers brainstorm 产出。最后更新：2026-08-03  
> 视觉说明：同目录 `avatar-fallback-mock.html`

## 背景与目标

「选择数据范围」弹窗/页中，群聊行头像取自 `groupInfo.accountInfoList` 前 4 人拼图。当前：

| 端 | 现状 |
|----|------|
| desktop | 只渲染 URL；空 `avatar` 退默认人像图，不用名字 |
| android | 远程拼图会跳过空 URL / 用默认图，未用 `accountInfoList.nickName` 末字兜底 |
| web | `AcGroupAvatar` → `AcAvatar` 已支持无头像显示 `nickName` 末字（本期不改） |
| ios | 本期不改 |

**目标**：Desktop + Android 在群拼图格子上，成员 `avatar` 为空时显示该成员 `nickName` 的最后一个字。

**成功标准**：

1. 主列表 / 搜索结果 / 底栏已选 chip 中，凡走 `accountInfoList` 拼图的地方，空头像格显示末字（有 `nickName` 时）。
2. 无 `avatar` 且无 `nickName` 时仍退默认人像，不裂图。
3. 1～4 人布局与现网一致（含 3 人缺右下）；**空位底色不动**（Desktop/Android 继续 `#f3f3f3`）。
4. 私聊行人头像、Web、iOS、接口契约均无回归改动。

## 用户流程

1. 用户打开「选择数据范围」（Desktop 弹窗 / Android 全屏页）。
2. 候选来自既有 `getAllImDialogue` 归一化；群项携带前 4 人 `{ id, nickName, avatar }`。
3. 用户在「全部 / 群组」列表、搜索结果、底栏已选 chip 看到群拼图：
   - 有头像 URL → 显示图片；
   - 无头像、有名字 → 该格显示名字末字；
   - 都无 → 默认人像。
4. 勾选/取消/保存行为不变；仅展示层变化。

## 显示规则（两端统一）

1. 仍取 `groupInfo.accountInfoList` **前 4 人**，顺序与契约一致。
2. 单格优先级：
   1. `avatar` 非空（trim 后）→ 网络/本地图；
   2. 否则 `nickName` 非空（trim 后）→ **末字** = `nickName.trim()` 最后一个字符（对齐 Web `slice(-1)`）；
   3. 否则 → 默认人像图。
3. 「无头像」= `avatar` 缺省 / 空串 / 仅空白。
4. **不跳过**无 avatar 的成员：拼图格数按成员数 1～4，避免布局塌缩。
5. 名字来源：**只用**接口 `accountInfoList[].nickName`；不查本地通讯录补名。
6. 人数布局（不改）：1 人铺满；2 人按各端现网；3 人缺右下；4 人满铺。空位底色本期不动。

## 范围

**本期做**：

- Desktop：`data-scope-model` 归一化保留 `groupMembers`（含 nickName）；列表项 / 搜索 / 底栏 chip 共用「图或末字」格子渲染。
- Android：`DataScopeModel` 归一化带成员 nickName；`DataRangeAvatarHelper` 拼图保留空 avatar 格位，空格用既有 `ImageUtils.createNameImage`；列表 / 搜索 / 底栏共用。

**本期不做**：

- Web / iOS
- 私聊行（`privateInfo.avatar`）末字兜底
- 改接口契约或后端补头像
- 对齐四端缺右下空位底色（`#f3f3f3` vs 白 vs 透明）
- 改全选 / 保存 / 搜索过滤等业务逻辑

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本期是否改 | —（已具备末字） | ✅ 改 | — | ✅ 改 |
| 末字绘制 | `AcAvatar` 色块字 | `ImageUtils.createNameImage` | — | 字头像 UI（对齐现有字头像样式习惯） |
| 拼图空位底色 | 透出父级（不动） | `#f3f3f3`（不动） | 白底（不动） | `#f3f3f3`（不动） |

## 数据模型

归一化群项增加（或等价保留）：

```text
groupMembers: Array<{ id?: string, nickName?: string, avatar?: string }>  // 最多 4
```

- 可由 `groupMembers` 派生旧字段 `groupAvatars: string[]` 以兼容过渡。
- **渲染以 `groupMembers` 为准**，避免只存 URL 导致无名字可兜底。

## 依赖的接口

- 既有：`context/contracts/personalAiFrame/getAllImDialogue.d.ts`（`groupInfo.accountInfoList` 含 `id` / `nickName` / `avatar`）
- 不新增接口；不改契约字段

## 验收清单

- [ ] Desktop：列表群行，成员无 avatar 有 nickName → 末字
- [ ] Desktop：搜索结果、底栏 chip 同上
- [ ] Android：同上三处
- [ ] 无 nickName → 默认人像，不裂图
- [ ] 3 人仍缺右下；空位仍为 `#f3f3f3`（Desktop/Android）
- [ ] 有 avatar 的格子行为与改前一致
- [ ] Web / iOS / 私聊行无改动

## 待用户确认的问题

（无；已确认：范围 = Desktop+Android；名字 = 仅 nickName；覆盖 = 列表+搜索+chip；方案 2 成员对象渲染；空位底色不动）
