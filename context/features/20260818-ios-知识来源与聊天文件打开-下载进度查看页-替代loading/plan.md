# iOS 打开文件的下载进度与取消 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development 或 superpowers:executing-plans 逐任务执行。步骤用 `- [ ]` 勾选。

**Goal：** iOS 上点开文件（知识来源 / 聊天文件 / H5 知识来源）时，把无信息的转圈 HUD 换成「实时百分比 + 可取消」的浮层。

**Architecture：** 三个入口最终都落到 `ZXFileClient writeToFile:` 这一个下载点。所以在下载层暴露进度与取消，在已有的 `ZXFilePreviewLoadHUD` 上加环形进度与取消按钮，再用一个轻量会话对象 `ZXFileLoadingSession` 统一「前置假进度 → 真实下载进度」的映射与取消聚合；各入口只负责创建会话、接回调。H5 侧新增专用桥 `openKnowledgeDoc`，把元数据 / 授权 / 签名 / 下载全部收回原生。

**Tech Stack：** Objective-C + UIKit（iOS，无单测无 lint）｜ Vue 3 + `node --test`（web）

## Global Constraints

- iOS 仓库**纯 Objective-C**，类 / 常量统一 `ZX` 前缀，注释用中文。
- **AI 不执行 `pod install` / `xcodebuild` / `xcrun simctl`**（`apps/ios/CLAUDE.md` 明令）。iOS 每个任务只改代码 + commit，编译与自测由人工在 Xcode 完成。
- **不新增 iOS 文件**：新类 `ZXFileLoadingSession` 写进已存在的 `ZXFilePreviewLoadHUD.h/.m`，避免改 `project.pbxproj` 带来排序噪声与漏加 target。
- 进度**单调不回退**：任何更新取 `max(当前, 新值)`。
- 取消**不做断点续传**：中止任务 + 删半成品 + 关浮层，不弹 toast。
- 分支：ios = `feat/ios-file-download-progress`（从 `release` 切）；web = `feat/knowledge-file-progress`（从 `release` 切）。
- web 端禁止改动与本功能无关的文件；desktop 三个本地调试文件（`.env.test` / `electron-builder.yml` / `package.json`）本次完全不碰。
- 桥方法名 `openKnowledgeDoc`，注册在 `ZXJSAIChatAPI`（对应 web 侧 `wnsdk.aiChat.openKnowledgeDoc`）。

---

### Task 0: 切分支（ios + web）

**Files:** 无代码改动

- [ ] **Step 1: iOS 切分支**

```bash
cd apps/ios
git fetch origin
git switch -c feat/ios-file-download-progress origin/release
git status --porcelain   # 期望：空
```

- [ ] **Step 2: web 切分支**

```bash
cd apps/web
git fetch origin
git switch -c feat/knowledge-file-progress origin/release
git status --porcelain   # 期望：空
```

- [ ] **Step 3: 确认基线**

```bash
git -C apps/ios log --oneline -1
git -C apps/web log --oneline -1
```

期望：两条都指向各自 `origin/release` 的最新提交。若 `release` 明显落后于团队实际主干，**停下来问用户**再继续。

---

### Task 1: 浮层升级为环形进度 + 取消按钮（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.h`
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.m`
- Test: 无（iOS 无单测，人工自测）

**Interfaces:**
- Consumes: 无
- Produces:
  - `+ (void)showWithTitle:(nullable NSString *)title progress:(float)progress onCancel:(nullable dispatch_block_t)onCancel;`
  - 保留 `+ (void)showWithTitle:(nullable NSString *)title progress:(float)progress;`（转调新方法，`onCancel` 传 nil，不显示取消按钮）
  - 保留 `+ (void)updateProgress:(float)progress;` / `+ (void)finishWithCompletion:(nullable dispatch_block_t)completion;` / `+ (void)dismiss;`

- [ ] **Step 1: 头文件加新 API**

`ZXFilePreviewLoadHUD.h` 的 `@interface ZXFilePreviewLoadHUD : UIView` 内，在 `+ (void)showWithTitle:progress:` 下面加一行：

```objc
/// 展示进度浮层。onCancel 非空时显示「取消」按钮，用户点击后浮层自动关闭并回调。
+ (void)showWithTitle:(nullable NSString *)title progress:(float)progress onCancel:(nullable dispatch_block_t)onCancel;
```

- [ ] **Step 2: 替换类扩展的私有属性**

`ZXFilePreviewLoadHUD.m` 中把原有类扩展整体替换为：

```objc
@interface ZXFilePreviewLoadHUD ()

@property (nonatomic, strong) UIView *progressContainerView;
@property (nonatomic, strong) UILabel *progressTitleLabel;
/// 环形进度：底环 + 进度环
@property (nonatomic, strong) CAShapeLayer *ringTrackLayer;
@property (nonatomic, strong) CAShapeLayer *ringProgressLayer;
@property (nonatomic, strong) UILabel *progressValueLabel;
@property (nonatomic, strong) UIView *separatorLine;
@property (nonatomic, strong) UIButton *cancelButton;
@property (nonatomic, copy, nullable) dispatch_block_t cancelHandler;
/// 已展示的最大进度，保证单调不回退
@property (nonatomic, assign) float displayedProgress;

@end
```

同时把文件顶部的常量补成：

```objc
static ZXFilePreviewLoadHUD *ZXFilePreviewCurrentLoadingView = nil;
static NSTimeInterval const ZXFilePreviewLoadHUDFinishDuration = 0.25f;
/// 环形进度尺寸
static CGFloat const ZXFilePreviewLoadHUDRingSize = 72.0f;
static CGFloat const ZXFilePreviewLoadHUDRingWidth = 5.0f;
```

- [ ] **Step 3: 改造展示方法**

把 `+ (void)showWithTitle:progress:` 整段替换为：

```objc
+ (void)showWithTitle:(NSString *)title progress:(float)progress {
    [self showWithTitle:title progress:progress onCancel:nil];
}

+ (void)showWithTitle:(NSString *)title progress:(float)progress onCancel:(dispatch_block_t)onCancel {
    [self performOnMainThread:^{
        UIWindow *window = [self targetWindow];
        if (!window) {
            return;
        }

        ZXFilePreviewLoadHUD *loadingView = ZXFilePreviewCurrentLoadingView;
        if (!loadingView) {
            loadingView = [[ZXFilePreviewLoadHUD alloc] initWithFrame:window.bounds];
            ZXFilePreviewCurrentLoadingView = loadingView;
        }
        if (loadingView.superview != window) {
            [loadingView removeFromSuperview];
            loadingView.frame = window.bounds;
            [window addSubview:loadingView];
        }
        loadingView.progressTitleLabel.text = title.length > 0 ? title : @"文件加载中...";
        loadingView.cancelHandler = onCancel;
        loadingView.separatorLine.hidden = (onCancel == nil);
        loadingView.cancelButton.hidden = (onCancel == nil);
        loadingView.displayedProgress = 0.0f;
        [loadingView setProgress:progress animated:NO];
        [loadingView setNeedsLayout];
        [window bringSubviewToFront:loadingView];

        if (loadingView.alpha < 1.0f) {
            loadingView.alpha = 0.0f;
            [UIView animateWithDuration:0.15 animations:^{
                loadingView.alpha = 1.0f;
            }];
        }
    }];
}
```

- [ ] **Step 4: dismiss 时清掉回调**

把 `+ (void)dismiss` 内 `ZXFilePreviewCurrentLoadingView = nil;` 那行**之后**补一行清理，整段改为：

```objc
+ (void)dismiss {
    [self performOnMainThread:^{
        ZXFilePreviewLoadHUD *loadingView = ZXFilePreviewCurrentLoadingView;
        if (!loadingView) {
            return;
        }
        ZXFilePreviewCurrentLoadingView = nil;
        loadingView.cancelHandler = nil;
        [UIView animateWithDuration:0.15 animations:^{
            loadingView.alpha = 0.0f;
        } completion:^(BOOL finished) {
            [loadingView removeFromSuperview];
        }];
    }];
}
```

- [ ] **Step 5: 重建视图层级与布局**

把 `- (instancetype)initWithFrame:` 与 `- (void)layoutSubviews` 两段整体替换为：

```objc
- (instancetype)initWithFrame:(CGRect)frame {
    self = [super initWithFrame:frame];
    if (self) {
        self.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        self.backgroundColor = [UIColor colorWithWhite:0.0f alpha:0.16f];
        self.accessibilityViewIsModal = YES;

        [self addSubview:self.progressContainerView];
        [self.progressContainerView.layer addSublayer:self.ringTrackLayer];
        [self.progressContainerView.layer addSublayer:self.ringProgressLayer];
        [self.progressContainerView addSubview:self.progressValueLabel];
        [self.progressContainerView addSubview:self.progressTitleLabel];
        [self.progressContainerView addSubview:self.separatorLine];
        [self.progressContainerView addSubview:self.cancelButton];
    }
    return self;
}

- (void)layoutSubviews {
    [super layoutSubviews];

    CGFloat horizontalMargin = 40.0f;
    CGFloat containerWidth = MIN(240.0f, MAX(0.0f, CGRectGetWidth(self.bounds) - horizontalMargin * 2.0f));
    BOOL hasCancel = !self.cancelButton.hidden;
    CGFloat containerHeight = hasCancel ? 208.0f : 160.0f;
    self.progressContainerView.frame = CGRectMake((CGRectGetWidth(self.bounds) - containerWidth) * 0.5f,
                                                  (CGRectGetHeight(self.bounds) - containerHeight) * 0.5f,
                                                  containerWidth,
                                                  containerHeight);

    CGFloat ringSize = ZXFilePreviewLoadHUDRingSize;
    CGRect ringRect = CGRectMake((containerWidth - ringSize) * 0.5f, 26.0f, ringSize, ringSize);
    UIBezierPath *ringPath = [UIBezierPath bezierPathWithArcCenter:CGPointMake(CGRectGetMidX(ringRect), CGRectGetMidY(ringRect))
                                                           radius:(ringSize - ZXFilePreviewLoadHUDRingWidth) * 0.5f
                                                       startAngle:-M_PI_2
                                                         endAngle:(-M_PI_2 + 2 * M_PI)
                                                        clockwise:YES];
    self.ringTrackLayer.path = ringPath.CGPath;
    self.ringProgressLayer.path = ringPath.CGPath;
    self.ringTrackLayer.frame = self.progressContainerView.bounds;
    self.ringProgressLayer.frame = self.progressContainerView.bounds;

    self.progressValueLabel.frame = ringRect;
    self.progressTitleLabel.frame = CGRectMake(16.0f, CGRectGetMaxY(ringRect) + 14.0f, containerWidth - 32.0f, 22.0f);
    self.separatorLine.frame = CGRectMake(0.0f, containerHeight - 48.0f, containerWidth, 0.5f);
    self.cancelButton.frame = CGRectMake(0.0f, containerHeight - 48.0f + 0.5f, containerWidth, 47.5f);
}
```

- [ ] **Step 6: 进度设置改为驱动环形 + 单调保护**

把 `- (void)setProgress:animated:` 整段替换为：

```objc
- (void)setProgress:(float)progress animated:(BOOL)animated {
    float validProgress = MIN(MAX(progress, 0.0f), 1.0f);
    // 单调保护：只允许前进，避免多段进度来回跳
    if (validProgress < self.displayedProgress) {
        validProgress = self.displayedProgress;
    }
    self.displayedProgress = validProgress;

    [CATransaction begin];
    [CATransaction setDisableActions:!animated];
    if (animated) {
        [CATransaction setAnimationDuration:0.2];
    }
    self.ringProgressLayer.strokeEnd = validProgress;
    [CATransaction commit];

    self.progressValueLabel.text = [NSString stringWithFormat:@"%.0f%%", validProgress * 100.0f];
    self.accessibilityLabel = self.progressTitleLabel.text;
    self.accessibilityValue = self.progressValueLabel.text;
}

- (void)zx_cancelTapped {
    dispatch_block_t handler = self.cancelHandler;
    [ZXFilePreviewLoadHUD dismiss];
    !handler ?: handler();
}
```

- [ ] **Step 7: 替换 getter**

把原 `- (UIProgressView *)progressView` getter 删除，并把 getter 区整体补成（`progressContainerView` / `progressTitleLabel` / `progressValueLabel` 保留原实现，新增下面三个）：

```objc
- (CAShapeLayer *)ringTrackLayer {
    if (!_ringTrackLayer) {
        _ringTrackLayer = [CAShapeLayer layer];
        _ringTrackLayer.fillColor = UIColor.clearColor.CGColor;
        _ringTrackLayer.strokeColor = [UIColor colorWithWhite:0.92f alpha:1.0f].CGColor;
        _ringTrackLayer.lineWidth = ZXFilePreviewLoadHUDRingWidth;
    }
    return _ringTrackLayer;
}

- (CAShapeLayer *)ringProgressLayer {
    if (!_ringProgressLayer) {
        _ringProgressLayer = [CAShapeLayer layer];
        _ringProgressLayer.fillColor = UIColor.clearColor.CGColor;
        _ringProgressLayer.strokeColor = Color_Main.CGColor;
        _ringProgressLayer.lineWidth = ZXFilePreviewLoadHUDRingWidth;
        _ringProgressLayer.lineCap = kCALineCapRound;
        _ringProgressLayer.strokeEnd = 0.0f;
    }
    return _ringProgressLayer;
}

- (UIView *)separatorLine {
    if (!_separatorLine) {
        _separatorLine = [[UIView alloc] initWithFrame:CGRectZero];
        _separatorLine.backgroundColor = [UIColor colorWithWhite:0.90f alpha:1.0f];
    }
    return _separatorLine;
}

- (UIButton *)cancelButton {
    if (!_cancelButton) {
        _cancelButton = [UIButton buttonWithType:UIButtonTypeCustom];
        [_cancelButton setTitle:@"取消" forState:UIControlStateNormal];
        [_cancelButton setTitleColor:[UIColor colorWithWhite:0.35f alpha:1.0f] forState:UIControlStateNormal];
        _cancelButton.titleLabel.font = [UIFont systemFontOfSize:16.0f];
        [_cancelButton addTarget:self action:@selector(zx_cancelTapped) forControlEvents:UIControlEventTouchUpInside];
    }
    return _cancelButton;
}
```

`progressValueLabel` 的字体改大以适配环心，把它的 getter 里的字号那行改为：

```objc
        _progressValueLabel.font = [UIFont systemFontOfSize:20.0f weight:UIFontWeightMedium];
        _progressValueLabel.textColor = [UIColor colorWithWhite:0.15f alpha:1.0f];
```

- [ ] **Step 8: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.h \
        SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.m
git commit -m "feat(file-preview): 加载浮层改环形进度并支持取消"
```

> 本任务不编译（AI 不跑 xcodebuild）。人工验证放到 Task 8 的自测清单。

---

### Task 2: 下载层暴露进度与取消（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_CoreKit/ZX_DataClient/ZXFileClient.h`
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_CoreKit/ZX_DataClient/ZXFileClient.m:86-200`
- Test: 无（iOS 无单测）

**Interfaces:**
- Consumes: 无
- Produces:
  - `@interface ZXFileDownloadTask : NSObject`，含 `- (void)cancel;` 与 `@property (nonatomic, readonly, getter=isCancelled) BOOL cancelled;`
  - `- (nullable ZXFileDownloadTask *)writeToFile:(ZXFileCacheModel *(^_Nullable)(void))cacheModelBlock progress:(void(^_Nullable)(float progress))progress completion:(void(^_Nullable)(NSString * _Nullable result, ZXError * _Nullable error))completion;`
  - 旧的 `- (void)writeToFile:completion:` 行为不变（内部转调新方法，progress 传 nil）

- [ ] **Step 1: 头文件加下载句柄与新方法**

`ZXFileClient.h` 中，在 `@interface ZXFileClient : NSObject` **之前**插入：

```objc
/// 可取消的文件下载句柄。取消后会中止网络任务并删除半成品文件。
@interface ZXFileDownloadTask : NSObject

@property (nonatomic, readonly, getter=isCancelled) BOOL cancelled;

- (void)cancel;

@end
```

并在 `- (void)writeToFile:completion:` 声明**下面**加：

```objc
/**
 存储文件（带下载进度，可取消）

 @param cacheModelBlock 缓存Model
 @param progress 下载进度回调（0~1），仅远端文件下载分支会回调，可能在子线程
 @param completion 完成回调
 @return 远端文件下载分支返回可取消句柄；其余分支返回 nil
 */
- (nullable ZXFileDownloadTask *)writeToFile:(ZXFileCacheModel *(^_Nullable)(void))cacheModelBlock
                                    progress:(void(^_Nullable)(float progress))progress
                                  completion:(void(^_Nullable)(NSString * _Nullable result, ZXError * _Nullable error))completion;
```

- [ ] **Step 2: 实现下载句柄**

`ZXFileClient.m` 中，在 `@implementation ZXFileClient` **之前**插入：

```objc
@interface ZXFileDownloadTask ()

@property (nonatomic, strong, nullable) NSURLSessionDownloadTask *sessionTask;
@property (nonatomic, copy, nullable) NSString *destinationPath;
@property (nonatomic, assign) BOOL cancelled;

@end

@implementation ZXFileDownloadTask

- (void)cancel {
    if (_cancelled) {
        return;
    }
    _cancelled = YES;
    [_sessionTask cancel];
    _sessionTask = nil;
    // 删除半成品文件，避免下次命中缓存读到坏文件
    if (_destinationPath.length && [NSFileManager.defaultManager fileExistsAtPath:_destinationPath]) {
        [NSFileManager.defaultManager removeItemAtPath:_destinationPath error:nil];
    }
}

@end
```

- [ ] **Step 3: 老方法转调新方法**

把 `- (void)writeToFile:(ZXFileCacheModel *(^)(void))cacheModelBlock completion:(...)completion {` 这一行**替换**为下面两段（老方法变成薄壳，原方法体整体归到新方法名下）：

```objc
- (void)writeToFile:(ZXFileCacheModel *(^)(void))cacheModelBlock completion:(void(^)(NSString * _Nullable result, ZXError * _Nullable error))completion {
    [self writeToFile:cacheModelBlock progress:nil completion:completion];
}

- (ZXFileDownloadTask *)writeToFile:(ZXFileCacheModel *(^)(void))cacheModelBlock
                           progress:(void(^)(float progress))progress
                         completion:(void(^)(NSString * _Nullable result, ZXError * _Nullable error))completion {
```

方法体保持不变，但**所有提前 return 的分支**要改成 `return nil;`（原来是裸 `return;`），且方法末尾补 `return nil;`。具体：`filePath.length == 0` 分支、`fileName.length == 0` 分支、`ZXCacheTypeImage` / `ZXCacheTypeThumbnailImage` 的 `fileData.length == 0` 分支，共 4 处 `return;` → `return nil;`。

- [ ] **Step 4: 文件下载分支接进度与取消**

把 `ZXCacheTypeFile` 分支里 `model.fileURL.absoluteString.length > 0` 那段（`AFHTTPSessionManager` 到 `[downloadTask resume];`）整体替换为：

```objc
        } else if (model.fileURL.absoluteString.length > 0) {
            AFHTTPSessionManager *manager = [AFHTTPSessionManager manager];
            NSURLRequest *request = [NSURLRequest requestWithURL:model.fileURL];
            ZXFileDownloadTask *cancelToken = [[ZXFileDownloadTask alloc] init];
            cancelToken.destinationPath = filePath;
            NSURLSessionDownloadTask *downloadTask = [manager downloadTaskWithRequest:request progress:^(NSProgress * _Nonnull downloadProgress) {
                if (!progress || downloadProgress.totalUnitCount <= 0) {
                    return;
                }
                progress((float)downloadProgress.fractionCompleted);
            } destination:^NSURL * _Nonnull(NSURL * _Nonnull targetPath, NSURLResponse * _Nonnull response) {
                return [NSURL fileURLWithPath:filePath];
            } completionHandler:^(NSURLResponse * _Nonnull response, NSURL * _Nullable responseFilePath, NSError * _Nullable error) {
                // 用户已取消：不再回调，交由 cancel 内部清理半成品
                if (cancelToken.isCancelled) {
                    return;
                }
                if (!error) {
                    !completion ?: completion(filePath, nil);
                } else {
                    !completion ?: completion(nil, [ZXError errorWithCode:ZXErrorCode_CacheFailed errorMsg:ZXErrorMsg_CacheFailed]);
                }
            }];
            cancelToken.sessionTask = downloadTask;
            [downloadTask resume];
            return cancelToken;
        } else {
```

- [ ] **Step 5: 自查**

```bash
cd apps/ios
grep -n "return nil;" SmartMessage/ZX_Kit/ZX_CoreKit/ZX_DataClient/ZXFileClient.m | head -20
```

期望：新方法体内 5 处以上 `return nil;`（4 处提前返回 + 方法末尾），且下载分支返回的是 `cancelToken`。

- [ ] **Step 6: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Kit/ZX_CoreKit/ZX_DataClient/ZXFileClient.h \
        SmartMessage/ZX_Kit/ZX_CoreKit/ZX_DataClient/ZXFileClient.m
git commit -m "feat(file-client): 文件下载暴露进度回调与取消句柄"
```

---

### Task 3: 加载会话对象（前置假进度 + 阶段映射 + 取消聚合）（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.h`
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.m`
- Test: 无（iOS 无单测）

**Interfaces:**
- Consumes: Task 1 的 `ZXFilePreviewLoadHUD` 全部类方法
- Produces：
  - `@interface ZXFileLoadingSession : NSObject`
  - `+ (instancetype)startWithTitle:(nullable NSString *)title;`
  - `@property (nonatomic, copy, nullable) dispatch_block_t onCancel;`
  - `@property (nonatomic, readonly, getter=isCancelled) BOOL cancelled;`
  - `- (void)updatePollingProgress:(float)progress;`（解密轮询段，直接用传入值）
  - `- (void)updateDownloadProgress:(float)progress;`（下载段，0~1 映射到 [起点, 1.0]）
  - `- (void)finishWithCompletion:(nullable dispatch_block_t)completion;`
  - `- (void)dismiss;`

- [ ] **Step 1: 头文件加会话类**

`ZXFilePreviewLoadHUD.h` 中 `ZXFilePreviewLoadHUD` 的 `@end` **之后**、`NS_ASSUME_NONNULL_END` **之前**插入：

```objc
/// 一次「打开文件」的加载会话：负责前置阶段假进度、下载真实进度映射、取消聚合。
/// 生命周期由调用方持有（强引用），dismiss / finish 后即可释放。
@interface ZXFileLoadingSession : NSObject

/// 展示浮层并启动前置假进度（0 → 8%，每 0.5s 前进 1%）
+ (instancetype)startWithTitle:(nullable NSString *)title;

/// 用户点取消时回调。调用方在这里取消自己的网络任务。
@property (nonatomic, copy, nullable) dispatch_block_t onCancel;
/// 是否已被用户取消。取消后所有进度更新与 finish 都会被忽略。
@property (nonatomic, readonly, getter=isCancelled) BOOL cancelled;

/// 绿盾解密轮询进度（调用方已按 0.05~0.65 语义传值），直接展示
- (void)updatePollingProgress:(float)progress;
/// 下载进度（0~1），映射到 [下载起点, 1.0]；起点为 0.08，若此前走过解密轮询则为 0.65
- (void)updateDownloadProgress:(float)progress;
/// 补到 100% 并在动画结束后回调（用于弹预览前的收尾）
- (void)finishWithCompletion:(nullable dispatch_block_t)completion;
/// 直接关闭浮层（失败或不再需要时）
- (void)dismiss;

@end
```

- [ ] **Step 2: 实现会话类**

`ZXFilePreviewLoadHUD.m` 文件**末尾**（`@end` 之后）追加：

```objc
#pragma mark - 加载会话

/// 前置阶段假进度上限
static float const ZXFileLoadingSessionPreProgressCap = 0.08f;
/// 前置阶段假进度步进间隔
static NSTimeInterval const ZXFileLoadingSessionPreProgressInterval = 0.5f;
/// 解密轮询结束后的下载起点
static float const ZXFileLoadingSessionPolledDownloadStart = 0.65f;

@interface ZXFileLoadingSession ()

@property (nonatomic, strong, nullable) NSTimer *preProgressTimer;
@property (nonatomic, assign) float preProgress;
@property (nonatomic, assign) BOOL polled;
@property (nonatomic, assign) BOOL finished;
@property (nonatomic, assign) BOOL cancelled;

@end

@implementation ZXFileLoadingSession

+ (instancetype)startWithTitle:(NSString *)title {
    ZXFileLoadingSession *session = [[ZXFileLoadingSession alloc] init];
    session.preProgress = 0.02f;
    __weak typeof(session) weakSession = session;
    [ZXFilePreviewLoadHUD showWithTitle:title.length ? title : @"文件加载中..."
                               progress:session.preProgress
                               onCancel:^{
        [weakSession zx_handleCancel];
    }];
    [session zx_startPreProgressTimer];
    return session;
}

- (void)dealloc {
    [_preProgressTimer invalidate];
    _preProgressTimer = nil;
}

- (void)zx_startPreProgressTimer {
    [self zx_stopPreProgressTimer];
    __weak typeof(self) weakSelf = self;
    self.preProgressTimer = [NSTimer scheduledTimerWithTimeInterval:ZXFileLoadingSessionPreProgressInterval
                                                            repeats:YES
                                                              block:^(NSTimer * _Nonnull timer) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf || strongSelf.cancelled) {
            [timer invalidate];
            return;
        }
        if (strongSelf.preProgress >= ZXFileLoadingSessionPreProgressCap) {
            [timer invalidate];
            return;
        }
        strongSelf.preProgress = MIN(strongSelf.preProgress + 0.01f, ZXFileLoadingSessionPreProgressCap);
        [ZXFilePreviewLoadHUD updateProgress:strongSelf.preProgress];
    }];
}

- (void)zx_stopPreProgressTimer {
    [self.preProgressTimer invalidate];
    self.preProgressTimer = nil;
}

- (void)zx_handleCancel {
    if (self.cancelled) {
        return;
    }
    self.cancelled = YES;
    [self zx_stopPreProgressTimer];
    dispatch_block_t handler = self.onCancel;
    self.onCancel = nil;
    !handler ?: handler();
}

- (void)updatePollingProgress:(float)progress {
    if (self.cancelled || self.finished) {
        return;
    }
    [self zx_stopPreProgressTimer];
    self.polled = YES;
    [ZXFilePreviewLoadHUD updateProgress:progress];
}

- (void)updateDownloadProgress:(float)progress {
    if (self.cancelled || self.finished) {
        return;
    }
    [self zx_stopPreProgressTimer];
    float start = self.polled ? ZXFileLoadingSessionPolledDownloadStart : ZXFileLoadingSessionPreProgressCap;
    float mapped = start + MIN(MAX(progress, 0.0f), 1.0f) * (1.0f - start);
    [ZXFilePreviewLoadHUD updateProgress:mapped];
}

- (void)finishWithCompletion:(dispatch_block_t)completion {
    if (self.cancelled) {
        return;
    }
    self.finished = YES;
    [self zx_stopPreProgressTimer];
    [ZXFilePreviewLoadHUD finishWithCompletion:^{
        [ZXFilePreviewLoadHUD dismiss];
        !completion ?: completion();
    }];
}

- (void)dismiss {
    [self zx_stopPreProgressTimer];
    [ZXFilePreviewLoadHUD dismiss];
}

@end
```

- [ ] **Step 3: 自查**

```bash
cd apps/ios
grep -n "ZXFileLoadingSession" SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.h | head
```

期望：头文件里能看到 `@interface ZXFileLoadingSession : NSObject` 与 6 个方法 / 2 个属性声明。

- [ ] **Step 4: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.h \
        SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZX_FilePreview/ZXFilePreviewLoadHUD.m
git commit -m "feat(file-preview): 新增加载会话，统一假进度映射与取消聚合"
```

---

### Task 4: 知识来源入口接线（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAgentKnowledgeOpenLogic.m`
- Test: 无（iOS 无单测）

**Interfaces:**
- Consumes: Task 3 的 `ZXFileLoadingSession`、Task 2 的 `writeToFile:progress:completion:` 与 `ZXFileDownloadTask`
- Produces: 无对外新接口（`openItem:fromController:` 签名不变）

- [ ] **Step 1: 引头文件**

`ZXAgentKnowledgeOpenLogic.m` 顶部 import 区补两行：

```objc
#import "ZXFilePreviewLoadHUD.h"
#import "ZXFileClient.h"
```

- [ ] **Step 2: `openItem:` 换成会话**

把 `+ (void)openItem:fromController:` 里的 `[ZXProgressHUD show:@"文件加载中..."];` 与紧随其后的 `[ZXProgressHUD dismiss];` 替换为会话。方法整体改为：

```objc
+ (void)openItem:(ZXAgentKnowledgeItem *)item fromController:(UIViewController *)controller {
    if (!item || !controller) {
        return;
    }
    ZXFileLoadingSession *session = [ZXFileLoadingSession startWithTitle:@"文件加载中..."];
    [self requestAgentFileDataForItem:item completion:^(ZXAgentFileDataModel * _Nullable fileData, ZXError * _Nullable error) {
        // 用户已取消：后续一律丢弃
        if (session.isCancelled) {
            return;
        }
        if (error) {
            [session dismiss];
            if ([error.errorCode isEqualToString:ZXAgentKnowledgeFeishuAuthErrorCode]) {
                NSString *authURL = [NSString stringWithFormat:@"%@ai-chat/FeishuAuthSinglePage?share=zx_pf_2", ZX_HostUrl];
                [self presentAgentAuthFromController:controller authUrl:authURL title:@"飞书授权" onFinished:nil];
                return;
            }
            if ([error.errorCode isEqualToString:ZXAgentKnowledgeWpsAuthErrorCode]) {
                NSString *authURL = [NSString stringWithFormat:@"%@ai-chat/WpsAuthSinglePage?share=zx_pf_2", ZX_HostUrl];
                [self presentAgentAuthFromController:controller authUrl:authURL title:@"WPS授权" onFinished:nil];
                return;
            }
            NSString *tip = error.errorMsg.length ? error.errorMsg : @"文件打开失败，请稍候重试";
            [ZXToast show:tip];
            return;
        }
        if (!fileData) {
            [session dismiss];
            [ZXToast show:@"知识已删除，无法访问"];
            return;
        }
        if (fileData.haveAuth && fileData.userFileId.length) {
            ZXAgentKnowledgeItem *shareItem = item;
            shareItem.userFileId = fileData.userFileId;
            [self openZhiWenFile:shareItem fromController:controller session:session];
            return;
        }
        if (fileData.url.length) {
            [self openResolvedFileURL:fileData.url item:item fromController:controller session:session];
            return;
        }
        [session dismiss];
        if (!fileData.haveAuth) {
            NSString *encodedTitle = [item.docName ?: @"" stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]] ?: @"";
            NSString *emptyURL = [NSString stringWithFormat:@"%@ai-chat/EmptyPage?type=fileNoAuth&title=%@", ZX_HostUrl, encodedTitle];
            [self openWebURL:emptyURL fromController:controller targetId:nil];
            return;
        }
        [ZXToast show:@"文件链接为空，请稍候重试"];
    }];
}
```

- [ ] **Step 3: 分发方法带上 session**

把 `+ (void)openResolvedFileURL:item:fromController:` 整段替换为（加 `session:` 参数并透传）：

```objc
+ (void)openResolvedFileURL:(NSString *)url
                       item:(ZXAgentKnowledgeItem *)item
             fromController:(UIViewController *)controller
                    session:(ZXFileLoadingSession *)session {
    item.resolvedURL = url;
    if (item.fromType == 0 || item.fromType == 1 || item.fromType == 2) {
        NSString *fileURL = [self shouldSignKnowledgeURLForFromType:item.fromType] ? [self normalizedKnowledgeFileURL:url] : url;
        if ([self isImageFileName:item.docName]) {
            [self openKnowledgeImage:fileURL docName:item.docName fromType:item.fromType fromController:controller session:session];
        } else {
            [self openKnowledgeDocument:fileURL item:item fromController:controller session:session];
        }
        return;
    }
    [session dismiss];
    [self openWebURL:url fromController:controller targetId:nil];
}
```

- [ ] **Step 4: 图片分支带上 session**

把 `+ (void)openKnowledgeImage:docName:fromType:fromController:` 整段替换为：

```objc
+ (void)openKnowledgeImage:(NSString *)fileURL
                   docName:(NSString *)docName
                  fromType:(NSInteger)fromType
            fromController:(UIViewController *)controller
                   session:(ZXFileLoadingSession *)session {
    if (!fileURL.length) {
        [session dismiss];
        [ZXToast show:@"图片链接为空"];
        return;
    }
    void (^previewBlock)(NSString *) = ^(NSString *remoteURL) {
        if (session.isCancelled) {
            return;
        }
        MWPhoto *photo = [MWPhoto photoWithURL:[NSURL URLWithString:remoteURL]];
        ZXAgentKnowledgePhotoPreviewHelper *helper = [[ZXAgentKnowledgePhotoPreviewHelper alloc] init];
        helper.photo = photo;
        MWPhotoBrowser *browser = [[MWPhotoBrowser alloc] initWithDelegate:helper];
        browser.displayActionButton = NO;
        browser.displayNavArrows = NO;
        browser.displaySelectionButtons = NO;
        browser.zoomPhotosToFill = YES;
        browser.alwaysShowControls = NO;
        browser.enableGrid = NO;
        browser.startOnGrid = NO;
        [session finishWithCompletion:^{
            [controller presentViewController:browser animated:YES completion:nil];
            objc_setAssociatedObject(browser, &kZXAgentKnowledgePhotoPreviewHelperKey, helper, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        }];
    };
    if ([self shouldSignKnowledgeURLForFromType:fromType]) {
        [ZXOSSClient getSignedUrl:fileURL completion:^(NSString * _Nullable signedUrl, ZXError * _Nullable error) {
            if (session.isCancelled) {
                return;
            }
            if (error || !signedUrl.length) {
                [session dismiss];
                [ZXToast show:@"查看图片失败，请稍候重试。"];
                return;
            }
            previewBlock(signedUrl);
        }];
    } else {
        previewBlock(fileURL);
    }
}
```

- [ ] **Step 5: 文档分支接下载进度与取消**

把 `+ (void)openKnowledgeDocument:item:fromController:` 整段替换为：

```objc
+ (void)openKnowledgeDocument:(NSString *)fileURL
                         item:(ZXAgentKnowledgeItem *)item
               fromController:(UIViewController *)controller
                      session:(ZXFileLoadingSession *)session {
    if (!fileURL.length) {
        [session dismiss];
        [ZXToast show:@"文件链接为空"];
        return;
    }
    NSString *normalizedURL = [self shouldSignKnowledgeURLForFromType:item.fromType] ? [self normalizedKnowledgeFileURL:fileURL] : fileURL;
    NSString *fileName = item.docName.length ? item.docName : @"文件";
    NSString *folderName = item.agentId.length ? item.agentId : @"agentKnowledge";
    void (^previewBlock)(NSString *) = ^(NSString *remoteURL) {
        if (session.isCancelled) {
            return;
        }
        ZXFileDownloadTask *downloadTask = [[ZXFileClient sharedClient] writeToFile:^ZXFileCacheModel * _Nonnull {
            ZXFileCacheModel *cacheModel = [[ZXFileCacheModel alloc] init];
            cacheModel.module = ZXCacheModuleIM;
            cacheModel.type = ZXCacheTypeFile;
            cacheModel.fileName = fileName;
            cacheModel.fileURL = [NSURL URLWithString:remoteURL];
            cacheModel.extFilePath = folderName;
            return cacheModel;
        } progress:^(float progress) {
            [session updateDownloadProgress:progress];
        } completion:^(NSString * _Nullable result, ZXError * _Nullable error) {
            if (session.isCancelled) {
                return;
            }
            if (error) {
                [session dismiss];
                [ZXToast show:@"查看文件失败，请稍候重试。"];
                return;
            }
            ZXMultiMediaParams *params = [ZXMultiMediaParams paramsWithPath:result originUrl:remoteURL];
            params.fileName = fileName;
            [session finishWithCompletion:^{
                [[ZXMultiMediaClient sharedClient] multiMediaPreviewFile:controller
                                                                  params:params
                                                                 handler:^(ZXError * _Nullable previewError) {
                    if (previewError) {
                        [ZXToast show:@"查看文件失败，请稍候重试。"];
                    }
                } dismiss:nil];
            }];
        }];
        session.onCancel = ^{
            [downloadTask cancel];
        };
    };
    if ([self shouldSignKnowledgeURLForFromType:item.fromType]) {
        [ZXOSSClient getSignedUrl:normalizedURL completion:^(NSString * _Nullable signedUrl, ZXError * _Nullable error) {
            if (session.isCancelled) {
                return;
            }
            if (error || !signedUrl.length) {
                [session dismiss];
                [ZXToast show:@"查看文件失败，请稍候重试。"];
                return;
            }
            previewBlock(signedUrl);
        }];
    } else {
        previewBlock(normalizedURL);
    }
}
```

- [ ] **Step 6: 智文分支带上 session**

把 `+ (void)openZhiWenFile:fromController:` 的签名与 HUD 调用改掉：签名加 `session:(ZXFileLoadingSession *)session`，删掉方法体里的 `[ZXProgressHUD show:@"文件加载中..."];`，并把网络回调里的 `[ZXProgressHUD dismiss];` 替换为 `[session dismiss];`；回调开头补：

```objc
        if (session.isCancelled) {
            return;
        }
```

- [ ] **Step 7: 确认 ZXProgressHUD 已从本文件清干净**

```bash
cd apps/ios
grep -n "ZXProgressHUD" SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAgentKnowledgeOpenLogic.m
```

期望：**无输出**。

- [ ] **Step 8: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAgentKnowledgeOpenLogic.m
git commit -m "feat(agent-knowledge): 知识来源打开改用进度浮层并支持取消"
```

---

### Task 5: 聊天文件 / H5 文件入口接线（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZXMultiMediaClient.m`（`openLocalFile:params:handler:` 与 `openDecryptedFilePreview:params:handler:`）
- Test: 无（iOS 无单测）

**Interfaces:**
- Consumes: Task 2 `writeToFile:progress:completion:` / `ZXFileDownloadTask`；Task 3 `ZXFileLoadingSession`
- Produces: 无对外新接口（`multiMediaPreviewFile:params:handler:dismiss:` 签名不变）

- [ ] **Step 1: 引头文件**

`ZXMultiMediaClient.m` 顶部 import 区确认含（缺则补）：

```objc
#import "ZXFilePreviewLoadHUD.h"
#import "ZXFileClient.h"
```

- [ ] **Step 2: 下载分支接进度（有 fileName 的路径）**

`- (void)openLocalFile:params:handler:` 中，本地未命中的 `else` 分支（原来直接 `writeToFile:completion:`）整体替换为：

```objc
            } else {
                // 本地不存在，边下载边展示进度，可取消
                ZXFileLoadingSession *session = [ZXFileLoadingSession startWithTitle:@"文件加载中..."];
                ZXFileDownloadTask *downloadTask = [[ZXFileClient sharedClient] writeToFile:^ZXFileCacheModel * _Nonnull{
                    ZXFileCacheModel *cacheModel = [[ZXFileCacheModel alloc] init];
                    cacheModel.module = cacheModule;
                    cacheModel.type = ZXCacheTypeFile;
                    cacheModel.fileName = fileName;
                    cacheModel.fileURL = fileURL;
                    if (newFolderName.length > 0) {
                        cacheModel.extFilePath = newFolderName;
                    }
                    return cacheModel;
                } progress:^(float progress) {
                    [session updateDownloadProgress:progress];
                } completion:^(NSString * _Nullable result, ZXError * _Nullable error) {
                    if (session.isCancelled) {
                        return;
                    }
                    if (error) {
                        [session dismiss];
                        !handler ?: handler([ZXError errorWithCode:ZXErrorCode_MultiMediaFileSourceFailed errorMsg:ZXErrorMsg_MultiMediaFileSourceFailed]);
                        return;
                    }
                    [session finishWithCompletion:^{
                        [self openQLPreview:[NSURL fileURLWithPath:result] handler:handler];
                    }];
                }];
                session.onCancel = ^{
                    [downloadTask cancel];
                };
            }
```

- [ ] **Step 3: 下载分支接进度（无 fileName 的路径）**

同方法末尾的 `else` 分支（`fileName.length == 0`，直接 `writeToFile:completion:` 的那段）同样改造：在 `writeToFile:` 前创建 `ZXFileLoadingSession *session = [ZXFileLoadingSession startWithTitle:@"文件加载中..."];`，把 `writeToFile:completion:` 改成 `writeToFile:progress:completion:` 并接 `[session updateDownloadProgress:progress];`，completion 内首行加 `if (session.isCancelled) { return; }`，成功分支包进 `[session finishWithCompletion:^{ ... }];`，失败分支先 `[session dismiss];`，最后把返回的 `ZXFileDownloadTask` 赋给 `session.onCancel` 里 cancel。写法与 Step 2 完全一致，只是 cacheModel 不带 `fileName`（保留该分支原有的 `cacheModel.fileName = fileName;` 赋值行不变）。

- [ ] **Step 4: 解密链路换成会话（顺带获得取消能力）**

`- (void)openDecryptedFilePreview:params:handler:` 中：

把

```objc
    [ZXFilePreviewLoadHUD showWithTitle:@"文件加载中..." progress:0.0f];
```

替换为

```objc
    ZXFileLoadingSession *session = [ZXFileLoadingSession startWithTitle:@"文件加载中..."];
```

把该方法内后续所有 `[ZXFilePreviewLoadHUD dismiss];` 替换为 `[session dismiss];`，`[ZXFilePreviewLoadHUD updateProgress:progress];` 替换为 `[session updatePollingProgress:progress];`，`[ZXFilePreviewLoadHUD finishWithCompletion:^{ ... }]` 替换为 `[session finishWithCompletion:^{ ... }]`。并在 `resolvePreviewFileWithTaskId:` 的两个回调开头补：

```objc
            if (session.isCancelled) {
                return;
            }
```

> 解密轮询没有可 cancel 的网络句柄，取消语义 = 会话置 cancelled 后所有回调被丢弃、浮层关闭；轮询自然结束。因此这里**不设** `session.onCancel`。

- [ ] **Step 5: 自查**

```bash
cd apps/ios
grep -n "ZXFilePreviewLoadHUD\|ZXFileLoadingSession" SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZXMultiMediaClient.m
```

期望：只剩 `ZXFileLoadingSession` 的调用，`ZXFilePreviewLoadHUD` 仅出现在 import 行。

- [ ] **Step 6: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_MultiMediaClient/ZXMultiMediaClient.m
git commit -m "feat(multimedia): 文件下载与解密预览统一走进度浮层"
```

---

### Task 6: 新增桥方法 openKnowledgeDoc（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/ZXJSAIChatAPI.m`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAgentKnowledgeOpenLogic.h`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAgentKnowledgeOpenLogic.m`
- Test: 无（iOS 无单测）

**Interfaces:**
- Consumes: Task 4 的 `openItem:fromController:`
- Produces:
  - `+ (void)openItem:(ZXAgentKnowledgeItem *)item fromController:(UIViewController *)controller onFinished:(nullable void (^)(NSString *status))onFinished;`（status 取值 `success` / `cancel` / `fail`）
  - 桥方法 `openKnowledgeDoc`（web 侧 `wnsdk.aiChat.openKnowledgeDoc`）

- [ ] **Step 1: `openItem:` 加带回调的重载（头文件）**

`ZXAgentKnowledgeOpenLogic.h` 中 `openItem:fromController:` 声明下面加：

```objc
/// 打开知识来源，并在流程结束时回调状态（success / cancel / fail），供 JSBridge 回传 web
+ (void)openItem:(ZXAgentKnowledgeItem *)item
  fromController:(UIViewController *)controller
      onFinished:(nullable void (^)(NSString *status))onFinished;
```

- [ ] **Step 2: 实现重载（实现文件）**

`ZXAgentKnowledgeOpenLogic.m` 中，把 Task 4 写好的 `+ (void)openItem:fromController:` 改成薄壳，并把方法体挪到新的重载里：

```objc
+ (void)openItem:(ZXAgentKnowledgeItem *)item fromController:(UIViewController *)controller {
    [self openItem:item fromController:controller onFinished:nil];
}

+ (void)openItem:(ZXAgentKnowledgeItem *)item
  fromController:(UIViewController *)controller
      onFinished:(void (^)(NSString *status))onFinished {
    ...（Task 4 的方法体，见下方改动点）
}
```

方法体的改动点（其余不变）：

1. 开头的 `if (!item || !controller) { return; }` 改为：

```objc
    if (!item || !controller) {
        !onFinished ?: onFinished(ZXAgentKnowledgeAuthStatusFail);
        return;
    }
```

2. 创建会话时挂上取消回调（在 `startWithTitle:` 之后立即加）：

```objc
    ZXFileLoadingSession *session = [ZXFileLoadingSession startWithTitle:@"文件加载中..."];
    __block BOOL finishReported = NO;
    void (^report)(NSString *) = ^(NSString *status) {
        if (finishReported) {
            return;
        }
        finishReported = YES;
        !onFinished ?: onFinished(status);
    };
    session.onCancel = ^{
        report(ZXAgentKnowledgeAuthStatusCancel);
    };
```

> 注意：Task 4 的 `openKnowledgeDocument:` 里会**覆盖** `session.onCancel` 为「取消下载任务」。所以在那里改成同时做两件事——把 Step 3 的写法照抄。

3. 所有 `[ZXToast show:...]` 的失败出口前补 `report(ZXAgentKnowledgeAuthStatusFail);`；`openWebURL:` / `openZhiWenFile:` / 预览成功出口补 `report(ZXAgentKnowledgeAuthStatusSuccess);`。

- [ ] **Step 3: 让下载取消同时回报 cancel**

`openKnowledgeDocument:item:fromController:session:` 内设置 `session.onCancel` 的那两行改为：

```objc
        dispatch_block_t previousCancel = session.onCancel;
        session.onCancel = ^{
            [downloadTask cancel];
            !previousCancel ?: previousCancel();
        };
```

- [ ] **Step 4: 注册桥方法**

`ZXJSAIChatAPI.m` 的 `registerHandlers` 内，在 `presentKnowledgeAuth` 那段**之后**追加：

```objc
    // MARK: 打开知识来源文件（原生全包：元数据 + 授权 + 签名 + 下载进度 + 预览）
    [self registerHandlerName:@"openKnowledgeDoc" handler:^(id data, ZXJSResponseHandler responseHandler) {
        NSDictionary *params = [data isKindOfClass:[NSDictionary class]] ? data : @{};
        NSString *docId = [params[@"docId"] description];
        NSString *agentId = [params[@"agentId"] description];
        if (!docId.length || !agentId.length) {
            responseHandler([ZXJSWebResponseModel modelWithCode:-1 msg:@"docId 或 agentId 为空" result:nil]);
            return;
        }
        ZXAgentKnowledgeItem *item = [[ZXAgentKnowledgeItem alloc] init];
        item.docId = docId;
        item.agentId = agentId;
        item.docName = params[@"docName"] ? [params[@"docName"] description] : @"";
        item.fromType = [params[@"fromType"] respondsToSelector:@selector(integerValue)] ? [params[@"fromType"] integerValue] : 0;
        dispatch_async(dispatch_get_main_queue(), ^{
            UIViewController *presenter = self.webloader;
            if (!presenter) {
                responseHandler([ZXJSWebResponseModel modelWithCode:-1 msg:@"页面不可用" result:nil]);
                return;
            }
            [ZXAgentKnowledgeOpenLogic openItem:item fromController:presenter onFinished:^(NSString *status) {
                if ([status isEqualToString:ZXAgentKnowledgeAuthStatusFail]) {
                    responseHandler([ZXJSWebResponseModel modelWithCode:-1 msg:@"文件打开失败" result:nil]);
                    return;
                }
                NSMutableDictionary *result = [NSMutableDictionary dictionary];
                [result setValue:status.length ? status : ZXAgentKnowledgeAuthStatusSuccess forKey:@"status"];
                responseHandler([ZXJSWebResponseModel modelWithCode:0 msg:nil result:[result mj_JSONString]]);
            }];
        });
    }];
```

`ZXJSAIChatAPI.m` 顶部 import 区补：

```objc
#import "ZXAgentKnowledgeItem.h"
```

- [ ] **Step 5: 自查**

```bash
cd apps/ios
grep -n "openKnowledgeDoc" SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/ZXJSAIChatAPI.m
grep -n "onFinished" SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAgentKnowledgeOpenLogic.h
```

期望：桥方法已注册；头文件里有带 `onFinished:` 的 `openItem:` 声明。

- [ ] **Step 6: 提交**

```bash
cd apps/ios
git add SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/ZXJSAIChatAPI.m \
        SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAgentKnowledgeOpenLogic.h \
        SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAgentKnowledgeOpenLogic.m
git commit -m "feat(bridge): 新增 openKnowledgeDoc，H5 知识来源交由原生打开"
```

---

### Task 7: web 平台分流 + 单测（web）

**Files:**
- Create: `apps/web/src/components/views/setting/knowledge/knowledgeNativeOpen.js`
- Create: `apps/web/src/components/views/setting/knowledge/tests/knowledgeNativeOpen.test.mjs`
- Modify: `apps/web/src/components/views/setting/knowledge/knowledgeDialogUtils.js:230-370`（`previewKnowledgeFile`）

**Interfaces:**
- Consumes: iOS 桥 `wnsdk.aiChat.openKnowledgeDoc`（Task 6）
- Produces:
  - `shouldOpenKnowledgeOnIosNative(userAgent, isWnsdkEnable) -> boolean`
  - `buildOpenKnowledgeDocParams(knowledgeItem) -> { docId, agentId, agentVersionId, docName, fromType }`
  - `openKnowledgeDocOnNative(knowledgeItem, bridge) -> Promise<string>`（resolve `"success"` / `"cancel"`，reject Error）

- [ ] **Step 1: 写失败的测试**

创建 `apps/web/src/components/views/setting/knowledge/tests/knowledgeNativeOpen.test.mjs`：

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldOpenKnowledgeOnIosNative,
  buildOpenKnowledgeDocParams,
  openKnowledgeDocOnNative
} from "../knowledgeNativeOpen.js";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 MTCoreApi/1.0";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 MTCoreApi/1.0";

test("仅 iOS 客户端容器走原生打开", () => {
  assert.equal(shouldOpenKnowledgeOnIosNative(IOS_UA, true), true);
  assert.equal(shouldOpenKnowledgeOnIosNative(ANDROID_UA, true), false);
  assert.equal(shouldOpenKnowledgeOnIosNative(IOS_UA, false), false);
  assert.equal(shouldOpenKnowledgeOnIosNative("", true), false);
});

test("桥参数只取原生需要的字段并补默认值", () => {
  assert.deepEqual(
    buildOpenKnowledgeDocParams({
      docId: "d1",
      agentId: "a1",
      docName: "报告.pdf",
      fromType: 1,
      extra: "忽略"
    }),
    {
      docId: "d1",
      agentId: "a1",
      agentVersionId: 0,
      docName: "报告.pdf",
      fromType: 1
    }
  );
  assert.deepEqual(buildOpenKnowledgeDocParams({ docId: "d2", agentId: "a2" }), {
    docId: "d2",
    agentId: "a2",
    agentVersionId: 0,
    docName: "",
    fromType: 0
  });
});

test("原生回调 success 时 resolve", async () => {
  const bridge = (params) => params.success({ status: "success" });
  assert.equal(
    await openKnowledgeDocOnNative({ docId: "d", agentId: "a" }, bridge),
    "success"
  );
});

test("原生回调 cancel 时 resolve cancel", async () => {
  const bridge = (params) => params.success('{"status":"cancel"}');
  assert.equal(
    await openKnowledgeDocOnNative({ docId: "d", agentId: "a" }, bridge),
    "cancel"
  );
});

test("桥缺失时 reject", async () => {
  await assert.rejects(
    () => openKnowledgeDocOnNative({ docId: "d", agentId: "a" }, undefined),
    /未注册/
  );
});

test("原生回调 fail 时 reject", async () => {
  const bridge = (params) => params.fail({ msg: "文件打开失败" });
  await assert.rejects(
    () => openKnowledgeDocOnNative({ docId: "d", agentId: "a" }, bridge),
    /文件打开失败/
  );
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/web
node --test src/components/views/setting/knowledge/tests/knowledgeNativeOpen.test.mjs
```

期望：FAIL，`ERR_MODULE_NOT_FOUND`（`knowledgeNativeOpen.js` 还不存在）。

- [ ] **Step 3: 写实现**

创建 `apps/web/src/components/views/setting/knowledge/knowledgeNativeOpen.js`：

```javascript
/**
 * 知识来源文件「交给 iOS 原生打开」的纯逻辑。
 * 原生侧对应 JSBridge：wnsdk.aiChat.openKnowledgeDoc（见 context/bridge.md）。
 */

/** 是否处于 iOS 知信 App 内嵌 WebView（MTCoreApi UA） */
export const shouldOpenKnowledgeOnIosNative = (userAgent, isWnsdkEnable) => {
  const ua = userAgent || "";
  return (
    !!isWnsdkEnable && ua.includes("MTCoreApi") && /iPhone|iPad|iPod/i.test(ua)
  );
};

/** 只把原生需要的字段传过去，缺省值与原生默认一致 */
export const buildOpenKnowledgeDocParams = (knowledgeItem) => {
  const item = knowledgeItem || {};
  return {
    docId: item.docId || "",
    agentId: item.agentId || "",
    agentVersionId: item.agentVersionId || 0,
    docName: item.docName || "",
    fromType: item.fromType || 0
  };
};

const parseStatus = (result) => {
  if (!result) return "";
  if (typeof result === "object" && result.status) return result.status;
  if (typeof result === "string") {
    try {
      return JSON.parse(result).status || "";
    } catch {
      return "";
    }
  }
  return "";
};

/**
 * 调原生打开知识来源文件。
 * @returns Promise<"success" | "cancel">；原生报错时 reject。
 */
export const openKnowledgeDocOnNative = (knowledgeItem, bridge) => {
  if (typeof bridge !== "function") {
    return Promise.reject(new Error("原生打开文件接口未注册"));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      handler(value);
    };
    try {
      bridge({
        ...buildOpenKnowledgeDocParams(knowledgeItem),
        success: (result) => {
          const status = parseStatus(result);
          finish(resolve, status === "cancel" ? "cancel" : "success");
        },
        fail: (error) => {
          const msg = (error && (error.msg || error.message)) || "文件打开失败";
          finish(reject, new Error(msg));
        }
      });
    } catch (e) {
      finish(reject, e instanceof Error ? e : new Error(String(e)));
    }
  });
};
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/web
node --test src/components/views/setting/knowledge/tests/knowledgeNativeOpen.test.mjs
```

期望：`# pass 6` / `# fail 0`。

- [ ] **Step 5: 接线到 previewKnowledgeFile**

`knowledgeDialogUtils.js` 顶部 import 区加：

```javascript
import {
  shouldOpenKnowledgeOnIosNative,
  openKnowledgeDocOnNative
} from "./knowledgeNativeOpen.js";
```

`previewKnowledgeFile` 函数体**第一行**（`const { url, haveAuth, userFileId } = agentFileData;` 之前）插入分流：

```javascript
  // iOS 客户端内：整套「元数据 + 授权 + 签名 + 下载进度 + 预览」交给原生，
  // web 侧不再自行拼 url（原生带可取消的下载进度浮层）。安卓与 PC 维持原有逻辑。
  if (shouldOpenKnowledgeOnIosNative(navigator.userAgent, isWnsdkEnable)) {
    return openKnowledgeDocOnNative(
      knowledgeItem,
      wnsdk?.aiChat?.openKnowledgeDoc
    ).catch((e) => {
      console.warn("[knowledge] 原生打开失败", e);
    });
  }
```

> 注意：这里用的是**入参 `knowledgeItem`**（含 docId / agentId / docName / fromType），不是 `agentFileData`。

- [ ] **Step 6: 类型检查 + 格式化**

```bash
cd apps/web
npx vue-tsc --noEmit
npx prettier --write src/components/views/setting/knowledge/knowledgeNativeOpen.js \
  src/components/views/setting/knowledge/tests/knowledgeNativeOpen.test.mjs \
  src/components/views/setting/knowledge/knowledgeDialogUtils.js
node --test src/components/views/setting/knowledge/tests/knowledgeNativeOpen.test.mjs
```

期望：`vue-tsc` exit 0；prettier 改完后测试仍 6 pass。

- [ ] **Step 7: 提交**

```bash
cd apps/web
git add src/components/views/setting/knowledge/knowledgeNativeOpen.js \
        src/components/views/setting/knowledge/tests/knowledgeNativeOpen.test.mjs \
        src/components/views/setting/knowledge/knowledgeDialogUtils.js
git commit -m "feat(knowledge): iOS 客户端内知识来源交由原生打开"
```

---

### Task 8: 文档同步与自测清单（context）

**Files:**
- Modify: `context/bridge.md`
- Create: `context/features/20260818-ios-知识来源与聊天文件打开-下载进度查看页-替代loading/impl-notes.md`
- Modify: `context/features/20260818-ios-知识来源与聊天文件打开-下载进度查看页-替代loading/status.md`

**Interfaces:**
- Consumes: Task 1–7 的全部产出
- Produces: 文档，无代码接口

- [ ] **Step 1: bridge.md 补协议**

在 `context/bridge.md` 的 AI 会话（aiChat）小节追加 `openKnowledgeDoc` 一节，字段表照抄 `spec.md` 的「JSBridge 新增协议」，并注明：**仅 iOS 实现，安卓未实现，web 按 UA 降级**。

- [ ] **Step 2: 写 impl-notes.md**

内容至少含：
- 三个入口收敛到 `ZXFileClient writeToFile:` 这一事实（跨端移植时最关键的信息）
- 进度分段：前置 0→8%（0.5s 步进）、下载 8%→100%、解密轮询 5%→65% 后下载接 65%→100%
- 取消语义：置 cancelled → 丢弃后续回调 + cancel 下载任务 + 删半成品；解密轮询无句柄可取消，仅丢回调
- 桥 `openKnowledgeDoc` 的入参 / 回参与 status 取值
- 联调坑：留空小节，自测中发现再补

- [ ] **Step 3: 更新 status.md 平台矩阵**

按 Task 1–8 重排矩阵行，代码完成的标 ✅，真机自测标 🚧，并在「待办 / 阻塞」写清人工自测清单：

- (ios) 知识来源大文件（>50MB）：进度是否连续爬升、百分比与实际吻合
- (ios) 下载中点取消：立即关闭、无预览弹出、再次点击能重新下载
- (ios) 聊天文件消息（普通 / 加密 / 微应用分享）各开一次
- (ios) 绿盾加密文件：5%→65% 轮询后接下载段，进度不回退
- (ios) 图片类知识来源：仍走图片浏览器，浮层正常消失
- (ios) 飞书 / WPS 未授权：浮层关闭后弹授权页
- (ios) 本地已缓存的文件：不应出现浮层，秒开
- (ios) H5 内点知识来源（移动端 AI 会话页）：走新桥、有进度、可取消
- (android) H5 内点知识来源：行为与改动前一致（回归）
- 弱网 / 断网：失败 toast 文案正确，浮层不残留

- [ ] **Step 4: 提交 context**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/bridge.md "context/features/20260818-ios-知识来源与聊天文件打开-下载进度查看页-替代loading"
git commit -m "docs(ios-file-progress): 补 openKnowledgeDoc 协议、impl-notes 与自测清单"
```

---

## 自查记录

- **spec 覆盖**：浮层形态 → T1；下载进度/取消 → T2/T3；三入口 → T4（知识来源）/T5（聊天文件 + H5 文件下载 + 解密）/T6（H5 知识来源桥）；web 平台分流 → T7；bridge.md + contracts 说明 → T8；分支约定 → T0。spec 里「不做」的项（独立页、断点续传、安卓改动、其余 iOS 入口专门接线）计划中均无对应任务，符合预期。
- **类型一致**：`ZXFileLoadingSession` 的方法名（`startWithTitle:` / `updatePollingProgress:` / `updateDownloadProgress:` / `finishWithCompletion:` / `dismiss` / `onCancel` / `isCancelled`）在 T3 定义、T4/T5/T6 使用，拼写一致；`ZXFileDownloadTask` 的 `cancel` / `isCancelled` 同理；web 三个导出名在测试与接线处一致。
- **无占位符**：所有代码步骤给了可直接粘贴的完整代码；iOS 无单测，验证方式统一为「人工 Xcode 编译 + T8 自测清单」，已在 Global Constraints 与各任务末尾注明。
