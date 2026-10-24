# TrustVault - Secure Document Sharing 
# TrustVault — Secure Document Sharing with a Real Audit Trail

TrustVault is an enterprise document security platform engineered to guarantee that unauthorized parties can never access confidential documents, while maintaining a tamper-evident audit record of all access and rejected attempts.

## 🌐 Live Deployment
- **Live URL:** https://trustvault-app-6t0f.onrender.com

---

## 👥 Evaluator Test Credentials

| Role | Username | Password | Default Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin_user` | `Admin@123` | System oversight, full audit log access, view all documents |
| **Document Owner** | `owner_user` | `Owner@123` | Upload files, grant/revoke user-level permissions |
| **Viewer** | `viewer_user` | `Viewer@123` | Read & download files only when explicitly granted by owner |

---

## 🛡️ Core Security Architecture & Non-Negotiables

### 1. Server-Enforced Authorization
Document access is validated on every single request through the server-side `checkDocumentAccess` middleware. UI elements are hidden for clean UX, but the backend never trusts client-side state. Tampering with IDs directly via URL or API immediately yields `403 Forbidden`.

### 2. Immediate Revocation
Permissions are evaluated live against the database on every access attempt rather than cached inside JWT claims. When an owner revokes access, it terminates immediately on the very next HTTP request.

### 3. Auditing Refused Attempts
When an unauthorized user attempts to access a document, the request is terminated with a `403 Forbidden` response and an immutable entry is recorded in `audit_logs` with `status: REFUSED`, the actor's user ID, IP address, and timestamp.

---

## 🧪 Automated Security Tests

Run the full security test suite locally:
```bash
npm test



# 1. Clone repository
git clone [https://github.com/rithika1056-collab/trustvault.git](https://github.com/rithika1056-collab/trustvault.git)
cd trustvault

# 2. Install dependencies
npm install

# 3. Run database migrations & seed users
node src/database/db.js

# 4. Start local development server
npm start
# App runs at: http://localhost:3000



Method,Endpoint,Required Role / Access,Description
POST,/api/auth/login,Public,Authenticates credentials and returns JWT session
POST,/api/documents/upload,Owner / Admin,Secure file upload with executable format filtering
GET,/api/documents,Authenticated,Lists documents owned by or explicitly shared with user
GET,/api/documents/:id/download,Owner or Granted User,Downloads document; writes SUCCESS or REFUSED audit log
POST,/api/documents/:id/permissions,Owner / Admin,Grants explicit read or edit access to a user
DELETE,/api/documents/:id/permissions/:userId,Owner / Admin,Revokes document access immediately
GET,/api/admin/audit-logs,Admin,Fetches the compliance audit log (last 200 entries)


