const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'omni-route',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Omni Route',
    description: 'Universal API Proxy/Routing Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      proxy: '/proxy/*',
      routes: '/api/routes'
    }
  });
});

// Dynamic proxy configuration from environment
const parseRoutes = () => {
  const routes = {};
  
  // Parse ROUTES env var: "path1=url1,path2=url2"
  if (process.env.ROUTES) {
    process.env.ROUTES.split(',').forEach(pair => {
      const [path, target] = pair.split('=');
      if (path && target) {
        routes[path.trim()] = target.trim();
      }
    });
  }
  
  // Default routes for common services
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
        // Forward authorization headers
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
      }
    }));
    console.log(`Proxy configured: ${path} -> ${target}`);
  }
});

// Routes API endpoint
app.get('/api/routes', (req, res) => {
  res.json({
    routes: Object.keys(routes).map(path => ({
      path,
      target: routes[path]
    }))
  });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not configured`,
    availableRoutes: Object.keys(routes)
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Omni Route server running on port ${PORT}`);
  console.log('Configured routes:', Object.keys(routes));
});