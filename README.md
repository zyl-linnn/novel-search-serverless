# 小说快搜网站部署指南

这是用于你自己的爬虫数据转网站的后端与前端源码，采用了 Cloudflare D1 数据库、KV 以及 Worker 的技术方案（实现了极低成本/无成本托管、限制搜素频率、隐去整体爬虫数据）。

## 准备步骤

按照以下步骤完成最终部署。由于你已经拥有了 Active 状态的 Cloudflare 域名 `mysearch.dpdns.org`，所以前面的域名与 NS 修改操作无需再进行了。

### 第一步：在 Cloudflare 中创建必需的资源

1. **创建 D1 数据库**
   - 登录 Cloudflare 控制台，在左侧菜单点击 **D1**，点击 **创建数据库**，名字填写 `novel_db`。
   - 记下该数据库的 `database_id`。

2. **创建 KV 命名空间**
   - 在左侧菜单点击 **KV**，点击 **创建命名空间**，名字填写 `rate_limit_kv`。
   - 记下该命名空间的 `id`。

3. **修改 `wrangler.toml` 配置文件**
   - 将上面你记下的 KV ID 和 D1 ID 填写到本项目目录下的 `wrangler.toml` 文件对应的 `id` 和 `database_id` 处。
   - 配置 `[vars]` 里的 `BASE_URL`，把 `https://www.example.com` 替换为真实小说对应网站的主域名。

### 第二步：导入原始数据

1. 本地安装 Node.js 后，在终端中可以安装并登录 wrangler：
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. 运行 Python 数据整理脚本：
   ```bash
   # 安装所需环境（通常直接运行即可，因为只用到了标准库）
   python prepare_data.py
   ```
   **这会读取你当前目录下的所有 `all_books*.json`，完成去重和组装，最后在目录下生成一个名为 `import.sql` 的文件。**
3. 将数据部署/导入到 Cloudflare D1 数据库：
   ```bash
   wrangler d1 execute novel_db --file=import.sql --batch
   ```
   *（如果由于网络情况导致超时报错，你可能需要拆分 `import.sql` 分多次或缩小上述脚本中 `batch_size` 变量）*

### 第三步：发布 API 后端 (Worker)

1. 在终端中直接运行发布命令：
   ```bash
   wrangler deploy
   ```
2. 这会自动读取 `wrangler.toml` 和 `worker.js` 发布你的 Worker 接口。你控制台会输出一个默认的 URL 比如 `https://novel-api.xxxxxxxx.workers.dev`。

### 第四步：部署前端页面

**方案 A：通过 GitHub Pages (推荐)**
1. 使用文本编辑器打开 `index.html`。
2. 找到代码中的 `const API_BASE = 'https://api.mysearch.dpdns.org';` 替换为你刚发布的 Worker API 网址。
3. 将 `index.html` 提交到你的 GitHub 仓库。
4. 在你的 GitHub 仓库中点击右上角的 **Settings** -> 左侧边栏的 **Pages**，然后 Source 配置从分支主目录 `/ (root)` 发布。

**方案 B：使用 Cloudflare Pages 绑定域名并发布**
1. 同样修改 `index.html` 中的 API 地址后保存。
2. 在 Cloudflare 控制台，进入 **Workers & Pages** -> **Pages**，创建项目，选择直接上传你的包含 `index.html` 的文件夹，进行部署。
3. 给它绑定你现成的域名（如 `mysearch.dpdns.org`）。

### 服务限制测试

- 可以访问你的页面使用搜索功能。
- 疯狂点击按钮进行搜索（或者用脚本刷），1分钟内达到10次后会看到 **“查询太频繁啦”** 错误，从而保护了你的服务。 
- 原生的全量 JSON 数据完全隐身于背后的数据库中，不再对外暴露下载！
