# DataRangeBar 类型弹窗边距与加宽 Implementation Plan

> **For agentic workers:** 可按任务逐步执行；步骤用 checkbox 跟踪。

**Goal:** 类型弹层相对视口左缘留约 12px，宽度改为 240，且不影响其他弹层与勾选逻辑。

**Architecture:** 仅改 `DataRangeBar.vue` 的 `el-popover` 属性：`:width="240"` + `:popper-options` 覆盖 `preventOverflow.padding`。

**Tech Stack:** Vue 3、Element Plus 2.x（`@popperjs/core`）

## Global Constraints

- 只改「点击类型」弹窗（`DataRangeBar.vue`），不动 TimeSelector / DataScopeBar 等。
- 视口边距约 12px；宽度 240。
- 不引入新依赖、不改接口。

---

## 文件映射

| 文件 | 职责 |
|------|------|
| `apps/web/src/components/views/home/commons/DataRangeBar.vue` | 类型胶囊 + el-popover |

### Task 1: 调整类型弹层宽度与视口边距（web）

**Files:**
- Modify: `apps/web/src/components/views/home/commons/DataRangeBar.vue`

**Interfaces:**
- Consumes: 现有 `el-popover` props（`visible` / `trigger` / `placement` / `popper-class`）
- Produces: 同组件对外 `update` 事件与 props 不变

- [x] **Step 1: 修改 el-popover 属性**

将模板中：

```vue
  <el-popover
    v-model:visible="visible"
    trigger="click"
    placement="top"
    :width="200"
    popper-class="!p-2 !rounded-2"
    @click.stop
  >
```

改为：

```vue
  <el-popover
    v-model:visible="visible"
    trigger="click"
    placement="top"
    :width="240"
    :popper-options="{
      modifiers: [
        {
          name: 'preventOverflow',
          options: { padding: 12 }
        }
      ]
    }"
    popper-class="!p-2 !rounded-2"
    @click.stop
  >
```

说明：EP 默认 `preventOverflow.padding` 为 `{ top:0, bottom:0, left:0, right:0 }`，导致可贴视口左缘；追加同名 modifier 后由 Popper merge，四边 padding 变为 12。

- [ ] **Step 2: 自测**（待本地打开页面确认）

1. 打开个人 AI 框 / 首页带 FilterBar 的会话，点击「类型」。
2. 确认弹层左缘与页面左缘有约 12px 空隙。
3. 确认弹层比改前略宽（240）。
4. 全选、单选、清空（关闭图标）行为正常。

- [x] **Step 3: 更新 status 矩阵（web 页面开发 / 自测）**

## 接口联调

- [x] 不适用（无接口）

## Android / iOS / Desktop 移植

- [x] 不适用（WebView / 内嵌 Web 复用本改动）
