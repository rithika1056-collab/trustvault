# PROMPTS & AI Development Log

### Entry 1 (2026-10-22) - SQLite Windows Native Build Warning
- **Prompt:** "How to set up database and packages for the TrustVault project."
- **AI Suggested:** Installing `better-sqlite3` directly without verifying Windows build prerequisites.
- **Issue Discovered:** On Windows without C++ build tools, `better-sqlite3` showed native build script warnings (`node-gyp rebuild`).
- **Correction:** Ran a standalone test `node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); console.log('SQLite works cleanly!');"` to verify the prebuilt binary functioned properly before writing the schema.
- **Commit Reference:** `a5f0e82`

### Entry 2 (2026-10-22) - Authorization Check Placement (Security Core)
- **Prompt:** "Generate document download route with role check."
- **AI Suggested:** A simple role-based guard checking `if (user.role === 'viewer') return res.download(...)`.
- **Issue Discovered:** Checking only the role creates an Insecure Direct Object Reference (IDOR). A viewer could download another user's private documents simply by changing the ID in the request.
- **Correction:** Implemented explicit per-document authorization middleware (`checkDocumentAccess`) that validates document ownership and explicit grants in the `document_permissions` table on every request.
- **Commit Reference:** `6c0d6e5`

### Entry 3 (2026-10-22) - Immediate Revocation Without Token Caching
- **Prompt:** "How to store user permissions in the JWT session so we avoid frequent database queries."
- **AI Suggested:** Storing an array of granted document IDs directly inside the JWT payload.
- **Issue Discovered:** Storing access grants in the token prevents immediate revocation. If an owner revokes access, the user can still access the file until the token expires.
- **Correction:** Kept JWT tokens limited to identity verification only. Access permissions are queried directly against the database on every access attempt so revocations take effect immediately.
- **Commit Reference:** `6c0d6e5`

### Entry 4 (2026-10-22) - Logging Refused Access Attempts
- **Prompt:** "Add audit logging to the document controller."
- **AI Suggested:** Logging only successful `200 OK` document downloads and uploads.
- **Issue Discovered:** The challenge requires proving who attempted unauthorized access. Logging only successful events leaves no evidence of security violations.
- **Correction:** Added automatic `REFUSED` audit log insertions directly inside the authorization middleware whenever an unauthorized user is blocked with `403 Forbidden`.
- **Commit Reference:** `6c0d6e5`

### Entry 5 (2026-10-22) - File Upload Extension Validation
- **Prompt:** "Configure Multer storage for document uploads."
- **AI Suggested:** Basic storage accepting all files without filtering.
- **Issue Discovered:** Accepting raw uploads without extension filtering allows executable files (`.exe`, `.bat`, `.sh`, `.js`) to be uploaded, creating remote code execution risks.
- **Correction:** Added a strict file filter rejecting dangerous executable extensions and limited file sizes to 10MB.
- **Commit Reference:** `6c0d6e5`