require('dotenv').config({ path: '.env' });
const express = require('express');
const cors = require('cors');
const { loggerMiddleware, errorHandler } = require('./middlewares');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const referenceRoutes = require('./routes/reference');
const itemsRoutes = require('./routes/items');
const matchesRoutes = require('./routes/matches');
const claimsRoutes = require('./routes/claims');

const app = express();

app.use(cors());
app.use(express.json());
app.use(loggerMiddleware);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/reference', referenceRoutes);
app.use('/api/v1/items', itemsRoutes);
app.use('/api/v1/matches', matchesRoutes);
app.use('/api/v1/claims', claimsRoutes);
app.use('/api/v1', healthRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler MUST be last
app.use(errorHandler);

module.exports = app;
