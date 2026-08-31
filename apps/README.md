# apps/ —— 各项目仓库的挂载点

本目录被编排仓库 .gitignore 忽略，每个项目保持独立 git 仓库。

## 智信主产品四端

功能迭代的平台矩阵说的就是这四个：

```bash
git clone http://192.168.5.166:10090/xinxi/zg-web/zx/zx-ai-chat.git      apps/web
git clone http://192.168.5.166:10090/xinxi/zg-android/smart_mesaage.git  apps/android
git clone http://192.168.5.166:10090/xinxi/zg-ios/smart_message.git      apps/ios
git clone http://192.168.5.166:10090/xinxi/zg-web/zx/zx-client-pc.git    apps/desktop
```

## 另外三个仓库（性质不同，不是智信的第五第六第七端）

```bash
# 智能会议室：目前是个人项目，远端在 GitHub（其余仓库都在公司内网 GitLab），正准备推进到公司
git clone https://github.com/NicCraver/zx-meeting-room.git                      apps/meeting

# 行动中心：公司的另一个 web 项目，主要当参考源（抄交互/逻辑/界面），未来也会直接迭代
git clone http://192.168.5.166:10090/xinxi/zg-web/zx/zx-action-center-pc.git    apps/action-center

# 通讯录/组织架构后端服务（Spring Boot），四端消费它的接口；会议室后端功能在这里落地
git clone http://192.168.5.166:10090/xinxi/zhixin/server-v2/smart-oa/zx-contact.git  apps/contact
```

目录名必须与上面一致（web / android / ios / desktop / meeting / action-center / contact）——hooks、脚本、命令都按此名寻址。
每个仓库根目录有自己的 CLAUDE.md（构建、测试、lint 命令与代码规范），进入该仓库工作时以它为准。
