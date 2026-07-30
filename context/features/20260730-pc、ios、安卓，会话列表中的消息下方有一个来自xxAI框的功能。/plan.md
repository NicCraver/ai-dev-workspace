# 定时任务消息 · 气泡下来源 badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅当 `content.extra.fixTaskMessage === 1` 时，在气泡下显示来源 badge：个人 AI 为「来自{nick}个人AI框」，群 AI 为「来自群AI框」；昵称旁 tag 不动。

**Architecture:** 各端在现有个人 AI 来源 badge 挂载点上收紧显隐，并扩展群 AI 文案。抽出 `isFixTaskMessage`（严格数字 `1`）与 `getAiSourceBadgeKind`（`personal` / `group` / 空）；个人仍走查人，群固定文案不查人。不改 identity tag。

**Tech Stack:** desktop Vue2；Android Java（`PersonalAiMsgHelper` / `PersonalAiSourceBadgeBinder`）；iOS ObjC（`ZXIMCellLogic` / `ZXIMChatCell`）。

**Spec:** `context/features/20260730-pc、ios、安卓，会话列表中的消息下方有一个来自xxAI框的功能。/spec.md`  
**UI:** 同目录 `ui-mock.html`

## Global Constraints

- 只改气泡下 **badge**，禁止改昵称旁「个人AI框 / 群AI框」tag
- `fixTaskMessage` 判真：**仅** `=== 1`（数字）；`"1"` / `0` / `null` / 缺省 → 不显示 badge
- 个人文案：`来自` + 归属人昵称 + `个人AI框`（查用户缓存，不用 `content.user.name`）
- 群文案：固定 `来自群AI框`
- 布局：气泡 → 表情 →「N条回复」→ badge（沿用现有挂载点，禁止上移）
- 端：desktop + android + ios；**不做 web**
- 分支：只在 `personal-ai-chat` 上改与 push

---

### Task 1: (desktop) fixTask 门闩 + 群 AI badge

**Files:**
- Modify: `apps/desktop/src/renderer/components/common/MsgPersonalAiRow.vue`
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue`（模板挂载点约 526–536；methods 中 `parseMsgExtra` / `getPersonalAccountId` / `isPersonalAiMsg` 活跃定义处）

**Interfaces:**
- Produces:
  - `isFixTaskMessage(msg) → boolean`（`extra.fixTaskMessage === 1`）
  - `isGroupAiMsg(msg) → boolean`（`senderUserId` 以 `ga_` 开头且非个人 AI）
  - `getAiSourceBadgeVariant(msg) → 'personal' | 'group' | null`
- Consumes: 现有 `parseMsgExtra` / `getPersonalAccountId` / `isPersonalAiMsg`

- [ ] **Step 1: 扩展 `MsgPersonalAiRow` 支持群固定文案**

```vue
<template>
  <div
    v-if="visible"
    class="msg-personal-ai-row flex items-center text-gray-medium truncate whitespace-nowrap"
  >
    <span class="flex items-center px-2 h-5 text-xs bg-#EBEFF2 rounded-full">
      {{ label }}
    </span>
  </div>
</template>

<script>
import { mapGetters } from "vuex";

export default {
  name: "MsgPersonalAiRow",
  props: {
    accountId: String,
    /** 'personal' | 'group' */
    variant: {
      type: String,
      default: "personal",
    },
  },
  data() {
    return { fetchedIds: {} };
  },
  computed: {
    ...mapGetters({ AllUserMap: "GetAllUserMap" }),
    userInfo() {
      if (!this.accountId) return null;
      return this.AllUserMap[this.accountId] || null;
    },
    nickName() {
      if (!this.userInfo) return "";
      return this.userInfo.name || this.userInfo.nickName || "";
    },
    label() {
      if (this.variant === "group") return "来自群AI框";
      return "来自" + this.nickName + "个人AI框";
    },
    visible() {
      if (this.variant === "group") return true;
      return !!(this.accountId && this.nickName);
    },
  },
  watch: {
    accountId: {
      immediate: true,
      handler() {
        if (this.variant === "group") return;
        this.ensureUserInfo();
      },
    },
  },
  methods: {
    ensureUserInfo() {
      if (!this.accountId) return;
      if (this.userInfo || this.fetchedIds[this.accountId]) return;
      this.fetchedIds[this.accountId] = true;
      this.$service &&
        this.$service.getAccountInformationOrganization &&
        this.$service.getAccountInformationOrganization
          .call(this, { id: this.accountId })
          .catch(() => {});
    },
  },
};
</script>
```

- [ ] **Step 2: 在 `msg-list.vue` methods 增加门闩与 variant（与现有 `parseMsgExtra` 同块，避免重复定义被覆盖）**

```js
isFixTaskMessage: function (msg) {
  var extra = this.parseMsgExtra(msg);
  return !!(extra && extra.fixTaskMessage === 1);
},
isGroupAiMsg: function (msg) {
  var sid = msg && msg.senderUserId;
  if (!sid || typeof sid !== "string" || !sid.startsWith("ga_")) return false;
  return !this.isPersonalAiMsg(msg);
},
getAiSourceBadgeVariant: function (msg) {
  if (!msg || msg.messageState === MessageModel.MessageState.RECALL) return null;
  if (!this.isFixTaskMessage(msg)) return null;
  if (this.isPersonalAiMsg(msg)) return "personal";
  if (this.isGroupAiMsg(msg)) return "group";
  return null;
},
```

- [ ] **Step 3: 改模板挂载点（保持位置：expansion 下、已读上）**

把：

```vue
<div
  v-if="
    item.messageState !== MessageModel.MessageState.RECALL &&
    getPersonalAccountId(item)
  "
  class="flex mt-2.5"
  :class="{ 'justify-end': item.bySelf }"
>
  <MsgPersonalAiRow :accountId="getPersonalAccountId(item)" />
</div>
```

改为：

```vue
<div
  v-if="getAiSourceBadgeVariant(item)"
  class="flex mt-2.5"
  :class="{ 'justify-end': item.bySelf }"
>
  <MsgPersonalAiRow
    :variant="getAiSourceBadgeVariant(item)"
    :accountId="getPersonalAccountId(item)"
  />
</div>
```

- [ ] **Step 4: 手测（PC）**

| 用例 | 期望 |
|------|------|
| 个人 AI + `fixTaskMessage: 1` | 有「个人AI框」tag + badge「来自{nick}个人AI框」 |
| 个人 AI + `0` / 缺省 / `"1"` | 有 tag、**无** badge |
| 群 AI（`ga_`）+ `1` | 有「群AI框」tag + badge「来自群AI框」 |
| 群 AI + 非 1 | 有 tag、无 badge |
| 撤回 | 无 badge |

- [ ] **Step 5: Commit（desktop 仓库，分支 `personal-ai-chat`）**

```bash
cd apps/desktop
git add src/renderer/components/common/MsgPersonalAiRow.vue \
  src/renderer/components/chitchat/message/msg-list.vue
git commit -m "$(cat <<'EOF'
feat(消息): 来源 badge 仅定时任务显示，支持群AI框

EOF
)"
```

---

### Task 2: (android) Helper 门闩 + Binder 群文案

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/dialogue/personal_ai_at/PersonalAiMsgHelper.java`
- Modify: `apps/android/IM/src/main/java/com/im/dialogue/personal_ai_at/PersonalAiSourceBadgeBinder.java`
- 挂钩已有：`MessageListAdapter` 调 `PersonalAiSourceBadgeBinder.bind`（约 1159）——若 Binder API 不变则可不改 Adapter
- 参考：`Constants.AGENT_TYPE`（群/个人 AI sender 前缀，同 tag 逻辑）

**Interfaces:**
- Produces:
  - `PersonalAiMsgHelper.isFixTaskMessage(UIMessage|MessageContent) → boolean`
  - `PersonalAiMsgHelper.isGroupAiMsg(UIMessage) → boolean`
  - `PersonalAiMsgHelper.getSourceBadgeText(UIMessage) → String`（空串=不显示）
- Binder 改为：有文案则 `setText`+显示，否则 `hide`（个人查人逻辑保留）

- [ ] **Step 1: 在 `PersonalAiMsgHelper` 增加判据**

```java
/** 仅数字 1；字符串 "1" / 缺省 / 0 → false */
public static boolean isFixTaskMessage(JSONObject extra) {
    if (extra == null || !extra.has("fixTaskMessage")) {
        return false;
    }
    Object raw = extra.opt("fixTaskMessage");
    if (!(raw instanceof Number)) {
        return false;
    }
    // 排除 1.5 等：必须是整型语义的 1
    return ((Number) raw).intValue() == 1
            && ((Number) raw).doubleValue() == 1.0d;
}

public static boolean isFixTaskMessage(MessageContent content) {
    return isFixTaskMessage(parseMsgExtra(content));
}

public static boolean isFixTaskMessage(UIMessage uiMessage) {
    if (uiMessage == null || uiMessage.getMessage() == null) {
        return false;
    }
    return isFixTaskMessage(uiMessage.getMessage().getContent());
}

/** sender 为 AGENT_TYPE 前缀且非个人 AI → 群 AI */
public static boolean isGroupAiMsg(UIMessage uiMessage) {
    if (uiMessage == null) {
        return false;
    }
    String senderId = uiMessage.getSenderUserId();
    if (StringUtils.isEmptyString(senderId)
            || !senderId.startsWith(Constants.AGENT_TYPE)) {
        return false;
    }
    return !isPersonalAiMsg(uiMessage);
}
```

（`Constants` 按文件现有 import 路径补上；与 `MessageListAdapter.setAgentRobotTag` 一致。）

- [ ] **Step 2: 改 `PersonalAiSourceBadgeBinder.bind`**

核心逻辑替换为：

```java
public static void bind(TextView tv, UIMessage data, boolean alignEnd) {
    if (tv == null) {
        return;
    }
    if (data == null
            || data.getContent() instanceof RecallNotificationMessage
            || !PersonalAiMsgHelper.isFixTaskMessage(data)) {
        hide(tv);
        return;
    }
    if (PersonalAiMsgHelper.isPersonalAiMsg(data)) {
        String accountId = PersonalAiMsgHelper.getPersonalAccountId(data);
        String name = resolveDisplayName(accountId);
        if (StringUtils.isEmptyString(name)) {
            hide(tv);
            return;
        }
        show(tv, "来自" + name + "个人AI框", alignEnd);
        return;
    }
    if (PersonalAiMsgHelper.isGroupAiMsg(data)) {
        show(tv, "来自群AI框", alignEnd);
        return;
    }
    hide(tv);
}

private static void show(TextView tv, String text, boolean alignEnd) {
    tv.setText(text);
    tv.setVisibility(View.VISIBLE);
    // 保留现有 RelativeLayout ALIGN_END/START 对齐逻辑（从原 bind 抽出）
    ...
}
```

**禁止**改 `setAgentRobotTag`（tag 不动）。

- [ ] **Step 3: 真机/模拟自测**

同 Task 1 用例表；确认「N条回复」下方、`tv_personal_ai_source` 仍在原 layout 位置。

- [ ] **Step 4: Commit（android 仓库，`personal-ai-chat`）**

```bash
cd apps/android
git add IM/src/main/java/com/im/dialogue/personal_ai_at/PersonalAiMsgHelper.java \
  IM/src/main/java/com/im/dialogue/personal_ai_at/PersonalAiSourceBadgeBinder.java
git commit -m "$(cat <<'EOF'
feat(消息): 来源 badge 仅定时任务显示，支持群AI框

EOF
)"
```

---

### Task 3: (ios) `ZXIMCellLogic` badge 文案门闩 + 群文案

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Logic/ZXIMCellLogic.h`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Logic/ZXIMCellLogic.m`（`personalAiSourceBadgeTextForMessage:` 约 1242）
- Cell 已调 `personalAiSourceBadgeTextForMessage` / `Height`——文案空则自动不占高，一般不用改 `ZXIMChatCell.m`
- **禁止**改 `agentSenderTagTextForMessage:`（tag）

**Interfaces:**
- Produces: `personalAiSourceBadgeTextForMessage:` 在 fixTask 下返回个人或「来自群AI框」；非 fixTask 返回 `@""`
- 可新增：`+ (BOOL)isFixTaskMessage:(ZXRCMessageModel *)messageModel;`

- [ ] **Step 1: Header 声明（可选公开）**

```objc
/// extra.fixTaskMessage 是否为数字 1
+ (BOOL)isFixTaskMessageForMessage:(ZXRCMessageModel *)messageModel;
```

- [ ] **Step 2: 实现门闩 + 改 badge 文案**

```objc
+ (BOOL)isFixTaskMessageForMessage:(ZXRCMessageModel *)messageModel {
    NSDictionary *extra = [self parseMsgExtraDictionary:messageModel];
    if (!extra) {
        return NO;
    }
    id value = extra[@"fixTaskMessage"];
    if (![value isKindOfClass:[NSNumber class]]) {
        return NO;
    }
    return [value integerValue] == 1 && fabs([value doubleValue] - 1.0) < 0.0001;
}

+ (NSString *)personalAiSourceBadgeTextForMessage:(ZXRCMessageModel *)messageModel {
    if (!messageModel || messageModel.messageType == ZXMessageTypeRecall) {
        return @"";
    }
    if (![self isFixTaskMessageForMessage:messageModel]) {
        return @"";
    }
    NSString *pid = [self personalAccountIdForMessage:messageModel];
    if (pid.length) {
        NSString *name = [self personalAiOwnerDisplayNameForAccountId:pid];
        if (!name.length) {
            return @"";
        }
        return [NSString stringWithFormat:@"来自%@个人AI框", name];
    }
    NSString *senderUserId = messageModel.sendUserInfoId.length
        ? messageModel.sendUserInfoId
        : messageModel.senderUserId;
    if ([senderUserId hasPrefix:ZXAgentFlag]) {
        return @"来自群AI框";
    }
    return @"";
}
```

`personalAiSourceBadgeHeightForMessage:` 仍依赖文案长度，无需改。

- [ ] **Step 3: 真机自测**

同 Task 1 用例；确认 tag 仍按原逻辑出现。

- [ ] **Step 4: Commit（ios 仓库，`personal-ai-chat`）**

```bash
cd apps/ios
git add SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Logic/ZXIMCellLogic.h \
  SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Logic/ZXIMCellLogic.m
git commit -m "$(cat <<'EOF'
feat(消息): 来源 badge 仅定时任务显示，支持群AI框

EOF
)"
```

---

### Task 4: (多端) 文档收尾

**Files:**
- Modify: `context/features/20260730-pc、ios、安卓，会话列表中的消息下方有一个来自xxAI框的功能。/status.md`
- Modify: `context/features/20260730-pc、ios、安卓，会话列表中的消息下方有一个来自xxAI框的功能。/impl-notes.md`（平台无关判定与显隐矩阵）
- 可选：在既有个人 AI / 消息相关契约注释中补 `fixTaskMessage`（无独立契约文件则可只写 impl-notes）

- [ ] **Step 1: 写 impl-notes（平台无关）**

必须覆盖：`fixTaskMessage` 严格 `=== 1`；个人/群判据；文案；与 tag 无关；布局顺序；extra 可能是 JSON 字符串。

- [ ] **Step 2: 更新 status 矩阵**（代码合入标 🚧，真机通过标 ✅）

- [ ] **Step 3: context 仓库 commit**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260730-pc、ios、安卓，会话列表中的消息下方有一个来自xxAI框的功能。/
git commit -m "$(cat <<'EOF'
docs(定时任务来源badge): 同步实现进展与 impl-notes

EOF
)"
```

---

## Spec coverage（自检）

| Spec 要求 | Task |
|-----------|------|
| 个人 badge + fixTask 门闩 | 1 / 2 / 3 |
| 群 badge「来自群AI框」 | 1 / 2 / 3 |
| 不改 tag | Global + 各 Task 禁止项 |
| 严格数字 1 | Global + 各 Helper |
| 布局在 N条回复下 | 沿用挂载点，不挪 |
| desktop / ios / android | Task 1–3 |
| 不做 web | Global |

## Placeholder scan

无 TBD / 「类似 Task N」占位。
