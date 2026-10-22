const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '../../trustvault.db');
const db = new Database(dbPath);

// Enforce foreign keys for data integrity
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'owner', 'viewer')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      filesize INTEGER NOT NULL,
      mimetype TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      owner_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      permission_level TEXT CHECK(permission_level IN ('read', 'edit')) NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(document_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      document_id INTEGER,
      action TEXT NOT NULL,
      status TEXT CHECK(status IN ('SUCCESS', 'REFUSED')) NOT NULL,
      ip_address TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
    );
  `);

  seedUsers();
}

function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminPass = bcrypt.hashSync('Admin@123', salt);
    const ownerPass = bcrypt.hashSync('Owner@123', salt);
    const viewerPass = bcrypt.hashSync('Viewer@123', salt);

    const insertUser = db.prepare(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
    );

    insertUser.run('admin_user', 'admin@trustvault.local', adminPass, 'admin');
    insertUser.run('owner_user', 'owner@trustvault.local', ownerPass, 'owner');
    insertUser.run('viewer_user', 'viewer@trustvault.local', viewerPass, 'viewer');
    
    console.log('Seed users created: admin_user, owner_user, viewer_user');
  }
}

initDb();

module.exports = db;