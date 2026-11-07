# 习惯卡 Habit Cards

按《掌控习惯》四大定律（提示、渴求、回应、奖赏）设计习惯卡并逐日打卡的单文件 Web 工具，内置「学习进度控制台」，支持 PWA 安装与可选的邮箱账号云同步。免费层的 Cloudflare Pages + D1 即可自托管。

**在线示例：https://habit-cards.pages.dev**

## 特性

- **单文件应用**：全部前端都在 `index.html` 里（习惯卡 + 学习进度控制台 + 说明书），无框架、无 npm 前端依赖、无外部请求
- **三级结构**：封面三入口（培养 / 戒除 / 学习进度）→ 分区列表 → 卡片详情（四定律小卡 + 打卡面板 + 就地快速打卡动效）
- **学习进度控制台**：有总量、有截止日的目标进度追踪——完成率 / 连续天数 / 预计完成日 / 周报复盘 / 打卡热力
- **主题三档**：日间 / 夜间 / 跟随系统，全站语义色变量驱动
- **PWA**：manifest + Service Worker（HTML network-first、静态 cache-first、`/api/*` 永不缓存），断网 100% 可用，可安装到手机桌面
- **海报导出**：纯 Canvas 2D 两遍布局，逐卡导出分享图
- **数据归你**：
  - 未登录：数据只存在本机浏览器 localStorage
  - 可选登录：邮箱注册后整快照云同步（换设备 / 清缓存不丢），冲突时给出双侧字节对比、由用户选择保留哪侧
  - 密码使用 Web Crypto 标准 API 的 PBKDF2-SHA256（10 万次迭代）加盐哈希，恒时比较防时序侧信道，注册接口按来源限速，会话 token 90 天可吊销
  - 同步失败静默重试，绝不弹窗打断使用

## 部署到你自己的 Cloudflare（免费层即可）

```bash
# 0. 复制配置模板并填入你自己的 D1 id
cp wrangler.toml.example wrangler.toml

# 1. 创建 D1 数据库，把输出的 database_id 填进 wrangler.toml
npx wrangler d1 create habit-cards-db

# 2. 初始化三张表（users / sessions / states）
npx wrangler d1 execute habit-cards-db --remote --file schema.sql

# 3. 收集部署工件到 dist/
node tools/build.js

# 4. 登录 Cloudflare 并部署（项目名可自定）
npx wrangler login
npx wrangler pages deploy dist --project-name habit-cards
```

本地开发（含 Functions 与本地 D1 模拟）：

```bash
cp wrangler.toml.example wrangler.toml   # 本地 dev 不校验 database_id，可保留占位
node tools/build.js
npx wrangler pages dev --port 8790
```

## 目录结构

```
├── index.html            # 全部前端：习惯卡 + 学习进度控制台 + 说明书（单文件）
├── functions/api/        # Cloudflare Pages Functions（云同步后端）
│   ├── _lib.js           #   JSON 响应 / 随机数 / PBKDF2 / 恒时比较 / 会话鉴权 / 注册限速
│   ├── register.js       #   POST /api/register（自动登录，返回 90 天 token）
│   ├── login.js          #   POST /api/login
│   ├── session.js        #   DELETE /api/session（吊销会话）
│   └── state.js          #   GET/PUT /api/state（每用户一行快照，整体覆盖式存取）
├── schema.sql            # D1 表结构：users / sessions / states
├── manifest.json         # PWA manifest
├── sw.js                 # Service Worker
├── icons/                # PWA 图标（192/512）
└── tools/
    ├── build.js          # 收集 dist/ 部署工件
    └── gen-icons.js      # 纯 Node zlib 手绘图标生成器（无第三方依赖）
```

## 数据与隐私

- 云同步快照按用户一行整存整取，只包含应用自身的业务键（习惯卡数据 / 学习进度数据 / 主题偏好），后端不做任何额外采集
- 同步凭据与会话只存于浏览器 localStorage；退出登录即吊销服务端会话
- 自部署时，所有数据都落在你自己的 D1 实例里

## 开发说明

- `index.html` 是构建完成的单文件产物：三个 `<script>` 块分别是云同步模块、学习进度控制台（Shadow DOM 模块）、习惯卡主脚本
- 修改后运行 `node tools/build.js` 刷新 `dist/`，再部署
- 主题切换 / 夜间档由 `--c-*` 语义色变量层驱动，新增界面请引用语义变量而不是写死颜色

## License

[MIT](LICENSE)
