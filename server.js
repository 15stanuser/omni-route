const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'omni-route', timestamp: new Date().toISOString() });
});

// Main dashboard - HTML UI
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Omni Route Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #1e293b; }
    h1 { font-size: 1.5rem; font-weight: 600; color: #f8fafc; }
    .version { background: #1e293b; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; transition: border-color 0.2s; }
    .card:hover { border-color: #3b82f6; }
    .card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; color: #f8fafc; }
    .card p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; }
    .endpoint { font-family: 'Monaco', 'Menlo', monospace; background: #0f172a; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: #22d3ee; }
    .status { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #334155; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
    .status-text { font-size: 0.875rem; color: #94a3b8; }
    .btn { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 0.875rem; cursor: pointer; text-decoration: none; }
    .btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Omni Route</h1>
        <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem;">Universal API Proxy / Routing Service</p>
      </div>
      <span class="version">v1.0.3</span>
    </header>
    <div class="grid">
      <div class="card">
        <h3>Health Check</h3>
        <p>Verify service status and uptime</p>
        <code class="endpoint">GET /health</code>
        <a href="/health" class="btn" target="_blank">Test Endpoint</a>
      </div>
      <div class="card">
        <h3>Proxy Routes</h3>
        <p>Dynamic proxy for external APIs with auth forwarding</p>
        <code class="endpoint">GET/POST /proxy/*</code>
        <a href="/proxy" class="btn">View Config</a>
      </div>
      <div class="card">
        <h3>Route Management</h3>
        <p>Configure and manage proxy routes</p>
        <code class="endpoint">GET/POST /api/routes</code>
        <a href="/api/routes" class="btn">Manage Routes</a>
      </div>
      <div class="card">
        <h3>API Documentation</h3>
        <p>OpenAPI/Swagger documentation</p>
        <code class="endpoint">GET /docs</code>
        <a href="/docs" class="btn">View Docs</a>
      </div>
    </div>
    <div class="status">
      <span class="status-dot"></span>
      <span class="status-text">Service Online - Deployed on Railway</span>
    </div>
  </div>
</body>
</html>`);
});

// Proxy endpoint
app.all('/proxy/*', (req, res) => {
  res.json({ message: 'Proxy endpoint - configure routes via /api/routes', path: req.path });
});

// Routes API
app.get('/api/routes', (req, res) => {
  res.json({ routes: [], message: 'No routes configured yet' });
});

app.post('/api/routes', (req, res) => {
  res.json({ success: true, route: req.body });
});

// Docs placeholder
app.get('/docs', (req, res) => {
  res.send('<h1>API Docs - Coming Soon</h1>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Omni Route v1.0.3 running on port ${PORT}`);
});
