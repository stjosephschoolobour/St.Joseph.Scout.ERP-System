import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import bcrypt from 'bcryptjs';

const getDirname = () => {
  try {
    if (typeof __dirname !== 'undefined') return __dirname;
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch (e) {}
  return process.cwd();
};

const CURRENT_DIR = getDirname();

// Robust Project Root Detection
function findProjectRoot(): string {
  if (process.env.SCOUT_DATA_DIR) {
    return path.resolve(process.env.SCOUT_DATA_DIR);
  }
  const checkDirs = [
    process.cwd(),
    CURRENT_DIR,
    path.join(CURRENT_DIR, '..'),
    path.join(process.cwd(), '..'),
  ];
  for (const d of checkDirs) {
    try {
      if (fs.existsSync(path.join(d, 'package.json')) || fs.existsSync(path.join(d, 'scout.db'))) {
        return path.resolve(d);
      }
    } catch (e) {}
  }
  return path.resolve(process.cwd());
}

export const PROJECT_ROOT = findProjectRoot();

// Robust DB Path Resolution
function resolveDbPath(): string {
  if (process.env.SCOUT_DATA_DIR) {
    return path.resolve(path.join(process.env.SCOUT_DATA_DIR, 'scout.db'));
  }
  // Check if Electron AppData db exists
  const appData = process.env.APPDATA;
  if (appData) {
    const electronDb = path.join(appData, 'ScoutSystem', 'scout.db');
    if (fs.existsSync(electronDb)) {
      return path.resolve(electronDb);
    }
  }
  // Check candidate locations for existing scout.db
  const candidates = [
    path.join(PROJECT_ROOT, 'scout.db'),
    path.join(process.cwd(), 'scout.db'),
    path.join(CURRENT_DIR, 'scout.db'),
    path.join(CURRENT_DIR, '..', 'scout.db'),
    path.join(PROJECT_ROOT, 'dist', 'scout.db'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return path.resolve(c);
      }
    } catch (e) {}
  }
  return path.resolve(path.join(PROJECT_ROOT, 'scout.db'));
}

export const DB_PATH = resolveDbPath();
export const PHOTOS_DIR = path.resolve(path.join(path.dirname(DB_PATH), 'data', 'photos'));

// Ensure photos directory exists
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

// Ensure database is initialized
export async function getDb(): Promise<Database> {
  if (!db) {
    if (!SQL) {
      let wasmBinary: Buffer | undefined;
      const possibleWasmPaths = [
        path.join(CURRENT_DIR, 'sql-wasm.wasm'),
        path.join(CURRENT_DIR, 'dist', 'sql-wasm.wasm'),
        path.join(process.cwd(), 'dist', 'sql-wasm.wasm'),
        path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        path.join(CURRENT_DIR, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      ];

      for (const p of possibleWasmPaths) {
        try {
          if (fs.existsSync(p)) {
            wasmBinary = fs.readFileSync(p);
            break;
          }
        } catch (e) {}
      }

      SQL = await initSqlJs(
        wasmBinary
          ? { wasmBinary }
          : {
              locateFile: (filename) => {
                for (const p of possibleWasmPaths) {
                  if (fs.existsSync(p)) return p;
                }
                return filename;
              },
            }
      );
    }

    // Look for existing db file or backup
    let dbFileToLoad: string | null = null;
    const candidates = [
      DB_PATH,
      `${DB_PATH}.bak`,
      path.resolve(path.join(PROJECT_ROOT, 'scout.db')),
      path.resolve(path.join(process.cwd(), 'scout.db')),
      path.resolve(path.join(CURRENT_DIR, 'scout.db')),
      path.resolve(path.join(CURRENT_DIR, '..', 'scout.db')),
    ];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const stats = fs.statSync(p);
          if (stats.size > 0) {
            dbFileToLoad = p;
            break;
          }
        }
      } catch (e) {}
    }

    if (dbFileToLoad) {
      console.log(`[DB] Loading persistent database from: ${dbFileToLoad}`);
      const fileBuffer = fs.readFileSync(dbFileToLoad);
      db = new SQL.Database(fileBuffer);
      runMigrations(db);
      ensureUsersTableColumns(db);
      hydrateFromSnapshotIfBetter(db);
      saveDb();
    } else {
      console.warn(`[DB] No existing database found at ${DB_PATH}. Initializing new schema.`);
      db = new SQL.Database();
      initializeSchema(db);
      runMigrations(db);
      ensureUsersTableColumns(db);
      hydrateFromSnapshotIfBetter(db);
      saveDb();
    }
  }
  return db;
}

export const SNAPSHOT_FILE = path.resolve(path.join(PROJECT_ROOT, 'data', 'members_snapshot.json'));
export const BACKUP_EXCEL_FILE = path.resolve(path.join(PROJECT_ROOT, 'data', 'last_restored_backup.xlsx'));

// Internal query helpers for server/db.ts
export function dbQueryAll(database: Database, sql: string, params: any[] = []): any[] {
  try {
    const stmt = database.prepare(sql);
    stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (err) {
    return [];
  }
}

export function dbQueryOne(database: Database, sql: string, params: any[] = []): any | null {
  const rows = dbQueryAll(database, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Sync current members, tribes, settings, and counters to persistent JSON snapshot
export function syncSnapshotToDisk(database: Database): void {
  try {
    const dataDir = path.dirname(SNAPSHOT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const members = dbQueryAll(database, 'SELECT * FROM members ORDER BY id ASC');
    const tribes = dbQueryAll(database, 'SELECT * FROM tribes ORDER BY id ASC');
    const systemCounters = dbQueryAll(database, 'SELECT * FROM system_counters');
    const settings = dbQueryAll(database, 'SELECT * FROM settings');

    if (members.length > 0) {
      const snapshot = {
        updated_at: new Date().toISOString(),
        total_members: members.length,
        total_tribes: tribes.length,
        members,
        tribes,
        systemCounters,
        settings,
      };

      const tempSnapPath = `${SNAPSHOT_FILE}.tmp`;
      fs.writeFileSync(tempSnapPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      fs.renameSync(tempSnapPath, SNAPSHOT_FILE);
      console.log(`[DB] Persistent snapshot synced: ${members.length} members, ${tribes.length} tribes`);
    }
  } catch (err) {
    console.error('[DB] Error saving persistent snapshot to disk:', err);
  }
}

// Auto-hydrate members and tribes from persistent snapshot if current db has fewer members
export function hydrateFromSnapshotIfBetter(database: Database): boolean {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) {
      return false;
    }

    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
    const snapshot = JSON.parse(raw);
    if (!snapshot || !Array.isArray(snapshot.members) || snapshot.members.length === 0) {
      return false;
    }

    const currentMembersRes = dbQueryOne(database, 'SELECT COUNT(*) as count FROM members');
    const currentCount = currentMembersRes ? (currentMembersRes.count as number) : 0;

    // If snapshot contains more members than the active database (e.g. database reset to demo 6 or empty)
    if (snapshot.members.length > currentCount) {
      console.log(`[DB] Auto-hydrating ${snapshot.members.length} members from persistent snapshot (current db had ${currentCount})...`);

      database.run('BEGIN TRANSACTION;');
      database.run('PRAGMA foreign_keys = OFF;');
      database.run('DELETE FROM activity_participants;');
      database.run('DELETE FROM members;');
      database.run('DELETE FROM tribes;');
      database.run('PRAGMA foreign_keys = ON;');

      // 1. Re-insert tribes
      if (Array.isArray(snapshot.tribes)) {
        for (const t of snapshot.tribes) {
          const tStmt = database.prepare(`
            INSERT OR REPLACE INTO tribes (id, code, name, leader_id, deputy_id, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          tStmt.run([
            t.id,
            t.code,
            t.name,
            t.leader_id || null,
            t.deputy_id || null,
            t.description || null,
            t.created_at || new Date().toISOString(),
            t.updated_at || new Date().toISOString(),
          ]);
          tStmt.free();
        }
      }

      // 2. Re-insert members
      for (const m of snapshot.members) {
        const mStmt = database.prepare(`
          INSERT OR REPLACE INTO members (
            id, member_code, student_name, student_name_en, guardian_name, national_id,
            birth_date, school_stage, scout_join_year, medical_condition, father_phone,
            mother_phone, leader_phone, mother_email, leader_email, father_job, mother_name,
            mother_job, address, talents_skills, member_type, tribe_id, photo_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        mStmt.run([
          m.id,
          m.member_code,
          m.student_name,
          m.student_name_en || null,
          m.guardian_name,
          m.national_id,
          m.birth_date,
          m.school_stage,
          m.scout_join_year,
          m.medical_condition || null,
          m.father_phone || null,
          m.mother_phone || null,
          m.leader_phone || null,
          m.mother_email || null,
          m.leader_email || null,
          m.father_job || null,
          m.mother_name || null,
          m.mother_job || null,
          m.address || null,
          m.talents_skills || null,
          m.member_type,
          m.tribe_id || null,
          m.photo_path || null,
          m.created_at || new Date().toISOString(),
          m.updated_at || new Date().toISOString(),
        ]);
        mStmt.free();
      }

      // 3. Re-insert system counters
      if (Array.isArray(snapshot.systemCounters)) {
        for (const c of snapshot.systemCounters) {
          const scStmt = database.prepare('INSERT OR REPLACE INTO system_counters (key, value) VALUES (?, ?)');
          scStmt.run([c.key, c.value]);
          scStmt.free();
        }
      }

      database.run('COMMIT;');
      console.log(`[DB] Successfully re-hydrated ${snapshot.members.length} members from persistent snapshot!`);
      return true;
    }
  } catch (err) {
    try { database.run('ROLLBACK;'); } catch (e) {}
    console.error('[DB] Failed to hydrate from persistent snapshot:', err);
  }
  return false;
}

// Persist the in-memory SQLite database to scout.db with fsync and cross-location sync
export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);

    // Ensure directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Atomic & durable write using fsync to ensure Windows writes to physical disk
    const tempPath = `${DB_PATH}.tmp`;
    const fd = fs.openSync(tempPath, 'w');
    fs.writeSync(fd, buffer, 0, buffer.length);
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    // Keep a backup of the existing database before replacing
    try {
      if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, `${DB_PATH}.bak`);
      }
    } catch (bakErr) {}

    fs.renameSync(tempPath, DB_PATH);

    // Sync to secondary locations if distinct, so launch from any path finds latest data
    const secondaryPaths = [
      path.resolve(path.join(PROJECT_ROOT, 'scout.db')),
      path.resolve(path.join(process.cwd(), 'scout.db')),
    ];
    for (const secPath of secondaryPaths) {
      if (secPath !== DB_PATH) {
        try {
          fs.writeFileSync(secPath, buffer);
        } catch (e) {}
      }
    }

    // Also synchronize persistent JSON snapshot
    syncSnapshotToDisk(db);
  } catch (err) {
    console.error('[DB] Critical error saving database to disk:', err);
  }
}

// Reload database from disk safely without destroying memory state if file missing
export function reloadDbFromDisk(): Database {
  if (!SQL) throw new Error('SQL.js is not initialized');
  let targetPath = DB_PATH;
  if (!fs.existsSync(targetPath)) {
    if (fs.existsSync(`${DB_PATH}.bak`)) targetPath = `${DB_PATH}.bak`;
    else if (fs.existsSync(path.join(PROJECT_ROOT, 'scout.db'))) targetPath = path.join(PROJECT_ROOT, 'scout.db');
  }

  if (fs.existsSync(targetPath)) {
    console.log(`[DB] Reloading database from: ${targetPath}`);
    const fileBuffer = fs.readFileSync(targetPath);
    db = new SQL.Database(fileBuffer);
    runMigrations(db);
    saveDb();
  } else {
    console.warn(`[DB] Cannot reload: ${targetPath} does not exist. Retaining current in-memory DB.`);
  }
  return db!;
}

// Ensure all expected columns exist in users table
export function ensureUsersTableColumns(database: Database): void {
  try {
    const userColumnsStmt = database.prepare("PRAGMA table_info(users)");
    const userCols: string[] = [];
    while (userColumnsStmt.step()) {
      const col = userColumnsStmt.getAsObject();
      if (col && typeof col.name === 'string') {
        userCols.push(col.name);
      }
    }
    userColumnsStmt.free();

    if (!userCols.includes('full_name')) {
      try { database.run("ALTER TABLE users ADD COLUMN full_name TEXT;"); } catch (e) {}
    }
    if (!userCols.includes('member_id')) {
      try { database.run("ALTER TABLE users ADD COLUMN member_id INTEGER;"); } catch (e) {}
    }
    if (!userCols.includes('tribe_id')) {
      try { database.run("ALTER TABLE users ADD COLUMN tribe_id INTEGER;"); } catch (e) {}
    }
    if (!userCols.includes('phone')) {
      try { database.run("ALTER TABLE users ADD COLUMN phone TEXT;"); } catch (e) {}
    }
    if (!userCols.includes('is_active')) {
      try { database.run("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;"); } catch (e) {}
    }
    if (!userCols.includes('email')) {
      try { database.run("ALTER TABLE users ADD COLUMN email TEXT;"); } catch (e) {}
    }
    if (!userCols.includes('address')) {
      try { database.run("ALTER TABLE users ADD COLUMN address TEXT;"); } catch (e) {}
    }
    if (!userCols.includes('photo_path')) {
      try { database.run("ALTER TABLE users ADD COLUMN photo_path TEXT;"); } catch (e) {}
    }
    if (!userCols.includes('theme_preference')) {
      try { database.run("ALTER TABLE users ADD COLUMN theme_preference TEXT DEFAULT 'light';"); } catch (e) {}
    }
  } catch (err) {
    console.error('[DB] Error ensuring users table columns:', err);
  }
}

function initializeSchema(database: Database): void {
  database.run('PRAGMA foreign_keys = ON;');

  // Users table
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'DATA_ENTRY', 'LEADER')),
      full_name TEXT,
      member_id INTEGER,
      tribe_id INTEGER,
      phone TEXT,
      email TEXT,
      address TEXT,
      photo_path TEXT,
      theme_preference TEXT DEFAULT 'light',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // User Profile Change Requests table (Pending Admin approval)
  database.run(`
    CREATE TABLE IF NOT EXISTS user_profile_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      requested_photo_path TEXT,
      requested_address TEXT,
      requested_phone TEXT,
      requested_email TEXT,
      requested_password_hash TEXT,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      admin_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Tribes table
  database.run(`
    CREATE TABLE IF NOT EXISTS tribes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT UNIQUE NOT NULL,
      leader_id INTEGER,
      deputy_id INTEGER,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // System Counters table (to ensure permanent sequence for Member Code)
  database.run(`
    CREATE TABLE IF NOT EXISTS system_counters (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
  `);

  // Members table
  database.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_code TEXT UNIQUE,
      student_name TEXT NOT NULL,
      student_name_en TEXT,
      guardian_name TEXT,
      national_id TEXT UNIQUE NOT NULL,
      birth_date TEXT NOT NULL,
      school_stage TEXT NOT NULL,
      scout_join_year INTEGER NOT NULL,
      medical_condition TEXT,
      father_phone TEXT,
      mother_phone TEXT,
      leader_phone TEXT,
      mother_email TEXT,
      leader_email TEXT,
      father_job TEXT,
      mother_name TEXT,
      mother_job TEXT,
      address TEXT,
      talents_skills TEXT,
      member_type TEXT NOT NULL CHECK(member_type IN ('عضوة', 'قائد')),
      tribe_id INTEGER,
      photo_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Audit Log table (without rigid action CHECK so all new audit actions are accommodated)
  database.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      user TEXT NOT NULL,
      action TEXT NOT NULL,
      member_id INTEGER,
      member_name TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Activities & Camps table
  database.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'معسكر',
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      address TEXT,
      start_date TEXT,
      end_date TEXT,
      fee REAL NOT NULL DEFAULT 0,
      leader_name TEXT,
      deputy_name TEXT,
      max_participants INTEGER DEFAULT 0,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'مفتوح',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Activity Participants table
  database.run(`
    CREATE TABLE IF NOT EXISTS activity_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'مدفوع',
      paid_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      registered_at TEXT NOT NULL,
      UNIQUE(activity_id, member_id)
    );
  `);

  // Tribe Meetings table
  database.run(`
    CREATE TABLE IF NOT EXISTS tribe_meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tribe_id INTEGER NOT NULL,
      meeting_date TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (tribe_id) REFERENCES tribes(id) ON DELETE CASCADE
    );
  `);

  // Tribe Attendance table
  database.run(`
    CREATE TABLE IF NOT EXISTS tribe_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      tribe_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PRESENT',
      notes TEXT,
      recorded_at TEXT NOT NULL,
      UNIQUE(meeting_id, member_id),
      FOREIGN KEY (meeting_id) REFERENCES tribe_meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
  `);

  // Annual Subscription Fees table (Unified per year across all members and leaders: regular and with uniform)
  database.run(`
    CREATE TABLE IF NOT EXISTS annual_subscription_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER UNIQUE NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      amount_with_uniform REAL NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Annual Subscription Payments table (Per member per year)
  database.run(`
    CREATE TABLE IF NOT EXISTS annual_subscription_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'مسدد',
      subscription_type TEXT NOT NULL DEFAULT 'اشتراك سنوي',
      paid_amount REAL NOT NULL DEFAULT 0,
      payment_date TEXT,
      receipt_number TEXT,
      notes TEXT,
      recorded_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(year, member_id),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
  `);

  // Store Items table (قسم المتجر والأصناف)
  database.run(`
    CREATE TABLE IF NOT EXISTS store_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      sizes TEXT,
      price REAL NOT NULL DEFAULT 0,
      image_url TEXT,
      category TEXT DEFAULT 'مهمات الكشافة',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Settings table
  database.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Member & Leader Wallets table (محفظة العضو / القائد)
  database.run(`
    CREATE TABLE IF NOT EXISTS member_wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER UNIQUE NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
  `);

  // Wallet Transactions Ledger table (سجل حركات المحفظة)
  database.run(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('DEPOSIT', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'WITHDRAW')),
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      category TEXT NOT NULL,
      reference_id TEXT,
      reference_title TEXT,
      description TEXT,
      receipt_number TEXT,
      recorded_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );
  `);

  // Initial settings
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear().toString();

  database.run(`
    INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('school_name', 'مدرسة القديس يوسف بالعبور'),
    ('system_name', 'نظام إدارة الكشافة'),
    ('current_year', '${currentYear}'),
    ('scout_group_name', 'مجموعة مدرسة القديس يوسف الكشفية'),
    ('scout_group_name_en', 'ST. JOSEPH\'S SCHOOL SCOUT GROUP'),
    ('group_slogan', 'كن مستعداً'),
    ('scout_logo_url', '');
  `);

  database.run(`
    INSERT OR IGNORE INTO system_counters (key, value) VALUES ('member_seq', 0);
  `);

  // Seed default admin user: "admin" / "jan123"
  const defaultSalt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('jan123', defaultSalt);

  database.run(`
    INSERT OR IGNORE INTO users (username, password_hash, role, is_active, created_at, updated_at)
    VALUES ('admin', '${adminHash}', 'ADMIN', 1, '${now}', '${now}');
  `);
}

function runMigrations(database: Database): void {
  const now = new Date().toISOString();

  // Ensure default admin user exists or update default password if still on initial
  const defaultSalt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('jan123', defaultSalt);

  try {
    const adminUserStmt = database.prepare("SELECT id, password_hash FROM users WHERE username = 'admin'");
    if (adminUserStmt.step()) {
      const adminData = adminUserStmt.getAsObject();
      const currentHash = adminData.password_hash as string;
      // If admin was on old default password "admin123", migrate to "jan123"
      if (bcrypt.compareSync('admin123', currentHash)) {
        const updateAdminStmt = database.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE username = 'admin'");
        updateAdminStmt.run([adminHash, now]);
        updateAdminStmt.free();
      }
    } else {
      database.run(`
        INSERT INTO users (username, password_hash, role, is_active, created_at, updated_at)
        VALUES ('admin', '${adminHash}', 'ADMIN', 1, '${now}', '${now}');
      `);
    }
    adminUserStmt.free();
  } catch (e) {
    console.log('Admin migration note:', e);
  }
  // 1. Ensure tribes table exists
  database.run(`
    CREATE TABLE IF NOT EXISTS tribes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT UNIQUE NOT NULL,
      leader_id INTEGER,
      deputy_id INTEGER,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Ensure system_counters exists
  database.run(`
    CREATE TABLE IF NOT EXISTS system_counters (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
  `);
  database.run(`
    INSERT OR IGNORE INTO system_counters (key, value) VALUES ('member_seq', 0);
  `);

  // 3. Inspect members table columns
  const tableInfoStmt = database.prepare("PRAGMA table_info(members)");
  const columns: string[] = [];
  while (tableInfoStmt.step()) {
    const col = tableInfoStmt.getAsObject();
    if (col && typeof col.name === 'string') {
      columns.push(col.name);
    }
  }
  tableInfoStmt.free();

  if (!columns.includes('member_code')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN member_code TEXT;");
    } catch (e) {
      console.log('Migration note: member_code column check', e);
    }
  }

  if (!columns.includes('tribe_id')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN tribe_id INTEGER;");
    } catch (e) {
      console.log('Migration note: tribe_id column check', e);
    }
  }

  if (!columns.includes('photo_path')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN photo_path TEXT;");
    } catch (e) {
      console.log('Migration note: photo_path column check', e);
    }
  }

  if (!columns.includes('student_name_en')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN student_name_en TEXT;");
    } catch (e) {
      console.log('Migration note: student_name_en column check', e);
    }
  }

  if (!columns.includes('father_job')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN father_job TEXT;");
    } catch (e) {
      console.log('Migration note: father_job column check', e);
    }
  }

  if (!columns.includes('mother_name')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN mother_name TEXT;");
    } catch (e) {
      console.log('Migration note: mother_name column check', e);
    }
  }

  if (!columns.includes('mother_job')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN mother_job TEXT;");
    } catch (e) {
      console.log('Migration note: mother_job column check', e);
    }
  }

  if (!columns.includes('address')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN address TEXT;");
    } catch (e) {
      console.log('Migration note: address column check', e);
    }
  }

  if (!columns.includes('talents_skills')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN talents_skills TEXT;");
    } catch (e) {
      console.log('Migration note: talents_skills column check', e);
    }
  }

  if (!columns.includes('mother_email')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN mother_email TEXT;");
    } catch (e) {
      console.log('Migration note: mother_email column check', e);
    }
  }

  if (!columns.includes('leader_email')) {
    try {
      database.run("ALTER TABLE members ADD COLUMN leader_email TEXT;");
    } catch (e) {
      console.log('Migration note: leader_email column check', e);
    }
  }

  // 3.b Check if members table needs migration for school grades (remove restrictive CHECK constraint)
  try {
    const tableInfoStmt = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='members'");
    let tableSql = '';
    if (tableInfoStmt.step()) {
      tableSql = String(tableInfoStmt.getAsObject().sql || '');
    }
    tableInfoStmt.free();

    if (tableSql && tableSql.includes("CHECK(school_stage IN")) {
      console.log('Migrating members table to support school grades...');
      database.run("PRAGMA foreign_keys = OFF;");
      database.run("BEGIN TRANSACTION;");
      database.run(`
        CREATE TABLE members_migrated_grades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member_code TEXT UNIQUE,
          student_name TEXT NOT NULL,
          student_name_en TEXT,
          guardian_name TEXT,
          national_id TEXT UNIQUE NOT NULL,
          birth_date TEXT NOT NULL,
          school_stage TEXT NOT NULL,
          scout_join_year INTEGER NOT NULL,
          medical_condition TEXT,
          father_phone TEXT,
          mother_phone TEXT,
          leader_phone TEXT,
          mother_email TEXT,
          leader_email TEXT,
          father_job TEXT,
          mother_name TEXT,
          mother_job TEXT,
          address TEXT,
          talents_skills TEXT,
          member_type TEXT NOT NULL CHECK(member_type IN ('عضوة', 'قائد')),
          tribe_id INTEGER,
          photo_path TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      database.run(`
        INSERT INTO members_migrated_grades (
          id, member_code, student_name, student_name_en, guardian_name, national_id, birth_date,
          school_stage, scout_join_year, medical_condition, father_phone, mother_phone, leader_phone,
          mother_email, leader_email, father_job, mother_name, mother_job, address, talents_skills,
          member_type, tribe_id, photo_path, created_at, updated_at
        )
        SELECT 
          id, member_code, student_name, student_name_en, guardian_name, national_id, birth_date,
          CASE
            WHEN school_stage = 'ابتدائي' THEN 'الصف الأول الابتدائي'
            WHEN school_stage = 'إعدادي' THEN 'الصف الأول الإعدادي'
            WHEN school_stage = 'ثانوي' THEN 'الصف الأول الثانوي'
            WHEN school_stage = 'جامعة' THEN 'أخرى'
            WHEN school_stage = 'تمهيدي' THEN 'الصف الأول الابتدائي'
            ELSE school_stage
          END,
          scout_join_year, medical_condition, father_phone, mother_phone, leader_phone,
          mother_email, leader_email, father_job, mother_name, mother_job, address, talents_skills,
          member_type, tribe_id, photo_path, created_at, updated_at
        FROM members;
      `);
      database.run("DROP TABLE members;");
      database.run("ALTER TABLE members_migrated_grades RENAME TO members;");
      database.run("COMMIT;");
      database.run("PRAGMA foreign_keys = ON;");
      console.log('Members table successfully migrated to school grades!');
    }
  } catch (err) {
    console.error('Migration note: school_stage schema migration', err);
  }

  try {
    database.run(`
      UPDATE members SET school_stage = 'الصف الأول الابتدائي' WHERE school_stage = 'ابتدائي';
      UPDATE members SET school_stage = 'الصف الأول الإعدادي' WHERE school_stage = 'إعدادي';
      UPDATE members SET school_stage = 'الصف الأول الثانوي' WHERE school_stage = 'ثانوي';
      UPDATE members SET school_stage = 'أخرى' WHERE school_stage = 'جامعة' OR school_stage = 'تمهيدي';
    `);
  } catch (e) {}

  // 4. Migrate member codes to A25xxxx format (e.g. sc000151 -> A250151)
  const allMembersStmt = database.prepare("SELECT id, member_code FROM members ORDER BY id ASC");
  const membersToMigrate: { id: number; currentCode: string }[] = [];
  while (allMembersStmt.step()) {
    const row = allMembersStmt.getAsObject();
    const id = row.id as number;
    const currentCode = String(row.member_code || '').trim();
    membersToMigrate.push({ id, currentCode });
  }
  allMembersStmt.free();

  let maxSeq = 0;
  const assignedCodes = new Set<string>();

  // Pass 1: Identify existing valid A25xxxx codes
  for (const m of membersToMigrate) {
    const matchA25 = m.currentCode.match(/^A250*(\d+)$/i);
    if (matchA25) {
      const num = parseInt(matchA25[1], 10);
      if (num > maxSeq && num < 250000) maxSeq = num;
      assignedCodes.add(m.currentCode.toUpperCase());
    }
  }

  // Pass 2: Migrate sc00xxxx or unassigned/non-A25 codes to A25xxxx
  for (const m of membersToMigrate) {
    if (/^A25\d{4,}$/i.test(m.currentCode)) {
      continue; // already in A25xxxx format
    }

    let targetSeq: number | null = null;
    const matchSc = m.currentCode.match(/^sc0*(\d+)$/i);
    const matchOldA = m.currentCode.match(/^A0*(\d+)$/i);
    const matchSct = m.currentCode.match(/^SCT-?0*(\d+)$/i);

    if (matchSc) {
      targetSeq = parseInt(matchSc[1], 10);
    } else if (matchOldA) {
      targetSeq = parseInt(matchOldA[1], 10);
    } else if (matchSct) {
      targetSeq = parseInt(matchSct[1], 10);
    }

    let newCode = '';
    if (targetSeq !== null && targetSeq >= 1) {
      newCode = formatMemberCode(targetSeq);
      if (targetSeq > maxSeq) maxSeq = targetSeq;
    }

    // If newCode is empty or already assigned, generate next sequential code
    if (!newCode || assignedCodes.has(newCode.toUpperCase())) {
      do {
        maxSeq++;
        newCode = formatMemberCode(maxSeq);
      } while (assignedCodes.has(newCode.toUpperCase()));
    }

    assignedCodes.add(newCode.toUpperCase());
    const updateStmt = database.prepare("UPDATE members SET member_code = ? WHERE id = ?");
    updateStmt.run([newCode, m.id]);
    updateStmt.free();
  }

  // If no members at all, keep maxSeq = 0
  if (membersToMigrate.length === 0) {
    maxSeq = 0;
  }

  // Update system counter
  const updateCounterStmt = database.prepare("UPDATE system_counters SET value = ? WHERE key = 'member_seq'");
  updateCounterStmt.run([maxSeq]);
  updateCounterStmt.free();

  // 5. Audit log table migration if needed (ensure no check constraint blocking new actions)
  // Check audit_log sql definition
  const auditDefStmt = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='audit_log'");
  let auditSql = '';
  if (auditDefStmt.step()) {
    auditSql = (auditDefStmt.getAsObject().sql as string) || '';
  }
  auditDefStmt.free();

  if (auditSql.includes('CHECK(action IN')) {
    // Recreate audit_log without the restrictive CHECK constraint
    try {
      database.run(`
        CREATE TABLE IF NOT EXISTS audit_log_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          user TEXT NOT NULL,
          action TEXT NOT NULL,
          member_id INTEGER,
          member_name TEXT,
          details TEXT,
          created_at TEXT NOT NULL
        );
        INSERT INTO audit_log_new (id, date, time, user, action, member_id, member_name, details, created_at)
        SELECT id, date, time, user, action, member_id, member_name, details, created_at FROM audit_log;
        DROP TABLE audit_log;
        ALTER TABLE audit_log_new RENAME TO audit_log;
      `);
    } catch (err) {
      console.error('Audit table migration error:', err);
    }
  }

  // 6. Ensure activities & activity_participants tables exist
  database.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'معسكر',
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      address TEXT,
      start_date TEXT,
      end_date TEXT,
      fee REAL NOT NULL DEFAULT 0,
      leader_name TEXT,
      deputy_name TEXT,
      max_participants INTEGER DEFAULT 0,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'مفتوح',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS activity_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'مدفوع',
      paid_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      registered_at TEXT NOT NULL,
      UNIQUE(activity_id, member_id)
    );
  `);

  // 7. Ensure tribe_meetings & tribe_attendance tables exist
  database.run(`
    CREATE TABLE IF NOT EXISTS tribe_meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tribe_id INTEGER NOT NULL,
      meeting_date TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS tribe_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      tribe_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PRESENT',
      notes TEXT,
      recorded_at TEXT NOT NULL,
      UNIQUE(meeting_id, member_id)
    );
  `);

  // 8. Ensure users table supports LEADER role and all columns
  try {
    ensureUsersTableColumns(database);

    // Ensure members table has leader_phone
    const memberColsStmt = database.prepare("PRAGMA table_info(members);");
    const memberCols: string[] = [];
    while (memberColsStmt.step()) {
      const col = memberColsStmt.getAsObject();
      if (col && typeof col.name === 'string') {
        memberCols.push(col.name);
      }
    }
    memberColsStmt.free();

    if (!memberCols.includes('leader_phone')) {
      try { database.run("ALTER TABLE members ADD COLUMN leader_phone TEXT;"); } catch (e) {}
    }

    // Check if inserting 'LEADER' fails due to old CHECK constraint
    let needsUsersTableRecreate = false;
    try {
      database.run("BEGIN TRANSACTION;");
      database.run("INSERT INTO users (username, password_hash, role, is_active, created_at, updated_at) VALUES ('__chk_leader__', 'x', 'LEADER', 0, '2026', '2026');");
      database.run("DELETE FROM users WHERE username = '__chk_leader__';");
      database.run("COMMIT;");
    } catch (checkErr) {
      try { database.run("ROLLBACK;"); } catch (rbErr) {}
      needsUsersTableRecreate = true;
    }

    if (needsUsersTableRecreate) {
      console.log('Migrating users table schema to allow LEADER role...');
      database.run("BEGIN TRANSACTION;");
      database.run(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('ADMIN', 'DATA_ENTRY', 'LEADER')),
          full_name TEXT,
          member_id INTEGER,
          tribe_id INTEGER,
          phone TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const oldColsStmt = database.prepare("PRAGMA table_info(users)");
      const oldCols: string[] = [];
      while (oldColsStmt.step()) {
        const col = oldColsStmt.getAsObject();
        if (col && typeof col.name === 'string') oldCols.push(col.name);
      }
      oldColsStmt.free();

      const hasMemberId = oldCols.includes('member_id');
      const hasTribeId = oldCols.includes('tribe_id');
      const hasPhone = oldCols.includes('phone');
      const hasFullName = oldCols.includes('full_name');
      const hasIsActive = oldCols.includes('is_active');

      database.run(`
        INSERT INTO users_new (id, username, password_hash, role, full_name, member_id, tribe_id, phone, is_active, created_at, updated_at)
        SELECT 
          id, 
          username, 
          password_hash, 
          role, 
          ${hasFullName ? 'full_name' : 'NULL'}, 
          ${hasMemberId ? 'member_id' : 'NULL'}, 
          ${hasTribeId ? 'tribe_id' : 'NULL'}, 
          ${hasPhone ? 'phone' : 'NULL'}, 
          ${hasIsActive ? 'is_active' : '1'}, 
          created_at, 
          updated_at 
        FROM users;
      `);
      database.run("DROP TABLE users;");
      database.run("ALTER TABLE users_new RENAME TO users;");
      database.run("COMMIT;");
      console.log('Users table migration for LEADER role completed.');
    }

    // Always re-ensure columns after any migration
    ensureUsersTableColumns(database);
  } catch (err) {
    console.log('Users migration note:', err);
  }

  // 9. Ensure annual subscription tables exist and seed default fee
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS annual_subscription_fees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER UNIQUE NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        amount_with_uniform REAL NOT NULL DEFAULT 0,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    database.run(`
      CREATE TABLE IF NOT EXISTS annual_subscription_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'مسدد',
        subscription_type TEXT NOT NULL DEFAULT 'اشتراك سنوي',
        paid_amount REAL NOT NULL DEFAULT 0,
        payment_date TEXT,
        receipt_number TEXT,
        notes TEXT,
        recorded_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(year, member_id),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
    `);

    // Migration: add amount_with_uniform to annual_subscription_fees if missing
    try {
      const feeColsStmt = database.prepare("PRAGMA table_info(annual_subscription_fees)");
      const feeCols: string[] = [];
      while (feeColsStmt.step()) {
        const col = feeColsStmt.getAsObject();
        if (col && typeof col.name === 'string') feeCols.push(col.name);
      }
      feeColsStmt.free();

      if (!feeCols.includes('amount_with_uniform')) {
        database.run("ALTER TABLE annual_subscription_fees ADD COLUMN amount_with_uniform REAL NOT NULL DEFAULT 0;");
      }
    } catch (e) {
      console.log('amount_with_uniform migration note:', e);
    }

    // Migration: add subscription_type to annual_subscription_payments if missing
    try {
      const payColsStmt = database.prepare("PRAGMA table_info(annual_subscription_payments)");
      const payCols: string[] = [];
      while (payColsStmt.step()) {
        const col = payColsStmt.getAsObject();
        if (col && typeof col.name === 'string') payCols.push(col.name);
      }
      payColsStmt.free();

      if (!payCols.includes('subscription_type')) {
        database.run("ALTER TABLE annual_subscription_payments ADD COLUMN subscription_type TEXT NOT NULL DEFAULT 'اشتراك سنوي';");
      }
    } catch (e) {
      console.log('subscription_type migration note:', e);
    }

    // Seed default fee for 2026 if not exists
    database.run(`
      INSERT OR IGNORE INTO annual_subscription_fees (year, amount, amount_with_uniform, description, created_at, updated_at)
      VALUES (2026, 200, 350, 'الاشتراك السنوي الموحد لعام 2026 (عادي 200 ج.م / بالزي 350 ج.م)', '${now}', '${now}');
    `);

    // Ensure 2026 has a default amount_with_uniform if it was previously 0
    database.run(`
      UPDATE annual_subscription_fees 
      SET amount_with_uniform = 350 
      WHERE year = 2026 AND (amount_with_uniform IS NULL OR amount_with_uniform = 0);
    `);
  } catch (subErr) {
    console.log('Subscription migration note:', subErr);
  }

  // 10. Ensure store_items table exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS store_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        stock INTEGER NOT NULL DEFAULT 0,
        sizes TEXT,
        price REAL NOT NULL DEFAULT 0,
        image_url TEXT,
        category TEXT DEFAULT 'مهمات الكشافة',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Check if store_items has any rows, if not, seed initial items
    const countStmt = database.prepare("SELECT COUNT(*) as count FROM store_items");
    let itemCount = 0;
    if (countStmt.step()) {
      itemCount = (countStmt.getAsObject().count as number) || 0;
    }
    countStmt.free();

    if (itemCount === 0) {
      const initialItems = [
        {
          name: 'القميص الكشفي الرسمي (Scout Shirt)',
          description: 'قميص كشفي رسمي عالي الجودة مع شارات الكتف والجيوب المزدوجة، مناسب لكافة المراحل الكشفية.',
          stock: 35,
          sizes: 'XS, S, M, L, XL, XXL',
          price: 180,
          category: 'الزي الرسمي',
        },
        {
          name: 'منديل الكشافة الموحد (Scout Scarf)',
          description: 'المنديل الكشفي الرسمي المعتمد لمدرسة القديس يوسف بالعبور مع عقدة التثبيت الكشفية (Woggle).',
          stock: 50,
          sizes: 'مقاس موحد',
          price: 65,
          category: 'إكسسوارات',
        },
        {
          name: 'قبعة الكشافة الرسمية (Scout Cap)',
          description: 'قبعة كشفية رسمية مريحة مع حافة واقية من الشمس ومطرزة بشعار المجموعة الكشفية.',
          stock: 22,
          sizes: 'S, M, L',
          price: 85,
          category: 'الزي الرسمي',
        },
        {
          name: 'حزام الكشافة مع الإبزيم المعدني',
          description: 'حزام من النسيج المقوى مع إبزيم معدني متين يحمل زهرة الكشافة العالمية ومشبك تعديل المقاس.',
          stock: 30,
          sizes: 'مقاس موحد',
          price: 90,
          category: 'إكسسوارات',
        },
        {
          name: 'حقيبة ظهر المعسكرات والمغامرات (Camp Backpack)',
          description: 'حقيبة ظهر متينة مقاومة للماء متعددة الجيوب سعة 35 لتر مخصصة للمخيمات والرحلات الخلوية.',
          stock: 15,
          sizes: '35 لتر',
          price: 320,
          category: 'مهمات المعسكرات',
        },
      ];

      const insertStmt = database.prepare(`
        INSERT INTO store_items (name, description, stock, sizes, price, image_url, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, '${now}', '${now}')
      `);

      for (const item of initialItems) {
        insertStmt.run([item.name, item.description, item.stock, item.sizes, item.price, item.category]);
      }
      insertStmt.free();
    }
  } catch (storeErr) {
    console.log('Store items migration note:', storeErr);
  }

  // 11. Ensure store_orders and store_order_items tables exist
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS store_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        user_name TEXT,
        user_role TEXT,
        buyer_name TEXT NOT NULL,
        buyer_phone TEXT,
        buyer_type TEXT DEFAULT 'MEMBER',
        member_id INTEGER,
        tribe_id INTEGER,
        tribe_name TEXT,
        total_items INTEGER NOT NULL DEFAULT 0,
        total_price REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'WAITING_PICKUP', 'SOLD', 'CANCELLED')),
        confirmed_at TEXT,
        confirmed_by TEXT,
        paid_at TEXT,
        paid_by TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    database.run(`
      CREATE TABLE IF NOT EXISTS store_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        size TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        image_url TEXT,
        FOREIGN KEY (order_id) REFERENCES store_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES store_items(id)
      );
    `);
  } catch (orderErr) {
    console.log('Store orders migration note:', orderErr);
  }

  // 11. Ensure user_profile_requests table exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS user_profile_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        requested_photo_path TEXT,
        requested_address TEXT,
        requested_phone TEXT,
        requested_email TEXT,
        requested_password_hash TEXT,
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        reviewed_at TEXT,
        reviewed_by TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    ensureUsersTableColumns(database);
  } catch (profErr) {
    console.log('User profile requests migration note:', profErr);
  }

  // 12. Ensure badges and member_badges tables exist and seed initial badges
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_en TEXT,
        category TEXT NOT NULL DEFAULT 'جدارة',
        icon TEXT NOT NULL DEFAULT 'Award',
        color TEXT NOT NULL DEFAULT 'amber',
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    database.run(`
      CREATE TABLE IF NOT EXISTS member_badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        badge_id INTEGER NOT NULL,
        awarded_at TEXT NOT NULL,
        awarded_by TEXT NOT NULL,
        reason TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(member_id, badge_id),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
      );
    `);

    // Check if badges table is empty, if so seed authentic scout badges
    const badgeCountStmt = database.prepare("SELECT COUNT(*) as count FROM badges");
    let badgeCount = 0;
    if (badgeCountStmt.step()) {
      badgeCount = (badgeCountStmt.getAsObject().count as number) || 0;
    }
    badgeCountStmt.free();

    if (badgeCount === 0) {
      const defaultBadges = [
        {
          name: 'وسام الصداقة الكشفية',
          name_en: 'Scout Friendship Badge',
          category: 'سلوك وأخلاق',
          icon: 'Heart',
          color: 'rose',
          description: 'يُمنح تقديراً للروح الودية ومساعدة الزملاء ونشر روح التآخي والمحبة بين أفراد الطليعة والمجموعة الكشفية.',
          requirements: 'الالتزام بروح الإخاء والتعاون، مساعدة الأعضاء الجدد، وعدم الغياب عن الاجتماعات لمدة 3 أشهر.',
        },
        {
          name: 'وسام الفارس الكشفي',
          name_en: 'Scout Knight Medal',
          category: 'جدارة وشجاعة',
          icon: 'Shield',
          color: 'amber',
          description: 'وسام شجاعة رفيع يُمنح للشهامة وتحمل المسؤولية في المواقف الصعبة والمعسكرات الخلوية.',
          requirements: 'قيادة الطليعة في مخيمين متتاليين بنجاح، إظهار الشجاعة والمبادرة، واجتياز اختبارات التحمل البدني.',
        },
        {
          name: 'وسام الإسعافات الأولية والإنقاذ',
          name_en: 'First Aid & Rescue Badge',
          category: 'مهارات طبية',
          icon: 'Cross',
          color: 'red',
          description: 'يُمنح لمن يتقن مهارات الإسعاف الأولي الميداني وتركيب الضمادات والتعامل السريع مع الحوادث والكسور.',
          requirements: 'اجتياز الاختبار الميداني للإسعافات الأولية، إتقان الإنعاش القلبي والرئوي CPR، ونقل المصابين بأمان.',
        },
        {
          name: 'وسام الملاحة وتتبع الأثر',
          name_en: 'Pioneering & Navigation Badge',
          category: 'فنون خلوية',
          icon: 'Compass',
          color: 'blue',
          description: 'يُمنح للمتميزين في استخدام البوصلة وقراءة الخرائط وتتبع الأثر وفك إشارات المورس الكشفية.',
          requirements: 'اجتياز مسار استكشافي خلوي لمسافة 5 كم بالخريطة والبوصلة فقط، وفك رسالة مشفرة بنجاح.',
        },
        {
          name: 'وسام المخيمات وفنون الخلاء',
          name_en: 'Campcraft & Outdoor Badge',
          category: 'مخيمات',
          icon: 'Tent',
          color: 'emerald',
          description: 'يُمنح لمن يتقن نصب الخيام الكشفية وعقد الحبال وإشعال النيران الآمنة والطهي الخلوي.',
          requirements: 'المشاركة في 3 معسكرات خلوية على الأقل، إتقان 8 عقد كشفية أساسية، والمحافظة على النظافة البيئية.',
        },
        {
          name: 'وسام الخدمة العامة والتطوع',
          name_en: 'Community Service Badge',
          category: 'خدمة مجتمعية',
          icon: 'Flame',
          color: 'orange',
          description: 'يُمنح للكشافين والقادة لجهودهم التطوعية في خدمة المدرسة والمجتمع وحملات النظافة والتشجير.',
          requirements: 'إتمام 20 ساعة عمل تطوعي معتمدة، والمشاركة الفعالة في تنظيم الفعاليات والمناسبات الكبرى.',
        },
        {
          name: 'وسام الرائد القائد المتميز',
          name_en: 'Distinguished Leader Medal',
          category: 'قيادة وإشراف',
          icon: 'Crown',
          color: 'purple',
          description: 'أرفع وسام قيادي يُمنح للقادة الذين أظهروا تفانياً استثنائياً في قيادة وتوجيه العشائر الكشفية وتأهيل الأجيال.',
          requirements: 'قيادة عشيرة كشفية بنجاح لأكثر من عامين، تحقيق نسبة التزام وحضور تتجاوز 85%، وبناء فريق قيادي واعد.',
        },
        {
          name: 'وسام الشرف الكشفي والأمانة',
          name_en: 'Scout Honor Badge',
          category: 'شرف وأمانة',
          icon: 'Star',
          color: 'yellow',
          description: 'يُمنح تقديراً للالتزام النموذجي بالوعد والقانون الكشفي، وحسن الخلق والقدوة الحسنة للجميع.',
          requirements: 'الالتزام التام بالقيم والمبادئ الكشفية، عدم تسجيل أي مخالفة سلوكية، والتوصية بالإجماع من قادة العشائر.',
        },
        {
          name: 'وسام اللياقة البدنية والرياضة',
          name_en: 'Fitness & Athletics Badge',
          category: 'رياضة ولياقة',
          icon: 'Zap',
          color: 'cyan',
          description: 'يُمنح للمتفوقين في الأنشطة الرياضية واللياقة البدنية واجتياز حواجز المعسكرات والماراثون الكشفي.',
          requirements: 'اجتياز اختبارات اللياقة البدنية المعيارية والمشاركة في الماراثون الكشفي أو البطولات الرياضية للمدرسة.',
        },
        {
          name: 'وسام الإبداع والابتكار الكشفي',
          name_en: 'Scout Star & Innovation Badge',
          category: 'إبداع وابتكار',
          icon: 'Trophy',
          color: 'indigo',
          description: 'يُمنح للمبتكرين في تقديم أفكار ومشاريع كشفية إبداعية أو تنظيم سهرات السمر والمسابقات العلمية.',
          requirements: 'تقديم مبادرة أو مشروع كشفي إبداعي يخدم العشيرة ويتم تنفيذه وتطبيقه عملياً في المعسكرات.',
        },
      ];

      const insertBadgeStmt = database.prepare(`
        INSERT INTO badges (name, name_en, category, icon, color, description, requirements, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, '${now}', '${now}')
      `);

      for (const b of defaultBadges) {
        insertBadgeStmt.run([b.name, b.name_en, b.category, b.icon, b.color, b.description, b.requirements]);
      }
      insertBadgeStmt.free();
    }
  } catch (badgeErr) {
    console.log('Badges migration note:', badgeErr);
  }

  // 10. Ensure member_wallets and wallet_transactions exist
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS member_wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER UNIQUE NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
    `);

    database.run(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('DEPOSIT', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'WITHDRAW')),
        amount REAL NOT NULL,
        balance_before REAL NOT NULL,
        balance_after REAL NOT NULL,
        category TEXT NOT NULL,
        reference_id TEXT,
        reference_title TEXT,
        description TEXT,
        receipt_number TEXT,
        recorded_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
    `);
  } catch (walletErr) {
    console.log('Wallets migration note:', walletErr);
  }

  // 13. Ensure user_sessions table exists for persistent auth across server restarts
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (sessErr) {
    console.log('User sessions migration note:', sessErr);
  }
}

// Format member code: 151 -> "A250151" (format: A25 + 4 digits)
export function formatMemberCode(seq: number): string {
  return `A25${String(seq).padStart(4, '0')}`;
}

// Generate next unique Member Code starting from A250001
export function generateNextMemberCode(database: Database): string {
  let seq = 0; // so that first generated code is A250001 (seq 1)
  
  const countStmt = database.prepare("SELECT COUNT(*) as count FROM members");
  let memberCount = 0;
  if (countStmt.step()) {
    memberCount = (countStmt.getAsObject().count as number) || 0;
  }
  countStmt.free();

  if (memberCount > 0) {
    const stmt = database.prepare("SELECT value FROM system_counters WHERE key = 'member_seq'");
    if (stmt.step()) {
      const val = (stmt.getAsObject().value as number) || 0;
      if (val >= 0 && val < 250000) {
        seq = val;
      }
    }
    stmt.free();

    // Scan existing member codes to ensure we stay strictly above any existing A25xxxx or scXXXXXX code
    const memStmt = database.prepare("SELECT member_code FROM members WHERE member_code IS NOT NULL");
    while (memStmt.step()) {
      const row = memStmt.getAsObject();
      const mCode = String(row.member_code || '').trim();
      const matchA25 = mCode.match(/^A250*(\d+)$/i);
      const matchSC = mCode.match(/^sc0*(\d+)$/i);
      const matchA = mCode.match(/^A0*(\d+)$/i);
      if (matchA25) {
        const num = parseInt(matchA25[1], 10);
        if (num >= 1 && num > seq) {
          seq = num;
        }
      } else if (matchSC) {
        const num = parseInt(matchSC[1], 10);
        if (num >= 1 && num > seq) {
          seq = num;
        }
      } else if (matchA) {
        const num = parseInt(matchA[1], 10);
        if (num >= 1 && num > seq && num < 250000) {
          seq = num;
        }
      }
    }
    memStmt.free();
  } else {
    // If no members in database, reset sequence to 0 so the first code is A250001
    seq = 0;
  }

  let code = '';
  let isUnique = false;

  while (!isUnique) {
    seq++;
    code = formatMemberCode(seq);
    const checkStmt = database.prepare("SELECT id FROM members WHERE LOWER(member_code) = LOWER(?)");
    checkStmt.bind([code]);
    if (!checkStmt.step()) {
      isUnique = true;
    }
    checkStmt.free();
  }

  const updateStmt = database.prepare("UPDATE system_counters SET value = ? WHERE key = 'member_seq'");
  updateStmt.run([seq]);
  updateStmt.free();

  return code;
}

export type AuditActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'ADD'
  | 'EDIT'
  | 'PROMOTION'
  | 'DELETE'
  | 'BACKUP'
  | 'RESTORE'
  | 'CREATE_TRIBE'
  | 'EDIT_TRIBE'
  | 'DELETE_TRIBE'
  | 'ASSIGN_TRIBE_LEADER'
  | 'ASSIGN_TRIBE_DEPUTY'
  | 'ADD_MEMBER_TO_TRIBE'
  | 'REMOVE_MEMBER_FROM_TRIBE'
  | 'TRIBE_MEETING_CREATE'
  | 'TRIBE_MEETING_DELETE'
  | 'TRIBE_ATTENDANCE_RECORD'
  | 'PHOTO_ADD'
  | 'PHOTO_UPDATE'
  | 'PHOTO_DELETE'
  | 'EXCEL_BACKUP'
  | 'EXCEL_RESTORE'
  | 'BATCH_IMPORT'
  | 'CSV_EXPORT'
  | 'MEMBER_CODE_GENERATED'
  | 'ACTIVITY_CREATE'
  | 'ACTIVITY_UPDATE'
  | 'ACTIVITY_DELETE'
  | 'ACTIVITY_PARTICIPANT_ADD'
  | 'ACTIVITY_PARTICIPANT_REMOVE'
  | 'ANNUAL_FEE_UPDATE'
  | 'ANNUAL_SUBSCRIPTION_PAY'
  | 'ANNUAL_SUBSCRIPTION_BULK_PAY'
  | 'ANNUAL_SUBSCRIPTION_CANCEL'
  | 'STORE_ITEM_CREATE'
  | 'STORE_ITEM_UPDATE'
  | 'STORE_ITEM_DELETE'
  | 'STORE_STOCK_UPDATE'
  | 'STORE_RESERVATION_CREATE'
  | 'STORE_RESERVATION_CONFIRM'
  | 'STORE_SALE_PAY'
  | 'STORE_RESERVATION_CANCEL'
  | 'PROFILE_REQUEST_CREATE'
  | 'PROFILE_REQUEST_APPROVE'
  | 'PROFILE_REQUEST_REJECT'
  | 'PROFILE_UPDATE'
  | 'BADGE_CREATE'
  | 'BADGE_UPDATE'
  | 'BADGE_DELETE'
  | 'BADGE_AWARD'
  | 'BADGE_REVOKE'
  | 'BULK_TRANSFER_TRIBE'
  | 'BULK_AWARD_BADGE'
  | 'BULK_EXPORT_CARDS'
  | 'WALLET_TOPUP'
  | 'WALLET_DEDUCT'
  | 'WALLET_PAY_SUBSCRIPTION'
  | 'WALLET_PAY_ACTIVITY'
  | 'WALLET_PAY_STORE'
  | 'WALLET_REFUND'
  | 'WALLET_ADJUSTMENT'
  | 'WALLET_SUBSCRIPTION_ROLLOVER'
  | 'WALLET_SUBSCRIPTION_REFUND'
  | 'FULL_SYSTEM_BACKUP'
  | 'FULL_SYSTEM_RESTORE'
  | 'UPDATE_GRADES'
  | 'REPAIR_PHOTOS';

export function logAudit(
  user: string,
  action: AuditActionType,
  memberId: number | null = null,
  memberName: string | null = null,
  details: string | null = null
): void {
  if (!db) return;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  const createdAt = now.toISOString();

  const stmt = db.prepare(`
    INSERT INTO audit_log (date, time, user, action, member_id, member_name, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([dateStr, timeStr, user, action, memberId, memberName, details, createdAt]);
  stmt.free();
  saveDb();
}

// Get or initialize member wallet balance
export function getMemberWalletBalance(database: Database, memberId: number): number {
  const stmt = database.prepare("SELECT balance FROM member_wallets WHERE member_id = ?");
  stmt.bind([memberId]);
  if (stmt.step()) {
    const res = (stmt.getAsObject().balance as number) || 0;
    stmt.free();
    return Number(res);
  }
  stmt.free();

  // Create zero-balance wallet record
  const now = new Date().toISOString();
  try {
    const insertStmt = database.prepare(`
      INSERT OR IGNORE INTO member_wallets (member_id, balance, created_at, updated_at)
      VALUES (?, 0, ?, ?)
    `);
    insertStmt.run([memberId, now, now]);
    insertStmt.free();
  } catch (e) {}

  return 0;
}

export interface RecordWalletTxParams {
  memberId: number;
  type: 'DEPOSIT' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'WITHDRAW';
  amount: number;
  category: 'TOPUP' | 'SUBSCRIPTION' | 'ACTIVITY' | 'STORE' | 'REFUND' | 'ADJUSTMENT';
  referenceId?: string | null;
  referenceTitle?: string | null;
  description?: string | null;
  recordedBy: string;
  adjustmentDirection?: 'ADD' | 'DEDUCT';
}

export function recordWalletTransaction(
  database: Database,
  params: RecordWalletTxParams
): { success: boolean; transactionId: number; balanceBefore: number; balanceAfter: number; receiptNumber: string; error?: string } {
  const { memberId, type, amount, category, referenceId, referenceTitle, description, recordedBy, adjustmentDirection } = params;
  if (amount <= 0) {
    return { success: false, transactionId: 0, balanceBefore: 0, balanceAfter: 0, receiptNumber: '', error: 'المبلغ يجب أن يكون أكبر من الصفر' };
  }

  const currentBalance = getMemberWalletBalance(database, memberId);
  let newBalance = currentBalance;

  const isAddition = type === 'DEPOSIT' || type === 'REFUND' || (type === 'ADJUSTMENT' && adjustmentDirection === 'ADD');

  if (isAddition) {
    newBalance = currentBalance + amount;
  } else {
    if (newBalance < amount && type !== 'ADJUSTMENT') {
      return {
        success: false,
        transactionId: 0,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance,
        receiptNumber: '',
        error: `رصيد المحفظة الحالي (${currentBalance} ج.م) غير كافٍ لإتمام خصم (${amount} ج.م)`,
      };
    }
    newBalance = Math.max(0, currentBalance - amount);
  }

  const now = new Date();
  const timestamp = now.toISOString();
  const year = now.getFullYear();
  const receiptNumber = `WAL-${year}-${Date.now().toString().slice(-6)}`;

  // Update or insert wallet balance
  const updateWalletStmt = database.prepare(`
    INSERT INTO member_wallets (member_id, balance, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(member_id) DO UPDATE SET
      balance = excluded.balance,
      updated_at = excluded.updated_at
  `);
  updateWalletStmt.run([memberId, newBalance, timestamp, timestamp]);
  updateWalletStmt.free();

  // Insert transaction
  const txStmt = database.prepare(`
    INSERT INTO wallet_transactions (
      member_id, type, amount, balance_before, balance_after, category,
      reference_id, reference_title, description, receipt_number, recorded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  txStmt.run([
    memberId,
    type,
    amount,
    currentBalance,
    newBalance,
    category,
    referenceId || null,
    referenceTitle || null,
    description || null,
    receiptNumber,
    recordedBy,
    timestamp,
  ]);
  txStmt.free();

  const lastIdStmt = database.prepare("SELECT last_insert_rowid() as id");
  let txId = 0;
  if (lastIdStmt.step()) {
    txId = (lastIdStmt.getAsObject().id as number) || 0;
  }
  lastIdStmt.free();

  saveDb();

  return {
    success: true,
    transactionId: txId,
    balanceBefore: currentBalance,
    balanceAfter: newBalance,
    receiptNumber,
  };
}

