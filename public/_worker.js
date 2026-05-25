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
            <div class="input-group mb-2">
                <input type="text" id="keyword" class="form-control form-control-lg" placeholder="输入书名关键词..." required>
                <button class="btn btn-primary btn-lg" type="submit" id="searchBtn">
                    搜索
                    <div class="spinner-border spinner-border-sm text-light ms-2" id="loading" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </button>
            </div>
            <div class="quota-hint" style="font-size:0.8rem;color:#999;text-align:center;margin-top:8px;">⏳ 额度有限，30 秒间隔，耗完即止</div>
        </form>

        <div id="errorMsg" class="alert alert-danger" style="display: none;"></div>

        <div id="resultCard" class="card result-card border-success">
            <div class="card-header bg-success text-white">
                🎉 搜索成功
            </div>
            <div class="card-body">
                <h5 class="card-title" id="bookTitle"></h5>
                <p class="card-text">点击下方链接前往阅读或查看详情。</p>
                <a href="#" id="bookUrl" target="_blank" class="btn btn-outline-success w-100">前往书籍页面</a>
            </div>
        </div>
    </div>
</div>

<div class="footer">
    浏览 <span id="totalPageViews" class="badge bg-info">0</span> ·
    查询 <span id="totalQueries" class="badge bg-secondary">0</span>
</div>

<script>
    const API_BASE = '';

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
                    showError("⏳ 查询太频繁，请等 30 秒后再试。");
                } else if (response.status === 404) {
                    showError("未找到，请更换关键词试试。");
                } else {
                    showError("服务繁忙，请稍后重试。");
                }
            }
        } catch (error) {
            showError("网络异常，请稍后重试。");
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
    const country = request.headers.get('cf-ipcountry') || '--';

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
          } catch(e) {}
        })()
      );
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
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
        return new Response(JSON.stringify({}), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // 内存限流：30秒窗口内仅1次（同边缘节点秒级生效）
      if (!globalThis.rlMap) globalThis.rlMap = new Map();
      const rl = globalThis.rlMap;
      const now = Date.now();
      const last = rl.get(ip);
      if (last && (now - last) < 30000) {
        return new Response(JSON.stringify({}), {
          status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      rl.set(ip, now);
      if (rl.size > 5000) rl.clear();

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
            ctx.waitUntil(
              env.DB.prepare('INSERT INTO search_logs (ip, country, keyword, found) VALUES (?, ?, ?, 0)').bind(ip, country, cacheKey).run().catch(() => {})
            );
            return new Response(JSON.stringify({}), {
              status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          
          resultObj = results[0];
          cacheMap.set(cacheKey, { data: resultObj, timestamp: now });
        } catch (dbError) {
          return new Response(JSON.stringify({}), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      ctx.waitUntil(
        (async () => {
          await env.DB.prepare('UPDATE stats SET total_queries = total_queries + 1 WHERE id = 1').run().catch(() => {});
          await env.DB.prepare('INSERT INTO search_logs (ip, country, keyword, found) VALUES (?, ?, ?, 1)').bind(ip, country, cacheKey).run().catch(() => {});
        })()
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

    if (path === '/analytics') {
      const key = url.searchParams.get('key') || '';
      const ANALYTICS_KEY = env.ANALYTICS_KEY || 'novel2026';
      if (key !== ANALYTICS_KEY) {
        return new Response('Unauthorized', { status: 401 });
      }

      try {
        const [recent, topK, countries, daily] = await Promise.all([
          env.DB.prepare('SELECT keyword, country, created_at FROM search_logs WHERE found=1 ORDER BY id DESC LIMIT 20').all(),
          env.DB.prepare('SELECT keyword, COUNT(*) as cnt FROM search_logs WHERE found=1 GROUP BY keyword ORDER BY cnt DESC LIMIT 15').all(),
          env.DB.prepare('SELECT country, COUNT(*) as cnt FROM search_logs GROUP BY country ORDER BY cnt DESC').all(),
          env.DB.prepare("SELECT DATE(created_at) as day, COUNT(*) as cnt FROM search_logs GROUP BY day ORDER BY day DESC LIMIT 7").all()
        ]);

        const formatRows = (rows) => rows.map(r => Object.values(r).join(' | ')).join('\\n');
        const html2 = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Analytics</title><style>body{font-family:monospace;max-width:900px;margin:20px auto;background:#111;color:#0f0;padding:20px}h2{border-bottom:1px solid #333;padding-bottom:5px;color:#0f0}pre{background:#000;padding:10px;border-radius:4px;overflow-x:auto;font-size:13px}</style></head><body>' +
          '<h2>📊 最近搜索 (Recent Searches)</h2><pre>' + formatRows(recent.results || []) + '</pre>' +
          '<h2>🔥 热门关键词 (Top Keywords)</h2><pre>' + formatRows(topK.results || []) + '</pre>' +
          '<h2>🌍 国家/地区分布 (Country)</h2><pre>' + formatRows(countries.results || []) + '</pre>' +
          '<h2>📅 每日搜索量 (Daily)</h2><pre>' + formatRows(daily.results || []) + '</pre>' +
          '</body></html>';
        return new Response(html2, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
      } catch (e) {
        return new Response('Analytics error', { status: 500 });
      }
    }

    return new Response("", { status: 404 });
  }
};
