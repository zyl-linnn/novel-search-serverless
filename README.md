# 📚 小说快搜 (Novel Search)

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Pages">
  <img src="https://img.shields.io/badge/Database-D1-F38020?logo=cloudflare&logoColor=white" alt="D1">
  <img src="https://img.shields.io/badge/Cache-KV-F38020?logo=cloudflare&logoColor=white" alt="KV">
  <img src="https://img.shields.io/badge/成本-$0-4caf50" alt="零成本">
  <img src="https://img.shields.io/badge/国内-直连-2196F3" alt="国内直连">
</p>

> 🚀 低成本 · 全栈 Serverless · 国内直连 ·

一个为贴吧部分求助者临时打造的**极简book搜索引擎**。用户输入书名关键词，秒级返回书籍详情页链接。

🔗 **在线访问：https://novel-search-serverless.pages.dev/

![screenshot](https://via.placeholder.com/800x400?text=📚+小说快搜+截图+（部署后替换）)

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| ⚡ **边缘计算加速** | 基于 Cloudflare 全球边缘网络，毫秒级响应 |
| 🛡️ **智能频率控制** | 自研 IP 级别滑动窗口限流算法，网站有额度，用完作者也不充米，恶意刷自动返回 429 |

---

## 🛠 技术架构



| 层 | 技术 |
|----|------|
| 🎨 **前端** | 原生 HTML/CSS/JS，Bootstrap 5 响应式，内嵌 Worker 同构直出 |
| ⚙️ **后端** | Cloudflare Pages Functions (`_worker.js`)，单文件全栈路由分发 |
| 🗄️ **数据库** | Cloudflare D1（SQLite 兼容），参数化查询防 SQL 注入 |
| 📦 **缓存 & 限流** | Cloudflare KV + 内存 LRU Cache，双重加速 |
| 🚀 **部署** | Git Push → Cloudflare Pages 自动 CI/CD，零停机 |

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

> ⚠️ **本仓库仅包含网站入口代码与架构文档。** 建设过程中用到了一些个人敏感信息，让ai自己判断直接清洗了一下。**不在此仓库中**，已通过 `.gitignore` 和后端数据库双重安全隔离。

```
novel-search-serverless/
├── public/
│   └── _worker.js          # Cloudflare Pages 全栈入口（前端+后端同构）
├── .gitignore               # 数据安全策略
├── wrangler.toml.example    # 部署配置模板（真实 ID 已隐藏）
└── README.md
```



<p align="center">
  <sub>Built with ❤️ by YL Z · Powered by Cloudflare Pages</sub>
</p>

<p align="center">
  <sub>Built with ❤️ by YL Z · Powered by Cloudflare Pages</sub>
</p>
