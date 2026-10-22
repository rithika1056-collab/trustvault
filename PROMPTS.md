# PROMPTS Log 
# PROMPTS & AI Development Log

### Entry 1 (2026-10-22) - SQLite Windows Compilation & Native Modules
- **Prompt:** "How to set up database and packages for the TrustVault project."
- **AI Suggested:** Using standard npm installation for `better-sqlite3`.
- **Issue Discovered:** On Windows environments without C++ build tools, `better-sqlite3` threw native compilation warnings (`node-gyp rebuild`).
- **Correction:** Verified runtime bindings with an in-memory check (`node -e "..."`) to confirm prebuilt binaries functioned cleanly before progressing.

### Entry 2 (2026-10-22) - Authorization Check Placement (Security Core)
- **Prompt:** "Generate document download route with role check."
- **AI Suggested:** A route checking `if (user.role === 'viewer') return res.download(...)`.
- **Issue Discovered:** A role-based check alone causes an IDOR vulnerability, allowing viewers to download any document regardless of ownership or specific sharing permissions.
- **Correction:** Implemented explicit per-document authorization middleware (`checkDocumentAccess`) that checks the `document_permissions` table on every single request.

### Entry 3 (2026-10-22) - Immediate Revocation Without Caching
- **Prompt:** "How to store permissions in JWT token so we don't query the database every time."
- **AI Suggested:** Storing an array of granted `documentIds` inside the user's JWT payload.
- **Issue Discovered:** Storing access grants in JWT tokens breaks the mandatory requirement of immediate revocation. If access is revoked, the token remains valid until expiry.
- **Correction:** Discarded token-stored permissions. Tokens only verify user identity; authorization decisions are resolved against the database in real-time.

### Entry 4 (2026-10-22) - Capturing REFUSED Access Attempts in Audit Logs
- **Prompt:** "Add audit logging to document controller."
- **AI Suggested:** Logging only successful `200 OK` downloads and uploads.
- **Issue Discovered:** Problem statement requires proving who attempted unauthorized access. Successful-only logging leaves no evidence of attacks.
- **Correction:** Added automatic `REFUSED` log entries directly inside the authorization rejection branch before sending `403 Forbidden`.