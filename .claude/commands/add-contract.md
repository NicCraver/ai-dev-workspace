---
description: 把后端接口文档落成 context/contracts 下的契约文件（一接口一文件）
argument-hint: <接口路径或名称，如 /corpPlateAccountRel/weekWorkDataRangeTree>；文档正文可直接粘在后面
---

新增接口契约任务。用户输入：$ARGUMENTS

面向**新接口**。若该接口的契约文件已存在，不要新建，改走 `/sync-contract`（更新 + 影响面分析）。

## 1. 收齐信息

需要：HTTP 方法 + 完整路径、用途一句话、入参字段表、回参字段表（含嵌套结构）、枚举取值范围、分页与时间格式。
来源可以是用户粘贴的接口文档 / 抓包 JSON / 后端口述 / swagger 片段。

缺哪块就问哪块，**不要靠猜补字段**。只有部分字段确认时，照常写文件，未确认的用 `@unconfirmed` 标注，别卡住。

## 2. 定域与文件名

先读 `context/contracts/README.md` 的目录树，判断归属：

- 落到既有域文件夹（如 `personalAiFrame/`），还是新建域。**新建域要先跟用户确认域名**。
- 文件名取接口动作名（camelCase，如 `weekWorkDataRangeTree.d.ts`）。路径前缀与域不一致时（跨路径子域）按业务归属放，文件名可加前缀区分（参考 `quickReplyList.d.ts`）。
- 存在同名文件 → 停下，转 `/sync-contract`。

## 3. 写契约文件

`context/contracts/<域>/<接口>.d.ts`，照 README「写法约定」：

```ts
/**
 * 契约：<域中文名> · <接口用途>
 * <METHOD> <完整路径>
 * Changelog:
 * - <YYYY-MM-DD> 新增。<非显然的行为要点：序列化怪癖 / 前端需自行拼接的节点 / 字段语义陷阱>
 */

import type { ApiResponse } from '../_common';

/** <METHOD> <路径> 入参 */
export interface <域大驼峰><接口大驼峰>Req { /* … */ }

/** <METHOD> <路径> 回参 data */
export interface <域大驼峰><接口大驼峰>Data { /* … */ }

/** <METHOD> <路径> 完整回参 */
export type <域大驼峰><接口大驼峰>Resp = ApiResponse<<域大驼峰><接口大驼峰>Data>;
```

硬性要求：

- 外层包裹一律 `import type { ApiResponse } from '../_common'`，**不要重复定义** code/msg/data。
- 每个字段一条中文注释，写语义不写字段名翻译。
- 有 mock 值的标 `mock: <值>`（`mock: '280'` / `mock: 0`）。
- 枚举写全取值：`0-全部；1-…`；时间写格式：`yyyy-MM-dd HH:mm:ss`。
- 后端未确认的字段/行为标 `@unconfirmed`。
- 后端返回可选的字段用 `?`，必返的不加。
- 域内 2+ 接口共用的类型放 `<域>/_shared.d.ts`，不要在两个接口文件里各写一份。

## 4. 更新 README 目录树

在 `context/contracts/README.md` 的树里加一行：`│  ├─ <文件名>  # <METHOD> <路径>`。新建域时同时加域文件夹一行。

## 5. 挂回活跃功能

若该接口属于某个活跃功能：

- 在该功能 `status.md`「待办 / 阻塞」补一条：哪些端需要按新契约接/改调用（页面先行阶段则写「mock 按契约构造」）。
- 平台矩阵里若已有对应行，更新状态。

## 6. 收尾

走 wrapup：`docs(<feature>): 新增契约 <接口>`。

原则：**先有契约再有代码**。四端 mock 与联调都以这个文件为准。
