const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小说快搜</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background-color: #f8f9fa;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        .container {
            flex: 1;
            margin-top: 50px;
            max-width: 600px;
        }
        .result-card {
            display: none;
            margin-top: 20px;
        }
        .footer {
            text-align: center;
            padding: 20px 0;
            color: #6c757d;
            font-size: 0.9rem;
        }
        .spinner-border {
            display: none;
        }
    </style>
</head>
<body>

<div class="container">
    <h2 class="text-center mb-4">📚 小说快搜</h2>
    
    <div class="card shadow-sm p-4">
        <form id="searchForm">
            <div class="input-group mb-3">
                <input type="text" id="keyword" class="form-control form-control-lg" placeholder="请输入小说名称关键词..." required>
                <button class="btn btn-primary btn-lg" type="submit" id="searchBtn">
                    搜索
                    <div class="spinner-border spinner-border-sm text-light ms-2" id="loading" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </button>
            </div>
        </form>

        <div id="errorMsg" class="alert alert-danger" style="display: none;"></div>

        <div id="resultCard" class="card result-card border-success">
            <div class="card-header bg-success text-white">
                🎉 搜索成功
            </div>
            <div class="card-body">
                <h5 class="card-title" id="bookTitle"></h5>
                <p class="card-text">找到匹配的一本书籍！点击下方链接前往阅读或查看详情。</p>
                <a href="#" id="bookUrl" target="_blank" class="btn btn-outline-success w-100">前往书籍页面</a>
            </div>
        </div>
    </div>
</div>

<div class="footer">
    本页已被浏览 <span id="totalPageViews" class="badge bg-info">0</span> 次 · 
    累计已查询 <span id="totalQueries" class="badge bg-secondary">0</span> 次<br>
    &copy; 2026 小说快搜 | Powered by Cloudflare Pages</div>

<script>
    // 如果你在前端使用与 Worker 相同的域名，可以改为空字符串 '' 从而使用相对路径
    const API_BASE = '/'; 

    document.addEventListener("DOMContentLoaded", () => {
        fetchStats();
    });

    document.getElementById('searchForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const keyword = document.getElementById('keyword').value.trim();
        if(!keyword) return;

        const btn = document.getElementById('searchBtn');
        const loading = document.getElementById('loading');
        const errorMsg = document.getElementById('errorMsg');
        const resultCard = document.getElementById('resultCard');

        // Reset UI
        btn.disabled = true;
        loading.style.display = 'inline-block';
        errorMsg.style.display = 'none';
        resultCard.style.display = 'none';

        try {
            const response = await fetch(\`\${API_BASE}/search?keyword=\${encodeURIComponent(keyword)}\`);
            const data = await response.json();

            if (response.ok) {
                document.getElementById('bookTitle').textContent = data.title;
                document.getElementById('bookUrl').href = data.url;
                resultCard.style.display = 'block';
                fetchStats(); // Update stats
            } else {
                if (response.status === 429) {
                    showError("查询太频繁啦！请稍微等一分钟后再试。");
                } else if (response.status === 404) {
                    showError("哎呀，没有找到相关的书籍，请更换关键词试试。");
                } else {
                    showError(data.error || "发生了未知错误。");
                }
            }
        } catch (error) {
            showError("网络请求失败，请检查您的网络连接或稍后重试。");
        } finally {
            btn.disabled = false;
            loading.style.display = 'none';
        }
    });

    async function fetchStats() {
        try {
            const resp = await fetch(\`\${API_BASE}/stats\`);
            if (resp.ok) {
                const data = await resp.json();
                document.getElementById('totalQueries').textContent = data.total_queries || 0;
                document.getElementById('totalPageViews').textContent = data.page_views || 0;
            }
        } catch(e) {
            console.error('Fetch stats failed', e);
        }
    }

    function showError(msg) {
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    }
</script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 主页：返回完整 HTML 页面，同时记录一次页面浏览 (Page View)
    if (path === '/' || path === '/index.html') {
      // 异步写入 KV，不阻塞页面响应
      ctx.waitUntil(
        (async () => {
          try {
            const current = await env.RATE_LIMIT_KV.get('stats:page_views');
            const count = current ? parseInt(current) + 1 : 1;
            await env.RATE_LIMIT_KV.put('stats:page_views', count.toString());
          } catch(e) { console.warn('PV write failed', e); }
        })()
      );
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    if (path === '/health') {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (path === '/stats') {
      try {
        // 并行读取：D1 查搜索次数 + KV 查页面浏览量
        const [dbResult, pvRaw] = await Promise.all([
          env.DB.prepare('SELECT total_queries FROM stats WHERE id = 1').all(),
          env.RATE_LIMIT_KV.get('stats:page_views')
        ]);
        let count = 0;
        if (dbResult.results && dbResult.results.length > 0) count = dbResult.results[0].total_queries;
        const pageViews = pvRaw ? parseInt(pvRaw) : 0;
        return new Response(JSON.stringify({ total_queries: count, page_views: pageViews }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ total_queries: "Error", page_views: 0 }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (path === '/search') {
      const keyword = url.searchParams.get('keyword');
      if (!keyword) {
        return new Response(JSON.stringify({ error: "Missing keyword" }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Rate Limiting
      const kvKey = `rate_limit:${ip}`;
      let rateData = null;
      try {
        rateData = await env.RATE_LIMIT_KV.get(kvKey, { type: "json" });
      } catch (e) {
        console.warn("KV Get failed", e);
      }
      
      const now = Date.now();
      
      if (!rateData) {
        rateData = { count: 1, resetAt: now + 60000 }; 
      } else {
        if (now > rateData.resetAt) {
          rateData = { count: 1, resetAt: now + 60000 };
        } else {
          rateData.count++;
        }
      }

      ctx.waitUntil(
        env.RATE_LIMIT_KV.put(kvKey, JSON.stringify(rateData), { expirationTtl: 60 }).catch(console.warn)
      );

      if (rateData.count > 10) {
        return new Response(JSON.stringify({ error: "Too many requests, try again later." }), {
          status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // LRU Cache
      if (!globalThis.searchCache) {
         globalThis.searchCache = new Map();
      }
      
      const cacheMap = globalThis.searchCache;
      if (cacheMap.size > 1000) {
        const firstKey = cacheMap.keys().next().value;
        cacheMap.delete(firstKey);
      }

      const cacheKey = keyword.trim().toLowerCase();
      let resultObj;

      if (cacheMap.has(cacheKey)) {
        const cachedItem = cacheMap.get(cacheKey);
        if (now - cachedItem.timestamp < 3600000) {
          resultObj = cachedItem.data;
        } else {
          cacheMap.delete(cacheKey);
        }
      }

      // DB Query
      if (!resultObj) {
        try {
          const queryPattern = `%${cacheKey}%`;
          const { results } = await env.DB.prepare('SELECT title, url FROM books WHERE title LIKE ? LIMIT 1').bind(queryPattern).all();

          if (!results || results.length === 0) {
            return new Response(JSON.stringify({ error: "Not found" }), {
              status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          resultObj = results[0];
          cacheMap.set(cacheKey, { data: resultObj, timestamp: now });
        } catch (dbError) {
          return new Response(JSON.stringify({ error: "Internal Server Error during DB query" }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      ctx.waitUntil(
         env.DB.prepare('UPDATE stats SET total_queries = total_queries + 1 WHERE id = 1').run().catch(console.warn)
      );

      const baseUrl = env.BASE_URL || 'https://www.example.com';
      let finalUrl = resultObj.url;
      if (!finalUrl.startsWith('http')) {
        finalUrl = baseUrl.replace(/\/$/, '') + '/' + resultObj.url.replace(/^\//, '');
      }

      return new Response(JSON.stringify({ 
         title: resultObj.title, 
         url: finalUrl 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
