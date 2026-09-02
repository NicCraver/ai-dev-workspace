# 自己发言退回线上色，仅 ActionCard 留浅底加描边

**Goal:** 自己看自己发的普通消息，气泡回到线上色；只有右侧 ActionCard（转发 AI 回复、定时用我身份）继续用浅底卡片，并加 `#F4F6F8` 描边。

**分流:** 自己发 + ActionCard。不要用 `fixTaskMessage`（逐条转发会抹掉）。

**不做阴影。** 对齐 web `BaseMsgCard.vue` AI 回复白卡：`border border-[#f4f6f8]`，即 `1px solid #F4F6F8`。

详见 Cursor plan「卡片配色分流阴影」。
