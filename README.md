# 📚 小说快搜 (Novel Search)

> 🚀 零成本 · 全栈 Serverless · 国内直连 · 数据零暴露

一个为贴吧社区打造的**极简小说搜索引擎**。用户输入书名关键词，即可秒级返回对应的书籍详情页链接。

🔗 **在线访问：** https://novel-search.pages.dev

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🔒 **数据安全隔离** | 数十万条爬虫数据全部存储在云端 D1 分布式数据库，前端仅暴露单条检索接口，**源数据永不对外暴露** |
| ⚡ **边缘计算加速** | 基于 Cloudflare 全球边缘网络，国内直连 .pages.dev 域名，毫秒级响应 |
| 🛡️ **智能频率控制** | 自研 IP 级别速率限制（Rate Limiting），恶意刷量自动拦截 |
| 📊 **实时统计大屏** | 页面浏览量 (PV) 与搜索次数 (Queries) 即时可见 |
| 💰 **完全免费架构** | Cloudflare Pages + D1 + KV 免费额度内运行，零服务器成本 |

---

## 🛠 技术架构

\\\mermaid
graph LR
    A[👤 贴吧用户] -->|输入书名| B[🌐 Cloudflare Pages]
    B -->|全栈 _worker.js| C[🗄️ Cloudflare D1<br/>小说数据库]
    B -->|频率校验| D[📦 Cloudflare KV<br/>限流 + PV 统计]
    C -->|返回单条结果| B
    B -->|渲染 HTML| A
\\\

- **前端：** 原生 HTML/CSS/JS，Bootstrap 5 响应式布局，内嵌于 Worker 同构直出
- **后端：** Cloudflare Pages Functions（_worker.js），单文件全栈路由分发
- **数据库：** Cloudflare D1（SQLite 兼容），存放清洗去重后的书籍索引
- **缓存 & 限流：** Cloudflare KV + 内存 LRU Cache，双重加速
- **部署：** Git Push → Cloudflare Pages 自动构建部署

---

## 🔧 技能栈展示

| 环节 | 涉及能力 |
|------|----------|
| **数据工程** | Python 爬虫数据清洗、去重、SQL 批量转换，处理数十 MB 级 JSON 并迁移上云 |
| **后端开发** | Cloudflare Workers / Pages Functions，RESTful API 设计，路由分发，CORS 处理 |
| **数据库** | D1 (SQLite) 建表、索引优化、参数化查询防注入 |
| **安全防护** | KV 实现滑动窗口限流算法、IP 级别访问控制 |
| **前端工程** | 原生 JS 异步请求、DOM 操作、Bootstrap UI、统计实时刷新 |
| **DevOps** | Git + Cloudflare Pages CI/CD，零停机自动部署 |

---

## 📂 仓库说明

> ⚠️ 本仓库仅包含**网站入口代码**。原始爬虫数据、数据集文件、数据处理脚本均**不在此仓库中**，已通过后端数据库安全隔离。

\\\
novel-search-serverless/
├── public/
│   └── _worker.js      # Cloudflare Pages 全栈入口
├── .gitignore           # 数据安全策略
├── wrangler.toml        # Cloudflare 部署配置
└── README.md
\\\

---

## 🚀 一键部署

1. Fork 本仓库到你的 GitHub
2. 在 Cloudflare Dashboard 创建 **Pages** 项目 → **Connect to Git**
3. 构建设置：输出目录填 public，框架预设选 None
4. 绑定你的 D1 数据库 (DB) + KV 命名空间 (RATE_LIMIT_KV)
5. 添加环境变量 BASE_URL = 你的小说源站域名
6. 保存 → 自动部署完成 🎉

---

<p align="center">
  <sub>Built with ❤️ by YL Z · Powered by Cloudflare Pages</sub>
</p>
