const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { checkDocumentAccess } = require('../middleware/authorize');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.resolve(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + path.basename(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const forbiddenExts = ['.exe', '.bat', '.sh', '.js', '.vbs', '.msi'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (forbiddenExts.includes(ext)) {
    return cb(new Error('Executable file types are strictly rejected for security.'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
});

router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please provide a valid file to upload.' });
  }

  const { title, category } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  const result = db.prepare(`
    INSERT INTO documents (title, filename, filepath, filesize, mimetype, category, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title || req.file.originalname,
    req.file.filename,
    req.file.path,
    req.file.size,
    req.file.mimetype,
    category || 'General',
    req.user.id
  );

  const documentId = result.lastInsertRowid;

  db.prepare(`
    INSERT INTO audit_logs (user_id, document_id, action, status, ip_address, details)
    VALUES (?, ?, 'DOCUMENT_UPLOAD', 'SUCCESS', ?, ?)
  `).run(req.user.id, documentId, ipAddress, `Uploaded document: ${req.file.originalname}`);

  res.status(201).json({
    message: 'File uploaded successfully',
    documentId
  });
});

router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const { search, category } = req.query;

  let query = '';
  let params = [];

  if (role === 'admin') {
    query = `
      SELECT d.*, u.username as owner_username, 'admin' as access_level 
      FROM documents d 
      JOIN users u ON d.owner_id = u.id 
      WHERE 1=1
    `;
  } else {
    query = `
      SELECT DISTINCT d.*, u.username as owner_username,
        CASE 
          WHEN d.owner_id = ? THEN 'owner'
          ELSE p.permission_level 
        END as access_level
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN document_permissions p ON p.document_id = d.id AND p.user_id = ?
      WHERE (d.owner_id = ? OR p.user_id = ?)
    `;
    params.push(userId, userId, userId, userId);
  }

  if (search) {
    query += ` AND (d.title LIKE ? OR d.filename LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    query += ` AND d.category = ?`;
    params.push(category);
  }

  query += ` ORDER BY d.created_at DESC`;

  const docs = db.prepare(query).all(...params);
  res.json({ documents: docs });
});

router.get('/:id/download', authenticateToken, checkDocumentAccess('read'), (req, res) => {
  const doc = req.document;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!fs.existsSync(doc.filepath)) {
    return res.status(404).json({ error: 'Physical file not found on disk.' });
  }

  db.prepare(`
    INSERT INTO audit_logs (user_id, document_id, action, status, ip_address, details)
    VALUES (?, ?, 'DOCUMENT_DOWNLOAD', 'SUCCESS', ?, ?)
  `).run(req.user.id, doc.id, ipAddress, `User ${req.user.username} downloaded document ID ${doc.id}`);

  res.download(doc.filepath, doc.filename);
});

router.post('/:id/permissions', authenticateToken, (req, res) => {
  const documentId = req.params.id;
  const { targetUsername, permissionLevel } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  if (doc.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only document owners or admins can grant access.' });
  }

  const targetUser = db.prepare('SELECT id, username FROM users WHERE username = ?').get(targetUsername);
  if (!targetUser) {
    return res.status(404).json({ error: 'Target user does not exist.' });
  }

  db.prepare(`
    INSERT INTO document_permissions (document_id, user_id, permission_level)
    VALUES (?, ?, ?)
    ON CONFLICT(document_id, user_id) DO UPDATE SET permission_level = excluded.permission_level
  `).run(documentId, targetUser.id, permissionLevel);

  db.prepare(`
    INSERT INTO audit_logs (user_id, document_id, action, status, ip_address, details)
    VALUES (?, ?, 'PERMISSION_GRANT', 'SUCCESS', ?, ?)
  `).run(
    req.user.id,
    documentId,
    ipAddress,
    `Granted ${permissionLevel} access on doc ${documentId} to ${targetUser.username}`
  );

  res.json({ message: `Access granted to ${targetUser.username} successfully.` });
});

router.delete('/:id/permissions/:targetUserId', authenticateToken, (req, res) => {
  const { id: documentId, targetUserId } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  if (doc.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only document owners or admins can revoke access.' });
  }

  db.prepare(
    'DELETE FROM document_permissions WHERE document_id = ? AND user_id = ?'
  ).run(documentId, targetUserId);

  db.prepare(`
    INSERT INTO audit_logs (user_id, document_id, action, status, ip_address, details)
    VALUES (?, ?, 'PERMISSION_REVOKE', 'SUCCESS', ?, ?)
  `).run(
    req.user.id,
    documentId,
    ipAddress,
    `Revoked permissions on doc ${documentId} for user ID ${targetUserId}`
  );

  res.json({ message: 'Permissions revoked immediately.' });
});

module.exports = router;