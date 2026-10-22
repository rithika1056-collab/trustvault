let currentUser = null;
let token = localStorage.getItem('tv_token') || null;

const authSection = document.getElementById('auth-section');
const dashboard = document.getElementById('dashboard');
const userInfo = document.getElementById('user-info');
const navUsername = document.getElementById('nav-username');
const navRole = document.getElementById('nav-role');
const documentsList = document.getElementById('documents-list');
const adminSection = document.getElementById('admin-section');
const auditLogsList = document.getElementById('audit-logs-list');

// Quick fill helper for testing
function quickFill(u, p) {
  document.getElementById('username').value = u;
  document.getElementById('password').value = p;
}

// 1. Authentication
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('auth-error');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Authentication failed';
      errorEl.classList.remove('hidden');
      return;
    }

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('tv_token', token);
    localStorage.setItem('tv_user', JSON.stringify(currentUser));
    renderDashboard();
  } catch (err) {
    errorEl.textContent = 'Server communication error.';
    errorEl.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('tv_token');
  localStorage.removeItem('tv_user');
  authSection.classList.remove('hidden');
  dashboard.classList.add('hidden');
  userInfo.classList.add('hidden');
});

// Render Dashboard View
function renderDashboard() {
  if (!currentUser) return;

  authSection.classList.add('hidden');
  dashboard.classList.remove('hidden');
  userInfo.classList.remove('hidden');

  navUsername.textContent = currentUser.username;
  navRole.textContent = currentUser.role;

  // Role permissions UI
  const uploadSection = document.getElementById('upload-section');
  if (currentUser.role === 'viewer') {
    uploadSection.classList.add('hidden');
  } else {
    uploadSection.classList.remove('hidden');
  }

  if (currentUser.role === 'admin') {
    adminSection.classList.remove('hidden');
    loadAuditLogs();
  } else {
    adminSection.classList.add('hidden');
  }

  loadDocuments();
}

// 2. Load Documents
async function loadDocuments() {
  const search = document.getElementById('search-input').value;
  const category = document.getElementById('category-filter').value;
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (category) params.append('category', category);

  try {
    const res = await fetch(`/api/documents?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    documentsList.innerHTML = '';

    if (!data.documents || data.documents.length === 0) {
      documentsList.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No documents found.</td></tr>`;
      return;
    }

    data.documents.forEach((doc) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${doc.title}</strong></td>
        <td>${doc.filename}</td>
        <td><span class="badge">${doc.category}</span></td>
        <td>${doc.owner_username}</td>
        <td>${doc.access_level || 'granted'}</td>
        <td>
          <button class="btn btn-secondary" onclick="downloadDoc(${doc.id})">Download</button>
          ${(currentUser.id === doc.owner_id || currentUser.role === 'admin') ? 
            `<button class="btn btn-secondary" onclick="openShareModal(${doc.id}, '${doc.title}')">Share</button>` : ''}
        </td>
      `;
      documentsList.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load documents:', err);
  }
}

// 3. Document Download Handler
async function downloadDoc(id) {
  try {
    const res = await fetch(`/api/documents/${id}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const errData = await res.json();
      alert(`Access Refused: ${errData.error}`);
      return;
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `document_${id}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert('Error connecting to download endpoint.');
  }
}

// 4. Document Upload Handler
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('doc-file');
  const title = document.getElementById('doc-title').value.trim();
  const category = document.getElementById('doc-category').value;
  const statusEl = document.getElementById('upload-status');

  if (!fileInput.files[0]) return;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('title', title);
  formData.append('category', category);

  try {
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();

    if (res.ok) {
      statusEl.textContent = 'Uploaded successfully!';
      statusEl.classList.remove('hidden');
      document.getElementById('upload-form').reset();
      loadDocuments();
    } else {
      statusEl.textContent = data.error || 'Upload failed.';
      statusEl.classList.remove('hidden');
    }
  } catch (err) {
    statusEl.textContent = 'Upload network error.';
  }
});

// 5. Admin Audit Trail
async function loadAuditLogs() {
  try {
    const res = await fetch('/api/admin/audit-logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    auditLogsList.innerHTML = '';

    if (!data.logs || data.logs.length === 0) {
      auditLogsList.innerHTML = `<tr><td colspan="6" style="text-align:center;">No audit records available.</td></tr>`;
      return;
    }

    data.logs.forEach((log) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(log.timestamp).toLocaleString()}</td>
        <td>${log.username || 'Anonymous'}</td>
        <td><code>${log.action}</code></td>
        <td class="status-${log.status}">${log.status}</td>
        <td>${log.ip_address || 'N/A'}</td>
        <td>${log.details || ''}</td>
      `;
      auditLogsList.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load audit logs:', err);
  }
}

document.getElementById('refresh-audit-btn').addEventListener('click', loadAuditLogs);
document.getElementById('search-input').addEventListener('input', loadDocuments);
document.getElementById('category-filter').addEventListener('change', loadDocuments);

// Modal helpers
function openShareModal(docId, docTitle) {
  document.getElementById('modal-doc-id').value = docId;
  document.getElementById('modal-doc-title').textContent = `Document: "${docTitle}"`;
  document.getElementById('share-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('share-modal').classList.add('hidden');
  document.getElementById('modal-status').classList.add('hidden');
}

document.getElementById('grant-perm-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const docId = document.getElementById('modal-doc-id').value;
  const targetUsername = document.getElementById('target-username').value.trim();
  const permissionLevel = document.getElementById('perm-level').value;
  const statusEl = document.getElementById('modal-status');

  try {
    const res = await fetch(`/api/documents/${docId}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ targetUsername, permissionLevel })
    });
    const data = await res.json();

    statusEl.textContent = res.ok ? 'Access granted!' : data.error;
    statusEl.classList.remove('hidden');
    if (res.ok) {
      setTimeout(closeModal, 1200);
      loadDocuments();
    }
  } catch (err) {
    statusEl.textContent = 'Error granting access.';
  }
});

// Auto login if session exists
const savedUser = localStorage.getItem('tv_user');
if (token && savedUser) {
  currentUser = JSON.parse(savedUser);
  renderDashboard();
}