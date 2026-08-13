# iOS 机器人/智能体消息 GFM Markdown 渲染优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 cmark-gfm 替换 iOS 端手写正则 Markdown 渲染，让机器人与智能体消息按 GFM 规范正确渲染，重点修复多级列表与表格。

**Architecture:** 解析与渲染分离。cmark-gfm 出 AST → 压成块序列（富文本块 / 表格块）→ `ZXMarkdownContentView` 段栈纵向排布（富文本块用 `UITextView`，表格块用可横滚的 `ZXMarkdownTableView`）。`ZXMarkdownManager` 对外 API 保持不变，内部换实现，三重兜底可随时退回老正则。

**Tech Stack:** Objective-C + UIKit + Masonry + CocoaPods（`libcmark_gfm ~> 0.29.4`）。仓库无单测、无 lint，验证靠人工 Xcode 构建 + Debug 自测页逐条对照。

> 全部任务只涉及 **ios** 端。web / android / desktop 本功能不动。

## Global Constraints

- 语言：**纯 Objective-C**，不引入 Swift。类/常量统一 `ZX` 前缀。注释用中文。
- 新代码集中在 `apps/ios/SmartMessage/ZX_Base/ZX_Manager/Markdown/`（功能内聚，见上级 CLAUDE.md）。
- 正确性基准：<https://github.github.com/gfm/>，不追像素级对齐 android/web。
- 依赖：`pod 'libcmark_gfm', '~> 0.29.4'`；**只有 `ZXMarkdownParser.m` 可以 `#import` cmark 头文件**，其他文件一律不许。
- **AI 不执行 `pod install` / `xcodebuild` / `xcrun simctl`**（apps/ios/CLAUDE.md 硬规定）。所有构建与真机自测由人工完成，计划中标 🧑 的步骤是交给人的。
- `ZXMarkdownManager` 现有公开方法签名一个不删、不改语义。
- 最低支持 iOS 13.0。
- 兜底开关 `ZXMarkdownUseCMark` 默认 `YES`；超过 20000 字符或解析异常回退老正则实现。
- 提交粒度：每个任务结束提交一次，信息格式 `feat(markdown): …` / `fix(markdown): …`。
- 禁止提交 `docs/local-dev-patch.md` 相关的本地 patch 改动。

---

## Task 0: 先落袋现有未提交改动（ios）

工作区 `apps/ios` 有 505 行未提交改动（`ZXMarkdownManager.m` +460、`ZXGroupRobotCell.m` +64），内容是**内联 HTML 渲染**（`processHTMLTags` + CSS 颜色解析 + HTML 实体解码，对齐安卓 Markwon HtmlPlugin）。本计划的 Task 4/5 要复用它。先单独提交，避免和本次改造混在一个 diff 里没法回滚。

**Files:**
- Commit: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/ZXMarkdownManager.m`
- Commit: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXGroupRobotCell.m`

- [ ] **Step 1: 确认改动范围只有这两个文件**

```bash
cd apps/ios && git status --short
```

Expected: 只有上面两个 `M`，没有别的。若有别的文件（尤其 `Podfile`、`docs/local-dev-patch.md` 相关），停下来问用户。

- [ ] **Step 2: 🧑 人工构建自测一次**

Xcode 打开 `zhixinApp.xcworkspace`，scheme `zhixinAppTest`，iPhone 15 / iOS 17 模拟器，clean build，发一条含 `<span style="color:red">红字</span>` 的机器人消息确认着色生效。

- [ ] **Step 3: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/ZXMarkdownManager.m \
        SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXGroupRobotCell.m
git commit -m "feat(markdown): 内联 HTML 渲染（span 着色/b/i/u/br/p + CSS 颜色 + 实体解码），对齐安卓 Markwon"
```

---

## Task 1: 摸清四个接入点的真实链路（ios · 调查任务）

spec 里「合并转发详情页是否复用会话页 cell」没验证。这个结论决定 Task 10-13 的工作量，必须先查清。

**Files:**
- Read only（不改代码）
- Write: `context/features/20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化/impl-notes.md`

- [ ] **Step 1: 查合并转发详情页链路**

```bash
cd apps/ios
grep -rn "ZXCombineMessageLogic\|combineMessage" --include="*.m" SmartMessage | grep -i "controller\|cell" | head -20
```

要回答三个问题：详情页是哪个 Controller；它用的 cell 是不是 `ZXGroupRobotCell` / `ZXIMAgentStreamReplyCell`；如果不是，它的正文渲染调的是哪个方法。

- [ ] **Step 2: 查聚合弹窗链路**

```bash
cd apps/ios
sed -n '520,600p' SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_ReplyPolymer/ZXPolymerPopView.m
```

确认它渲染智能体正文时调的是 `ZXIMCellLogic` 的哪个方法，正文承载控件是 `UITextView` 还是 `UILabel`（`UILabel` 不能挂 attachment 点击，接入方式不同）。

- [ ] **Step 3: 记录到 impl-notes**

在 `impl-notes.md` 新建「接入点链路」小节，四个接入点各一行：入口 Controller/View、承载控件类型、渲染调用的方法名与行号、是否复用会话页 cell。

- [ ] **Step 4: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化/impl-notes.md
git commit -m "docs(20260813-ios-GFM-Markdown渲染优化): 记录四个接入点的渲染链路"
```

---

## Task 2: 引入 libcmark_gfm 并跑通最小解析（ios）

**Files:**
- Modify: `apps/ios/Podfile`
- Create: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownParser.h`
- Create: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownParser.m`

**Interfaces:**
- Produces: `+ (BOOL)zx_smokeTestGFM;` —— 临时冒烟方法，Task 4 会被正式解析方法取代

- [ ] **Step 1: 改 Podfile**

在 `Podfile` 主 target 的依赖列表里加一行（放在第三方依赖区，紧邻其他工具类库）：

```ruby
  # GFM Markdown 解析（GitHub 官方 cmark-gfm 的 C 实现）
  pod 'libcmark_gfm', '~> 0.29.4'
```

- [ ] **Step 2: 🧑 人工 pod install**

```bash
cd apps/ios && pod install
```

Expected: 输出含 `Installing libcmark_gfm (0.29.4)`。若报找不到 spec，先 `pod repo update` 再试；仍失败则停下来，改走「源码内置」备选（把 <https://github.com/github/cmark-gfm> 的 `src/` + `extensions/` 放进 `SmartMessage/ZX_ThridParty/cmark-gfm/`，其余任务不变）。

- [ ] **Step 3: 确认头文件导入路径**

```bash
cd apps/ios && find Pods/libcmark_gfm -name "cmark-gfm.h" -o -name "cmark-gfm-core-extensions.h" | head
```

把实际路径记下来，下一步的 `#import` 按它写（常见两种：`<cmark-gfm/cmark-gfm.h>` 或 `<libcmark_gfm/cmark-gfm.h>`）。

- [ ] **Step 4: 写解析器骨架 + 冒烟方法**

`ZXMarkdownParser.h`：

```objc
//
//  ZXMarkdownParser.h
//  GFM 解析器：唯一 import cmark-gfm 的文件
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ZXMarkdownParser : NSObject

/// 冒烟测试：解析一段含表格与嵌套列表的 GFM，成功返回 YES（Task 4 后删除）
+ (BOOL)zx_smokeTestGFM;

@end

NS_ASSUME_NONNULL_END
```

`ZXMarkdownParser.m`（`#import` 路径按 Step 3 的实测结果替换）：

```objc
#import "ZXMarkdownParser.h"
#import <cmark-gfm/cmark-gfm.h>
#import <cmark-gfm/cmark-gfm-core-extensions.h>

@implementation ZXMarkdownParser

/// 注册 GFM 扩展，进程内只做一次
+ (void)zx_ensureExtensionsRegistered {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        cmark_gfm_core_extensions_ensure_registered();
    });
}

+ (BOOL)zx_smokeTestGFM {
    [self zx_ensureExtensionsRegistered];
    const char *markdown =
        "| a | b |\n|---|---|\n| 1 | 2 |\n\n- 一级\n  - 二级\n";
    cmark_parser *parser = cmark_parser_new(CMARK_OPT_DEFAULT);
    if (!parser) { return NO; }
    // 挂上 5 个 GFM 扩展
    NSArray<NSString *> *extensionNames = @[@"table", @"strikethrough", @"autolink", @"tasklist", @"tagfilter"];
    for (NSString *name in extensionNames) {
        cmark_syntax_extension *ext = cmark_find_syntax_extension(name.UTF8String);
        if (ext) {
            cmark_parser_attach_syntax_extension(parser, ext);
        } else {
            NSLog(@"[ZXMarkdown] 未找到扩展: %@", name);
        }
    }
    cmark_parser_feed(parser, markdown, strlen(markdown));
    cmark_node *doc = cmark_parser_finish(parser);
    BOOL ok = NO;
    if (doc) {
        // 遍历顶层子节点，确认第一个是 table
        cmark_node *first = cmark_node_first_child(doc);
        const char *typeName = first ? cmark_node_get_type_string(first) : "";
        NSLog(@"[ZXMarkdown] 冒烟首块类型: %s", typeName);
        ok = (strcmp(typeName, "table") == 0);
        cmark_node_free(doc);
    }
    cmark_parser_free(parser);
    return ok;
}

@end
```

- [ ] **Step 5: 挂一个临时调用点**

在 `apps/ios/SmartMessage/ZX_Base/ZX_AppDelegate/AppDelegate+AppTools.m` 的任意启动方法内，`#if DEBUG` 包一行：

```objc
#if DEBUG
    NSLog(@"[ZXMarkdown] 冒烟结果: %@", [ZXMarkdownParser zx_smokeTestGFM] ? @"通过" : @"失败");
#endif
```

（记得 `#import "ZXMarkdownParser.h"`。Task 8 建完自测页后删掉这段。）

- [ ] **Step 6: 🧑 人工构建验证**

Xcode clean build `zhixinAppTest`，跑起来看控制台。
Expected: `[ZXMarkdown] 冒烟首块类型: table` 和 `[ZXMarkdown] 冒烟结果: 通过`。
若打印 `未找到扩展: table`，说明 pod 缺 core-extensions，回 Step 2 改走源码内置。

- [ ] **Step 7: 提交**

```bash
cd apps/ios
git add Podfile Podfile.lock SmartMessage/ZX_Base/ZX_Manager/Markdown/ SmartMessage/ZX_Base/ZX_AppDelegate/AppDelegate+AppTools.m
git commit -m "feat(markdown): 引入 libcmark_gfm 并跑通 GFM 扩展冒烟解析"
```

---

## Task 3: 样式表与块模型（ios）

纯数据/配置，无依赖，先做，后面所有任务都用它。

**Files:**
- Create: `.../Markdown/ZXMarkdownStyle.h` / `.m`
- Create: `.../Markdown/ZXMarkdownBlock.h` / `.m`
- Create: `.../Markdown/ZXMarkdownTableModel.h` / `.m`

**Interfaces:**
- Produces:
  - `ZXMarkdownStyle`：`+ (instancetype)defaultStyleWithBaseAttributes:(NSDictionary *)attrs;`，属性 `baseAttributes` / `headerFontSizes`（6 元素 NSNumber 数组）/ `listIndent`（每级缩进 pt）/ `listMarkers`（3 元素字符串数组）/ `codeBackgroundColor` / `codeFont` / `quoteBarColor` / `quoteIndent` / `tableBorderColor` / `tableHeaderBackgroundColor` / `tableCellPadding` / `tableMaxColumnWidth` / `linkColor` / `paragraphSpacing`
  - `ZXMarkdownBlockType`：`ZXMarkdownBlockTypeRich` / `ZXMarkdownBlockTypeTable`
  - `ZXMarkdownBlock`：`+ richBlockWithAttributedString:` / `+ tableBlockWithModel:`，属性 `type` / `attributedString` / `tableModel`
  - `ZXMarkdownTableModel`：属性 `columnAlignments`（`NSArray<NSNumber *>`，值为 `ZXMarkdownTableAlignment`）/ `headerCells`（`NSArray<NSAttributedString *>`）/ `bodyRows`（`NSArray<NSArray<NSAttributedString *> *>`）/ `columnCount`

- [ ] **Step 1: 写 ZXMarkdownStyle.h**

```objc
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/// Markdown 渲染样式集中定义，调用方可逐项覆盖
@interface ZXMarkdownStyle : NSObject

/// 正文默认属性（字体、颜色、段落样式），由气泡侧传入
@property (nonatomic, copy) NSDictionary<NSAttributedStringKey, id> *baseAttributes;
/// 六级标题字号，默认 @[@22,@20,@18,@16,@15,@14]
@property (nonatomic, copy) NSArray<NSNumber *> *headerFontSizes;
/// 列表每级缩进，默认 18
@property (nonatomic, assign) CGFloat listIndent;
/// 三级无序列表 marker，默认 @[@"•", @"◦", @"▪"]
@property (nonatomic, copy) NSArray<NSString *> *listMarkers;
/// 代码底色，默认 #F5F6F7
@property (nonatomic, strong) UIColor *codeBackgroundColor;
/// 等宽字体，默认 Menlo，字号跟随正文
@property (nonatomic, strong) UIFont *codeFont;
/// 引用块左侧竖条颜色，默认 #C9CDD4
@property (nonatomic, strong) UIColor *quoteBarColor;
/// 引用块缩进，默认 12
@property (nonatomic, assign) CGFloat quoteIndent;
/// 表格边框色，默认 #E5E6EB
@property (nonatomic, strong) UIColor *tableBorderColor;
/// 表头底色，默认 #F7F8FA
@property (nonatomic, strong) UIColor *tableHeaderBackgroundColor;
/// 单元格内边距，默认 8
@property (nonatomic, assign) CGFloat tableCellPadding;
/// 单列最大宽度，超出换行，默认 160
@property (nonatomic, assign) CGFloat tableMaxColumnWidth;
/// 链接色，默认 Color_Main
@property (nonatomic, strong) UIColor *linkColor;
/// 段间距，默认 6
@property (nonatomic, assign) CGFloat paragraphSpacing;

+ (instancetype)defaultStyleWithBaseAttributes:(nullable NSDictionary<NSAttributedStringKey, id> *)attrs;

@end

NS_ASSUME_NONNULL_END
```

- [ ] **Step 2: 写 ZXMarkdownStyle.m**

```objc
#import "ZXMarkdownStyle.h"

@implementation ZXMarkdownStyle

+ (instancetype)defaultStyleWithBaseAttributes:(NSDictionary<NSAttributedStringKey,id> *)attrs {
    ZXMarkdownStyle *style = [[ZXMarkdownStyle alloc] init];
    style.baseAttributes = attrs ?: @{ NSFontAttributeName: [UIFont systemFontOfSize:15],
                                       NSForegroundColorAttributeName: [UIColor blackColor] };
    UIFont *baseFont = style.baseAttributes[NSFontAttributeName];
    CGFloat baseSize = baseFont ? baseFont.pointSize : 15.0;
    style.headerFontSizes = @[@22, @20, @18, @16, @15, @14];
    style.listIndent = 18;
    style.listMarkers = @[@"•", @"◦", @"▪"];
    style.codeBackgroundColor = [UIColor colorWithRed:0xF5/255.0 green:0xF6/255.0 blue:0xF7/255.0 alpha:1];
    style.codeFont = [UIFont fontWithName:@"Menlo" size:baseSize - 1] ?: [UIFont systemFontOfSize:baseSize - 1];
    style.quoteBarColor = [UIColor colorWithRed:0xC9/255.0 green:0xCD/255.0 blue:0xD4/255.0 alpha:1];
    style.quoteIndent = 12;
    style.tableBorderColor = [UIColor colorWithRed:0xE5/255.0 green:0xE6/255.0 blue:0xEB/255.0 alpha:1];
    style.tableHeaderBackgroundColor = [UIColor colorWithRed:0xF7/255.0 green:0xF8/255.0 blue:0xFA/255.0 alpha:1];
    style.tableCellPadding = 8;
    style.tableMaxColumnWidth = 160;
    style.linkColor = [UIColor colorWithRed:0 green:0x6A/255.0 blue:0xFF/255.0 alpha:1];
    style.paragraphSpacing = 6;
    return style;
}

@end
```

- [ ] **Step 3: 写 ZXMarkdownTableModel.h / .m**

```objc
// ZXMarkdownTableModel.h
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, ZXMarkdownTableAlignment) {
    ZXMarkdownTableAlignmentLeft = 0,
    ZXMarkdownTableAlignmentCenter,
    ZXMarkdownTableAlignmentRight,
};

@interface ZXMarkdownTableModel : NSObject

/// 每列对齐方式，元素为 ZXMarkdownTableAlignment 的 NSNumber
@property (nonatomic, copy) NSArray<NSNumber *> *columnAlignments;
/// 表头单元格
@property (nonatomic, copy) NSArray<NSAttributedString *> *headerCells;
/// 数据行，每行元素数已按 columnCount 补齐/截断
@property (nonatomic, copy) NSArray<NSArray<NSAttributedString *> *> *bodyRows;
/// 列数（以表头为准）
@property (nonatomic, readonly) NSInteger columnCount;

@end

NS_ASSUME_NONNULL_END
```

```objc
// ZXMarkdownTableModel.m
#import "ZXMarkdownTableModel.h"

@implementation ZXMarkdownTableModel

- (NSInteger)columnCount {
    return (NSInteger)self.headerCells.count;
}

@end
```

- [ ] **Step 4: 写 ZXMarkdownBlock.h / .m**

```objc
// ZXMarkdownBlock.h
#import <Foundation/Foundation.h>
#import "ZXMarkdownTableModel.h"

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, ZXMarkdownBlockType) {
    ZXMarkdownBlockTypeRich = 0,   ///< 富文本块（段落/标题/列表/引用/代码块等已合并）
    ZXMarkdownBlockTypeTable,      ///< 表格块，走独立子视图
};

@interface ZXMarkdownBlock : NSObject

@property (nonatomic, assign, readonly) ZXMarkdownBlockType type;
@property (nonatomic, strong, readonly, nullable) NSAttributedString *attributedString;
@property (nonatomic, strong, readonly, nullable) ZXMarkdownTableModel *tableModel;

+ (instancetype)richBlockWithAttributedString:(NSAttributedString *)attributedString;
+ (instancetype)tableBlockWithModel:(ZXMarkdownTableModel *)model;

@end

NS_ASSUME_NONNULL_END
```

```objc
// ZXMarkdownBlock.m
#import "ZXMarkdownBlock.h"

@interface ZXMarkdownBlock ()
@property (nonatomic, assign) ZXMarkdownBlockType type;
@property (nonatomic, strong, nullable) NSAttributedString *attributedString;
@property (nonatomic, strong, nullable) ZXMarkdownTableModel *tableModel;
@end

@implementation ZXMarkdownBlock

+ (instancetype)richBlockWithAttributedString:(NSAttributedString *)attributedString {
    ZXMarkdownBlock *block = [[ZXMarkdownBlock alloc] init];
    block.type = ZXMarkdownBlockTypeRich;
    block.attributedString = attributedString;
    return block;
}

+ (instancetype)tableBlockWithModel:(ZXMarkdownTableModel *)model {
    ZXMarkdownBlock *block = [[ZXMarkdownBlock alloc] init];
    block.type = ZXMarkdownBlockTypeTable;
    block.tableModel = model;
    return block;
}

@end
```

- [ ] **Step 5: 🧑 人工构建验证**

Xcode build，Expected: 编译通过，无警告。

- [ ] **Step 6: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/Markdown/
git commit -m "feat(markdown): 新增样式表 ZXMarkdownStyle 与块模型 ZXMarkdownBlock/ZXMarkdownTableModel"
```

---

## Task 4: 富文本构建器 —— 行内与块级渲染（ios）

把 cmark AST 的节点变成 `NSAttributedString`。这是最大的一块，先写不含表格的部分（表格由 Task 6 的视图负责，构建器只管单元格内的行内渲染）。

**Files:**
- Create: `.../Markdown/ZXMarkdownAttributedBuilder.h` / `.m`

**Interfaces:**
- Consumes: `ZXMarkdownStyle`（Task 3）
- Produces:
  - `- (instancetype)initWithStyle:(ZXMarkdownStyle *)style;`
  - `- (NSAttributedString *)inlineAttributedStringForNode:(void *)cmarkNode;` —— 渲染一个节点的所有行内子节点（表格单元格、段落、标题、列表项复用它）；参数用 `void *` 避免头文件泄漏 cmark 类型
  - `- (NSAttributedString *)blockAttributedStringForNode:(void *)cmarkNode listLevel:(NSInteger)level orderedIndex:(NSInteger)index;` —— 渲染一个块级节点（段落/标题/列表/引用/代码块/分割线）

- [ ] **Step 1: 写头文件**

```objc
#import <Foundation/Foundation.h>
#import "ZXMarkdownStyle.h"

NS_ASSUME_NONNULL_BEGIN

/// cmark AST → NSAttributedString。cmark 类型以 void * 传递，不污染头文件
@interface ZXMarkdownAttributedBuilder : NSObject

@property (nonatomic, strong, readonly) ZXMarkdownStyle *style;

- (instancetype)initWithStyle:(ZXMarkdownStyle *)style NS_DESIGNATED_INITIALIZER;
- (instancetype)init NS_UNAVAILABLE;

/// 渲染节点下的行内内容（文本/强调/行内码/链接/删除线/软硬换行/raw inline HTML 原样保留）
- (NSMutableAttributedString *)inlineAttributedStringForNode:(void *)cmarkNode;

/// 渲染块级节点。listLevel 为所在列表层级（0 表示不在列表内），orderedIndex 为有序列表当前序号（无序传 0）
- (NSMutableAttributedString *)blockAttributedStringForNode:(void *)cmarkNode
                                                  listLevel:(NSInteger)listLevel
                                               orderedIndex:(NSInteger)orderedIndex;

@end

NS_ASSUME_NONNULL_END
```

- [ ] **Step 2: 实现行内渲染**

`ZXMarkdownAttributedBuilder.m` 头部与行内部分：

```objc
#import "ZXMarkdownAttributedBuilder.h"
#import <cmark-gfm/cmark-gfm.h>
#import <cmark-gfm/cmark-gfm-core-extensions.h>

@interface ZXMarkdownAttributedBuilder ()
@property (nonatomic, strong) ZXMarkdownStyle *style;
@end

@implementation ZXMarkdownAttributedBuilder

- (instancetype)initWithStyle:(ZXMarkdownStyle *)style {
    self = [super init];
    if (self) {
        _style = style;
    }
    return self;
}

#pragma mark - 行内

- (NSMutableAttributedString *)inlineAttributedStringForNode:(void *)cmarkNode {
    NSMutableAttributedString *result = [[NSMutableAttributedString alloc] init];
    if (!cmarkNode) { return result; }
    cmark_node *node = (cmark_node *)cmarkNode;
    for (cmark_node *child = cmark_node_first_child(node); child != NULL; child = cmark_node_next(child)) {
        [result appendAttributedString:[self zx_inlineForSingleNode:child inheritedTraits:0]];
    }
    return result;
}

/// traits: 位掩码，1=bold 2=italic 4=strike 8=code
- (NSMutableAttributedString *)zx_inlineForSingleNode:(cmark_node *)node inheritedTraits:(NSInteger)traits {
    NSMutableAttributedString *out = [[NSMutableAttributedString alloc] init];
    cmark_node_type type = cmark_node_get_type(node);
    const char *typeName = cmark_node_get_type_string(node);

    switch (type) {
        case CMARK_NODE_TEXT: {
            const char *literal = cmark_node_get_literal(node);
            NSString *text = literal ? @(literal) : @"";
            [out appendAttributedString:[self zx_attributedText:text traits:traits]];
            break;
        }
        case CMARK_NODE_SOFTBREAK: {
            // GFM 软换行：渲染成空格更贴近规范，但聊天场景保留换行更符合用户预期，这里按换行处理
            [out appendAttributedString:[self zx_attributedText:@"\n" traits:traits]];
            break;
        }
        case CMARK_NODE_LINEBREAK: {
            [out appendAttributedString:[self zx_attributedText:@"\n" traits:traits]];
            break;
        }
        case CMARK_NODE_CODE: {
            const char *literal = cmark_node_get_literal(node);
            NSString *text = literal ? @(literal) : @"";
            NSMutableAttributedString *code = [self zx_attributedText:text traits:(traits | 8)];
            [code addAttribute:NSBackgroundColorAttributeName
                         value:self.style.codeBackgroundColor
                         range:NSMakeRange(0, code.length)];
            [out appendAttributedString:code];
            break;
        }
        case CMARK_NODE_EMPH:
        case CMARK_NODE_STRONG: {
            NSInteger childTraits = traits | (type == CMARK_NODE_STRONG ? 1 : 2);
            for (cmark_node *child = cmark_node_first_child(node); child != NULL; child = cmark_node_next(child)) {
                [out appendAttributedString:[self zx_inlineForSingleNode:child inheritedTraits:childTraits]];
            }
            break;
        }
        case CMARK_NODE_LINK: {
            const char *url = cmark_node_get_url(node);
            NSMutableAttributedString *inner = [[NSMutableAttributedString alloc] init];
            for (cmark_node *child = cmark_node_first_child(node); child != NULL; child = cmark_node_next(child)) {
                [inner appendAttributedString:[self zx_inlineForSingleNode:child inheritedTraits:traits]];
            }
            if (url && inner.length) {
                [inner addAttribute:NSLinkAttributeName value:@(url) range:NSMakeRange(0, inner.length)];
                [inner addAttribute:NSForegroundColorAttributeName value:self.style.linkColor range:NSMakeRange(0, inner.length)];
            }
            [out appendAttributedString:inner];
            break;
        }
        case CMARK_NODE_HTML_INLINE: {
            // raw inline HTML 原样透出，交给 ZXMarkdownManager 既有 processHTMLTags 后处理
            const char *literal = cmark_node_get_literal(node);
            NSString *text = literal ? @(literal) : @"";
            [out appendAttributedString:[self zx_attributedText:text traits:traits]];
            break;
        }
        default: {
            // 扩展节点：strikethrough 由扩展注册，类型名判断
            if (typeName && strcmp(typeName, "strikethrough") == 0) {
                for (cmark_node *child = cmark_node_first_child(node); child != NULL; child = cmark_node_next(child)) {
                    [out appendAttributedString:[self zx_inlineForSingleNode:child inheritedTraits:(traits | 4)]];
                }
            } else {
                for (cmark_node *child = cmark_node_first_child(node); child != NULL; child = cmark_node_next(child)) {
                    [out appendAttributedString:[self zx_inlineForSingleNode:child inheritedTraits:traits]];
                }
            }
            break;
        }
    }
    return out;
}

/// 按 traits 组装字体与属性
- (NSMutableAttributedString *)zx_attributedText:(NSString *)text traits:(NSInteger)traits {
    NSMutableDictionary *attrs = [self.style.baseAttributes mutableCopy];
    UIFont *baseFont = attrs[NSFontAttributeName] ?: [UIFont systemFontOfSize:15];
    CGFloat size = baseFont.pointSize;
    if (traits & 8) {
        attrs[NSFontAttributeName] = self.style.codeFont;
    } else {
        UIFontDescriptorSymbolicTraits symbolic = 0;
        if (traits & 1) { symbolic |= UIFontDescriptorTraitBold; }
        if (traits & 2) { symbolic |= UIFontDescriptorTraitItalic; }
        if (symbolic) {
            UIFontDescriptor *descriptor = [baseFont.fontDescriptor fontDescriptorWithSymbolicTraits:symbolic];
            attrs[NSFontAttributeName] = descriptor ? [UIFont fontWithDescriptor:descriptor size:size] : baseFont;
        }
    }
    if (traits & 4) {
        attrs[NSStrikethroughStyleAttributeName] = @(NSUnderlineStyleSingle);
    }
    return [[NSMutableAttributedString alloc] initWithString:text attributes:attrs];
}
```

- [ ] **Step 3: 实现块级渲染**

接着写块级部分（同一个 `.m`）：

```objc
#pragma mark - 块级

- (NSMutableAttributedString *)blockAttributedStringForNode:(void *)cmarkNode
                                                  listLevel:(NSInteger)listLevel
                                               orderedIndex:(NSInteger)orderedIndex {
    NSMutableAttributedString *out = [[NSMutableAttributedString alloc] init];
    if (!cmarkNode) { return out; }
    cmark_node *node = (cmark_node *)cmarkNode;
    cmark_node_type type = cmark_node_get_type(node);

    switch (type) {
        case CMARK_NODE_PARAGRAPH: {
            [out appendAttributedString:[self inlineAttributedStringForNode:node]];
            [out appendAttributedString:[self zx_newline]];
            [self zx_applyParagraphStyleTo:out headIndent:listLevel * self.style.listIndent firstLineIndent:listLevel * self.style.listIndent];
            break;
        }
        case CMARK_NODE_HEADING: {
            NSInteger level = MAX(1, MIN(6, cmark_node_get_heading_level(node)));
            NSMutableAttributedString *inner = [self inlineAttributedStringForNode:node];
            CGFloat fontSize = [self.style.headerFontSizes[level - 1] doubleValue];
            [inner addAttribute:NSFontAttributeName value:[UIFont boldSystemFontOfSize:fontSize] range:NSMakeRange(0, inner.length)];
            [out appendAttributedString:inner];
            [out appendAttributedString:[self zx_newline]];
            [self zx_applyParagraphStyleTo:out headIndent:0 firstLineIndent:0];
            break;
        }
        case CMARK_NODE_CODE_BLOCK: {
            const char *literal = cmark_node_get_literal(node);
            NSString *code = literal ? @(literal) : @"";
            // 去掉末尾多余换行，避免代码块底部空一行
            while ([code hasSuffix:@"\n"]) { code = [code substringToIndex:code.length - 1]; }
            NSMutableAttributedString *inner = [[NSMutableAttributedString alloc] initWithString:code
                                                                                     attributes:@{ NSFontAttributeName: self.style.codeFont,
                                                                                                   NSBackgroundColorAttributeName: self.style.codeBackgroundColor }];
            [out appendAttributedString:inner];
            [out appendAttributedString:[self zx_newline]];
            [self zx_applyParagraphStyleTo:out headIndent:self.style.quoteIndent firstLineIndent:self.style.quoteIndent];
            break;
        }
        case CMARK_NODE_BLOCK_QUOTE: {
            for (cmark_node *child = cmark_node_first_child(node); child != NULL; child = cmark_node_next(child)) {
                NSMutableAttributedString *inner = [self blockAttributedStringForNode:child listLevel:listLevel orderedIndex:0];
                // 引用块整体染灰并额外缩进，左侧竖条由 ZXMarkdownContentView 绘制时按 NSBackgroundColor 标记定位
                [inner addAttribute:NSForegroundColorAttributeName
                              value:[UIColor colorWithWhite:0.45 alpha:1]
                              range:NSMakeRange(0, inner.length)];
                [out appendAttributedString:inner];
            }
            [self zx_applyParagraphStyleTo:out headIndent:(listLevel * self.style.listIndent + self.style.quoteIndent)
                           firstLineIndent:(listLevel * self.style.listIndent + self.style.quoteIndent)];
            break;
        }
        case CMARK_NODE_LIST: {
            BOOL ordered = (cmark_node_get_list_type(node) == CMARK_ORDERED_LIST);
            NSInteger index = ordered ? cmark_node_get_list_start(node) : 0;
            for (cmark_node *item = cmark_node_first_child(node); item != NULL; item = cmark_node_next(item)) {
                [out appendAttributedString:[self zx_listItemForNode:item listLevel:listLevel ordered:ordered index:index]];
                if (ordered) { index++; }
            }
            break;
        }
        case CMARK_NODE_ITEM: {
            [out appendAttributedString:[self zx_listItemForNode:node listLevel:listLevel ordered:(orderedIndex > 0) index:orderedIndex]];
            break;
        }
        case CMARK_NODE_THEMATIC_BREAK: {
            NSMutableAttributedString *rule = [[NSMutableAttributedString alloc] initWithString:@"\n"
                                                                                    attributes:self.style.baseAttributes];
            [rule addAttribute:NSStrikethroughStyleAttributeName value:@(NSUnderlineStyleSingle) range:NSMakeRange(0, rule.length)];
            [rule addAttribute:NSStrikethroughColorAttributeName value:self.style.tableBorderColor range:NSMakeRange(0, rule.length)];
            [out appendAttributedString:rule];
            break;
        }
        case CMARK_NODE_HTML_BLOCK: {
            const char *literal = cmark_node_get_literal(node);
            NSString *text = literal ? @(literal) : @"";
            [out appendAttributedString:[[NSAttributedString alloc] initWithString:text attributes:self.style.baseAttributes]];
            break;
        }
        default: {
            for (cmark_node *child = cmark_node_first_child(node); child != NULL; child = cmark_node_next(child)) {
                [out appendAttributedString:[self blockAttributedStringForNode:child listLevel:listLevel orderedIndex:0]];
            }
            break;
        }
    }
    return out;
}

/// 单个列表项：marker + 内容，支持任务列表与多级缩进
- (NSMutableAttributedString *)zx_listItemForNode:(cmark_node *)item
                                        listLevel:(NSInteger)listLevel
                                          ordered:(BOOL)ordered
                                            index:(NSInteger)index {
    NSMutableAttributedString *out = [[NSMutableAttributedString alloc] init];

    NSString *markerText;
    if (cmark_gfm_extensions_get_tasklist_item_checked(item)) {
        markerText = @"☑ ";
    } else if (cmark_node_get_type(item) == CMARK_NODE_ITEM && [self zx_isTasklistItem:item]) {
        markerText = @"☐ ";
    } else if (ordered) {
        markerText = [NSString stringWithFormat:@"%ld. ", (long)index];
    } else {
        NSString *bullet = self.style.listMarkers[MIN((NSUInteger)listLevel, self.style.listMarkers.count - 1)];
        markerText = [NSString stringWithFormat:@"%@ ", bullet];
    }
    [out appendAttributedString:[[NSAttributedString alloc] initWithString:markerText attributes:self.style.baseAttributes]];

    // 子块：第一个段落直接接在 marker 后，后续块（含嵌套列表）层级 +1
    BOOL first = YES;
    for (cmark_node *child = cmark_node_first_child(item); child != NULL; child = cmark_node_next(child)) {
        if (first && cmark_node_get_type(child) == CMARK_NODE_PARAGRAPH) {
            NSMutableAttributedString *inline_ = [self inlineAttributedStringForNode:child];
            [out appendAttributedString:inline_];
            [out appendAttributedString:[self zx_newline]];
            first = NO;
        } else {
            [out appendAttributedString:[self blockAttributedStringForNode:child listLevel:(listLevel + 1) orderedIndex:0]];
        }
    }

    CGFloat indent = listLevel * self.style.listIndent;
    [self zx_applyParagraphStyleTo:out
                        headIndent:(indent + self.style.listIndent)
                   firstLineIndent:indent];
    return out;
}

/// cmark 的 tasklist 扩展只在 checked 时返回 YES，未勾选项靠节点类型名判断
- (BOOL)zx_isTasklistItem:(cmark_node *)item {
    const char *typeName = cmark_node_get_type_string(item);
    return typeName && strcmp(typeName, "tasklist") == 0;
}

- (NSAttributedString *)zx_newline {
    return [[NSAttributedString alloc] initWithString:@"\n" attributes:self.style.baseAttributes];
}

/// 只给尚未设置段落样式的区间补，避免覆盖内层已设的缩进
- (void)zx_applyParagraphStyleTo:(NSMutableAttributedString *)text
                      headIndent:(CGFloat)headIndent
                 firstLineIndent:(CGFloat)firstLineIndent {
    if (!text.length) { return; }
    [text enumerateAttribute:NSParagraphStyleAttributeName
                     inRange:NSMakeRange(0, text.length)
                     options:0
                  usingBlock:^(id value, NSRange range, BOOL *stop) {
        if (value) { return; }
        NSMutableParagraphStyle *paragraph = [self.style.baseAttributes[NSParagraphStyleAttributeName] mutableCopy] ?: [[NSMutableParagraphStyle alloc] init];
        paragraph.headIndent = headIndent;
        paragraph.firstLineHeadIndent = firstLineIndent;
        paragraph.paragraphSpacing = self.style.paragraphSpacing;
        [text addAttribute:NSParagraphStyleAttributeName value:paragraph range:range];
    }];
}

@end
```

- [ ] **Step 4: 🧑 人工构建验证**

Xcode build。Expected: 编译通过。若 `cmark_gfm_extensions_get_tasklist_item_checked` 报未声明，补 `#import <cmark-gfm/cmark-gfm-extension_api.h>`。

- [ ] **Step 5: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownAttributedBuilder.h SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownAttributedBuilder.m
git commit -m "feat(markdown): 新增 AST 富文本构建器（行内强调/码/链接/删除线 + 标题/列表/引用/代码块）"
```

---

## Task 5: 解析器 —— AST 压成块序列（ios）

**Files:**
- Modify: `.../Markdown/ZXMarkdownParser.h` / `.m`（替换 Task 2 的冒烟方法）

**Interfaces:**
- Consumes: `ZXMarkdownStyle`、`ZXMarkdownBlock`、`ZXMarkdownTableModel`（Task 3）、`ZXMarkdownAttributedBuilder`（Task 4）
- Produces: `+ (NSArray<ZXMarkdownBlock *> *)blocksFromMarkdown:(NSString *)markdown style:(ZXMarkdownStyle *)style streaming:(BOOL)streaming;`
  - `streaming = YES` 时，位于**文末的表格**降级成富文本块（流式未闭合场景）

- [ ] **Step 1: 改头文件**

```objc
#import <Foundation/Foundation.h>
#import "ZXMarkdownBlock.h"
#import "ZXMarkdownStyle.h"

NS_ASSUME_NONNULL_BEGIN

@interface ZXMarkdownParser : NSObject

/// 解析 GFM，返回块序列。streaming=YES 时文末表格降级为纯文本块（等流式收完再成表）
+ (NSArray<ZXMarkdownBlock *> *)blocksFromMarkdown:(NSString *)markdown
                                             style:(ZXMarkdownStyle *)style
                                         streaming:(BOOL)streaming;

@end

NS_ASSUME_NONNULL_END
```

- [ ] **Step 2: 实现解析与块切分**

```objc
#import "ZXMarkdownParser.h"
#import "ZXMarkdownAttributedBuilder.h"
#import <cmark-gfm/cmark-gfm.h>
#import <cmark-gfm/cmark-gfm-core-extensions.h>
#import <cmark-gfm/cmark-gfm-extension_api.h>

@implementation ZXMarkdownParser

+ (void)zx_ensureExtensionsRegistered {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        cmark_gfm_core_extensions_ensure_registered();
    });
}

+ (NSArray<ZXMarkdownBlock *> *)blocksFromMarkdown:(NSString *)markdown
                                             style:(ZXMarkdownStyle *)style
                                         streaming:(BOOL)streaming {
    if (!markdown.length) { return @[]; }
    [self zx_ensureExtensionsRegistered];

    cmark_parser *parser = cmark_parser_new(CMARK_OPT_DEFAULT | CMARK_OPT_UNSAFE);
    if (!parser) { return @[]; }
    for (NSString *name in @[@"table", @"strikethrough", @"autolink", @"tasklist", @"tagfilter"]) {
        cmark_syntax_extension *ext = cmark_find_syntax_extension(name.UTF8String);
        if (ext) { cmark_parser_attach_syntax_extension(parser, ext); }
    }
    const char *utf8 = markdown.UTF8String;
    cmark_parser_feed(parser, utf8, strlen(utf8));
    cmark_node *doc = cmark_parser_finish(parser);
    if (!doc) { cmark_parser_free(parser); return @[]; }

    ZXMarkdownAttributedBuilder *builder = [[ZXMarkdownAttributedBuilder alloc] initWithStyle:style];
    NSMutableArray<ZXMarkdownBlock *> *blocks = [NSMutableArray array];
    NSMutableAttributedString *pending = [[NSMutableAttributedString alloc] init];

    for (cmark_node *node = cmark_node_first_child(doc); node != NULL; node = cmark_node_next(node)) {
        const char *typeName = cmark_node_get_type_string(node);
        BOOL isTable = (typeName && strcmp(typeName, "table") == 0);
        BOOL isLastNode = (cmark_node_next(node) == NULL);

        if (isTable && !(streaming && isLastNode)) {
            if (pending.length) {
                [blocks addObject:[ZXMarkdownBlock richBlockWithAttributedString:[pending copy]]];
                pending = [[NSMutableAttributedString alloc] init];
            }
            ZXMarkdownTableModel *model = [self zx_tableModelForNode:node builder:builder];
            if (model.columnCount > 0) {
                [blocks addObject:[ZXMarkdownBlock tableBlockWithModel:model]];
            }
        } else if (isTable) {
            // 流式未闭合：整段按纯文本追加，等流结束重渲染时再成表
            [pending appendAttributedString:[self zx_plainTextForTableNode:node style:style]];
        } else {
            [pending appendAttributedString:[builder blockAttributedStringForNode:node listLevel:0 orderedIndex:0]];
        }
    }
    if (pending.length) {
        [blocks addObject:[ZXMarkdownBlock richBlockWithAttributedString:[pending copy]]];
    }

    cmark_node_free(doc);
    cmark_parser_free(parser);
    return [blocks copy];
}

/// table 节点 → ZXMarkdownTableModel（列数以表头为准，数据行补空/截断）
+ (ZXMarkdownTableModel *)zx_tableModelForNode:(cmark_node *)tableNode
                                       builder:(ZXMarkdownAttributedBuilder *)builder {
    ZXMarkdownTableModel *model = [[ZXMarkdownTableModel alloc] init];
    uint16_t columnCount = cmark_gfm_extensions_get_table_columns(tableNode);
    uint8_t *alignments = cmark_gfm_extensions_get_table_alignments(tableNode);

    NSMutableArray<NSNumber *> *alignmentList = [NSMutableArray array];
    for (uint16_t i = 0; i < columnCount; i++) {
        ZXMarkdownTableAlignment alignment = ZXMarkdownTableAlignmentLeft;
        if (alignments) {
            switch (alignments[i]) {
                case 'c': alignment = ZXMarkdownTableAlignmentCenter; break;
                case 'r': alignment = ZXMarkdownTableAlignmentRight; break;
                default: alignment = ZXMarkdownTableAlignmentLeft; break;
            }
        }
        [alignmentList addObject:@(alignment)];
    }
    model.columnAlignments = alignmentList;

    NSMutableArray<NSAttributedString *> *header = [NSMutableArray array];
    NSMutableArray<NSArray<NSAttributedString *> *> *bodyRows = [NSMutableArray array];

    for (cmark_node *row = cmark_node_first_child(tableNode); row != NULL; row = cmark_node_next(row)) {
        BOOL isHeader = cmark_gfm_extensions_get_table_row_is_header(row);
        NSMutableArray<NSAttributedString *> *cells = [NSMutableArray array];
        for (cmark_node *cell = cmark_node_first_child(row); cell != NULL; cell = cmark_node_next(cell)) {
            [cells addObject:[builder inlineAttributedStringForNode:cell]];
        }
        // 补齐/截断到 columnCount
        while (cells.count < columnCount) {
            [cells addObject:[[NSAttributedString alloc] initWithString:@""]];
        }
        if (cells.count > columnCount) {
            [cells removeObjectsInRange:NSMakeRange(columnCount, cells.count - columnCount)];
        }
        if (isHeader && header.count == 0) {
            [header addObjectsFromArray:cells];
        } else {
            [bodyRows addObject:[cells copy]];
        }
    }
    model.headerCells = [header copy];
    model.bodyRows = [bodyRows copy];
    return model;
}

/// 流式未闭合表格：按原始行输出成等宽纯文本
+ (NSAttributedString *)zx_plainTextForTableNode:(cmark_node *)tableNode style:(ZXMarkdownStyle *)style {
    NSMutableString *text = [NSMutableString string];
    for (cmark_node *row = cmark_node_first_child(tableNode); row != NULL; row = cmark_node_next(row)) {
        NSMutableArray<NSString *> *cells = [NSMutableArray array];
        for (cmark_node *cell = cmark_node_first_child(row); cell != NULL; cell = cmark_node_next(cell)) {
            cmark_node *textNode = cmark_node_first_child(cell);
            const char *literal = textNode ? cmark_node_get_literal(textNode) : NULL;
            [cells addObject:(literal ? @(literal) : @"")];
        }
        [text appendFormat:@"%@\n", [cells componentsJoinedByString:@"  "]];
    }
    return [[NSAttributedString alloc] initWithString:text
                                           attributes:@{ NSFontAttributeName: style.codeFont,
                                                         NSForegroundColorAttributeName: style.baseAttributes[NSForegroundColorAttributeName] ?: [UIColor blackColor] }];
}

@end
```

- [ ] **Step 3: 删掉 Task 2 的冒烟调用**

删除 `AppDelegate+AppTools.m` 里 `#if DEBUG` 的 `zx_smokeTestGFM` 调用与对应 `#import`。

- [ ] **Step 4: 🧑 人工构建验证**

Xcode build。Expected: 编译通过。若 `cmark_gfm_extensions_get_table_row_is_header` 未声明，确认已 `#import <cmark-gfm/cmark-gfm-extension_api.h>`。

- [ ] **Step 5: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/Markdown/ SmartMessage/ZX_Base/ZX_AppDelegate/AppDelegate+AppTools.m
git commit -m "feat(markdown): 解析器输出块序列，表格单列成块、流式未闭合表格降级纯文本"
```

---

## Task 6: 横滚表格视图（ios）

**Files:**
- Create: `.../Markdown/ZXMarkdownTableView.h` / `.m`

**Interfaces:**
- Consumes: `ZXMarkdownTableModel`、`ZXMarkdownStyle`
- Produces:
  - `- (instancetype)initWithModel:(ZXMarkdownTableModel *)model style:(ZXMarkdownStyle *)style;`
  - `- (CGFloat)heightForWidth:(CGFloat)width;`

- [ ] **Step 1: 写头文件**

```objc
#import <UIKit/UIKit.h>
#import "ZXMarkdownTableModel.h"
#import "ZXMarkdownStyle.h"

NS_ASSUME_NONNULL_BEGIN

/// GFM 表格视图：外层横向滚动，内部网格由 UILabel 铺成
@interface ZXMarkdownTableView : UIView

- (instancetype)initWithModel:(ZXMarkdownTableModel *)model style:(ZXMarkdownStyle *)style;

/// 表格总高度（与可见宽度无关，横滚不影响高度）
- (CGFloat)heightForWidth:(CGFloat)width;

@end

NS_ASSUME_NONNULL_END
```

- [ ] **Step 2: 实现**

```objc
#import "ZXMarkdownTableView.h"

@interface ZXMarkdownTableView ()
@property (nonatomic, strong) ZXMarkdownTableModel *model;
@property (nonatomic, strong) ZXMarkdownStyle *style;
@property (nonatomic, strong) UIScrollView *scrollView;
@property (nonatomic, strong) UIView *gridView;
/// 各列宽度（含内边距）
@property (nonatomic, copy) NSArray<NSNumber *> *columnWidths;
/// 各行高度（第 0 行为表头）
@property (nonatomic, copy) NSArray<NSNumber *> *rowHeights;
@end

@implementation ZXMarkdownTableView

- (instancetype)initWithModel:(ZXMarkdownTableModel *)model style:(ZXMarkdownStyle *)style {
    self = [super initWithFrame:CGRectZero];
    if (self) {
        _model = model;
        _style = style;
        [self zx_measure];
        [self zx_setupViews];
    }
    return self;
}

/// 量列宽与行高：列宽取该列所有单元格自然宽的最大值，上限 tableMaxColumnWidth
- (void)zx_measure {
    NSInteger columnCount = self.model.columnCount;
    CGFloat padding = self.style.tableCellPadding;
    NSMutableArray<NSNumber *> *widths = [NSMutableArray array];
    NSMutableArray<NSArray<NSAttributedString *> *> *allRows = [NSMutableArray array];
    if (self.model.headerCells.count) { [allRows addObject:self.model.headerCells]; }
    [allRows addObjectsFromArray:self.model.bodyRows];

    for (NSInteger column = 0; column < columnCount; column++) {
        CGFloat maxWidth = 0;
        for (NSArray<NSAttributedString *> *row in allRows) {
            if (column >= (NSInteger)row.count) { continue; }
            CGSize size = [row[column] boundingRectWithSize:CGSizeMake(CGFLOAT_MAX, CGFLOAT_MAX)
                                                    options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingUsesFontLeading
                                                    context:nil].size;
            maxWidth = MAX(maxWidth, ceil(size.width));
        }
        [widths addObject:@(MIN(maxWidth, self.style.tableMaxColumnWidth) + padding * 2)];
    }
    self.columnWidths = widths;

    NSMutableArray<NSNumber *> *heights = [NSMutableArray array];
    for (NSArray<NSAttributedString *> *row in allRows) {
        CGFloat maxHeight = 0;
        for (NSInteger column = 0; column < columnCount && column < (NSInteger)row.count; column++) {
            CGFloat contentWidth = [widths[column] doubleValue] - padding * 2;
            CGSize size = [row[column] boundingRectWithSize:CGSizeMake(contentWidth, CGFLOAT_MAX)
                                                    options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingUsesFontLeading
                                                    context:nil].size;
            maxHeight = MAX(maxHeight, ceil(size.height));
        }
        [heights addObject:@(maxHeight + padding * 2)];
    }
    self.rowHeights = heights;
}

- (void)zx_setupViews {
    self.scrollView = [[UIScrollView alloc] init];
    self.scrollView.showsHorizontalScrollIndicator = YES;
    self.scrollView.showsVerticalScrollIndicator = NO;
    self.scrollView.alwaysBounceVertical = NO;
    // 只吃横向手势，纵向仍归会话列表
    self.scrollView.directionalLockEnabled = YES;
    [self addSubview:self.scrollView];

    self.gridView = [[UIView alloc] init];
    self.gridView.layer.borderWidth = 1.0 / UIScreen.mainScreen.scale;
    self.gridView.layer.borderColor = self.style.tableBorderColor.CGColor;
    self.gridView.layer.cornerRadius = 4;
    self.gridView.clipsToBounds = YES;
    [self.scrollView addSubview:self.gridView];

    CGFloat padding = self.style.tableCellPadding;
    CGFloat lineWidth = 1.0 / UIScreen.mainScreen.scale;
    NSMutableArray<NSArray<NSAttributedString *> *> *allRows = [NSMutableArray array];
    if (self.model.headerCells.count) { [allRows addObject:self.model.headerCells]; }
    [allRows addObjectsFromArray:self.model.bodyRows];

    CGFloat y = 0;
    for (NSInteger rowIndex = 0; rowIndex < (NSInteger)allRows.count; rowIndex++) {
        NSArray<NSAttributedString *> *row = allRows[rowIndex];
        CGFloat rowHeight = [self.rowHeights[rowIndex] doubleValue];
        CGFloat x = 0;
        BOOL isHeader = (rowIndex == 0 && self.model.headerCells.count > 0);

        if (isHeader) {
            UIView *headerBackground = [[UIView alloc] initWithFrame:CGRectMake(0, y, [self zx_totalWidth], rowHeight)];
            headerBackground.backgroundColor = self.style.tableHeaderBackgroundColor;
            [self.gridView addSubview:headerBackground];
        }

        for (NSInteger column = 0; column < self.model.columnCount; column++) {
            CGFloat columnWidth = [self.columnWidths[column] doubleValue];
            UILabel *label = [[UILabel alloc] initWithFrame:CGRectMake(x + padding, y + padding,
                                                                      columnWidth - padding * 2, rowHeight - padding * 2)];
            label.numberOfLines = 0;
            if (column < (NSInteger)row.count) {
                NSMutableAttributedString *cellText = [row[column] mutableCopy];
                if (isHeader && cellText.length) {
                    UIFont *baseFont = self.style.baseAttributes[NSFontAttributeName] ?: [UIFont systemFontOfSize:15];
                    [cellText addAttribute:NSFontAttributeName
                                     value:[UIFont boldSystemFontOfSize:baseFont.pointSize]
                                     range:NSMakeRange(0, cellText.length)];
                }
                label.attributedText = cellText;
            }
            switch ((ZXMarkdownTableAlignment)[self.model.columnAlignments[column] integerValue]) {
                case ZXMarkdownTableAlignmentCenter: label.textAlignment = NSTextAlignmentCenter; break;
                case ZXMarkdownTableAlignmentRight:  label.textAlignment = NSTextAlignmentRight; break;
                default: label.textAlignment = NSTextAlignmentLeft; break;
            }
            [self.gridView addSubview:label];

            // 竖分隔线（最后一列不画）
            if (column < self.model.columnCount - 1) {
                UIView *line = [[UIView alloc] initWithFrame:CGRectMake(x + columnWidth - lineWidth, y, lineWidth, rowHeight)];
                line.backgroundColor = self.style.tableBorderColor;
                [self.gridView addSubview:line];
            }
            x += columnWidth;
        }

        // 横分隔线（最后一行不画）
        if (rowIndex < (NSInteger)allRows.count - 1) {
            UIView *line = [[UIView alloc] initWithFrame:CGRectMake(0, y + rowHeight - lineWidth, [self zx_totalWidth], lineWidth)];
            line.backgroundColor = self.style.tableBorderColor;
            [self.gridView addSubview:line];
        }
        y += rowHeight;
    }

    self.gridView.frame = CGRectMake(0, 0, [self zx_totalWidth], y);
    self.scrollView.contentSize = self.gridView.frame.size;
}

- (CGFloat)zx_totalWidth {
    CGFloat total = 0;
    for (NSNumber *width in self.columnWidths) { total += width.doubleValue; }
    return total;
}

- (CGFloat)heightForWidth:(CGFloat)width {
    CGFloat total = 0;
    for (NSNumber *height in self.rowHeights) { total += height.doubleValue; }
    return total;
}

- (void)layoutSubviews {
    [super layoutSubviews];
    self.scrollView.frame = self.bounds;
}

@end
```

- [ ] **Step 3: 🧑 人工构建验证**

Xcode build。Expected: 编译通过。

- [ ] **Step 4: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownTableView.h SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownTableView.m
git commit -m "feat(markdown): 新增可横滚 GFM 表格视图（列对齐/表头底色/网格线）"
```

---

## Task 7: 段栈容器（ios）

**Files:**
- Create: `.../Markdown/ZXMarkdownContentView.h` / `.m`

**Interfaces:**
- Consumes: `ZXMarkdownBlock`、`ZXMarkdownStyle`、`ZXMarkdownTableView`
- Produces:
  - `- (void)setBlocks:(NSArray<ZXMarkdownBlock *> *)blocks style:(ZXMarkdownStyle *)style width:(CGFloat)width;`
  - `- (CGFloat)heightForWidth:(CGFloat)width;`
  - `- (CGFloat)clipHeightForTargetHeight:(CGFloat)targetHeight width:(CGFloat)width;`
  - `@property (nonatomic, copy) void (^imageTapHandler)(NSString *imageURL);`
  - `@property (nonatomic, copy) void (^referenceTapHandler)(NSString *docId);`
  - `@property (nonatomic, readonly) UITextView *firstTextView;` —— 兼容旧代码取 textView 的地方

- [ ] **Step 1: 写头文件**

```objc
#import <UIKit/UIKit.h>
#import "ZXMarkdownBlock.h"
#import "ZXMarkdownStyle.h"

NS_ASSUME_NONNULL_BEGIN

/// Markdown 段栈容器：富文本块用 UITextView，表格块用 ZXMarkdownTableView，纵向排布
@interface ZXMarkdownContentView : UIView

/// 命中 illustration 图片
@property (nonatomic, copy, nullable) void (^imageTapHandler)(NSString *imageURL);
/// 命中 agent-ref 引用角标
@property (nonatomic, copy, nullable) void (^referenceTapHandler)(NSString *docId);
/// 第一个富文本块的 textView（兼容旧代码里直接操作 textView 的场景，可能为 nil）
@property (nonatomic, strong, readonly, nullable) UITextView *firstTextView;

- (void)setBlocks:(NSArray<ZXMarkdownBlock *> *)blocks style:(ZXMarkdownStyle *)style width:(CGFloat)width;

/// 内容总高
- (CGFloat)heightForWidth:(CGFloat)width;

/// 收起态裁剪高度：裁剪线落在表格块内时延伸到该块底部，不半截切
- (CGFloat)clipHeightForTargetHeight:(CGFloat)targetHeight width:(CGFloat)width;

@end

NS_ASSUME_NONNULL_END
```

- [ ] **Step 2: 实现**

```objc
#import "ZXMarkdownContentView.h"
#import "ZXMarkdownTableView.h"
#import "ZXMarkdownManager.h"

@interface ZXMarkdownContentView ()
@property (nonatomic, copy) NSArray<ZXMarkdownBlock *> *blocks;
@property (nonatomic, strong) ZXMarkdownStyle *style;
@property (nonatomic, strong) NSMutableArray<UIView *> *blockViews;
/// 与 blockViews 一一对应的高度
@property (nonatomic, strong) NSMutableArray<NSNumber *> *blockHeights;
@property (nonatomic, strong, readwrite, nullable) UITextView *firstTextView;
@end

@implementation ZXMarkdownContentView

- (instancetype)initWithFrame:(CGRect)frame {
    self = [super initWithFrame:frame];
    if (self) {
        _blockViews = [NSMutableArray array];
        _blockHeights = [NSMutableArray array];
    }
    return self;
}

- (void)setBlocks:(NSArray<ZXMarkdownBlock *> *)blocks style:(ZXMarkdownStyle *)style width:(CGFloat)width {
    _blocks = [blocks copy];
    _style = style;
    for (UIView *view in self.blockViews) { [view removeFromSuperview]; }
    [self.blockViews removeAllObjects];
    [self.blockHeights removeAllObjects];
    self.firstTextView = nil;

    CGFloat y = 0;
    for (ZXMarkdownBlock *block in blocks) {
        if (block.type == ZXMarkdownBlockTypeTable) {
            ZXMarkdownTableView *tableView = [[ZXMarkdownTableView alloc] initWithModel:block.tableModel style:style];
            CGFloat height = [tableView heightForWidth:width];
            tableView.frame = CGRectMake(0, y, width, height);
            [self addSubview:tableView];
            [self.blockViews addObject:tableView];
            [self.blockHeights addObject:@(height)];
            y += height + style.paragraphSpacing;
        } else {
            UITextView *textView = [self zx_makeTextView];
            textView.attributedText = block.attributedString;
            CGFloat height = ceil([textView sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)].height);
            textView.frame = CGRectMake(0, y, width, height);
            [self addSubview:textView];
            [self.blockViews addObject:textView];
            [self.blockHeights addObject:@(height)];
            if (!self.firstTextView) { self.firstTextView = textView; }
            y += height;
        }
    }
}

- (UITextView *)zx_makeTextView {
    UITextView *textView = [[UITextView alloc] init];
    textView.editable = NO;
    textView.scrollEnabled = NO;
    textView.backgroundColor = [UIColor clearColor];
    textView.textContainerInset = UIEdgeInsetsZero;
    textView.textContainer.lineFragmentPadding = 0;
    // 提前锁 TextKit1，保证 illustration attachment 稳定渲染（沿用既有约定）
    [ZXMarkdownManager zx_prepareTextViewForAttachmentRendering:textView];

    UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(zx_handleTap:)];
    [textView addGestureRecognizer:tap];
    return textView;
}

- (void)zx_handleTap:(UITapGestureRecognizer *)gesture {
    UITextView *textView = (UITextView *)gesture.view;
    if (![textView isKindOfClass:[UITextView class]]) { return; }
    CGPoint point = [gesture locationInView:textView];
    __weak typeof(self) weakSelf = self;
    [ZXMarkdownManager handleTapInTextView:textView
                                   atPoint:point
                              imageHandler:^(NSString *imageURL) {
        if (weakSelf.imageTapHandler) { weakSelf.imageTapHandler(imageURL); }
    }
                          referenceHandler:^(NSString *docId) {
        if (weakSelf.referenceTapHandler) { weakSelf.referenceTapHandler(docId); }
    }];
}

- (CGFloat)heightForWidth:(CGFloat)width {
    CGFloat total = 0;
    for (NSInteger i = 0; i < (NSInteger)self.blockHeights.count; i++) {
        total += [self.blockHeights[i] doubleValue];
        if (self.blocks[i].type == ZXMarkdownBlockTypeTable) { total += self.style.paragraphSpacing; }
    }
    return total;
}

- (CGFloat)clipHeightForTargetHeight:(CGFloat)targetHeight width:(CGFloat)width {
    CGFloat accumulated = 0;
    for (NSInteger i = 0; i < (NSInteger)self.blockHeights.count; i++) {
        CGFloat blockHeight = [self.blockHeights[i] doubleValue];
        CGFloat blockBottom = accumulated + blockHeight;
        if (blockBottom >= targetHeight) {
            if (self.blocks[i].type == ZXMarkdownBlockTypeTable) {
                // 表格不切半截：要么整块显示，要么整块不显示
                return (accumulated <= 0) ? blockBottom : accumulated;
            }
            // 富文本块沿用既有按行/附件对齐的裁剪逻辑
            return accumulated + [ZXMarkdownManager zx_adjustedClipHeightForAttributedText:self.blocks[i].attributedString
                                                                              contentWidth:width
                                                                              targetHeight:(targetHeight - accumulated)];
        }
        accumulated = blockBottom;
        if (self.blocks[i].type == ZXMarkdownBlockTypeTable) { accumulated += self.style.paragraphSpacing; }
    }
    return accumulated;
}

@end
```

- [ ] **Step 3: 🧑 人工构建验证**

Xcode build。Expected: 编译通过。

- [ ] **Step 4: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownContentView.h SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownContentView.m
git commit -m "feat(markdown): 新增段栈容器 ZXMarkdownContentView（高度求和 + 表格不半截裁剪 + 点击转发）"
```

---

## Task 8: Debug 自测页 + GFM 用例集（ios）

先建验收工具，再改线上路径 —— 后面每个接入任务都靠它验。

**Files:**
- Create: `.../Markdown/Debug/ZXMarkdownDebugController.h` / `.m`
- Create: `.../Markdown/Debug/ZXMarkdownDebugCases.h` / `.m`
- Create: `.../Markdown/Debug/UIWindow+ZXMarkdownDebug.m`

**Interfaces:**
- Consumes: `ZXMarkdownParser`、`ZXMarkdownContentView`、`ZXMarkdownStyle`
- Produces: `ZXMarkdownDebugCases`：`+ (NSArray<NSDictionary<NSString *, NSString *> *> *)allCases;`（每项含 `id` / `title` / `markdown` / `expect`）

- [ ] **Step 1: 写用例集（spec 附录逐条落成数据）**

`ZXMarkdownDebugCases.m` 关键片段（29 条全写，这里给出格式与前若干条，其余按 spec 表格逐条补齐，`id` 与 spec 编号一致）：

```objc
#import "ZXMarkdownDebugCases.h"

@implementation ZXMarkdownDebugCases

+ (NSArray<NSDictionary<NSString *,NSString *> *> *)allCases {
    return @[
        @{ @"id": @"L1", @"title": @"三层缩进无序列表",
           @"markdown": @"- 一级\n  - 二级\n    - 三级\n",
           @"expect": @"三级缩进层次分明，marker 依次 •／◦／▪" },
        @{ @"id": @"L2", @"title": @"加号列表",
           @"markdown": @"+ 甲\n+ 乙\n",
           @"expect": @"识别为无序列表" },
        @{ @"id": @"L3", @"title": @"3 起始有序列表",
           @"markdown": @"3. 三\n4. 四\n5. 五\n",
           @"expect": @"从 3 开始连续编号" },
        @{ @"id": @"L4", @"title": @"任务列表",
           @"markdown": @"- [ ] 未完成\n- [x] 已完成\n",
           @"expect": @"渲染 ☐ / ☑，不显示原始括号" },
        @{ @"id": @"L5", @"title": @"有序内嵌无序",
           @"markdown": @"1. 一\n   - 甲\n   - 乙\n2. 二\n",
           @"expect": @"嵌套层级与缩进正确" },
        @{ @"id": @"L6", @"title": @"列表项含行内样式",
           @"markdown": @"- **粗** 与 `码` 与 [链接](https://example.com)\n",
           @"expect": @"行内样式全部保留" },
        @{ @"id": @"L7", @"title": @"列表项多段落",
           @"markdown": @"- 第一段\n\n  第二段\n",
           @"expect": @"同项内两段，缩进对齐" },
        @{ @"id": @"L8", @"title": @"松散列表",
           @"markdown": @"- 甲\n\n- 乙\n",
           @"expect": @"项间距大于紧凑列表" },
        @{ @"id": @"T1", @"title": @"标准三列表格",
           @"markdown": @"| 字段 | 类型 | 说明 |\n|---|---|---|\n| id | int | 主键 |\n| name | str | 名称 |\n",
           @"expect": @"真表格：表头底色 + 网格线" },
        @{ @"id": @"T2", @"title": @"一条消息两个表格",
           @"markdown": @"| a | b |\n|---|---|\n| 1 | 2 |\n\n中间段落\n\n| c | d |\n|---|---|\n| 3 | 4 |\n",
           @"expect": @"两个表格都渲染" },
        @{ @"id": @"T3", @"title": @"含空单元格",
           @"markdown": @"| a | b | c |\n|---|---|---|\n| 1 |  | 3 |\n",
           @"expect": @"空格占位，列不错位" },
        @{ @"id": @"T4", @"title": @"对齐符",
           @"markdown": @"| 左 | 中 | 右 |\n|:---|:---:|---:|\n| 1 | 2 | 3 |\n",
           @"expect": @"左/居中/右对齐生效" },
        @{ @"id": @"T5", @"title": @"单元格内转义竖线",
           @"markdown": @"| a | b |\n|---|---|\n| x \\| y | z |\n",
           @"expect": @"显示字面竖线，不拆列" },
        @{ @"id": @"T6", @"title": @"单元格内行内样式",
           @"markdown": @"| a | b |\n|---|---|\n| **粗** | `码` |\n",
           @"expect": @"行内样式保留" },
        @{ @"id": @"T7", @"title": @"八列宽表",
           @"markdown": @"| c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 |\n|---|---|---|---|---|---|---|---|\n| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |\n",
           @"expect": @"可横向拖动，纵向滚动仍归列表" },
        @{ @"id": @"T8", @"title": @"列数不一致",
           @"markdown": @"| a | b |\n|---|---|\n| 1 | 2 | 3 |\n| 4 |\n",
           @"expect": @"多余单元格丢弃，缺失补空" },
        @{ @"id": @"T9", @"title": @"表格紧跟段落",
           @"markdown": @"上文段落\n| a | b |\n|---|---|\n| 1 | 2 |\n",
           @"expect": @"正确断块" },
        @{ @"id": @"I1", @"title": @"粗体内含星号",
           @"markdown": @"**含*星号*的粗体**\n",
           @"expect": @"整体加粗，内层斜体" },
        @{ @"id": @"I2", @"title": @"下划线语法",
           @"markdown": @"__粗__ 与 _斜_\n",
           @"expect": @"生效" },
        @{ @"id": @"I3", @"title": @"中文粘连下划线",
           @"markdown": @"中文_不是斜体_中文\n",
           @"expect": @"按 GFM 分隔符规则，不变斜体" },
        @{ @"id": @"I4", @"title": @"多反引号行内码",
           @"markdown": @"``含 ` 反引号``\n",
           @"expect": @"正确渲染" },
        @{ @"id": @"I5", @"title": @"缩进代码块",
           @"markdown": @"普通段落\n\n    int a = 1;\n    int b = 2;\n",
           @"expect": @"渲染为代码块" },
        @{ @"id": @"I6", @"title": @"未闭合围栏",
           @"markdown": @"```swift\nlet a = 1\n",
           @"expect": @"到文末结束，不吃后文" },
        @{ @"id": @"I7", @"title": @"裸 URL",
           @"markdown": @"访问 https://github.github.com/gfm/ 看规范\n",
           @"expect": @"autolink 成可点链接" },
        @{ @"id": @"I8", @"title": @"软换行",
           @"markdown": @"第一行\n第二行\n",
           @"expect": @"按软断行处理，间距正确" },
        @{ @"id": @"I9", @"title": @"空行分段",
           @"markdown": @"第一段\n\n第二段\n",
           @"expect": @"段落间距正确" },
        @{ @"id": @"I10", @"title": @"嵌套引用块",
           @"markdown": @"> 一层\n>> 二层\n",
           @"expect": @"缩进层次可见" },
        @{ @"id": @"I11", @"title": @"反斜杠转义",
           @"markdown": @"\\*不是斜体\\* 与 \\_下划线\\_ 与 \\| 竖线\n",
           @"expect": @"显示字面字符" },
        @{ @"id": @"I12", @"title": @"标题",
           @"markdown": @"# 一级\n## 二级\n###### 六级\n\nSetext 标题\n===\n",
           @"expect": @"字号递减；setext 亦识别" },
        @{ @"id": @"C3", @"title": @"内联 HTML 着色",
           @"markdown": @"<span style=\"color:red\">红字</span> 与 <b>粗</b>\n",
           @"expect": @"颜色与加粗仍生效" },
    ];
}

@end
```

`ZXMarkdownDebugCases.h`：

```objc
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// GFM 验收用例集，与 spec 附录一一对应
@interface ZXMarkdownDebugCases : NSObject

/// 每项含 id / title / markdown / expect
+ (NSArray<NSDictionary<NSString *, NSString *> *> *)allCases;

@end

NS_ASSUME_NONNULL_END
```

- [ ] **Step 2: 写自测页**

`ZXMarkdownDebugController.h`：

```objc
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/// Debug 专用：GFM 用例渲染对照页
@interface ZXMarkdownDebugController : UIViewController

@end

NS_ASSUME_NONNULL_END
```

`ZXMarkdownDebugController.m`：

```objc
#import "ZXMarkdownDebugController.h"
#import "ZXMarkdownDebugCases.h"
#import "ZXMarkdownParser.h"
#import "ZXMarkdownContentView.h"
#import "ZXMarkdownStyle.h"

@interface ZXMarkdownDebugController ()
@property (nonatomic, strong) UIScrollView *scrollView;
@end

@implementation ZXMarkdownDebugController

- (void)viewDidLoad {
    [super viewDidLoad];
    self.title = @"GFM 用例对照";
    self.view.backgroundColor = [UIColor whiteColor];

    self.scrollView = [[UIScrollView alloc] initWithFrame:self.view.bounds];
    self.scrollView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [self.view addSubview:self.scrollView];

    UIBarButtonItem *close = [[UIBarButtonItem alloc] initWithTitle:@"关闭"
                                                             style:UIBarButtonItemStylePlain
                                                            target:self
                                                            action:@selector(zx_close)];
    self.navigationItem.leftBarButtonItem = close;

    CGFloat width = CGRectGetWidth(self.view.bounds) - 32;
    CGFloat y = 16;
    ZXMarkdownStyle *style = [ZXMarkdownStyle defaultStyleWithBaseAttributes:@{ NSFontAttributeName: [UIFont systemFontOfSize:15],
                                                                               NSForegroundColorAttributeName: [UIColor blackColor] }];

    for (NSDictionary<NSString *, NSString *> *testCase in [ZXMarkdownDebugCases allCases]) {
        UILabel *titleLabel = [[UILabel alloc] initWithFrame:CGRectMake(16, y, width, 20)];
        titleLabel.font = [UIFont boldSystemFontOfSize:13];
        titleLabel.textColor = [UIColor colorWithRed:0 green:0.4 blue:0.9 alpha:1];
        titleLabel.text = [NSString stringWithFormat:@"%@ · %@", testCase[@"id"], testCase[@"title"]];
        [self.scrollView addSubview:titleLabel];
        y += 24;

        UILabel *expectLabel = [[UILabel alloc] initWithFrame:CGRectMake(16, y, width, 0)];
        expectLabel.font = [UIFont systemFontOfSize:12];
        expectLabel.textColor = [UIColor grayColor];
        expectLabel.numberOfLines = 0;
        expectLabel.text = [NSString stringWithFormat:@"期望：%@", testCase[@"expect"]];
        [expectLabel sizeToFit];
        expectLabel.frame = CGRectMake(16, y, width, CGRectGetHeight(expectLabel.frame));
        [self.scrollView addSubview:expectLabel];
        y += CGRectGetHeight(expectLabel.frame) + 8;

        NSArray<ZXMarkdownBlock *> *blocks = [ZXMarkdownParser blocksFromMarkdown:testCase[@"markdown"]
                                                                            style:style
                                                                        streaming:NO];
        ZXMarkdownContentView *contentView = [[ZXMarkdownContentView alloc] initWithFrame:CGRectZero];
        [contentView setBlocks:blocks style:style width:width];
        CGFloat height = [contentView heightForWidth:width];
        contentView.frame = CGRectMake(16, y, width, height);
        contentView.layer.borderWidth = 1.0 / UIScreen.mainScreen.scale;
        contentView.layer.borderColor = [UIColor colorWithWhite:0.9 alpha:1].CGColor;
        [self.scrollView addSubview:contentView];
        y += height + 24;
    }

    self.scrollView.contentSize = CGSizeMake(CGRectGetWidth(self.view.bounds), y);
}

- (void)zx_close {
    [self dismissViewControllerAnimated:YES completion:nil];
}

@end
```

- [ ] **Step 3: 挂摇一摇入口（DEBUG 限定）**

`UIWindow+ZXMarkdownDebug.m`（无对应 .h，整文件由 `#if DEBUG` 包住）：

```objc
#if DEBUG

#import <UIKit/UIKit.h>
#import "ZXMarkdownDebugController.h"

/// Debug 包：摇一摇打开 GFM 用例对照页
@implementation UIWindow (ZXMarkdownDebug)

- (BOOL)canBecomeFirstResponder {
    return YES;
}

- (void)motionEnded:(UIEventSubtype)motion withEvent:(UIEvent *)event {
    if (motion != UIEventSubtypeMotionShake) { return; }
    UIViewController *top = self.rootViewController;
    while (top.presentedViewController) { top = top.presentedViewController; }
    if ([top isKindOfClass:[UINavigationController class]] &&
        [[(UINavigationController *)top topViewController] isKindOfClass:[ZXMarkdownDebugController class]]) {
        return;
    }
    ZXMarkdownDebugController *debugController = [[ZXMarkdownDebugController alloc] init];
    UINavigationController *nav = [[UINavigationController alloc] initWithRootViewController:debugController];
    nav.modalPresentationStyle = UIModalPresentationFullScreen;
    [top presentViewController:nav animated:YES completion:nil];
}

@end

#endif
```

- [ ] **Step 4: 🧑 人工构建 + 逐条验收**

Xcode build → 模拟器跑起来 → `Device > Shake`（⌃⌘Z）→ 自测页打开。
按 spec 附录逐条看，把不达标的用例 id 记下来。
Expected: L1-L8、T1-T9、I1-I12、C3 全部符合「期望」列。

**这一步大概率会挑出问题**（缩进量、间距、marker 尺寸、表格列宽）。修完再往下走——后面的接入任务默认渲染层已经对了。

- [ ] **Step 5: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/Markdown/Debug/
git commit -m "feat(markdown): 新增 DEBUG 摇一摇 GFM 用例对照页（30 条用例）"
```

---

## Task 9: ZXMarkdownManager 内部切换 + 三重兜底（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/ZXMarkdownManager.h`
- Modify: `apps/ios/SmartMessage/ZX_Base/ZX_Manager/ZXMarkdownManager.m`

**Interfaces:**
- Consumes: `ZXMarkdownParser`、`ZXMarkdownStyle`、`ZXMarkdownBlock`
- Produces:
  - `+ (NSArray<ZXMarkdownBlock *> *)blocksForText:(NSString *)text param:(ZXMarkdownParam *)param streaming:(BOOL)streaming;`
  - `ZXMarkdownParam` 新增 `@property (nonatomic, assign) BOOL streaming;`
  - 现有 `renderMarkdownBy:param:` 行为不变（内部改走新解析，把块序列拼回单个 `NSAttributedString`，表格块回退成纯文本对齐形式）

- [ ] **Step 1: 加开关与新入口声明**

`ZXMarkdownManager.h` 追加：

```objc
@class ZXMarkdownBlock;

/// 是否启用 cmark-gfm 解析（默认 YES；出线上问题可置 NO 回退老正则）
UIKIT_EXTERN BOOL ZXMarkdownUseCMark;

/// 超过该长度直接走老正则，避免超长文本解析开销
UIKIT_EXTERN NSUInteger const ZXMarkdownCMarkLengthLimit;

@interface ZXMarkdownManager (Blocks)

/// 解析成块序列，供 ZXMarkdownContentView 使用；streaming=YES 时文末表格降级纯文本
+ (NSArray<ZXMarkdownBlock *> *)blocksForText:(NSString *)text
                                        param:(ZXMarkdownParam *)param
                                    streaming:(BOOL)streaming;

@end
```

`ZXMarkdownParam` 声明里追加：

```objc
/// 是否处于流式输出中（文末未闭合表格降级为纯文本），默认 NO
@property (nonatomic, assign) BOOL streaming;
```

- [ ] **Step 2: 实现新入口与兜底**

`ZXMarkdownManager.m` 追加（放在 `renderMarkdownBy:param:` 附近）：

```objc
BOOL ZXMarkdownUseCMark = YES;
NSUInteger const ZXMarkdownCMarkLengthLimit = 20000;

@implementation ZXMarkdownManager (Blocks)

+ (NSArray<ZXMarkdownBlock *> *)blocksForText:(NSString *)text
                                        param:(ZXMarkdownParam *)param
                                    streaming:(BOOL)streaming {
    if (!text.length) { return @[]; }
    ZXMarkdownStyle *style = [ZXMarkdownStyle defaultStyleWithBaseAttributes:param.attrs];

    // 兜底 1/2：开关关闭、未开启 Markdown 解析、或正文超长 → 老正则，整段当一个富文本块
    if (!ZXMarkdownUseCMark || !param.parseMarkdown || text.length > ZXMarkdownCMarkLengthLimit) {
        NSAttributedString *legacy = [self renderMarkdownBy:text param:param];
        return legacy.length ? @[[ZXMarkdownBlock richBlockWithAttributedString:legacy]] : @[];
    }

    // 与老路径一致：先归一化转义，再把 reference / illustration 换成占位 slot
    NSString *normalized = [self zx_normalizeAgentContentEscapes:text];
    NSString *placeheld = normalized;
    if (param.parseReference) {
        placeheld = [self zx_replaceReferenceTagsInText:[self zx_collapseIgnorableWhitespaceAroundReferenceTags:placeheld] param:param];
    }
    if (param.parseIllustration) {
        placeheld = [self zx_replaceIllustrationTagsInText:placeheld param:param];
    }

    NSArray<ZXMarkdownBlock *> *blocks = nil;
    @try {
        blocks = [ZXMarkdownParser blocksFromMarkdown:placeheld style:style streaming:streaming];
    } @catch (NSException *exception) {
        NSLog(@"[ZXMarkdown] cmark 解析异常，回退老正则: %@", exception.reason);
        blocks = nil;
    }
    // 兜底 3：解析没出块 → 老正则
    if (!blocks.count) {
        NSAttributedString *legacy = [self renderMarkdownBy:text param:param];
        return legacy.length ? @[[ZXMarkdownBlock richBlockWithAttributedString:legacy]] : @[];
    }

    // 富文本块回填 attachment：内联 HTML → 角标 → 插图，顺序与老路径一致
    NSMutableArray<ZXMarkdownBlock *> *result = [NSMutableArray array];
    for (ZXMarkdownBlock *block in blocks) {
        if (block.type != ZXMarkdownBlockTypeRich) {
            [result addObject:block];
            continue;
        }
        NSMutableAttributedString *mutable = [block.attributedString mutableCopy];
        [self processHTMLTags:mutable defaultAttrs:param.attrs];
        [self zx_decodeHTMLEntitiesInAttributedString:mutable];
        if (param.parseReference) {
            [self zx_applyReferencePlaceholdersInAttributedString:mutable param:param];
        }
        if (param.parseIllustration) {
            [self zx_applyIllustrationPlaceholdersInAttributedString:mutable param:param];
        } else {
            [self zx_removeIllustrationPlaceholdersInAttributedString:mutable];
        }
        [result addObject:[ZXMarkdownBlock richBlockWithAttributedString:mutable]];
    }
    return [result copy];
}

@end
```

> 上面用到的 `zx_replaceReferenceTagsInText:param:` 等方法目前是文件内私有方法（`ZXMarkdownManager.m:344/362/429/464/479/653`），在 `.m` 顶部补一个类扩展声明即可，不要挪到公开头文件。

- [ ] **Step 3: 🧑 人工构建验证**

Xcode build。Expected: 编译通过。摇一摇自测页仍正常（走的是 `ZXMarkdownParser`，不受影响）。

- [ ] **Step 4: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Base/ZX_Manager/ZXMarkdownManager.h SmartMessage/ZX_Base/ZX_Manager/ZXMarkdownManager.m
git commit -m "feat(markdown): ZXMarkdownManager 增块序列入口，接 cmark 解析并保留三重兜底"
```

---

## Task 10: 接入机器人气泡（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXGroupRobotCell.m:508-600`（共享测量视图 + 流式高度）
- Modify: 同文件 `:640-860`（`contentLab` 赋值与高度计算）
- Modify: 同文件 `:1168-1180`（`contentLab` 懒加载）

**Interfaces:**
- Consumes: `ZXMarkdownManager (Blocks)`、`ZXMarkdownContentView`

- [ ] **Step 1: 把 contentLab 换成段栈容器**

`contentLab` 保留（不含表格时仍是它在干活），新增一个 `ZXMarkdownContentView *markdownContentView` 属性，两者互斥显示：

```objc
// 懒加载，紧跟现有 contentLab 的懒加载写
- (ZXMarkdownContentView *)markdownContentView {
    if (!_markdownContentView) {
        _markdownContentView = [[ZXMarkdownContentView alloc] initWithFrame:CGRectZero];
        __weak typeof(self) weakSelf = self;
        _markdownContentView.imageTapHandler = ^(NSString *imageURL) {
            [weakSelf zx_handleMarkdownImageTap:imageURL];
        };
        _markdownContentView.referenceTapHandler = ^(NSString *docId) {
            [weakSelf zx_handleMarkdownReferenceTap:docId];
        };
        [self.bgView addSubview:_markdownContentView];
    }
    return _markdownContentView;
}
```

`zx_handleMarkdownImageTap:` / `zx_handleMarkdownReferenceTap:` 里调用当前 `contentLab` tap 手势回调走的那套逻辑（在 `ZXGroupRobotCell.m:160-200` 附近，直接抽成方法复用，不要复制粘贴）。

- [ ] **Step 2: 改渲染分支**

把 `ZXGroupRobotCell.m:806-814` 那段替换成：

```objc
        param.parseMarkdown = YES;
        param.streaming = self.isStreaming;   // 若 cell 无此属性，用现有判断流式的字段替代
        NSArray<ZXMarkdownBlock *> *blocks = [ZXMarkdownManager blocksForText:content param:param streaming:param.streaming];
        BOOL hasTable = NO;
        for (ZXMarkdownBlock *block in blocks) {
            if (block.type == ZXMarkdownBlockTypeTable) { hasTable = YES; break; }
        }
        CGFloat contentWidth = kChatMsgContentW - 32;
        if (hasTable) {
            // 含表格：走段栈
            self.contentLab.hidden = YES;
            self.markdownContentView.hidden = NO;
            [self.markdownContentView setBlocks:blocks style:[ZXMarkdownStyle defaultStyleWithBaseAttributes:param.attrs] width:contentWidth];
            mdContent = nil;
        } else {
            // 无表格：保持原路径，单 textView
            self.markdownContentView.hidden = YES;
            self.contentLab.hidden = NO;
            mdContent = blocks.count ? [blocks.firstObject.attributedString mutableCopy] : [[NSMutableAttributedString alloc] init];
        }
```

- [ ] **Step 3: 改高度计算**

`:825` 与 `:844` 两处高度改成按分支取：

```objc
    CGFloat fullContentHeight = hasTable
        ? [self.markdownContentView heightForWidth:contentWidth]
        : [self.contentLab sizeThatFits:CGSizeMake(contentWidth, CGFLOAT_MAX)].height;
```

收起态那处：

```objc
        contentHeight = hasTable
            ? [self.markdownContentView clipHeightForTargetHeight:targetHeight width:contentWidth]
            : [ZXMarkdownManager zx_adjustedClipHeightForAttributedText:mdContent
                                                           contentWidth:contentWidth
                                                           targetHeight:targetHeight];
```

- [ ] **Step 4: 段栈约束**

`markdownContentView` 的 Masonry 约束与 `contentLab` 完全一致（同一个父视图、同样的 edge inset），高度用上一步算出的值。

- [ ] **Step 5: 🧑 人工自测**

发以下消息到群里，逐条看：T1 标准表格 / T2 两个表格 / T7 八列宽表（横拖）/ L1 三层列表 / C6 纯文本消息（对比改造前无差异）/ C5 长消息收起展开。

- [ ] **Step 6: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXGroupRobotCell.m
git commit -m "feat(markdown): 机器人气泡接入段栈渲染，含表格走 ZXMarkdownContentView"
```

---

## Task 11: 接入智能体气泡 + 流式（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Logic/ZXIMCellLogic.m:1700-1712`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Logic/ZXIMCellLogic.h:120-140`（新增块序列版方法声明）
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXIMAgentStreamReplyCell.m:150-260`

**Interfaces:**
- Produces: `ZXIMCellLogic`：`+ (NSArray<ZXMarkdownBlock *> *)agentReplyBlocksForContent:(NSString *)content items:(NSArray<ZXAgentKnowledgeItem *> *)items attrs:(NSDictionary *)attrs imageWidth:(CGFloat)imageWidth parseIllustration:(BOOL)parseIllustration streaming:(BOOL)streaming;`
  - 与现有 `agentReplyRenderedContent:…` 并存；前缀（`回复@xxx：`）作为**第一个富文本块的前置内容**拼进去，不单独成块

- [ ] **Step 1: 在 ZXIMCellLogic 加块序列版方法**

复制现有 `agentReplyRenderedContent:` 的前缀拼装逻辑（`ZXIMCellLogic.m:1680-1699`），把正文那段换成：

```objc
    NSMutableArray<ZXMarkdownBlock *> *blocks = [NSMutableArray array];
    if (bodyContent.length > 0) {
        ZXMarkdownParam *param = [[ZXMarkdownParam alloc] init];
        param.attrs = attrs;
        param.referenceIndexMap = [ZXAgentKnowledgeItem referenceIndexMapFromItems:items ?: @[]];
        param.parseReference = YES;
        param.parseIllustration = parseIllustration;
        param.parseMarkdown = YES;
        param.streaming = streaming;
        param.imageWidth = imageWidth > 0 ? imageWidth : (kChatMsgContentW - 32);
        [blocks addObjectsFromArray:[ZXMarkdownManager blocksForText:bodyContent param:param streaming:streaming]];
    }
    // 前缀并进第一个富文本块，避免多出一段
    if (result.length && blocks.count && blocks.firstObject.type == ZXMarkdownBlockTypeRich) {
        NSMutableAttributedString *merged = [result mutableCopy];
        [merged appendAttributedString:blocks.firstObject.attributedString];
        blocks[0] = [ZXMarkdownBlock richBlockWithAttributedString:merged];
    } else if (result.length) {
        [blocks insertObject:[ZXMarkdownBlock richBlockWithAttributedString:result] atIndex:0];
    }
    return [blocks copy];
```

- [ ] **Step 2: 智能体 cell 接段栈**

`ZXIMAgentStreamReplyCell.m` 里新增段栈属性与渲染分支（与机器人 cell 同构，这里给完整代码，不要去翻 Task 10）：

```objc
// 懒加载
- (ZXMarkdownContentView *)markdownContentView {
    if (!_markdownContentView) {
        _markdownContentView = [[ZXMarkdownContentView alloc] initWithFrame:CGRectZero];
        __weak typeof(self) weakSelf = self;
        _markdownContentView.imageTapHandler = ^(NSString *imageURL) {
            [weakSelf zx_handleMarkdownImageTap:imageURL];
        };
        _markdownContentView.referenceTapHandler = ^(NSString *docId) {
            [weakSelf zx_handleMarkdownReferenceTap:docId];
        };
        [self.bgView addSubview:_markdownContentView];
    }
    return _markdownContentView;
}
```

渲染分支（替换现有调 `agentReplyRenderedContent:` 的那段）：

```objc
    BOOL streaming = self.isStreaming;   // 用该 cell 现有的「是否流式中」字段
    NSArray<ZXMarkdownBlock *> *blocks = [ZXIMCellLogic agentReplyBlocksForContent:content
                                                                             items:items
                                                                             attrs:attrs
                                                                        imageWidth:imageWidth
                                                                 parseIllustration:parseIllustration
                                                                         streaming:streaming];
    BOOL hasTable = NO;
    for (ZXMarkdownBlock *block in blocks) {
        if (block.type == ZXMarkdownBlockTypeTable) { hasTable = YES; break; }
    }
    CGFloat contentWidth = [self zx_contentWidth];
    NSMutableAttributedString *mdContent = nil;
    if (hasTable) {
        self.contentLab.hidden = YES;
        self.markdownContentView.hidden = NO;
        [self.markdownContentView setBlocks:blocks
                                      style:[ZXMarkdownStyle defaultStyleWithBaseAttributes:attrs]
                                      width:contentWidth];
    } else {
        self.markdownContentView.hidden = YES;
        self.contentLab.hidden = NO;
        mdContent = blocks.count ? [blocks.firstObject.attributedString mutableCopy] : [[NSMutableAttributedString alloc] init];
        self.contentLab.attributedText = mdContent;
    }
```

高度两处（`ZXIMAgentStreamReplyCell.m:161` 与 `:246`）：

```objc
    // :161 附近 —— 完整高度
    CGFloat fullContentHeight = hasTable
        ? [self.markdownContentView heightForWidth:contentWidth]
        : MAX(ceil([measureView sizeThatFits:CGSizeMake(contentWidth, CGFLOAT_MAX)].height), SS(20));

    // :246 附近 —— 收起态裁剪
    contentHeight = hasTable
        ? [self.markdownContentView clipHeightForTargetHeight:targetHeight width:contentWidth]
        : [ZXMarkdownManager zx_adjustedClipHeightForAttributedText:mdContent
                                                       contentWidth:contentWidth
                                                       targetHeight:targetHeight];
```

`markdownContentView` 的 Masonry 约束与 `contentLab` 完全一致（同父视图、同 edge inset），高度用上面算出的值。

- [ ] **Step 3: 共享测量视图改造**

`ZXGroupRobotCell.m:508` 的 `zx_sharedStreamingMeasureTextView` 旁边加一个共享段栈测量实例：

```objc
+ (ZXMarkdownContentView *)zx_sharedStreamingMeasureContentView {
    static ZXMarkdownContentView *measureView = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        measureView = [[ZXMarkdownContentView alloc] initWithFrame:CGRectZero];
    });
    return measureView;
}
```

流式高度计算处（`:578-582`）按 `hasTable` 分支选用哪个测量实例。

- [ ] **Step 4: 🧑 人工自测（重点是流式）**

让智能体输出一段含表格的回复，盯着看：吐表格过程中显示等宽纯文本 → 表格吐完后变成表格视图 → 高度只跳一次、不闪不抖。再验 C1 引用角标点击、C2 插图与表格共存。

- [ ] **Step 5: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Logic/ZXIMCellLogic.h \
        SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Logic/ZXIMCellLogic.m \
        SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXIMAgentStreamReplyCell.m \
        SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMChatCell/ZXGroupRobotCell.m
git commit -m "feat(markdown): 智能体气泡接入段栈渲染，流式未闭合表格先按纯文本显示"
```

---

## Task 12: 接入回复聚合弹窗（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_ReplyPolymer/ZXPolymerPopView.m:539` 附近（具体行号以 Task 1 的排查结论为准）

- [ ] **Step 1: 按 Task 1 的结论选接法**

- 若正文控件是 `UITextView` → 照 Task 10 模式加 `markdownContentView` 分支
- 若是 `UILabel` → 先换成 `ZXMarkdownContentView`（`UILabel` 挂不了 attachment 点击），约束照搬原 label

- [ ] **Step 2: 🧑 人工自测**

在群里对一条含表格的智能体回复点开聚合弹窗，确认表格渲染、可横拖、弹窗高度正确。

- [ ] **Step 3: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_ReplyPolymer/ZXPolymerPopView.m
git commit -m "feat(markdown): 回复聚合弹窗接入段栈渲染"
```

---

## Task 13: 接入合并转发详情页（ios）

**Files:**
- Modify: 由 Task 1 的排查结论确定（`ZXCombineMessageLogic` 链路上的详情页 Controller / cell）

- [ ] **Step 1: 按结论接入**

- 若复用会话页 cell → Task 10/11 改完这里自动就好，本任务只做验证，跳到 Step 2
- 若是独立实现 → 照 Task 10 模式加 `markdownContentView` 分支与高度改写

- [ ] **Step 2: 🧑 人工自测**

把一条含表格 + 三层列表的机器人消息合并转发，打开详情页确认渲染与会话页一致。

- [ ] **Step 3: 提交**

```bash
cd apps/ios
git add -u
git commit -m "feat(markdown): 合并转发详情页接入段栈渲染"
```

---

## Task 14: 全量验收与收尾（ios）

**Files:**
- Modify: `context/features/20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化/status.md`
- Modify: `context/features/20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化/impl-notes.md`

- [ ] **Step 1: 🧑 三档构建**

1. `zhixinAppTest` + iPhone 15 / iOS 17 模拟器 Debug —— clean build 通过
2. 真机 Debug —— 签名 + arm64 通过
3. `zhixinAppProd` archive —— 通过（历史上 bitcode/archive 出过问题，必须验）

- [ ] **Step 2: 🧑 记录包体增量**

Xcode Organizer → 选中新 archive → App Thinning Size Report，与上一次 archive 对比，记下增量数字。

- [ ] **Step 3: 🧑 跑完整自测清单**

四个接入点 × spec 附录用例代表项（每处至少跑 T1/T2/T7/L1/L4/C6），外加 C1-C5。

- [ ] **Step 4: 更新文档**

`status.md`：平台矩阵全部打 ✅，写明最终 commit、包体增量数字、`ZXMarkdownUseCMark` 开关位置。
`impl-notes.md`：补「GFM 渲染实现要点」小节 —— 块切分规则、流式降级判定条件、三重兜底、表格列宽策略、cmark 扩展注册时机。这是平台无关的逻辑提炼，其他端将来遇到同类问题可直接参考。

- [ ] **Step 5: 提交 context**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化
git commit -m "docs(20260813-ios-GFM-Markdown渲染优化): 全量验收通过，补实现笔记与包体数据"
```

---

## 风险与回滚

| 风险 | 触发信号 | 处置 |
|------|----------|------|
| `libcmark_gfm` pod 拉不到 / 内网装不上 | Task 2 Step 2 `pod install` 失败 | 改走源码内置：cmark-gfm 源码进 `SmartMessage/ZX_ThridParty/cmark-gfm/`，其余任务不变 |
| archive 阶段爆 bitcode / 链接错误 | Task 14 Step 1 第 3 档失败 | 检查 `Podfile` `post_install` 是否需把新 pod 加进统一 `ENABLE_BITCODE=NO` 处理 |
| 线上渲染异常 | 用户反馈乱版 | `ZXMarkdownUseCMark = NO` 一行回退老正则，发补丁包 |
| 流式高度抖动 | Task 11 Step 4 自测发现 | 检查 `streaming` 判定是否透传正确；必要时把「文末表格降级」放宽成「最后两个块都降级」 |
| 表格横滚与会话列表纵滚打架 | Task 10 Step 5 自测发现 | `directionalLockEnabled` 已开；仍冲突则给表格 scrollView 的 panGesture 加 `require gestureRecognizerShouldBegin` 方向判定 |
