const { v4: uuidv4 } = require('uuid');

function loggerMiddleware(req, res, next) {
  req.id = uuidv4();
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] [${req.id}] ${req.method} ${req.originalUrl} - START`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${req.id}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });

  next();
}

function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] [${req.id || 'NO_ID'}] ERROR:`, err);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation Error', details: err.message });
  }
  // Check for Postgres errors
  if (err.code) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Conflict', details: 'Resource already exists' });
    }
  }
  res.status(500).json({ error: 'Internal Server Error' });
}

module.exports = {
  loggerMiddleware,
  errorHandler
};
