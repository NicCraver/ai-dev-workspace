# 智能会议室 · 前端基建 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `apps/meeting/` monorepo（前端 `web/` + Hono 后端 `server/`），交付能跑通三入口构建、网络层、路由版本自更新与冒烟页的工程底座。

**Architecture:** pnpm workspace 两包。`web/` 照 `apps/web` 的 MPA 骨架但只留 `main`/`zx`/`m` 三入口，从 `apps/web` **定点移植**四个自研 vite 插件、`mergeDist.js`、`http.js`（axios 拦截器）与 router 版本自更新逻辑，依赖表收窄到会议室实际需要的部分。`server/` 是 Hono + TS 最小服务，`/meetingApi/health` 故意返回智信业务码信封，让移植来的响应拦截器无需开特例。

**Tech Stack:** Vue 3.5 + Vite 7 + vue-router 4 + vite-plugin-pages + UnoCSS 66 + Element Plus 2 + Vant 4 + axios；Hono 4 + @hono/node-server + tsx；Node 22.16.0 / pnpm 10.22.0。

## Global Constraints

- 仓库路径 `apps/meeting/`，独立 git（`git init`，本期无 remote）。`apps/` 被编排仓 `.gitignore` 忽略。
- Node **22.16.0** / pnpm **10.22.0**，根 `package.json#volta` 锁定。
- 部署 base 固定 `/meeting/`；web dev 端口 **6273**；server 端口 **3100**。
- 三个构建入口：`main`(`index.html`) / `zx`(`zx/index.html`) / `m`(`m/index.html`)。**没有 share 入口。**
- 前端 JS 为主，工具/类型可用 TS。**不引入** Pinia/Vuex、ESLint、单元测试框架。
- **不引入**这些依赖：tiptap 全家、ali-oss、ant-design-x-vue、better-scroll、@tanstack/vue-table、unplugin-vue-macros、vite-plugin-inspect。
- 中文注释。
- 本期**不做 JSBridge**：token 只从 URL query / sessionStorage 取，取值逻辑集中在 `web/src/utils/index.js`。
- sessionStorage 键：`meetingToken` / `meetingCorpId` / `clientType`。
- 每个 task 结束前必须跑出该 task「验证步骤」里写明的期望输出，才允许 commit。

---

### Task 1: monorepo 骨架

**Files:**
- Create: `apps/meeting/package.json`
- Create: `apps/meeting/pnpm-workspace.yaml`
- Create: `apps/meeting/.gitignore`
- Create: `apps/meeting/.npmrc`

**Interfaces:**
- Produces: 根脚本 `dev` / `dev:web` / `dev:server` / `build` / `build:prod`，全部用 `pnpm -F <pkg> run <script>` 转发；子包名分别为 `@meeting/web`、`@meeting/server`。

- [ ] **Step 1: 建目录并 git init**

```bash
mkdir -p /Users/nic/w/ai-dev-workspace/apps/meeting
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git init
```

期望：`Initialized empty Git repository in .../apps/meeting/.git/`

- [ ] **Step 2: 写 `pnpm-workspace.yaml`**

```yaml
packages:
  - "web"
  - "server"
```

- [ ] **Step 3: 写根 `package.json`**

```json
{
  "name": "zx-meeting-room",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently -n server,web -c cyan,green \"pnpm run dev:server\" \"pnpm run dev:web\"",
    "dev:web": "pnpm -F @meeting/web run dev",
    "dev:server": "pnpm -F @meeting/server run dev",
    "build:web": "pnpm -F @meeting/web run build",
    "build:server": "pnpm -F @meeting/server run build",
    "build": "pnpm run build:server && pnpm run build:web",
    "build:prod": "pnpm run build:server && pnpm -F @meeting/web run build:prod",
    "format": "pnpm -F @meeting/web run format"
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  },
  "packageManager": "pnpm@10.22.0",
  "volta": {
    "node": "22.16.0",
    "pnpm": "10.22.0"
  }
}
```

- [ ] **Step 4: 写 `.gitignore`**

```gitignore
node_modules
dist
dist_main
dist_zx
dist_m
.DS_Store
*.local
.env
.env.*
!.env.example
components.d.ts
auto-imports.d.ts
tsconfig.tsbuildinfo
web/src/assets/index.ts
web/src/server/index.js
```

> 末两行是插件生成物：`vite-auto-assets-exports` 与 `vite-auto-api-exports` 每次 `buildStart` 重写，进仓只会产生噪声 diff。

- [ ] **Step 5: 写 `.npmrc`**

```
shamefully-hoist=false
strict-peer-dependencies=false
```

- [ ] **Step 6: 验证 workspace 被识别**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting && pnpm install
```

期望：安装 `concurrently`，输出含 `Done in`。此时 `pnpm -F @meeting/web run dev` 会报找不到包——正常，Task 3 才建。

- [ ] **Step 7: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "chore: 初始化 zx-meeting-room monorepo 骨架"
```

---

### Task 2: server —— Hono 最小服务

**Files:**
- Create: `apps/meeting/server/package.json`
- Create: `apps/meeting/server/tsconfig.json`
- Create: `apps/meeting/server/src/index.ts`
- Create: `apps/meeting/server/src/middleware/cors.ts`
- Create: `apps/meeting/server/src/routes/health.ts`

**Interfaces:**
- Consumes: Task 1 的 workspace 与根脚本 `dev:server`。
- Produces: `GET http://localhost:3100/meetingApi/health` → `{ "code": "M0000", "data": { "ok": true, "ts": <number> }, "msg": "" }`。web 侧 Task 4 的 `http.js` 响应拦截器依赖 `code === "M0000"` 才拆包。

- [ ] **Step 1: 先写验证命令，确认它现在失败**

```bash
curl -s -m 2 http://localhost:3100/meetingApi/health
```

期望：`curl: (7) Failed to connect to localhost port 3100`（服务还不存在）。

- [ ] **Step 2: 写 `server/package.json`**

```json
{
  "name": "@meeting/server",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "hono": "^4.6.14"
  },
  "devDependencies": {
    "@types/node": "^24.6.0",
    "tsx": "^4.19.2",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 3: 写 `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"],
    "lib": ["ES2022"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: 写 `server/src/middleware/cors.ts`**

```ts
import { cors } from "hono/cors";

/** dev 期前端跑在 6273，走 vite proxy 时同源；直连调试时需要放行 */
export const corsMiddleware = cors({
  origin: ["http://localhost:6273", "http://127.0.0.1:6273"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "zxCorpId", "clientType", "version", "retrykey"],
  maxAge: 600
});
```

- [ ] **Step 5: 写 `server/src/routes/health.ts`**

```ts
import { Hono } from "hono";

const health = new Hono();

/**
 * 健康检查。
 * 故意套用智信业务码信封（code=M0000 表示成功），
 * 这样 web 侧移植过来的 axios 响应拦截器不必为自家后端开特例。
 */
health.get("/health", (c) =>
  c.json({
    code: "M0000",
    data: { ok: true, ts: Date.now() },
    msg: ""
  })
);

export default health;
```

- [ ] **Step 6: 写 `server/src/index.ts`**

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors.js";
import health from "./routes/health.js";

const PORT = Number(process.env.PORT || 3100);

const app = new Hono();
app.use("*", corsMiddleware);

// 所有业务路由统一挂在 /meetingApi 前缀下，与 web 侧 vite proxy 及生产 nginx 反代对齐
app.route("/meetingApi", health);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[meeting-server] listening on http://localhost:${info.port}`);
});
```

- [ ] **Step 7: 装依赖并起服务**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting && pnpm install
pnpm run dev:server
```

期望：`[meeting-server] listening on http://localhost:3100`

- [ ] **Step 8: 验证 health（另开终端）**

```bash
curl -s http://localhost:3100/meetingApi/health
```

期望输出形如：`{"code":"M0000","data":{"ok":true,"ts":1756...},"msg":""}`

- [ ] **Step 9: 验证 tsc 构建**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting && pnpm run build:server
```

期望：退出码 0，生成 `server/dist/index.js`。

- [ ] **Step 10: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "feat(server): Hono 最小服务，/meetingApi/health 返回智信业务码信封"
```

---

### Task 3: web —— 构建配置与四个自研插件

**Files:**
- Create: `apps/meeting/web/package.json`
- Create: `apps/meeting/web/tsconfig.json`
- Create: `apps/meeting/web/vite.config.js`
- Create: `apps/meeting/web/uno.config.js`
- Create: `apps/meeting/web/export.config.js`
- Create: `apps/meeting/web/mergeDist.js`
- Create: `apps/meeting/web/.prettierrc`
- Create: `apps/meeting/web/src/plugins/vite-mpa-plugin.js`
- Create: `apps/meeting/web/src/plugins/vite-pages-config.js`
- Create: `apps/meeting/web/src/plugins/vite-auto-api-exports.js`
- Create: `apps/meeting/web/src/plugins/vite-auto-assets-exports.js`
- Create: `apps/meeting/web/index.html`
- Create: `apps/meeting/web/zx/index.html`
- Create: `apps/meeting/web/m/index.html`
- Create: `apps/meeting/web/public/.gitkeep`
- Create: `apps/meeting/web/src/assets/.gitkeep`

**Interfaces:**
- Consumes: Task 1 的 workspace。
- Produces:
  - 虚拟模块 `~pages` / `~zx-pages` / `~m-pages`（Task 5/6/7 的 router 从这里取路由表）
  - 编译期常量 `JENKINS_BUILD_NUMBER: string`、`__BUILD_TARGET__: "main" | "zx" | "m"`
  - 运行期全局 `window.__VITE_MPA_PLATFORM__`：`zx` 入口为 `"zx"`、`m` 入口为 `"m"`、main 入口为 `undefined`
  - alias `@` → `web/src`
  - `mergeDist.js` 把 `dist_main` / `dist_zx` / `dist_m` 合并成 `dist/` 并写 `dist/build_version`

- [ ] **Step 1: 写 `web/package.json`**

依赖版本与 `apps/web` 对齐（同栈同版本，避免两项目行为漂移）。

```json
{
  "name": "@meeting/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build:main": "cross-env BUILD_TARGET=main vite build",
    "build:zx": "cross-env BUILD_TARGET=zx vite build",
    "build:mobile": "cross-env BUILD_TARGET=m vite build",
    "build": "rm -rf dist && vue-tsc && pnpm run build:main && pnpm run build:zx && pnpm run build:mobile && node mergeDist.js",
    "build:main:prod": "cross-env BUILD_TARGET=main vite build --mode prod",
    "build:zx:prod": "cross-env BUILD_TARGET=zx vite build --mode prod",
    "build:mobile:prod": "cross-env BUILD_TARGET=m vite build --mode prod",
    "build:prod": "rm -rf dist && vue-tsc && pnpm run build:main:prod && pnpm run build:zx:prod && pnpm run build:mobile:prod && node mergeDist.js",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit",
    "format": "prettier --write src/"
  },
  "dependencies": {
    "axios": "^1.13.2",
    "dayjs": "^1.11.19",
    "element-plus": "^2.11.7",
    "vant": "^4.9.21",
    "vue": "^3.5.22",
    "vue-router": "^4.6.3"
  },
  "devDependencies": {
    "@iconify-json/carbon": "^1.2.15",
    "@types/node": "^24.6.0",
    "@unocss/preset-icons": "^66.5.10",
    "@unocss/preset-wind3": "^66.5.6",
    "@unocss/reset": "^66.5.6",
    "@unocss/transformer-directives": "^66.5.6",
    "@vant/touch-emulator": "^1.4.0",
    "@vitejs/plugin-vue": "^6.0.1",
    "@vue/tsconfig": "^0.8.1",
    "@vueuse/core": "^14.0.0",
    "code-inspector-plugin": "^1.6.4",
    "cross-env": "^10.1.0",
    "fs-extra": "^11.3.2",
    "is-mobile": "^5.0.0",
    "prettier": "^3.4.2",
    "typescript": "^5.9.3",
    "unocss": "^66.5.6",
    "unplugin-auto-import": "^20.2.0",
    "unplugin-vue-components": "^30.0.0",
    "vite": "^7.2.2",
    "vite-plugin-pages": "^0.33.1",
    "vue-tsc": "^3.1.0"
  }
}
```

- [ ] **Step 2: 写 `web/tsconfig.json`**

照 `apps/web/tsconfig.json`，**删掉** `vueCompilerOptions` 与 `types: ["unplugin-vue-macros/macros-global"]`（本项目不用 vue-macros）。

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "allowJs": true,
    "checkJs": false,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "useDefineForClassFields": true,
    "lib": ["ESNext", "DOM"],
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.js",
    "src/**/*.d.ts",
    "src/**/*.vue",
    "*.d.ts"
  ],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 写 `web/src/plugins/vite-mpa-plugin.js`**

移植自 `apps/web`，**删掉 share 的 fallback 与 platformMap 条目**，默认 base 改 `/meeting/`。

```js
/**
 * MPA 多页面应用插件
 * 集成路由回退与平台识别（本项目只有 main / zx / m 三个入口）
 */
export const mpaPlugin = (baseUrl = "/meeting/") => {
  return {
    name: "mpa-unified",
    // 开发服务器中间件 —— 处理子入口的 history 路由回退
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        const routes = [
          { prefix: `${baseUrl}m/`, fallback: `${baseUrl}m/` },
          { prefix: `${baseUrl}zx/`, fallback: `${baseUrl}zx/` }
        ];

        for (const route of routes) {
          if (
            url.startsWith(route.prefix) &&
            !url.includes(".") &&
            url !== route.fallback
          ) {
            req.url = route.fallback;
            break;
          }
        }
        next();
      });
    },
    // HTML 转换 —— 注入平台标识，运行期读 window.__VITE_MPA_PLATFORM__ 判断宿主形态
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const { filename } = ctx;
        const platformMap = {
          "/m/index.html": "m",
          "/zx/index.html": "zx"
        };
        const platform = Object.keys(platformMap).find((key) =>
          filename.includes(key)
        );
        const platformPrefix = platform ? platformMap[platform] : "";
        if (platformPrefix) {
          const script = `<script>window.__VITE_MPA_PLATFORM__='${platformPrefix}';</script>`;
          return html.replace("<head>", `<head>${script}`);
        }
        return html;
      }
    }
  };
};
```

- [ ] **Step 4: 写 `web/src/plugins/vite-pages-config.js`**

```js
import Pages from "vite-plugin-pages";

/**
 * 三套文件式路由：主应用 / 桌面(zx) / 移动(m)
 * @returns {any[]}
 */
export const createPagesPlugins = () => {
  const pagesConfigs = [
    { dirs: "src/pages", moduleId: "~pages" },
    { dirs: "src/mpa/desktop/pages", moduleId: "~zx-pages" },
    { dirs: "src/mpa/mobile/pages", moduleId: "~m-pages" }
  ];

  return pagesConfigs.map((config) =>
    Pages({
      dirs: config.dirs,
      extensions: ["vue", "tsx", "ts", "js"],
      moduleId: config.moduleId
    })
  );
};
```

- [ ] **Step 5: 写 `web/src/plugins/vite-auto-api-exports.js`**

从 `apps/web/src/plugins/vite-auto-api-exports.js` 原样移植（扫 `src/server/module/` 生成 `src/server/index.js`）。

```js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function autoApiExports() {
  const moduleDir = path.join(__dirname, "../server/module");
  const indexFile = path.join(__dirname, "../server/index.js");

  function scanModuleFiles() {
    if (!fs.existsSync(moduleDir)) {
      return [];
    }
    const files = fs.readdirSync(moduleDir);
    return files.filter((file) => /\.(js|ts)$/.test(file));
  }

  function generateIndexContent() {
    const moduleFiles = scanModuleFiles();

    const exports = moduleFiles
      .map((file) => `export * from "./module/${file}";`)
      .join("\n");

    return `${exports}

// 为了保持兼容性，也提供一个包含所有 API 的默认导出
const apiModules = import.meta.glob("./**/*.{js,ts}", { eager: true });
const api = {};
Object.entries(apiModules).forEach(([path, module]) => {
  if (!path.includes("index") && !path.includes("http")) {
    Object.assign(api, module);
  }
});
export default api;
`;
  }

  function writeIndexFile() {
    fs.writeFileSync(indexFile, generateIndexContent());
    console.log("🔄 API exports regenerated automatically!");
  }

  return {
    name: "auto-api-exports",
    buildStart() {
      writeIndexFile();
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(moduleDir) && file !== indexFile) {
        writeIndexFile();
        server.ws.send({ type: "full-reload" });
      }
    }
  };
}
```

- [ ] **Step 6: 写 `web/src/plugins/vite-auto-assets-exports.js`**

从 `apps/web/src/plugins/vite-auto-assets-exports.js` 原样移植（含那段显式排序的注释——跨平台 readdir 顺序不同会产生无意义 diff）。

```js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function autoExportAssets(options = {}) {
  const {
    targetDir = "./src/assets",
    outputFile = "index.ts",
    exclude = ["faces"],
    customImport
  } = options;

  let assetsDir;
  let outputPath;

  return {
    name: "auto-export-assets",
    configResolved(config) {
      assetsDir = path.resolve(config.root, targetDir);
      outputPath = path.join(assetsDir, outputFile);
    },
    buildStart() {
      generateAssetExports();
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(assetsDir) && file !== outputPath) {
        const ext = path.extname(file).slice(1);
        if (["svg", "png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
          generateAssetExports();
          server.ws.send({ type: "full-reload" });
        }
      }
    }
  };

  function generateAssetExports() {
    if (!fs.existsSync(assetsDir)) {
      console.warn(`Assets directory not found: ${assetsDir}`);
      return;
    }
    const files = [];
    function scanDir(dir, basePath = "") {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir);
      items.forEach((item) => {
        if (item === outputFile) return;
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        if (fs.statSync(fullPath).isDirectory() && !exclude.includes(item)) {
          scanDir(fullPath, relativePath);
        } else if (/\.(svg|png|jpg|jpeg|gif|webp)$/i.test(item)) {
          const fileName = path.basename(item, path.extname(item));
          const fileType = path.extname(item).slice(1);
          const relativeFilePath = `./${relativePath.replace(/\\/g, "/")}`;
          let importName;
          if (customImport) {
            const customResult = customImport(
              fileName,
              relativePath.replace(/\\/g, "/"),
              fileType
            );
            if (typeof customResult === "string") {
              const match = customResult.match(/import\s+(\w+)\s+from/);
              if (match) {
                files.push({ importName: match[1], customImport: customResult });
                return;
              }
            }
          }
          if (fileType === "svg" && relativePath.startsWith("svg")) {
            importName = `iSvg${fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())}`;
          } else {
            importName = `${fileType}${fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())}`;
          }
          files.push({ importName, path: relativeFilePath });
        }
      });
    }
    scanDir(assetsDir);
    if (files.length === 0) {
      console.warn("No asset files found");
      return;
    }
    // 显式排序：readdir 顺序依赖文件系统（macOS APFS 大小写敏感序 vs Linux 常为大小写不敏感），
    // 不排序会导致不同平台生成的 index.ts 顺序不一致、产生无意义 diff。
    files.sort((a, b) => {
      const pathA = a.path || a.importName;
      const pathB = b.path || b.importName;
      return pathA.localeCompare(pathB, "en", { sensitivity: "base" });
    });
    const imports = files
      .map(
        (file) =>
          file.customImport || `import ${file.importName} from "${file.path}";`
      )
      .join("\n");
    const exports = files.map((file) => `  ${file.importName}`).join(",\n");
    const content = `${imports}

export {
${exports}
}
`;
    try {
      fs.writeFileSync(outputPath, content);
      console.log("✅ Assets index.ts generated successfully!");
    } catch (error) {
      console.error("❌ Failed to write assets index.ts:", error);
    }
  }
}
```

- [ ] **Step 7: 写 `web/export.config.js`**

```js
export default {
  targetDir: "./src/assets",
  outputFile: "index.ts",
  customImport: (fileName, file, fileType) => {
    const name =
      fileName.charAt(0).toUpperCase() +
      fileName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    if (fileType === "svg" && file.startsWith("svg")) {
      return `import iSvg${name} from "./${file}";`;
    } else {
      return `import ${fileType}${name} from "./${file}";`;
    }
  }
};
```

- [ ] **Step 8: 写 `web/uno.config.js`**

照搬 `apps/web` 的色板与 rules；**删掉** `tzero` 色组与 `t0-item-*` shortcut（AI 框专用）。

```js
import {
  defineConfig,
  transformerVariantGroup,
  presetTypography,
  presetIcons
} from "unocss";
import { presetWind3 } from "@unocss/preset-wind3";
import transformerDirectives from "@unocss/transformer-directives";

export default defineConfig({
  presets: [
    presetWind3(),
    presetTypography(),
    presetIcons({ scale: 1.2, warn: true })
  ],
  theme: {
    colors: {
      black: "#1F2329",
      primary: "#3E7EFF",
      primaryActive: "#2E6BE6",
      primaryLight: "#EBF2FF",
      primaryBorder: "#D8E5FF",
      danger: "#FA4141",
      dangerActive: "#DD3636",
      success: "#36D18E",
      split: "#E7E7E7",
      grayDark: "#5D616B",
      grayMedium: "#8F959E",
      grayLight: "#F4F6F8",
      edge: "#E1E5EB",
      warning: "#FEAC00",
      control: "#C9CFD8",
      controlActive: "#E0E4E8"
    }
  },
  rules: [
    ["gutter-stable", { "scrollbar-gutter": "stable" }],
    ["drag-area", { "app-region": "drag" }],
    ["no-drag-area", { "app-region": "no-drag" }],
    [
      "bg-layout-gradient",
      { background: "linear-gradient(180deg, #EBF2FF 0%, #F5F8FF 100%)" }
    ]
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  safelist: [
    ...Array.from({ length: 24 }, (_, i) => `grid-cols-${i + 1}`),
    ...Array.from({ length: 24 }, (_, i) => `col-span-${i + 1}`)
  ]
});
```

- [ ] **Step 9: 写 `web/vite.config.js`**

```js
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "path";

import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";

import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import {
  ElementPlusResolver,
  VantResolver
} from "unplugin-vue-components/resolvers";
import { codeInspectorPlugin } from "code-inspector-plugin";

import exportConfig from "./export.config.js";
import { autoApiExports } from "./src/plugins/vite-auto-api-exports.js";
import { autoExportAssets } from "./src/plugins/vite-auto-assets-exports.js";
import { mpaPlugin } from "./src/plugins/vite-mpa-plugin.js";
import { createPagesPlugins } from "./src/plugins/vite-pages-config.js";

// 部署 base，改动需同步部署侧 nginx
const base = "/meeting/";

// MPA 构建目标
const buildTarget = process.env.BUILD_TARGET || "main";
const buildEntries = {
  main: "index.html", // 主应用
  zx: "zx/index.html", // 桌面端（PC WebView）
  m: "m/index.html" // 移动端（iOS / 安卓 WebView）
};

export default defineConfig(({ mode }) => {
  return {
    base,
    server: {
      // dev 反向代理：/api 走智信网关，/meetingApi 走本地 Hono
      proxy: {
        "/api": "http://192.168.10.25",
        "/meetingApi": "http://localhost:3100"
      },
      host: "0.0.0.0",
      port: 6273
    },
    preview: { port: 6273 },
    plugins: [
      codeInspectorPlugin({
        bundler: "vite",
        injectTo: [
          resolve(__dirname, "src/main.js"), // main 入口
          resolve(__dirname, "src/mpa/desktop/main.js"), // zx 入口
          resolve(__dirname, "src/mpa/mobile/main.js") // m 入口
        ],
        behavior: { copy: true }
      }),
      vue(),
      UnoCSS(),
      AutoImport({ resolvers: [ElementPlusResolver(), VantResolver()] }),
      Components({ resolvers: [ElementPlusResolver(), VantResolver()] }),
      autoExportAssets(exportConfig),
      autoApiExports(),
      ...createPagesPlugins(),
      mpaPlugin(base)
    ],
    define: {
      JENKINS_BUILD_NUMBER: JSON.stringify(
        process.env.BUILD_NUMBER || "NOT_JENKINS_CI"
      ),
      // 构建目标（main/zx/m），供运行期区分宿主形态
      __BUILD_TARGET__: JSON.stringify(buildTarget)
    },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
    },
    build: {
      assetsInlineLimit: 0,
      ...(mode !== "development" && { outDir: `dist_${buildTarget}` }),
      rollupOptions: {
        input:
          mode === "development"
            ? Object.fromEntries(
                Object.entries(buildEntries).map(([k, v]) => [
                  k,
                  resolve(__dirname, v)
                ])
              )
            : { [buildTarget]: resolve(__dirname, buildEntries[buildTarget]) }
      }
    }
  };
});
```

- [ ] **Step 10: 写 `web/mergeDist.js`**

三个入口，无 share。

```js
import fs from "fs-extra";

async function mergeDist() {
  await fs.emptyDir("dist");
  await fs.copy("dist_main", "dist");
  await fs.copy("dist_zx", "dist");
  await fs.copy("dist_m", "dist");
  console.log("Merge completed!");
  await fs.writeJson("dist/build_version", {
    branch: process.env.branchName || "NOT_CI",
    commit: process.env.GIT_COMMIT || "NOT_CI",
    build_number: process.env.BUILD_NUMBER || "NOT_CI",
    build_time: +new Date()
  });
}

try {
  await mergeDist();
} catch (e) {
  console.error(e);
  process.exit(0);
}
```

- [ ] **Step 11: 写 `web/.prettierrc`**

```json
{
  "trailingComma": "none",
  "arrowParens": "always"
}
```

- [ ] **Step 12: 写三个入口 HTML**

`web/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>智能会议室</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

`web/zx/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>智能会议室</title>
  </head>
  <body>
    <div id="app" class="text-sm"></div>
    <script type="module" src="/src/mpa/desktop/main.js"></script>
  </body>
</html>
```

`web/m/index.html`（保留 `apps/web` 那套移动端 polyfill 与视口设置，去掉 wnsdk 调用——本期不做桥）：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"
    />
    <title>智能会议室</title>
    <style>
      #app {
        -webkit-overflow-scrolling: touch;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
      }
    </style>
    <script>
      // 低版本 WebView polyfill（安卓部分机型缺这几个方法）
      (function () {
        if (typeof Object.hasOwn !== "function") {
          Object.defineProperty(Object, "hasOwn", {
            value(target, property) {
              return Object.prototype.hasOwnProperty.call(target, property);
            },
            configurable: true,
            writable: true
          });
        }
        if (typeof Array.prototype.at !== "function") {
          Object.defineProperty(Array.prototype, "at", {
            value(index) {
              var target = Object(this);
              var length = target.length >>> 0;
              var normalizedIndex = Number(index) || 0;
              if (normalizedIndex < 0) normalizedIndex += length;
              if (normalizedIndex < 0 || normalizedIndex >= length)
                return undefined;
              return target[normalizedIndex];
            },
            configurable: true,
            writable: true
          });
        }
      })();
    </script>
  </head>
  <body>
    <div id="app" class="text-sm w-screen h-screen overflow-hidden"></div>
    <script type="module" src="/src/mpa/mobile/main.js"></script>
  </body>
</html>
```

- [ ] **Step 13: 建占位目录**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting/web
mkdir -p public src/assets src/pages src/mpa/desktop/pages src/mpa/mobile/pages src/server/module src/utils src/use
touch public/.gitkeep src/assets/.gitkeep
```

- [ ] **Step 14: 装依赖**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting && pnpm install
```

期望：`Done in`，无 ERR_PNPM_PEER_DEP_ISSUES。

- [ ] **Step 15: 验证 vite 能加载配置**

此时还没有任何 `main.js`，`vite build` 必然失败，但**配置本身必须能被解析**：

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting/web && pnpm exec vite build --mode development 2>&1 | head -20
```

期望：报错内容是找不到 `/src/main.js` 之类的入口解析失败，**不是** 配置文件语法/导入错误（例如不得出现 `Failed to load config`）。

- [ ] **Step 16: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "feat(web): 三入口 vite 构建配置与四个自研插件"
```

---

### Task 4: web —— 运行时基础层（utils / dialog / http）

**Files:**
- Create: `apps/meeting/web/src/utils/index.js`
- Create: `apps/meeting/web/src/utils/dialog.js`
- Create: `apps/meeting/web/src/use/useMobileEnv.js`
- Create: `apps/meeting/web/src/use/useElementState.js`
- Create: `apps/meeting/web/src/server/http.js`
- Create: `apps/meeting/web/src/server/module/health.js`
- Create: `apps/meeting/web/src/style.css`

**Interfaces:**
- Consumes: Task 3 的 alias `@`、`autoApiExports` 插件（会生成 `src/server/index.js`）。
- Produces（Task 5/6/7 直接调用这些签名）：
  - `getToken(type?: "access_token" | "refresh_token"): string | null`
  - `setToken(data: { access_token: string, refresh_token: string }): void`
  - `getCorpId(): string | null`
  - `getUrlParams(data: string | Location): Map<string, string>`
  - `bootstrapAuthFromUrl(): { token: string | null, corpId: string | null, clientType: string }`
  - `showToastError(message: string, showWarning?: boolean): void`
  - `confirmNoted(message: string, options?: object): Promise<unknown>`
  - `default http: AxiosInstance`（`baseURL` 默认 `/meetingApi`）
  - `getHealth(): Promise<{ ok: boolean, ts: number }>`

- [ ] **Step 1: 写 `web/src/use/useElementState.js`**

```js
import { ref } from "vue";

// 全屏元素引用：Element Plus 的弹层需要 appendTo 到它，否则全屏下弹层不可见
const fullscreenElement = ref(null);

document.addEventListener("fullscreenchange", function () {
  fullscreenElement.value = document.fullscreenElement;
});

export { fullscreenElement };
```

- [ ] **Step 2: 写 `web/src/use/useMobileEnv.js`**

```js
import { computed, ref } from "vue";
import isMobile from "is-mobile";

// 全局响应式状态：宿主可显式设置，未设置时按 UA 判断
const mEnv = ref(false);

export const setMobileEnv = (env) => {
  mEnv.value = env;
};

export default () => {
  const mobileEnv = computed(() => mEnv.value || isMobile());
  return { mobileEnv, setMobileEnv };
};
```

- [ ] **Step 3: 写 `web/src/utils/dialog.js`**

只保留基建实际用到的两个（`http.js` 用 `showToastError`，`router.js` 用 `confirmNoted`）加一个成功提示；其余等业务需要再补。

```js
import { unref } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";
import { showSuccessToast, showFailToast, showDialog } from "vant";
import { fullscreenElement } from "@/use/useElementState";
import useMobileEnv from "@/use/useMobileEnv";

const { mobileEnv } = useMobileEnv();

/** 成功提示 */
export const showToastSuccess = (message, duration) => {
  if (mobileEnv.value) {
    showSuccessToast({
      message,
      forbidClick: true,
      duration: duration ? duration : 2000
    });
  } else {
    ElMessage.success({
      message,
      appendTo: unref(fullscreenElement) || "body"
    });
  }
};

/** 错误提示 */
export const showToastError = (message, showWarning = false) => {
  if (mobileEnv.value) {
    showFailToast({ message, forbidClick: true });
  } else {
    ElMessage({
      type: showWarning ? "warning" : "error",
      message,
      appendTo: unref(fullscreenElement) || "body"
    });
  }
};

/** 单按钮告知型弹框（版本自更新提示用） */
export const confirmNoted = (message, { title, confirmText, ...args } = {}) => {
  if (mobileEnv.value) {
    return showDialog({
      title: title || "提示",
      message,
      width: "80%",
      confirmButtonColor: "#3E7EFF",
      confirmButtonText: confirmText || "确定",
      overlayStyle: { background: "rgba(0, 0, 0, 0.5) !important" }
    });
  }
  return ElMessageBox.confirm(message, title || "提示", {
    confirmButtonText: confirmText || "确定",
    showCancelButton: false,
    type: "warning",
    autofocus: false,
    closeOnClickModal: false,
    closeOnPressEscape: false,
    appendTo: unref(fullscreenElement) || "body",
    ...args
  });
};
```

- [ ] **Step 4: 写 `web/src/utils/index.js`**

`getToken` / `setToken` / `getCorpId` / `getUrlParams` 移植自 `apps/web`，**sessionStorage 键改成 meeting 前缀**；新增 `bootstrapAuthFromUrl()` 作为本期唯一的登录态入口（将来接 JSBridge 只改这一个函数）。

```js
export * from "./dialog";

/** 取 token（本期只从 sessionStorage 读，来源见 bootstrapAuthFromUrl） */
export const getToken = (type = "access_token") => {
  try {
    const token = JSON.parse(sessionStorage.getItem("meetingToken") || "null");
    return token ? token[type] : null;
  } catch (error) {
    return null;
  }
};

/** 保存 token */
export const setToken = (data) => {
  sessionStorage.setItem("meetingToken", JSON.stringify(data));
};

/** 取企业 ID */
export const getCorpId = () => sessionStorage.getItem("meetingCorpId");

/** 解析 URL 查询参数 */
export const getUrlParams = (data) => {
  let url = "";
  if (typeof data === "string") {
    if (data.split("?").length && data.split("?")[1])
      url = `?${data.split("?")[1]}`;
  } else {
    url = data.search;
  }
  const result = new Map();
  if (url) {
    const params = url.substring(1).split("&");
    for (let i = 0; i < params.length; i++) {
      const temp = params[i].split("=");
      const currentValue = result.get(temp[0]);
      // URL 查询参数里 + 代表空格
      const value = temp[1] ? temp[1].replace(/\+/g, " ") : temp[1];
      result.set(temp[0], currentValue ?? value);
    }
  }
  return result;
};

/**
 * 本期登录态入口：从 URL query 取 token / corpId / clientType 落 sessionStorage，
 * 没带参数时沿用已有的 sessionStorage 值。
 * 后续接 JSBridge（wnsdk.meeting.* 或 window.webview.ipcRenderer）时只改这一个函数，
 * 不要在组件里各写一份取 token 逻辑。
 */
export const bootstrapAuthFromUrl = () => {
  const params = getUrlParams(location.href);
  const token = params.get("token");
  const corpId = params.get("corpId");
  const clientType = params.get("clientType");

  if (token) {
    setToken({ access_token: token, refresh_token: params.get("refreshToken") || "" });
  }
  if (corpId) {
    sessionStorage.setItem("meetingCorpId", corpId);
  }
  if (clientType) {
    sessionStorage.setItem("clientType", JSON.stringify(clientType));
  }

  return {
    token: getToken(),
    corpId: getCorpId(),
    clientType: clientType || "app"
  };
};
```

- [ ] **Step 5: 写 `web/src/server/http.js`**

移植自 `apps/web/src/server/http.js`，改动两处：`baseMap` 收窄、默认 `baseURL` 指 `/meetingApi`。其余（token 刷新、`O_T_00x`、重试 ≤3、`M0000` 拆包）逐字保留。

```js
import axios from "axios";
import {
  getToken,
  setToken,
  getCorpId,
  getUrlParams,
  showToastError
} from "@/utils";
import { useSessionStorage } from "@vueuse/core";
import { unref } from "vue";

let errorFlag = false;
let IsRefrshToken = false; // 是否正在刷新 token
let currentResponse;

const errorMsg = ["O_T_001", "O_T_002", "O_T_003"];
const retryMap = new Map();

export const baseMap = {
  base: "/api/",
  auth: "/api/oauth",
  meeting: "/meetingApi"
};

const clientType = useSessionStorage("clientType", "app");

const params = getUrlParams(location.href);
if (params.get("clientType")) {
  clientType.value = params.get("clientType");
}

export const setClientType = (v) => {
  if (v) {
    clientType.value = v;
  }
};

const http = axios.create({
  baseURL: baseMap.meeting,
  timeout: 30000,
  validateStatus: (status) => status < 400,
  headers: {
    "Content-Type": "application/json;charset=utf-8",
    clientType,
    version: "v1"
  }
});

export const insRequestArgs = [
  (request) => {
    retryRequest(request);
    request.headers.clientType = unref(clientType);
    if (
      request.url.indexOf("/refresh/token") === -1 &&
      request.url.indexOf("/app/login") === -1
    ) {
      const token = getToken("access_token");
      if (token) {
        request.headers.Authorization = `Bearer ${token}`;
      }
      // 调用方可按业务归属显式指定企业，未指定时用当前企业
      if (!request.headers.zxCorpId) {
        request.headers.zxCorpId = getCorpId();
      }
    }
    return request;
  },
  (error) => Promise.reject(error)
];
// @ts-ignore axios 类型未导出 tuple 形态的拦截器参数
http.interceptors.request.use(...insRequestArgs);

export const insResponseArgs = [
  (response) => {
    if (response.status === 200 && errorMsg.includes(response.data.code)) {
      if (response.data.code === "O_T_003") {
        if (!errorFlag) {
          errorFlag = true;
          showToastError(response.data.msg || "登录已过期，请重新登录");
          setTimeout(() => {
            errorFlag = false;
          }, 2000);
        }
        return Promise.reject(response);
      }
      if (!IsRefrshToken) {
        IsRefrshToken = true;
        currentResponse = response;
        return refreshToken()
          .then((res) => {
            if (res) {
              const option = { ...currentResponse.config };
              if (typeof currentResponse.config.data === "string") {
                try {
                  option.data = JSON.parse(currentResponse.config.data);
                } catch (error) {
                  option.data = currentResponse.config.data;
                }
              }
              IsRefrshToken = false;
              return http(option);
            }
          })
          .catch((error) => {
            showToastError(response.data.msg || "登录已过期，请重新登录");
            return Promise.reject(error);
          });
      }
      return new Promise((resolve) => {
        const polling = setInterval(() => {
          if (!IsRefrshToken) {
            clearInterval(polling);
            const option = { ...response.config, baseURL: "" };
            if (typeof response.config.data === "string") {
              try {
                option.data = JSON.parse(response.config.data);
              } catch (error) {
                option.data = response.config.data;
              }
            }
            resolve(http(option));
          }
        }, 10);
      });
    }
    if (response.data.code !== "M0000") {
      return Promise.reject(response.data);
    }
    return response.data.data;
  },
  (error = {}) => {
    if (!axios.isCancel(error)) {
      const { config } = error;
      if (config && config.headers) {
        const retrylog = retryMap.get(config.headers.retrykey);
        if (retrylog <= 3) {
          return retryXHR(config);
        }
        retryMap.delete(config.headers.retrykey);
      }
    }
    return Promise.reject(error);
  }
];
// @ts-ignore 同上
http.interceptors.response.use(...insResponseArgs);

export function refreshToken() {
  const refresh_token = getToken("refresh_token");
  return http
    .post("/api/refresh/token", {}, { params: { refresh_token }, baseURL: "" })
    .then((data) => {
      const { access_token, refresh_token } = data;
      setToken({ access_token, refresh_token });
      return data;
    })
    .catch((error) => Promise.reject(error));
}

const retryRequest = (config) => {
  if (!config.headers.retrykey) {
    config.headers.retrykey = `${Date.now()}#${config.url}`;
  }
  const retrylog = retryMap.has(config.headers.retrykey)
    ? retryMap.get(config.headers.retrykey)
    : 0;
  retryMap.set(config.headers.retrykey, retrylog + 1);
};

const retryXHR = (config) => {
  config.url = config.url.replace(config.baseURL, "");
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(http(config));
    }, 2000);
  });
};

export default http;
```

- [ ] **Step 6: 写 `web/src/server/module/health.js`**

```js
import http from "../http";

/** 后端健康检查（拦截器已拆掉 M0000 信封，这里拿到的是 data.data） */
export const getHealth = () => http.get("/health");
```

- [ ] **Step 7: 写 `web/src/style.css`**

```css
/* 全局基础样式：三个入口共用 */
html,
body,
#app {
  height: 100%;
  margin: 0;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei",
    "Helvetica Neue", Arial, sans-serif;
  color: #1f2329;
  background: #f4f6f8;
}
```

- [ ] **Step 8: 验证生成物按预期产出**

先临时跑一次 dev（Task 5 之后才有页面，这里只看插件是否写出文件）：

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting/web && pnpm exec vite build --mode development 2>&1 | head -20
ls src/server/index.js
```

期望：`src/server/index.js` 存在，内容首行是 `export * from "./module/health.js";`。构建本身仍会因缺 `main.js` 报错，属正常。

- [ ] **Step 9: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "feat(web): 移植 axios 网络层与 token/弹窗工具，新增 health 接口"
```

---

### Task 5: web —— main 入口、router 版本自更新、冒烟页

**Files:**
- Create: `apps/meeting/web/src/main.js`
- Create: `apps/meeting/web/src/App.vue`
- Create: `apps/meeting/web/src/router.js`
- Create: `apps/meeting/web/src/components/SmokeCard.vue`
- Create: `apps/meeting/web/src/pages/index.vue`

**Interfaces:**
- Consumes: Task 3 的 `~pages` / `__BUILD_TARGET__` / `JENKINS_BUILD_NUMBER`；Task 4 的 `bootstrapAuthFromUrl` / `getHealth` / `confirmNoted`。
- Produces: `SmokeCard.vue` —— props `{ entry: string }`，三个入口的冒烟页共用；内部自行调 `getHealth()` 并展示结果。Task 6/7 直接复用，不再各写一份。

- [ ] **Step 1: 写 `web/src/components/SmokeCard.vue`**

三个入口共用一份，避免复制三遍（DRY）。

```vue
<template>
  <div class="p-16px">
    <h1 class="text-18px font-600 text-black m-0">智能会议室 · 冒烟页</h1>
    <ul class="mt-12px p-0 list-none text-14px text-grayDark leading-28px">
      <li>入口（entry）：{{ entry }}</li>
      <li>__BUILD_TARGET__：{{ buildTarget }}</li>
      <li>__VITE_MPA_PLATFORM__：{{ platform }}</li>
      <li>token：{{ tokenState }}</li>
      <li>corpId：{{ corpId || "（无）" }}</li>
      <li>后端 health：{{ healthText }}</li>
    </ul>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { bootstrapAuthFromUrl } from "@/utils";
import { getHealth } from "@/server";

defineProps({
  entry: { type: String, required: true }
});

const buildTarget = __BUILD_TARGET__;
const platform = window.__VITE_MPA_PLATFORM__ || "（main 入口无此标识）";

const auth = bootstrapAuthFromUrl();
const corpId = ref(auth.corpId);
const tokenState = computed(() => (auth.token ? "已获取" : "无（可用 ?token= 注入）"));

const healthText = ref("请求中…");

onMounted(async () => {
  try {
    const data = await getHealth();
    healthText.value = `ok=${data.ok} ts=${data.ts}`;
  } catch (error) {
    healthText.value = `失败：${error && error.message ? error.message : JSON.stringify(error)}`;
  }
});
</script>
```

- [ ] **Step 2: 写 `web/src/pages/index.vue`**

```vue
<template>
  <SmokeCard entry="main（独立浏览器）" />
</template>

<script setup>
import SmokeCard from "@/components/SmokeCard.vue";
</script>
```

- [ ] **Step 3: 写 `web/src/router.js`**

移植 `apps/web` 的版本自更新逻辑，fetch 路径改 `/meeting/build_version`。

```js
import { createRouter, createWebHistory } from "vue-router";
import routes from "~pages";
import { confirmNoted } from "./utils";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

/**
 * 版本自更新：产物换版后旧页面的动态 import 会 404。
 * 捕获该错误 → 比对线上 build_version 与编译期常量 → 不一致就提示刷新。
 */
router.onError((error, to) => {
  console.log("router.onError", { error, to });
  if (
    error.message.includes("Failed to fetch dynamically imported module") ||
    error.message.includes("Importing a module script failed")
  ) {
    fetch("/meeting/build_version", { cache: "no-cache" })
      .then((x) => x.text())
      .then((v) => {
        // @ts-ignore JENKINS_BUILD_NUMBER 是 vite define 注入的编译期常量
        if (!new RegExp(JENKINS_BUILD_NUMBER).test(v)) {
          return confirmNoted("会议室已更新，是否刷新为最新版本?");
        }
      })
      .then((update) => {
        if (update) {
          location.href = location.href;
        }
      });
  }
});
```

- [ ] **Step 4: 写 `web/src/App.vue`**

```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 5: 写 `web/src/main.js`**

```js
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";

import "@unocss/reset/tailwind.css";
import "uno.css";
import "@vant/touch-emulator";
import "element-plus/dist/index.css";
import "vant/lib/index.css";
import "./style.css";

createApp(App).use(router).mount("#app");
```

> ⚠️ 全局插件 / 样式 / 指令要**同步三处 main.js**（本文件 + Task 6 的 desktop + Task 7 的 mobile），漏改会导致某入口行为漂移——这是 `apps/web` 记录在案的坑。

- [ ] **Step 6: 起 dev 验证 main 入口**

两个终端：

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting && pnpm run dev:server
```

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting && pnpm run dev:web
curl -s http://localhost:6273/meeting/ | head -5
```

期望：HTML 返回，含 `<div id="app">`。浏览器打开 `http://localhost:6273/meeting/`，页面应显示：
`__BUILD_TARGET__：main`、`__VITE_MPA_PLATFORM__：（main 入口无此标识）`、`后端 health：ok=true ts=...`。

- [ ] **Step 7: 验证 token 注入通路**

浏览器打开 `http://localhost:6273/meeting/?token=abc123&corpId=c1`，期望页面显示 `token：已获取`、`corpId：c1`。

- [ ] **Step 8: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "feat(web): main 入口、路由版本自更新与共用冒烟卡片"
```

---

### Task 6: web —— zx（桌面）入口

**Files:**
- Create: `apps/meeting/web/src/mpa/desktop/main.js`
- Create: `apps/meeting/web/src/mpa/desktop/App.vue`
- Create: `apps/meeting/web/src/mpa/desktop/pages/index.vue`

**Interfaces:**
- Consumes: Task 3 的 `~zx-pages`；Task 5 的 `SmokeCard.vue`。
- Produces: zx 入口挂在 `${BASE_URL}zx/` 的 history base 上。

- [ ] **Step 1: 写 `web/src/mpa/desktop/App.vue`**

```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 2: 写 `web/src/mpa/desktop/pages/index.vue`**

用 Element Plus 组件，验证按需注册在 zx 入口生效。

```vue
<template>
  <div>
    <SmokeCard entry="zx（PC WebView）" />
    <div class="px-16px">
      <el-button type="primary" @click="visible = true">
        Element Plus 自检
      </el-button>
      <el-dialog v-model="visible" title="按需注册正常" width="320px">
        <span class="text-14px text-grayDark">Element Plus 已生效。</span>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import SmokeCard from "@/components/SmokeCard.vue";

const visible = ref(false);
</script>
```

- [ ] **Step 3: 写 `web/src/mpa/desktop/main.js`**

```js
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import routes from "~zx-pages";

import "@unocss/reset/tailwind.css";
import "uno.css";
import "@vant/touch-emulator";
import "element-plus/dist/index.css";
import "vant/lib/index.css";
import "@/style.css";

const router = createRouter({
  history: createWebHistory(`${import.meta.env.BASE_URL}zx/`),
  routes
});

createApp(App).use(router).mount("#app");
```

- [ ] **Step 4: 验证 zx 入口**

dev server 保持运行，浏览器开 `http://localhost:6273/meeting/zx/`。

期望：显示 `__BUILD_TARGET__：main`（dev 模式下 BUILD_TARGET 未设，属正常）、`__VITE_MPA_PLATFORM__：zx`、`后端 health：ok=true ts=...`；点「Element Plus 自检」弹窗正常打开。

- [ ] **Step 5: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "feat(web): zx 桌面入口与 Element Plus 自检页"
```

---

### Task 7: web —— m（移动）入口

**Files:**
- Create: `apps/meeting/web/src/mpa/mobile/main.js`
- Create: `apps/meeting/web/src/mpa/mobile/App.vue`
- Create: `apps/meeting/web/src/mpa/mobile/pages/index.vue`

**Interfaces:**
- Consumes: Task 3 的 `~m-pages`；Task 5 的 `SmokeCard.vue`。
- Produces: m 入口挂在 `${BASE_URL}m/` 的 history base 上。

- [ ] **Step 1: 写 `web/src/mpa/mobile/App.vue`**

```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 2: 写 `web/src/mpa/mobile/pages/index.vue`**

用 Vant 组件，验证按需注册在 m 入口生效。

```vue
<template>
  <div>
    <SmokeCard entry="m（iOS / 安卓 WebView）" />
    <div class="px-16px">
      <van-button type="primary" size="small" @click="show = true">
        Vant 自检
      </van-button>
      <van-popup v-model:show="show" round position="bottom" class="p-16px">
        <span class="text-14px text-grayDark">Vant 已生效。</span>
      </van-popup>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import SmokeCard from "@/components/SmokeCard.vue";

const show = ref(false);
</script>
```

- [ ] **Step 3: 写 `web/src/mpa/mobile/main.js`**

```js
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import routes from "~m-pages";

import "@unocss/reset/tailwind.css";
import "uno.css";
import "element-plus/dist/index.css";
import "vant/lib/index.css";
import "@/style.css";

const router = createRouter({
  history: createWebHistory(`${import.meta.env.BASE_URL}m/`),
  routes
});

createApp(App).use(router).mount("#app");
```

- [ ] **Step 4: 验证 m 入口**

浏览器开 `http://localhost:6273/meeting/m/`（建议开 DevTools 移动模拟）。

期望：`__VITE_MPA_PLATFORM__：m`、`后端 health：ok=true ts=...`；点「Vant 自检」底部弹层正常弹出。

- [ ] **Step 5: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "feat(web): m 移动入口与 Vant 自检页"
```

---

### Task 8: 全量构建与类型检查验收

**Files:**
- Modify: `apps/meeting/web/package.json`（仅当构建暴露脚本问题时）

**Interfaces:**
- Consumes: Task 2–7 全部产出。
- Produces: `web/dist/` 合并产物（三入口 HTML + `build_version`），即部署物。

- [ ] **Step 1: 类型检查**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting/web && pnpm exec vue-tsc --noEmit; echo "exit=$?"
```

期望：`exit=0`。若报 `~pages` / `~zx-pages` / `~m-pages` 找不到类型，新建 `web/src/vite-env.d.ts`：

```ts
/// <reference types="vite/client" />

declare module "~pages" {
  import type { RouteRecordRaw } from "vue-router";
  const routes: RouteRecordRaw[];
  export default routes;
}
declare module "~zx-pages" {
  import type { RouteRecordRaw } from "vue-router";
  const routes: RouteRecordRaw[];
  export default routes;
}
declare module "~m-pages" {
  import type { RouteRecordRaw } from "vue-router";
  const routes: RouteRecordRaw[];
  export default routes;
}

declare const JENKINS_BUILD_NUMBER: string;
declare const __BUILD_TARGET__: "main" | "zx" | "m";

interface Window {
  __VITE_MPA_PLATFORM__?: "zx" | "m";
}
```

改完重跑本步，直到 `exit=0`。

- [ ] **Step 2: 全量构建**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting && pnpm run build; echo "exit=$?"
```

期望：`exit=0`，末尾输出 `Merge completed!`。

- [ ] **Step 3: 核对产物**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting/web
ls dist/index.html dist/zx/index.html dist/m/index.html dist/build_version
cat dist/build_version
```

期望：四个文件都在；`build_version` 内含 `branch` / `commit` / `build_number` / `build_time` 四个键。

- [ ] **Step 4: 核对平台标识已注入产物**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting/web
grep -o "__VITE_MPA_PLATFORM__='[a-z]*'" dist/zx/index.html dist/m/index.html
```

期望两行：`dist/zx/index.html:__VITE_MPA_PLATFORM__='zx'`、`dist/m/index.html:__VITE_MPA_PLATFORM__='m'`。

- [ ] **Step 5: server 构建**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting && pnpm run build:server; echo "exit=$?"
```

期望：`exit=0`。

- [ ] **Step 6: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "chore: 补齐类型声明，全量构建与类型检查通过"
```

---

### Task 9: 仓库文档与工作区文档

**Files:**
- Create: `apps/meeting/CLAUDE.md`
- Create: `apps/meeting/README.md`
- Create: `context/platforms/meeting.md`
- Modify: `context/features/20260824-智能会议室-前端基建/status.md`

**Interfaces:**
- Consumes: Task 1–8 的全部实际命令与端口。
- Produces: 后续会话的入口文档。

- [ ] **Step 1: 写 `apps/meeting/CLAUDE.md`**

照 `apps/web/CLAUDE.md` 体例，内容必须与实际一致（命令、端口、生成物、三处 main.js 同步约束）：

```markdown
# 智能会议室（apps/meeting）

pnpm workspace 双包：`web/`（Vue 3 + Vite 7 MPA，三入口 main/zx/m）+ `server/`（Hono + TS）。
内嵌于智信 PC / iOS / 安卓 WebView。架构地图见上级仓库 `context/platforms/meeting.md`。

## 环境要求
- Node 22.16.0 / pnpm 10.22.0（根 `package.json#volta` 锁定）。

## 常用命令
| 场景 | 命令（在 `apps/meeting/` 根执行） |
|------|------|
| 安装依赖 | `pnpm i` |
| 前后端同时起 | `pnpm dev` |
| 只起前端 | `pnpm dev:web`（端口 6273，`/api`→192.168.10.25，`/meetingApi`→localhost:3100） |
| 只起后端 | `pnpm dev:server`（端口 3100） |
| 全量构建 | `pnpm build`（server tsc → web vue-tsc → main/zx/m → mergeDist） |
| 生产构建 | `pnpm build:prod` |
| 仅类型检查 | `pnpm -F @meeting/web exec vue-tsc --noEmit` |
| 格式化 | `pnpm format` |

> ⚠️ 没有 ESLint、没有单元测试。类型检查唯一手段是 `vue-tsc`（已内嵌在 `build`）。

## 代码规范
- Vue 3 Composition API + `<script setup>`；组合式函数放 `web/src/use/`，命名 `useXxx`。**不引入** Pinia/Vuex。
- JS 为主，工具/类型可用 TS。中文注释。
- 样式统一 UnoCSS 原子类 + `uno.config.js` 主题 token；Element Plus / Vant 按需自动注册，**不要整包 import**。
- 新接口写到 `web/src/server/module/<域>.js`，导出命名函数；走 `web/src/server/http.js` 的 axios 实例。
- 路由文件式（`vite-plugin-pages`）：主应用 `web/src/pages`、桌面 `web/src/mpa/desktop/pages`、移动 `web/src/mpa/mobile/pages`。**别放错目录。**
- 功能内聚：一个功能域一个目录，单测（将来有的话）集中到该功能的 `tests/`。

## 多入口注意事项
- 三个 HTML 入口各有独立 `main.js`。**新增全局插件、全局样式、全局指令必须同步三处**
  （`web/src/main.js`、`web/src/mpa/desktop/main.js`、`web/src/mpa/mobile/main.js`）。
- 部署 base 固定 `/meeting/`，改动需同步 `web/vite.config.js` 与部署侧。
- 取 token 一律走 `web/src/utils/index.js` 的 `bootstrapAuthFromUrl()`；将来接 JSBridge 也只改这一个函数。

## 生成物勿动
`web/src/server/index.js`、`web/src/assets/index.ts`、`components.d.ts`、`auto-imports.d.ts` —— 均由插件生成，已在 `.gitignore`。

## 提交前自检
1. `pnpm format`
2. `pnpm build` 通过
3. 改了接口 → 同步 `context/contracts/` 并在活跃功能 `impl-notes.md` 记一笔
```

- [ ] **Step 2: 写 `apps/meeting/README.md`**

```markdown
# zx-meeting-room

智能会议室前端 + Node 后端（pnpm workspace）。

- `web/` —— Vue 3 + Vite 7，MPA 三入口：`main`（独立浏览器）/ `zx`（PC WebView）/ `m`（iOS·安卓 WebView）
- `server/` —— Hono + TypeScript，端口 3100，路由前缀 `/meetingApi`

```bash
pnpm i
pnpm dev          # 前后端一起起
pnpm build        # 产出 web/dist/
```

部署 base `/meeting/`。详见 `CLAUDE.md`。
```

- [ ] **Step 3: 写 `context/platforms/meeting.md`**

与 `context/platforms/web.md` 同体例，约 100 行以内：

````markdown
# 智能会议室端一页纸

> 保持在约 100 行以内。由 /distill 定期结晶更新，人工修正错误。最后更新：2026-08-24

## 基本信息
- 仓库：apps/meeting/（pnpm workspace 双包：`web/` + `server/`，独立 git）
- 前端技术栈：Vue 3.5（`<script setup>`）+ Vite 7 + Vue Router 4（文件式路由 `vite-plugin-pages`）
  + UnoCSS 66（presetWind3 / typography / icons）+ Element Plus（PC）+ Vant（移动）+ axios。
  状态管理用 composables（`web/src/use/`），**无 Pinia/Vuex**。JS 为主，工具/类型用 TS。
- 后端技术栈：Hono 4 + @hono/node-server + TypeScript（strict），dev 用 tsx watch。
- 包管理 pnpm，根 `package.json#volta` 锁 node 22.16.0 / pnpm 10.22.0。
- 目标环境：以 `/meeting/` 为 base 部署；既作独立 Web，也内嵌于智信 PC / iOS / 安卓 WebView。

## 常用命令
```bash
# 在 apps/meeting/ 根执行
pnpm i
pnpm dev              # 前后端一起起（concurrently）
pnpm dev:web          # 仅前端，端口 6273
pnpm dev:server       # 仅后端，端口 3100
pnpm build            # server tsc → web vue-tsc → main/zx/m → mergeDist 合并到 web/dist/
pnpm build:prod       # 生产构建
pnpm format           # prettier，仅作用于 web/src/
```
> **无 ESLint、无测试脚本**；类型检查唯一手段是 `vue-tsc`（已内嵌在 build，单独跑
> `pnpm -F @meeting/web exec vue-tsc --noEmit`）。

## 目录与架构约定
- **MPA 三入口**（见 `web/vite.config.js` 的 `buildEntries`）：`index.html`(main) · `zx/`(PC) · `m/`(移动)。
  **没有 share 入口。** 各自有独立 `main.js`：`web/src/main.js`、`web/src/mpa/desktop/main.js`、
  `web/src/mpa/mobile/main.js`。**新增全局插件/样式/指令要同步三处。**
- **路由（文件式）**：三套虚拟模块 `~pages`(web/src/pages) / `~zx-pages`(web/src/mpa/desktop/pages) /
  `~m-pages`(web/src/mpa/mobile/pages)；`web/src/router.js` 另含版本自更新（动态 import 失败 →
  比对 `/meeting/build_version` 与 `JENKINS_BUILD_NUMBER` → 提示刷新）。
- **网络层 `web/src/server/`**：`http.js` 是 axios 实例（baseURL `/meetingApi`，30s；请求拦截自动加
  `Authorization`/`zxCorpId`/`clientType`/`version`；响应拦截处理业务码：`M0000` 成功 /
  `O_T_001/002` 静默刷新 token / `O_T_003` 登录过期 / 失败重试 ≤3 次）。按业务域拆
  `web/src/server/module/*.js`；**`web/src/server/index.js` 由 `vite-auto-api-exports` 自动生成，勿手改。**
- **后端 `server/src/`**：`index.ts` 挂 `/meetingApi` 前缀；路由按域拆 `routes/*.ts`。
  接口一律返回智信业务码信封 `{ code: "M0000", data, msg }`，好让前端拦截器无需开特例。
- **样式/组件**：UnoCSS 原子类 + `web/uno.config.js` 主题 token（primary `#3E7EFF` 等，与智信视觉统一）；
  Element Plus / Vant 走 unplugin 按需自动注册。
- **别名**：`@/` → `web/src/`。
- **登录态**：`web/src/utils/index.js` 的 `bootstrapAuthFromUrl()` 是唯一入口，
  sessionStorage 键 `meetingToken` / `meetingCorpId` / `clientType`。

## Mock 开关方式
无统一 mock 开关。页面先行阶段按 `context/contracts/` 的类型在 `web/src/server/module/` 或组件内构造
本地 mock，接口到位后删 mock、改回真实调用，并在活跃功能 impl-notes 记录差异。

## WebView 集成方式
**当前未做 JSBridge。** token / corpId / clientType 由宿主拼在 URL query 上
（`?token=&corpId=&clientType=`），前端 `bootstrapAuthFromUrl()` 落 sessionStorage。
三端内嵌地址：PC → `/meeting/zx/`，iOS / 安卓 → `/meeting/m/`。
将来接桥（拟 `wnsdk.meeting.*` / `window.webview.ipcRenderer`）只改 `bootstrapAuthFromUrl()` 一处，
协议须先写入 `context/bridge.md`。

## 已知坑
- `base` 固定 `/meeting/`，部署路径须一致，否则资源 404。
- `JENKINS_BUILD_NUMBER` / `__BUILD_TARGET__` 是 vite **编译期** define，改 env 必须重启 dev server。
- dev 模式下三个入口都同时构建，`__BUILD_TARGET__` 恒为 `main`；要区分入口请读
  `window.__VITE_MPA_PLATFORM__`（zx/m 有值，main 为 undefined）。
- 生成物勿手改且不提交：`web/src/server/index.js`、`web/src/assets/index.ts`、
  `components.d.ts`、`auto-imports.d.ts`。
- 全局插件/样式注册散落在三个 `main.js`，漏改会导致某入口行为不一致。
- 无 lint/test，质量靠人工 + `vue-tsc`；提交前建议 `pnpm format` 并本地跑一次 `pnpm build`。
````

- [ ] **Step 4: 更新 `status.md`**

把平台矩阵中 Task 1–9 对应的行改成 ✅，「待办 / 阻塞」补上：`apps/meeting` 待建 remote、三端内嵌 URL 与 JSBridge 待排期、业务页面下一轮。

- [ ] **Step 5: 提交 apps/meeting**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add -A
git commit -m "docs: 补 CLAUDE.md 与 README"
```

- [ ] **Step 6: 提交编排仓 context**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/platforms/meeting.md "context/features/20260824-智能会议室-前端基建"
git commit -m "docs(meeting): 前端基建落地，补 platforms 一页纸与状态矩阵"
```

---

## 验收清单（对应 spec「验收标准」六条）

- [ ] 1. `pnpm i` 通过，无 peer 冲突 —— Task 3 Step 14
- [ ] 2. `curl http://localhost:3100/meetingApi/health` 返 `code: "M0000"` —— Task 2 Step 8
- [ ] 3. `/meeting/`、`/meeting/zx/`、`/meeting/m/` 三页均出且 health 打屏成功 —— Task 5 Step 6、Task 6 Step 4、Task 7 Step 4
- [ ] 4. zx 的 Element Plus 与 m 的 Vant 都正常渲染 —— Task 6 Step 4、Task 7 Step 4
- [ ] 5. `pnpm build` 产出合并 `dist/` 含三入口 HTML 与 `build_version` —— Task 8 Step 3
- [ ] 6. web `vue-tsc --noEmit` 与 server `tsc` 均退 0 —— Task 8 Step 1、Step 5
