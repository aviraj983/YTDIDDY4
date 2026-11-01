const app = require('../server.js');

module.exports = (req, res) => {
  // Normalize req.url so Express routes (/api/info, /api/download, /api/health) always match
  if (req.url && !req.url.startsWith('/api') && (req.url.startsWith('/info') || req.url.startsWith('/download') || req.url.startsWith('/health'))) {
    req.url = '/api' + req.url;
  }
  return app(req, res);
};
