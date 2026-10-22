const db = require('../database/db');

function checkDocumentAccess(requiredPermission = 'read') {
  return (req, res, next) => {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (userRole === 'admin' && requiredPermission === 'read') {
      req.document = doc;
      return next();
    }

    if (doc.owner_id === userId) {
      req.document = doc;
      return next();
    }

    const perm = db.prepare(
      'SELECT permission_level FROM document_permissions WHERE document_id = ? AND user_id = ?'
    ).get(documentId, userId);

    const hasAccess =
      perm &&
      (perm.permission_level === requiredPermission ||
        (requiredPermission === 'read' && perm.permission_level === 'edit'));

    if (hasAccess) {
      req.document = doc;
      return next();
    }

    // Security violation: log REFUSED status
    db.prepare(`
      INSERT INTO audit_logs (user_id, document_id, action, status, ip_address, details)
      VALUES (?, ?, ?, 'REFUSED', ?, ?)
    `).run(
      userId,
      documentId,
      `UNAUTHORIZED_${requiredPermission.toUpperCase()}_ATTEMPT`,
      ipAddress,
      `User ${req.user.username} (ID: ${userId}) attempted unauthorized ${requiredPermission} on document ${documentId}`
    );

    return res.status(403).json({
      error: 'Access denied: You do not have permission to access this document.'
    });
  };
}

module.exports = { checkDocumentAccess };