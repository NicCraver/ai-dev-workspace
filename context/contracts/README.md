# contracts/ —— 接口契约（唯一事实来源）

规则：

1. 每个业务域一个 `.d.ts` 文件（TypeScript 类型 + 注释描述语义），文件头维护 Changelog。
2. mock 先行阶段：四端的 mock 数据必须能通过这里的类型检查（web 直接引用类型；android/ios 按字段一一对应）。
3. 接口到位/变更：**先改契约、记 Changelog，再改代码**（用 /sync-contract 走流程）。
4. 联调发现实际行为与契约不符：以实际为准更新契约，并在活跃功能 impl-notes.md 的「联调坑」补一条。
5. 通用约定（分页结构、错误码、时间格式）写在 `_common.d.ts`，各域文件不要重复定义。

参考 `_example.d.ts` 的写法。
