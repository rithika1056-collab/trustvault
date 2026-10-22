const request = require('supertest');
const app = require('../src/server');
const db = require('../src/database/db');

describe('TrustVault Strict Security & Authorisation Tests', () => {
  let ownerToken;
  let viewerToken;
  let documentId;
  let viewerUserId;

  beforeAll(async () => {
    // 1. Authenticate Owner
    const ownerRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner_user', password: 'Owner@123' });
    ownerToken = ownerRes.body.token;

    // 2. Authenticate Viewer
    const viewerRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'viewer_user', password: 'Viewer@123' });
    viewerToken = viewerRes.body.token;
    viewerUserId = viewerRes.body.user.id;

    // 3. Upload a sample confidential file as Owner
    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Confidential Salaries Q4')
      .field('category', 'Finance')
      .attach('file', Buffer.from('CONFIDENTIAL EMPLOYEE SALARY DATA'), 'salaries.txt');

    documentId = uploadRes.body.documentId;
  });

  test('SECURITY: Viewer CANNOT download owner document without permission (Expect 403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Access denied/i);
  });

  test('AUDIT TRAIL: Unauthorized download attempt must be recorded as REFUSED in the audit log', async () => {
    const refusedLog = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE document_id = ? AND status = 'REFUSED'
      ORDER BY timestamp DESC LIMIT 1
    `).get(documentId);

    expect(refusedLog).toBeDefined();
    expect(refusedLog.status).toBe('REFUSED');
    expect(refusedLog.user_id).toBe(viewerUserId);
  });

  test('PERMISSIONS: Owner can grant read access to Viewer, enabling download', async () => {
    const grantRes = await request(app)
      .post(`/api/documents/${documentId}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetUsername: 'viewer_user', permissionLevel: 'read' });

    expect(grantRes.statusCode).toBe(200);

    const downloadRes = await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(downloadRes.statusCode).toBe(200);
  });

  test('IMMEDIATE REVOCATION: Revoking permission denies access immediately', async () => {
    const revokeRes = await request(app)
      .delete(`/api/documents/${documentId}/permissions/${viewerUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(revokeRes.statusCode).toBe(200);

    // Download should immediately fail with 403 Forbidden
    const downloadRes = await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(downloadRes.statusCode).toBe(403);
  });
});