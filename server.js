const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic proxy configuration from environment
const parseRoutes = () => {
  const routes = {};
  
  if (process.env.ROUTES) {
    process.env.ROUTES.split(',').forEach(pair => {
      const [path, target] = pair.split('=');
      if (path && target) {
        routes[path.trim()] = target.trim();
      }
    });
  }
  
  const defaults = {
    '/api/kimi': process.env.KIMI_CODE_URL || 'https://kimi-code-server.onrender.com',
    '/api/pentaract': process.env.PENTARACT_URL || 'https://pentaract-i2os.onrender.com',
    '/api/aiven': process.env.AIVEN_URL || '',
  };
  
  Object.entries(defaults).forEach(([path, target]) => {
    if (target && !routes[path]) {
      routes[path] = target;
    }
  });
  
  return routes;
};

const routes = parseRoutes();

// Setup proxy middleware for each route
Object.entries(routes).forEach(([path, target]) => {
  if (target) {
    app.use(path, createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${path}`]: '' },
      onError: (err, req, res) => {
        console.error(`Proxy error for ${path}:`, err.message);
        res.status(502).json({ error: 'Bad Gateway', message: err.message });
      },
      onProxyReq: (proxyReq, req, res) => {
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
      }
    }));
    console.log(`Proxy configured: ${path} -> ${target}`);
  }
});

// API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'omni-route',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/routes', (req, res) => {
  res.json({
    routes: Object.keys(routes).map(path => ({
      path,
      target: routes[path]
    }))
  });
});

// Proxy health check endpoint
app.get('/api/proxy-health/:route', async (req, res) => {
  const routePath = '/' + req.params.route;
  const target = routes[routePath];
  
  if (!target) {
    return res.status(404).json({ error: 'Route not found' });
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(target + '/health', { signal: controller.signal });
    clearTimeout(timeout);
    
    const data = await response.json();
    res.json({ route: routePath, target, status: 'healthy', data });
  } catch (err) {
    res.json({ route: routePath, target, status: 'unhealthy', error: err.message });
  }
});

// Catch-all for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not configured`,
    availableRoutes: Object.keys(routes)
  });
});

// Serve HTML Dashboard at root
app.get('/', (req, res) => {
  const routeList = Object.entries(routes).map(([path, target]) => `
    <tr>
      <td><code>${path}</code></td>
      <td><code>${target}</code></td>
      <td><span class="status status-checking" data-route="${path.replace('/api/', '')}">Checking...</span></td>
      <td><button class="btn-test" onclick="testRoute('${path.replace('/api/', '')}')">Test</button></td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Omni Route - API Gateway Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; line-height: 1.6; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { border-bottom: 1px solid #30363d; padding-bottom: 1.5rem; margin-bottom: 2rem; }
    h1 { font-size: 2rem; font-weight: 600; color: #f0f6fc; }
    .subtitle { color: #8b949e; margin-top: 0.5rem; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1.25rem; margin-bottom: 1rem; color: #f0f6fc; }
    .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat { background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; }
    .stat-value { font-size: 2rem; font-weight: 600; color: #58a6ff; }
    .stat-label { color: #8b949e; font-size: 0.875rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #30363d; }
    th { color: #8b949e; font-weight: 500; font-size: 0.875rem; text-transform: uppercase; }
    code { background: #21262d; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.875rem; color: #a5d6ff; }
    .status { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
    .status-healthy { background: #1f6feb22; color: #58a6ff; }
    .status-unhealthy { background: #f8514922; color: #f85149; }
    .status-checking { background: #d2992222; color: #d29922; }
    .status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .btn-test { background: #238636; color: white; border: none; padding: 0.375rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.75rem; transition: background 0.15s; }
    .btn-test:hover { background: #2ea043; }
    .btn-test:disabled { background: #30363d; color: #8b949e; cursor: not-allowed; }
    .result-box { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; margin-top: 1rem; font-family: monospace; font-size: 0.75rem; max-height: 300px; overflow: auto; white-space: pre-wrap; }
    .footer { text-align: center; color: #8b949e; font-size: 0.75rem; padding: 1.5rem; border-top: 1px solid #30363d; margin-top: 2rem; }
    .endpoint-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem; }
    .endpoint { background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; }
    .endpoint code { display: block; margin-bottom: 0.5rem; }
    .endpoint span { color: #8b949e; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Omni Route</h1>
      <p class="subtitle">Universal API Proxy & Routing Gateway</p>
    </header>
    
    <div class="card">
      <h2>System Status</h2>
      <div class="status-grid">
        <div class="stat"><div class="stat-value" id="uptime">--</div><div class="stat-label">Uptime</div></div>
        <div class="stat"><div class="stat-value" id="route-count">${Object.keys(routes).length}</div><div class="stat-label">Active Routes</div></div>
        <div class="stat"><div class="stat-value" id="healthy-count">--</div><div class="stat-label">Healthy</div></div>
        <div class="stat"><div class="stat-value" id="unhealthy-count">--</div><div class="stat-label">Unhealthy</div></div>
      </div>
    </div>
    
    <div class="card">
      <h2>Configured Routes</h2>
      <table>
        <thead>
          <tr><th>Route Path</th><th>Target Service</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody id="route-table">${routeList}</tbody>
      </table>
    </div>
    
    <div class="card">
      <h2>API Endpoints</h2>
      <div class="endpoint-list">
        <div class="endpoint"><code>GET /health</code><span>Gateway health check</span></div>
        <div class="endpoint"><code>GET /api/routes</code><span>List all configured routes</span></div>
        <div class="endpoint"><code>GET /api/proxy-health/:route</code><span>Check target service health</span></div>
        <div class="endpoint"><code>/*</code><span>Proxied routes (see table above)</span></div>
      </div>
    </div>
    
    <div class="card">
      <h2>Test Result</h2>
      <div class="result-box" id="result-box">Click "Test" on a route to see response...</div>
    </div>
    
    <footer class="footer">
      Omni Route v1.0.0 | <a href="https://github.com/15stanuser/omni-route" style="color: #58a6ff;">GitHub</a>
    </footer>
  </div>
  
  <script>
    const routeTable = document.getElementById('route-table');
    const resultBox = document.getElementById('result-box');
    
    async function checkAllHealth() {
      const statusEls = document.querySelectorAll('.status-checking');
      let healthy = 0, unhealthy = 0;
      
      for (const el of statusEls) {
        const route = el.dataset.route;
        try {
          const res = await fetch(\`/api/proxy-health/\${route}\`);
          const data = await res.json();
          el.className = 'status ' + (data.status === 'healthy' ? 'status-healthy' : 'status-unhealthy');
          el.textContent = data.status === 'healthy' ? '● Healthy' : '● Unhealthy';
          if (data.status === 'healthy') healthy++; else unhealthy++;
        } catch (e) {
          el.className = 'status status-unhealthy';
          el.textContent = '● Error';
          unhealthy++;
        }
      }
      
      document.getElementById('healthy-count').textContent = healthy;
      document.getElementById('unhealthy-count').textContent = unhealthy;
    }
    
    async function testRoute(route) {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Testing...';
      
      try {
        const res = await fetch(\`/api/\${route}/health\`);
        const data = await res.json();
        resultBox.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        resultBox.textContent = 'Error: ' + e.message;
      }
      
      btn.disabled = false;
      btn.textContent = 'Test';
    }
    
    // Update uptime
    setInterval(async () => {
      try {
        const res = await fetch('/health');
        const data = await res.json();
        const hrs = Math.floor(data.uptime / 3600);
        const mins = Math.floor((data.uptime % 3600) / 60);
        const secs = Math.floor(data.uptime % 60);
        document.getElementById('uptime').textContent = \`\${hrs}h \${mins}m \${secs}s\`;
      } catch {}
    }, 1000);
    
    // Initial health check
    checkAllHealth();
    setInterval(checkAllHealth, 30000);
  </script>
</body>
</html>`;
  
  res.send(html);
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Omni Route server running on port \${PORT}\`);
  console.log('Configured routes:', Object.keys(routes));
});
