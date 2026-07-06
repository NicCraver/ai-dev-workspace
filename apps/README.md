# apps/ —— 四个项目仓库的挂载点

本目录被编排仓库 .gitignore 忽略，每个项目保持独立 git 仓库：

```bash
git clone <web仓库地址>     apps/web
git clone <android仓库地址> apps/android
git clone <ios仓库地址>     apps/ios
git clone <electron仓库地址> apps/desktop
```

目录名必须是 web / android / ios / desktop（hooks、命令按此名寻址）。
每个仓库根目录应有自己的 CLAUDE.md（bootstrap 第 4 步生成）。
