# Threat Model and Security Considerations 
# Threat Model & Security Analysis - TrustVault

## 1. Threat: Insecure Direct Object References (IDOR) on Document Download
- **Scenario:** A malicious viewer intercepts or guesses a document ID (`/api/documents/1/download`) and tries to fetch confidential files belonging to someone else.
- **Mitigation:** Server-side authorization middleware (`checkDocumentAccess`) runs on every request. It queries the database directly to confirm ownership or an active grant. Hiding UI buttons is treated only as a UX convenience, never as security.
- **Status:** Closed and verified via automated test in `tests/security.test.js`.

## 2. Threat: Audit Log Tampering / Repudiation
- **Scenario:** An insider performs unauthorized actions and tries to alter or delete audit entries to cover their tracks.
- **Mitigation:** The application exposes no `UPDATE` or `DELETE` endpoints for the `audit_logs` table. Only server-side append operations (`INSERT`) are executed.
- **Refused Attempts Recorded:** Even rejected unauthorized attempts (`REFUSED`) are written to the audit trail with user identity, timestamp, and IP address.
- **Status:** Closed and verified via automated test.

## 3. Threat: Stale Permissions / Session Hijacking after Revocation
- **Scenario:** An owner revokes access from an employee, but the employee still retains temporary access due to cached tokens or stale permission lists.
- **Mitigation:** Permissions are checked live against the database on each download/access request. Revoking a permission in `document_permissions` takes effect immediately on the very next HTTP request.
- **Status:** Closed and verified via automated test.

## 4. Threat: Malicious File Uploads / Remote Code Execution
- **Scenario:** An attacker uploads a malicious script (`.exe`, `.sh`, `.js`, `.bat`, `.vbs`) disguised as a document.
- **Mitigation:** Multer storage uses an extension blacklist rejecting executable files, limits file size to 10MB, and renames files with random timestamps on disk to prevent directory traversal or file overwrites.
- **Status:** Closed.

## 5. Threat: Password Leaks & Credential Stuffing
- **Scenario:** Database exposure reveals raw user passwords.
- **Mitigation:** All passwords are salted and hashed with `bcryptjs` using 10 rounds before storage. Plain text passwords are never stored or logged.
- **Status:** Closed.

## 6. Accepted Risks / Trade-offs
- **In-Memory / Single Instance SQLite:** SQLite is used for zero-configuration testing and lightweight deployment. For multi-region enterprise scaling, a managed PostgreSQL cluster with read-replicas would replace local storage.
- **At-Rest File Encryption:** Files are currently protected via file system access controls and randomized file naming. Full AES-256 envelope encryption at rest is deferred to future enterprise hardening.