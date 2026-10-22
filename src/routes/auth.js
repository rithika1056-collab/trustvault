const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, status, ip_address, details)
      VALUES (?, 'USER_LOGIN', 'REFUSED', ?, ?)
    `).run(user ? user.id : null, ipAddress, `Failed login attempt for username: ${username}`);

    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  db.prepare(`
    INSERT INTO audit_logs (user_id, action, status, ip_address, details)
    VALUES (?, 'USER_LOGIN', 'SUCCESS', ?, ?)
  `).run(user.id, ipAddress, `User ${user.username} logged in successfully`);

  return res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
});

module.exports = router;