# 实现笔记：安卓会话页 NPE 崩溃（单聊已读回执）

平台无关的逻辑提炼。本条只涉及 Android，但「三元表达式混用装箱/拆箱类型」的坑对任何 Java/Kotlin 端通用。

## 崩溃现场

```
java.lang.NullPointerException: Attempt to invoke virtual method
  'long java.lang.Long.longValue()' on a null object reference
    at com.im.dialogue.ConversationFragment$8.onSuccess(ConversationFragment.java:1009)
```

版本 v3.6.22 / versionCode 299，华为 VOG-AL00 (Android 10)。`$8` 是 `initPrivateTime()`
里 `getReadMsg` 的匿名 `DefaultSubscriber`，回调跑在主线程（`HandlerScheduler`），所以直接闪退。

## 根因

```java
// 崩溃写法
readTime = privateReadTimeSet == null ? 0L : privateReadTimeSet.higher(uiMessage.getSentTime());
```

Java 条件运算符两支类型分别是 `long`（字面量 `0L`）和 `Long`（`TreeSet.higher()` 返回值），
按二元数值提升规则整个表达式被判定为 **`long`**，于是 `Long` 那支被强制 `.longValue()` 拆箱。

`TreeSet.higher(x)` 在集合里**没有严格大于 x 的元素**时返回 `null` → 拆箱 NPE。

## 触发条件

单聊会话，自己发的消息处于可见区且在 `limitTime` 窗口内，而已读时间集合里没有比这条消息
`sentTime` 更晚的时间戳——即**对方还没读**（或该会话尚无已读记录）。这是常态而非边缘情况，
所以「刚发完消息、对方没读时进会话 / 收到对方消息触发已读回执」都能复现。

## 修法

```java
readTime = privateReadTimeSet == null ? null : privateReadTimeSet.higher(uiMessage.getSentTime());
```

两支都是 `Long`，不发生提升，不拆箱。语义等价：下游判断统一是
`readTime != null && readTime != 0`，null 与 0L 落同一分支（显示「已读」但不带时间）。

改动三处，都在 `ConversationFragment.java`：

| 位置 | 场景 |
|------|------|
| `initPrivateTime()` 内 `getReadMsg` 回调 | 进会话拉已读时间后刷新可见区 |
| `ReadReceiptEvent` — `isFromGlobalSearch` 分支 | 全局搜索进会话后收到已读回执 |
| `ReadReceiptEvent` — 常规分支 | 常规已读回执 |

`MessageListAdapter.java:2007` 是同名调用但**安全**——结果直接赋给 `Long` 变量，无三元提升。

## 复查要点（同类坑）

三元表达式里只要一支是基本类型字面量、另一支是可能为 null 的包装类型，就必崩。
排查时 grep 形如 `? 0L :` / `? 0 :` / `? false :` 且另一支是 `Map.get` / `TreeSet.higher` /
`lower` / `ceiling` / `floor` 等允许返回 null 的 API。
