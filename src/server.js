const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Added for security headers
const path = require('path');
require('dotenv').config();

const rateLimit = require('express-rate-limit');   // ← Added

const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/documents');
const db = require('./database/db');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 attempts
  message: { error: 'Too many login attempts. Please try again later.' }
});

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, '../public')));

// Apply rate limiter only to login route
app.use('/api/auth/login', loginLimiter);   // ← Added

app.use('/api/auth', authRoutes);
app.use('/api/documents', docRoutes);

app.get('/api/admin/audit-logs', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  const logs = db.prepare(`
    SELECT a.*, u.username, d.title as document_title
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN documents d ON a.document_id = d.id
    ORDER BY a.timestamp DESC
    LIMIT 200
  `).all();

  res.json({ logs });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'TrustVault API' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`TrustVault server is running securely on port ${PORT}`);
  });
}

module.exports = app;