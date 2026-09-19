import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  getDb,
  saveDb,
  reloadDbFromDisk,
  logAudit,
  generateNextMemberCode,
  formatMemberCode,
  DB_PATH,
  PHOTOS_DIR,
  AuditActionType,
  ensureUsersTableColumns,
  getMemberWalletBalance,
  recordWalletTransaction,
  PROJECT_ROOT,
  SNAPSHOT_FILE,
  BACKUP_EXCEL_FILE,
  hydrateFromSnapshotIfBetter,
} from './server/db';
import initSqlJs from 'sql.js';

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

// Configure multer for memory buffer (and photo uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// In-memory failed attempts tracker for brute-force protection (5 attempts lockout)
interface LoginAttemptInfo {
  count: number;
  lockoutUntil: number;
}
const loginAttempts = new Map<string, LoginAttemptInfo>();

// Simple offline session store
interface SessionUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'DATA_ENTRY' | 'LEADER';
  full_name?: string;
  member_id?: number | null;
  member_code?: string | null;
  tribe_id?: number | null;
  tribe_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photo_path?: string | null;
  theme_preference?: string | null;
}
const activeSessions = new Map<string, SessionUser>();

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const SCHOOL_GRADES_LIST = [
  'الصف الأول الابتدائي',
  'الصف الثاني الابتدائي',
  'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي',
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
  'أخرى',
] as const;

function normalizeGrade(raw: any): string {
  if (!raw || typeof raw !== 'string') return 'الصف الأول الابتدائي';
  const str = raw.trim();

  if (SCHOOL_GRADES_LIST.includes(str as any)) return str;

  // Secondary
  if (str.includes('ثانو')) {
    if (str.includes('ثالث') || str.includes('3') || str.includes('٣')) return 'الصف الثالث الثانوي';
    if (str.includes('ثان') || str.includes('2') || str.includes('٢')) return 'الصف الثاني الثانوي';
    return 'الصف الأول الثانوي';
  }

  // Prep / Middle
  if (str.includes('إعداد') || str.includes('اعداد')) {
    if (str.includes('ثالث') || str.includes('3') || str.includes('٣')) return 'الصف الثالث الإعدادي';
    if (str.includes('ثان') || str.includes('2') || str.includes('٢')) return 'الصف الثاني الإعدادي';
    return 'الصف الأول الإعدادي';
  }

  // Primary
  if (str.includes('ابتدائ') || str.includes('ابتدائي')) {
    if (str.includes('سادس') || str.includes('6') || str.includes('٦')) return 'الصف السادس الابتدائي';
    if (str.includes('خامس') || str.includes('5') || str.includes('٥')) return 'الصف الخامس الابتدائي';
    if (str.includes('رابع') || str.includes('4') || str.includes('٤')) return 'الصف الرابع الابتدائي';
    if (str.includes('ثالث') || str.includes('3') || str.includes('٣')) return 'الصف الثالث الابتدائي';
    if (str.includes('ثان') || str.includes('2') || str.includes('٢')) return 'الصف الثاني الابتدائي';
    return 'الصف الأول الابتدائي';
  }

  if (str.includes('أخرى') || str.includes('اخري') || str.includes('جامع') || str.includes('خريج')) {
    return 'أخرى';
  }

  return 'أخرى';
}

// Authentication Middleware
async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || (req.query.token as string);
  if (!token) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً للوصول إلى النظام' });
  }

  if (activeSessions.has(token)) {
    (req as any).user = activeSessions.get(token);
    return next();
  }

  // Check persistent session in database
  try {
    const db = await getDb();
    const sessionRow = queryOne(
      db,
      `SELECT s.token, u.id, u.username, u.role, u.full_name, u.member_id, u.tribe_id, u.phone, u.email, u.address, u.photo_path, u.theme_preference, u.is_active 
       FROM user_sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.token = ? AND u.is_active = 1`,
      [token]
    );
    if (sessionRow) {
      let tribeName = null;
      if (sessionRow.tribe_id) {
        const tr = queryOne(db, 'SELECT name FROM tribes WHERE id = ?', [sessionRow.tribe_id]);
        if (tr) tribeName = tr.name;
      }
      let memberCode = null;
      if (sessionRow.member_id) {
        const mem = queryOne(db, 'SELECT member_code FROM members WHERE id = ?', [sessionRow.member_id]);
        if (mem) memberCode = mem.member_code;
      }
      const sessionUser: SessionUser = {
        id: sessionRow.id,
        username: sessionRow.username,
        role: sessionRow.role as 'ADMIN' | 'DATA_ENTRY' | 'LEADER',
        full_name: sessionRow.full_name || sessionRow.username,
        member_id: sessionRow.member_id || null,
        member_code: memberCode,
        tribe_id: sessionRow.tribe_id || null,
        tribe_name: tribeName,
        phone: sessionRow.phone || null,
        email: sessionRow.email || null,
        address: sessionRow.address || null,
        photo_path: sessionRow.photo_path || null,
        theme_preference: (sessionRow.theme_preference as any) || 'light',
      };
      activeSessions.set(token, sessionUser);
      (req as any).user = sessionUser;
      return next();
    }
  } catch (err) {
    console.error('Session lookup error:', err);
  }

  return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً للوصول إلى النظام' });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as SessionUser;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'عفواً، هذه العملية مخصصة لمدير النظام (ADMIN) فقط' });
  }
  next();
}

function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as SessionUser;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'DATA_ENTRY')) {
    return res.status(403).json({ error: 'عفواً، هذه العملية مخصصة للإدارة (المدير أو الأدمن) فقط' });
  }
  next();
}

// Helper to run query and return all rows as array of objects
function queryAll(db: any, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(db: any, sql: string, params: any[] = []): any | null {
  const rows = queryAll(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function safeRollback(db: any): void {
  try {
    if (db) {
      db.run('ROLLBACK;');
    }
  } catch (_) {
    // Ignore if no transaction is active or already rolled back
  }
}

/**
 * Normalizes an external image link (especially Google Drive, Dropbox, OneDrive, etc.)
 * into a direct download URL.
 */
function convertToDirectImageUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();
  if (!url) return null;

  // Already a local path or data URI
  if (url.startsWith('/data/photos/') || url.startsWith('data:image/')) {
    return url;
  }

  // Google Drive standard file link: https://drive.google.com/file/d/FILE_ID/view...
  const driveFileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`;
  }

  // Google Drive open or uc links with id parameter: https://drive.google.com/open?id=FILE_ID
  const driveIdParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if ((url.includes('drive.google.com') || url.includes('docs.google.com')) && driveIdParam && driveIdParam[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveIdParam[1]}`;
  }

  // Dropbox share links
  if (url.includes('dropbox.com')) {
    return url.replace('?dl=0', '?dl=1');
  }

  return url;
}

/**
 * Downloads an image from a URL (handling HTTP/HTTPS redirects and timeouts)
 * and safely writes it to PHOTOS_DIR, returning the local web path `/data/photos/{filename}`.
 */
async function downloadImageAndSaveLocally(
  rawUrl: string,
  identifier: string
): Promise<string | null> {
  const directUrl = convertToDirectImageUrl(rawUrl);
  if (!directUrl) return null;

  // If already a local path, preserve it
  if (directUrl.startsWith('/data/photos/')) {
    return directUrl;
  }

  // Handle base64 data URI
  if (directUrl.startsWith('data:image/')) {
    try {
      const match = directUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const buffer = Buffer.from(match[2], 'base64');
        const safeId = identifier.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeId}_${Date.now()}.${ext}`;
        const targetPath = path.join(PHOTOS_DIR, filename);
        fs.writeFileSync(targetPath, buffer);
        return `/data/photos/${filename}`;
      }
    } catch (e) {
      console.warn(`[PHOTO_DOWNLOAD] Failed to decode base64 data URI:`, e);
      return null;
    }
  }

  // Helper to fetch buffer following redirects
  const fetchBuffer = (targetUrl: string, redirectCount = 0): Promise<{ buffer: Buffer; contentType: string }> => {
    return new Promise((resolve, reject) => {
      if (redirectCount > 6) {
        return reject(new Error('Too many redirects'));
      }

      let parsed: URL;
      try {
        parsed = new URL(targetUrl);
      } catch (err) {
        return reject(new Error('رابط الصورة غير صالح: ' + targetUrl));
      }

      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(
        parsed,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/*,*/*;q=0.8',
          },
          timeout: 10000,
        },
        (res) => {
          // Handle HTTP redirects (301, 302, 303, 307, 308)
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            res.resume(); // consume response to free memory
            return resolve(fetchBuffer(redirectUrl, redirectCount + 1));
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP status ${res.statusCode}`));
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = res.headers['content-type'] || '';
            resolve({ buffer, contentType });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error('Request timeout'));
      });

      req.on('error', (err) => {
        reject(err);
      });
    });
  };

  try {
    const { buffer, contentType } = await fetchBuffer(directUrl);

    // Validate minimum image size (at least 100 bytes)
    if (!buffer || buffer.length < 100) {
      console.warn(`[PHOTO_DOWNLOAD] Buffer too small (${buffer?.length} bytes) for ${directUrl}`);
      return null;
    }

    // Determine extension from content-type or url
    let ext = 'jpg';
    const lowerType = contentType.toLowerCase();
    if (lowerType.includes('png')) ext = 'png';
    else if (lowerType.includes('webp')) ext = 'webp';
    else if (lowerType.includes('svg')) ext = 'svg';
    else if (lowerType.includes('jpeg') || lowerType.includes('jpg')) ext = 'jpg';
    else if (directUrl.endsWith('.png')) ext = 'png';
    else if (directUrl.endsWith('.webp')) ext = 'webp';

    const safeId = identifier.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeId}_${Date.now()}.${ext}`;
    const targetPath = path.join(PHOTOS_DIR, filename);

    if (!fs.existsSync(PHOTOS_DIR)) {
      fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    }

    fs.writeFileSync(targetPath, buffer);
    console.log(`[PHOTO_DOWNLOAD] Successfully saved member photo: /data/photos/${filename}`);
    return `/data/photos/${filename}`;
  } catch (err: any) {
    console.warn(`[PHOTO_DOWNLOAD] Warning: Could not download photo from ${directUrl}:`, err.message);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Static serving for local member photos
  app.use('/data/photos', express.static(PHOTOS_DIR));

  // Health endpoint for server readiness
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Initialize DB
  await getDb();

  // Photo viewer endpoint with fallback safety
  app.get('/api/photos/view/:filename', (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(PHOTOS_DIR, filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'الصورة غير موجودة' });
    }
  });

  // Photo Upload endpoint
  app.post('/api/photos/upload', authenticate, upload.single('photo'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'لم يتم اختيار ملف صورة' });
      }

      const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedMime.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'نوع الملف غير مدعوم. يرجى اختيار صورة JPG أو PNG أو SVG أو WEBP' });
      }

      let ext = 'jpg';
      if (req.file.mimetype === 'image/png') ext = 'png';
      else if (req.file.mimetype === 'image/svg+xml') ext = 'svg';
      else if (req.file.mimetype === 'image/webp') ext = 'webp';
      const customCode = (req.body.member_code || '').trim();
      const filename = customCode ? `${customCode}_${Date.now()}.${ext}` : `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const targetPath = path.join(PHOTOS_DIR, filename);

      fs.writeFileSync(targetPath, req.file.buffer);

      const photoRef = `/data/photos/${filename}`;
      logAudit(user.username, 'PHOTO_ADD', null, null, `رفع صورة جديدة: ${filename}`);

      res.json({
        success: true,
        photo_path: photoRef,
        filename,
      });
    } catch (err: any) {
      console.error('Photo upload error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء حفظ الصورة' });
    }
  });

  // --- 1. AUTHENTICATION ROUTES ---
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
      }

      const clientIp = req.ip || 'local';
      const attemptKey = `${username}_${clientIp}`;
      const nowTime = Date.now();

      const attemptInfo = loginAttempts.get(attemptKey);
      if (attemptInfo && attemptInfo.lockoutUntil > nowTime) {
        const remainingMinutes = Math.ceil((attemptInfo.lockoutUntil - nowTime) / 60000);
        return res.status(429).json({
          error: `تم قفل الحساب مؤقتاً لتجاوز 5 محاولات خاطئة. يرجى المحاولة بعد ${remainingMinutes} دقيقة.`,
        });
      }

      const db = await getDb();
      const user = queryOne(db, 'SELECT * FROM users WHERE username = ?', [username]);

      if (!user) {
        const curr = attemptInfo || { count: 0, lockoutUntil: 0 };
        curr.count += 1;
        if (curr.count >= 5) {
          curr.lockoutUntil = nowTime + 5 * 60 * 1000;
        }
        loginAttempts.set(attemptKey, curr);

        return res.status(401).json({
          error: curr.count >= 5
            ? 'تم قفل الحساب مؤقتاً لتجاوز 5 محاولات خاطئة.'
            : 'اسم المستخدم أو كلمة المرور غير صحيحة',
        });
      }

      if (user.is_active !== 1) {
        return res.status(403).json({ error: 'هذا الحساب معطل حالياً. يرجى مراجعة مسؤول النظام.' });
      }

      const isMatch = bcrypt.compareSync(password, user.password_hash);
      if (!isMatch) {
        const curr = attemptInfo || { count: 0, lockoutUntil: 0 };
        curr.count += 1;
        if (curr.count >= 5) {
          curr.lockoutUntil = nowTime + 5 * 60 * 1000;
        }
        loginAttempts.set(attemptKey, curr);

        return res.status(401).json({
          error: curr.count >= 5
            ? 'تم قفل الحساب مؤقتاً لتجاوز 5 محاولات خاطئة.'
            : 'اسم المستخدم أو كلمة المرور غير صحيحة',
        });
      }

      loginAttempts.delete(attemptKey);

      const token = generateToken();
      let tribeName = null;
      if (user.tribe_id) {
        const tr = queryOne(db, 'SELECT name FROM tribes WHERE id = ?', [user.tribe_id]);
        if (tr) tribeName = tr.name;
      }
      let memberCode = null;
      if (user.member_id) {
        const mem = queryOne(db, 'SELECT member_code, student_name FROM members WHERE id = ?', [user.member_id]);
        if (mem) {
          memberCode = mem.member_code;
        }
      }
      const sessionUser: SessionUser = {
        id: user.id,
        username: user.username,
        role: user.role as 'ADMIN' | 'DATA_ENTRY' | 'LEADER',
        full_name: user.full_name || user.username,
        member_id: user.member_id || null,
        member_code: memberCode,
        tribe_id: user.tribe_id || null,
        tribe_name: tribeName,
        phone: user.phone || null,
        email: user.email || null,
        address: user.address || null,
        photo_path: user.photo_path || null,
        theme_preference: (user.theme_preference as any) || 'light',
      };
      activeSessions.set(token, sessionUser);

      // Persist session to SQLite user_sessions table
      try {
        db.run('INSERT OR REPLACE INTO user_sessions (token, user_id, created_at) VALUES (?, ?, ?)', [
          token,
          user.id,
          new Date().toISOString(),
        ]);
        saveDb();
      } catch (sessSaveErr) {
        console.warn('Failed to persist session to DB:', sessSaveErr);
      }

      logAudit(user.username, 'LOGIN', null, null, 'تسجيل دخول ناجح للنظام');

      res.json({
        token,
        user: sessionUser,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.' });
    }
  });

  app.post('/api/auth/logout', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const token = req.headers['authorization']?.replace('Bearer ', '') || (req.query.token as string);
      if (token) {
        activeSessions.delete(token);
        try {
          const db = await getDb();
          db.run('DELETE FROM user_sessions WHERE token = ?', [token]);
          saveDb();
        } catch (sessDelErr) {}
      }
      logAudit(user.username, 'LOGOUT', null, null, 'تسجيل خروج من النظام');
      res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الخروج' });
    }
  });

  app.get('/api/auth/me', authenticate, async (req: Request, res: Response) => {
    try {
      const sessionUser = (req as any).user as SessionUser;
      const db = await getDb();
      ensureUsersTableColumns(db);
      const userRow = queryOne(
        db,
        'SELECT id, username, role, full_name, member_id, tribe_id, phone, email, address, photo_path, theme_preference FROM users WHERE id = ?',
        [sessionUser.id]
      );
      if (userRow) {
        let tribeName = null;
        if (userRow.tribe_id) {
          const tr = queryOne(db, 'SELECT name FROM tribes WHERE id = ?', [userRow.tribe_id]);
          if (tr) tribeName = tr.name;
        }
        let memberCode = null;
        if (userRow.member_id) {
          const mem = queryOne(db, 'SELECT member_code, photo_path, address FROM members WHERE id = ?', [userRow.member_id]);
          if (mem) {
            memberCode = mem.member_code;
            if (!userRow.photo_path && mem.photo_path) userRow.photo_path = mem.photo_path;
            if (!userRow.address && mem.address) userRow.address = mem.address;
          }
        }
        const updatedUser: SessionUser = {
          id: userRow.id,
          username: userRow.username,
          role: userRow.role,
          full_name: userRow.full_name || userRow.username,
          member_id: userRow.member_id || null,
          member_code: memberCode,
          tribe_id: userRow.tribe_id || null,
          tribe_name: tribeName,
          phone: userRow.phone || null,
          email: userRow.email || null,
          address: userRow.address || null,
          photo_path: userRow.photo_path || null,
          theme_preference: userRow.theme_preference || 'light',
        };
        const token = req.headers['authorization']?.replace('Bearer ', '') || (req.query.token as string);
        if (token) activeSessions.set(token, updatedUser);
        return res.json({ user: updatedUser });
      }
      res.json({ user: sessionUser });
    } catch {
      res.json({ user: (req as any).user });
    }
  });

  // --- USER PROFILE & SETTINGS ROUTES ---

  // Get current user profile with pending/rejected request status
  app.get('/api/user/profile', authenticate, async (req: Request, res: Response) => {
    try {
      const sessionUser = (req as any).user as SessionUser;
      const db = await getDb();
      ensureUsersTableColumns(db);

      const userRow = queryOne(
        db,
        'SELECT id, username, role, full_name, member_id, tribe_id, phone, email, address, photo_path, theme_preference FROM users WHERE id = ?',
        [sessionUser.id]
      );
      if (!userRow) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      let tribeName = null;
      if (userRow.tribe_id) {
        const tr = queryOne(db, 'SELECT name FROM tribes WHERE id = ?', [userRow.tribe_id]);
        if (tr) tribeName = tr.name;
      }
      let memberCode = null;
      if (userRow.member_id) {
        const mem = queryOne(db, 'SELECT member_code, photo_path, address FROM members WHERE id = ?', [userRow.member_id]);
        if (mem) {
          memberCode = mem.member_code;
          if (!userRow.photo_path && mem.photo_path) userRow.photo_path = mem.photo_path;
          if (!userRow.address && mem.address) userRow.address = mem.address;
        }
      }

      // Check pending request
      const pendingRequest = queryOne(
        db,
        "SELECT * FROM user_profile_requests WHERE user_id = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1",
        [sessionUser.id]
      );

      // Check last rejected request
      const lastRejectedRequest = queryOne(
        db,
        "SELECT * FROM user_profile_requests WHERE user_id = ? AND status = 'REJECTED' ORDER BY id DESC LIMIT 1",
        [sessionUser.id]
      );

      const userObj = {
        id: userRow.id,
        username: userRow.username,
        role: userRow.role,
        full_name: userRow.full_name || userRow.username,
        member_id: userRow.member_id || null,
        member_code: memberCode,
        tribe_id: userRow.tribe_id || null,
        tribe_name: tribeName,
        phone: userRow.phone || null,
        email: userRow.email || null,
        address: userRow.address || null,
        photo_path: userRow.photo_path || null,
        theme_preference: userRow.theme_preference || 'light',
      };

      res.json({
        user: userObj,
        pending_request: pendingRequest || null,
        last_rejected_request: lastRejectedRequest || null,
      });
    } catch (err: any) {
      console.error('Get profile error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات الملف الشخصي' });
    }
  });

  // Update theme preference immediately
  app.put('/api/user/theme', authenticate, async (req: Request, res: Response) => {
    try {
      const sessionUser = (req as any).user as SessionUser;
      const { theme } = req.body;
      if (theme !== 'light' && theme !== 'dark') {
        return res.status(400).json({ error: 'السمة غير صالحة' });
      }
      const db = await getDb();
      ensureUsersTableColumns(db);
      const stmt = db.prepare('UPDATE users SET theme_preference = ?, updated_at = ? WHERE id = ?');
      stmt.run([theme, new Date().toISOString(), sessionUser.id]);
      stmt.free();
      saveDb();
      sessionUser.theme_preference = theme;
      res.json({ success: true, theme });
    } catch (err: any) {
      console.error('Theme update error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء حفظ السمة' });
    }
  });

  // Submit profile change request (Auto-approved for ADMIN, PENDING for others)
  app.post('/api/user/profile/request', authenticate, async (req: Request, res: Response) => {
    try {
      const sessionUser = (req as any).user as SessionUser;
      const db = await getDb();
      ensureUsersTableColumns(db);

      const {
        photo_path,
        address,
        phone,
        email,
        current_password,
        new_password,
        confirm_password,
      } = req.body;

      const userRow = queryOne(db, 'SELECT * FROM users WHERE id = ?', [sessionUser.id]);
      if (!userRow) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      // Password validation if change requested
      let newPasswordHash: string | null = null;
      if (new_password) {
        if (!current_password) {
          return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية لتأكيد التغيير' });
        }
        const isCurrentMatch = bcrypt.compareSync(current_password, userRow.password_hash);
        if (!isCurrentMatch) {
          return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
        }
        if (new_password.length < 4) {
          return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن لا تقل عن 4 أحرف' });
        }
        if (confirm_password && new_password !== confirm_password) {
          return res.status(400).json({ error: 'كلمة المرور وتأكيدها غير متطابقين' });
        }
        const salt = bcrypt.genSaltSync(10);
        newPasswordHash = bcrypt.hashSync(new_password, salt);
      }

      const now = new Date().toISOString();

      // If user is ADMIN: Apply directly without approval!
      if (sessionUser.role === 'ADMIN') {
        const updateFields: string[] = ['updated_at = ?'];
        const updateParams: any[] = [now];

        if (photo_path !== undefined) {
          updateFields.push('photo_path = ?');
          updateParams.push(photo_path || null);
        }
        if (address !== undefined) {
          updateFields.push('address = ?');
          updateParams.push(address?.trim() || null);
        }
        if (phone !== undefined) {
          updateFields.push('phone = ?');
          updateParams.push(phone?.trim() || null);
        }
        if (email !== undefined) {
          updateFields.push('email = ?');
          updateParams.push(email?.trim() || null);
        }
        if (newPasswordHash) {
          updateFields.push('password_hash = ?');
          updateParams.push(newPasswordHash);
        }

        updateParams.push(sessionUser.id);
        const updateStmt = db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`);
        updateStmt.run(updateParams);
        updateStmt.free();

        // If member_id linked, update member's address / photo
        if (userRow.member_id) {
          const memFields: string[] = ['updated_at = ?'];
          const memParams: any[] = [now];
          if (photo_path) {
            memFields.push('photo_path = ?');
            memParams.push(photo_path);
          }
          if (address) {
            memFields.push('address = ?');
            memParams.push(address.trim());
          }
          if (phone) {
            memFields.push('father_phone = ?');
            memParams.push(phone.trim());
          }
          memParams.push(userRow.member_id);
          const memStmt = db.prepare(`UPDATE members SET ${memFields.join(', ')} WHERE id = ?`);
          memStmt.run(memParams);
          memStmt.free();
        }

        saveDb();
        logAudit(sessionUser.username, 'PROFILE_UPDATE', userRow.member_id, userRow.full_name, 'تعديل بيانات الحساب الشخصي مباشرة (Admin)');

        const refreshed = queryOne(
          db,
          'SELECT id, username, role, full_name, member_id, tribe_id, phone, email, address, photo_path, theme_preference FROM users WHERE id = ?',
          [sessionUser.id]
        );
        return res.json({
          success: true,
          auto_approved: true,
          message: 'تم تحديث بيانات حسابك بنجاح',
          user: refreshed,
        });
      }

      // If user is non-admin (LEADER, DATA_ENTRY):
      // Check existing pending request
      const existingPending = queryOne(
        db,
        "SELECT id FROM user_profile_requests WHERE user_id = ? AND status = 'PENDING'",
        [sessionUser.id]
      );

      const reqPhoto = photo_path !== undefined ? photo_path : (userRow.photo_path || null);
      const reqAddress = address !== undefined ? address.trim() : (userRow.address || null);
      const reqPhone = phone !== undefined ? phone.trim() : (userRow.phone || null);
      const reqEmail = email !== undefined ? email.trim() : (userRow.email || null);

      if (existingPending) {
        const updateStmt = db.prepare(`
          UPDATE user_profile_requests SET
            requested_photo_path = ?,
            requested_address = ?,
            requested_phone = ?,
            requested_email = ?,
            requested_password_hash = COALESCE(?, requested_password_hash),
            updated_at = ?
          WHERE id = ?
        `);
        updateStmt.run([
          reqPhoto,
          reqAddress,
          reqPhone,
          reqEmail,
          newPasswordHash,
          now,
          existingPending.id,
        ]);
        updateStmt.free();
      } else {
        const insertStmt = db.prepare(`
          INSERT INTO user_profile_requests (
            user_id,
            requested_photo_path,
            requested_address,
            requested_phone,
            requested_email,
            requested_password_hash,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
        `);
        insertStmt.run([
          sessionUser.id,
          reqPhoto,
          reqAddress,
          reqPhone,
          reqEmail,
          newPasswordHash,
          now,
          now,
        ]);
        insertStmt.free();
      }

      saveDb();
      logAudit(
        sessionUser.username,
        'PROFILE_REQUEST_CREATE',
        userRow.member_id,
        userRow.full_name,
        `إرسال طلب تعديل الحساب (هاتف: ${reqPhone || 'بدون تغيير'}, بريد: ${reqEmail || 'بدون تغيير'}) بانتظار موافقة الإدارة`
      );

      res.json({
        success: true,
        auto_approved: false,
        message: 'تم إرسال طلب التعديل بنجاح، وهو الآن بانتظار موافقة المدير أو الأدمن.',
      });
    } catch (err: any) {
      console.error('Submit profile request error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء إرسال طلب تعديل الملف الشخصي' });
    }
  });

  // Cancel pending profile request
  app.delete('/api/user/profile/request', authenticate, async (req: Request, res: Response) => {
    try {
      const sessionUser = (req as any).user as SessionUser;
      const db = await getDb();
      const stmt = db.prepare("DELETE FROM user_profile_requests WHERE user_id = ? AND status = 'PENDING'");
      stmt.run([sessionUser.id]);
      stmt.free();
      saveDb();
      res.json({ success: true, message: 'تم إلغاء طلب التعديل بنجاح' });
    } catch (err: any) {
      console.error('Cancel profile request error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء إلغاء الطلب' });
    }
  });

  // --- ADMIN PROFILE REQUESTS REVIEW ENDPOINTS ---

  // Get all profile update requests
  app.get('/api/admin/profile-requests', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      ensureUsersTableColumns(db);
      const rows = queryAll(
        db,
        `
        SELECT 
          r.id,
          r.user_id,
          r.requested_photo_path,
          r.requested_address,
          r.requested_phone,
          r.requested_email,
          CASE WHEN r.requested_password_hash IS NOT NULL AND r.requested_password_hash != '' THEN 1 ELSE 0 END as has_new_password,
          r.status,
          r.admin_notes,
          r.created_at,
          r.updated_at,
          r.reviewed_at,
          r.reviewed_by,
          u.username,
          u.full_name,
          u.role,
          u.photo_path as current_photo_path,
          u.address as current_address,
          u.phone as current_phone,
          u.email as current_email,
          t.name as tribe_name
        FROM user_profile_requests r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN tribes t ON u.tribe_id = t.id
        ORDER BY 
          CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END,
          r.id DESC
      `
      );
      res.json({ requests: rows });
    } catch (err: any) {
      console.error('Get admin profile requests error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء جلب طلبات تعديل الحسابات' });
    }
  });

  // Count pending profile requests
  app.get('/api/admin/profile-requests/count', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const row = queryOne(db, "SELECT COUNT(*) as count FROM user_profile_requests WHERE status = 'PENDING'");
      res.json({ count: row?.count || 0 });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ في جلب عدد الطلبات المعلقة' });
    }
  });

  // Approve profile request
  app.post('/api/admin/profile-requests/:id/approve', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).user as SessionUser;
      const requestId = parseInt(req.params.id, 10);
      const db = await getDb();
      ensureUsersTableColumns(db);

      const request = queryOne(db, 'SELECT * FROM user_profile_requests WHERE id = ?', [requestId]);
      if (!request) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }
      if (request.status !== 'PENDING') {
        return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً' });
      }

      const targetUser = queryOne(db, 'SELECT * FROM users WHERE id = ?', [request.user_id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'المستخدم صاحب الطلب غير موجود' });
      }

      const now = new Date().toISOString();

      // Apply changes to users table
      const updateFields: string[] = ['updated_at = ?'];
      const updateParams: any[] = [now];

      if (request.requested_photo_path !== null && request.requested_photo_path !== undefined) {
        updateFields.push('photo_path = ?');
        updateParams.push(request.requested_photo_path);
      }
      if (request.requested_address !== null && request.requested_address !== undefined) {
        updateFields.push('address = ?');
        updateParams.push(request.requested_address);
      }
      if (request.requested_phone !== null && request.requested_phone !== undefined) {
        updateFields.push('phone = ?');
        updateParams.push(request.requested_phone);
      }
      if (request.requested_email !== null && request.requested_email !== undefined) {
        updateFields.push('email = ?');
        updateParams.push(request.requested_email);
      }
      if (request.requested_password_hash) {
        updateFields.push('password_hash = ?');
        updateParams.push(request.requested_password_hash);
      }

      updateParams.push(targetUser.id);
      const updateStmt = db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`);
      updateStmt.run(updateParams);
      updateStmt.free();

      // If linked to member, update member's record as well
      if (targetUser.member_id) {
        const memFields: string[] = ['updated_at = ?'];
        const memParams: any[] = [now];
        if (request.requested_photo_path) {
          memFields.push('photo_path = ?');
          memParams.push(request.requested_photo_path);
        }
        if (request.requested_address) {
          memFields.push('address = ?');
          memParams.push(request.requested_address);
        }
        if (request.requested_phone) {
          memFields.push('father_phone = ?');
          memParams.push(request.requested_phone);
        }
        memParams.push(targetUser.member_id);
        const memStmt = db.prepare(`UPDATE members SET ${memFields.join(', ')} WHERE id = ?`);
        memStmt.run(memParams);
        memStmt.free();
      }

      // Mark request as APPROVED
      const statusStmt = db.prepare(`
        UPDATE user_profile_requests SET
          status = 'APPROVED',
          reviewed_by = ?,
          reviewed_at = ?,
          updated_at = ?
        WHERE id = ?
      `);
      statusStmt.run([adminUser.username, now, now, requestId]);
      statusStmt.free();

      saveDb();
      logAudit(
        adminUser.username,
        'PROFILE_REQUEST_APPROVE',
        targetUser.member_id,
        targetUser.full_name,
        `الموافقة على تعديل بيانات حساب المستخدم: ${targetUser.username} (${targetUser.full_name || ''})`
      );

      res.json({ success: true, message: 'تمت الموافقة على تعديلات الحساب وتطبيقها بنجاح' });
    } catch (err: any) {
      console.error('Approve profile request error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء الموافقة على الطلب' });
    }
  });

  // Reject profile request
  app.post('/api/admin/profile-requests/:id/reject', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminUser = (req as any).user as SessionUser;
      const requestId = parseInt(req.params.id, 10);
      const notes = (req.body.notes || '').trim();
      const db = await getDb();

      const request = queryOne(db, 'SELECT * FROM user_profile_requests WHERE id = ?', [requestId]);
      if (!request) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }
      if (request.status !== 'PENDING') {
        return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً' });
      }

      const targetUser = queryOne(db, 'SELECT * FROM users WHERE id = ?', [request.user_id]);
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        UPDATE user_profile_requests SET
          status = 'REJECTED',
          admin_notes = ?,
          reviewed_by = ?,
          reviewed_at = ?,
          updated_at = ?
        WHERE id = ?
      `);
      stmt.run([notes || 'تم رفض الطلب من قبل الإدارة', adminUser.username, now, now, requestId]);
      stmt.free();

      saveDb();
      logAudit(
        adminUser.username,
        'PROFILE_REQUEST_REJECT',
        targetUser?.member_id || null,
        targetUser?.full_name || null,
        `رفض طلب تعديل حساب المستخدم: ${targetUser?.username || ''} - السبب: ${notes || 'غير محدد'}`
      );

      res.json({ success: true, message: 'تم رفض طلب تعديل الحساب' });
    } catch (err: any) {
      console.error('Reject profile request error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء رفض الطلب' });
    }
  });

  // Helper to compute birthdays for current week, next 7 days, or current month
  function getMembersBirthdays(db: any, period: 'week' | 'next7' | 'month' = 'week'): any[] {
    const members = queryAll(
      db,
      `SELECT m.*, t.name as tribe_name 
       FROM members m 
       LEFT JOIN tribes t ON m.tribe_id = t.id 
       WHERE m.birth_date IS NOT NULL AND TRIM(m.birth_date) != ''`
    );

    const now = new Date();
    const currentYear = now.getFullYear();

    // In Egyptian scout calendar, week starts on Saturday (السبت)
    const day = now.getDay();
    const daysSinceSaturday = (day + 1) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceSaturday, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59, 999);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const next7End = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);

    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const monthNamesArabic = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const results: any[] = [];

    for (const m of members) {
      if (!m.birth_date) continue;
      const parts = String(m.birth_date).trim().split('-');
      let bMonth = -1;
      let bDay = -1;
      let birthYear = 0;

      if (parts.length === 3) {
        birthYear = parseInt(parts[0], 10);
        bMonth = parseInt(parts[1], 10) - 1;
        bDay = parseInt(parts[2], 10);
      } else {
        const parsed = new Date(m.birth_date);
        if (!isNaN(parsed.getTime())) {
          birthYear = parsed.getFullYear();
          bMonth = parsed.getMonth();
          bDay = parsed.getDate();
        }
      }

      if (bMonth < 0 || bDay < 0 || isNaN(birthYear)) continue;

      for (const yr of [currentYear, currentYear - 1, currentYear + 1]) {
        const candidateDate = new Date(yr, bMonth, bDay, 12, 0, 0);
        let matches = false;

        if (period === 'week') {
          matches = candidateDate >= startOfWeek && candidateDate <= endOfWeek;
        } else if (period === 'next7') {
          matches = candidateDate >= todayStart && candidateDate <= next7End;
        } else if (period === 'month') {
          matches = candidateDate.getFullYear() === currentYear && candidateDate.getMonth() === now.getMonth();
        }

        if (matches) {
          const turningAge = Math.max(1, yr - birthYear);
          const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
          const diffDays = Math.round((candidateDate.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));

          results.push({
            ...m,
            birthdayDate: candidateDate.toISOString(),
            dayOfWeekName: dayNames[candidateDate.getDay()],
            formattedDate: `${bDay} ${monthNamesArabic[bMonth]}`,
            turningAge,
            isToday: diffDays === 0,
            daysRemaining: diffDays,
          });
          break;
        }
      }
    }

    results.sort((a, b) => {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      if (a.daysRemaining >= 0 && b.daysRemaining < 0) return -1;
      if (a.daysRemaining < 0 && b.daysRemaining >= 0) return 1;
      return a.daysRemaining - b.daysRemaining;
    });

    return results;
  }

  // --- 2. DASHBOARD METRICS ---
  app.get('/api/dashboard', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const totalMembers = queryOne(db, 'SELECT COUNT(*) as count FROM members')?.count || 0;
      const totalFemales = queryOne(db, "SELECT COUNT(*) as count FROM members WHERE member_type = 'عضوة'")?.count || 0;
      const totalLeaders = queryOne(db, "SELECT COUNT(*) as count FROM members WHERE member_type = 'قائد'")?.count || 0;
      const totalTribes = queryOne(db, 'SELECT COUNT(*) as count FROM tribes')?.count || 0;

      const primaryCount = queryOne(db, "SELECT COUNT(*) as count FROM members WHERE school_stage LIKE '%ابتدائي%'")?.count || 0;
      const prepCount = queryOne(db, "SELECT COUNT(*) as count FROM members WHERE school_stage LIKE '%إعدادي%'")?.count || 0;
      const secCount = queryOne(db, "SELECT COUNT(*) as count FROM members WHERE school_stage LIKE '%ثانوي%'")?.count || 0;
      const otherCount = queryOne(
        db,
        "SELECT COUNT(*) as count FROM members WHERE school_stage NOT LIKE '%ابتدائي%' AND school_stage NOT LIKE '%إعدادي%' AND school_stage NOT LIKE '%ثانوي%'"
      )?.count || 0;

      const stageCounts = {
        'ابتدائي': primaryCount,
        'إعدادي': prepCount,
        'ثانوي': secCount,
        'جامعة': 0,
        'أخرى': otherCount,
      };

      const medicalConditionsCount = queryOne(
        db,
        "SELECT COUNT(*) as count FROM members WHERE medical_condition IS NOT NULL AND TRIM(medical_condition) != ''"
      )?.count || 0;

      // Tribes Breakdown
      const tribesRows = queryAll(
        db,
        `SELECT t.id, t.name, COUNT(m.id) as count 
         FROM tribes t 
         LEFT JOIN members m ON m.tribe_id = t.id 
         GROUP BY t.id, t.name 
         ORDER BY count DESC, t.name ASC`
      );

      const recentMembers = queryAll(
        db,
        `SELECT m.*, t.name as tribe_name 
         FROM members m 
         LEFT JOIN tribes t ON m.tribe_id = t.id 
         ORDER BY m.id DESC LIMIT 5`
      );

      // Weekly Birthdays (current week)
      const weeklyBirthdays = getMembersBirthdays(db, 'week');

      res.json({
        totalMembers,
        totalFemales,
        totalLeaders,
        totalTribes,
        tribesBreakdown: tribesRows,
        stages: stageCounts,
        medicalConditionsCount,
        recentMembers,
        weeklyBirthdays,
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'فشل استرجاع إحصائيات لوحة التحكم' });
    }
  });

  // Dedicated birthdays endpoint supporting periods: week, next7, month
  app.get('/api/birthdays', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const period = (req.query.period as 'week' | 'next7' | 'month') || 'week';
      const birthdays = getMembersBirthdays(db, period);
      res.json({ success: true, count: birthdays.length, period, birthdays });
    } catch (err) {
      console.error('Birthdays error:', err);
      res.status(500).json({ error: 'فشل جلب قائمة أعياد الميلاد' });
    }
  });

  // --- 3. MEMBERS CRUD ---
  // List & Search members (Extends search: Name, Member Code, National ID, Tribe Name)
  app.get('/api/members', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { q, stage, type, tribe_id } = req.query;

      let sql = `
        SELECT m.*, t.name as tribe_name, t.code as tribe_code
        FROM members m
        LEFT JOIN tribes t ON m.tribe_id = t.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (q && typeof q === 'string' && q.trim()) {
        const queryTerm = q.trim();
        sql += ` AND (
          m.student_name LIKE ? 
          OR m.national_id LIKE ? 
          OR m.member_code LIKE ? 
          OR t.name LIKE ?
          OR t.code LIKE ?
          OR m.mother_email LIKE ?
          OR m.leader_email LIKE ?
        )`;
        params.push(
          `%${queryTerm}%`,
          `%${queryTerm}%`,
          `%${queryTerm}%`,
          `%${queryTerm}%`,
          `%${queryTerm}%`,
          `%${queryTerm}%`,
          `%${queryTerm}%`
        );
      }

      if (stage && typeof stage === 'string' && stage !== 'ALL') {
        sql += ' AND m.school_stage = ?';
        params.push(stage);
      }

      if (type && typeof type === 'string' && type !== 'ALL') {
        sql += ' AND m.member_type = ?';
        params.push(type);
      }

      if (tribe_id && typeof tribe_id === 'string' && tribe_id !== 'ALL') {
        if (tribe_id === 'NONE') {
          sql += ' AND m.tribe_id IS NULL';
        } else {
          sql += ' AND m.tribe_id = ?';
          params.push(parseInt(tribe_id, 10));
        }
      }

      sql += ' ORDER BY m.id DESC';
      const members = queryAll(db, sql, params);
      res.json({ members });
    } catch (err) {
      console.error('Members fetch error:', err);
      res.status(500).json({ error: 'فشل تحميل قائمة الأعضاء' });
    }
  });

  // Get single member
  app.get('/api/members/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const id = parseInt(req.params.id, 10);
      const member = queryOne(
        db,
        `SELECT m.*, t.name as tribe_name, t.code as tribe_code 
         FROM members m 
         LEFT JOIN tribes t ON m.tribe_id = t.id 
         WHERE m.id = ?`,
        [id]
      );
      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }
      res.json({ member });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات العضو' });
    }
  });

  // Create member (Auto generates permanent unique Member Code starting from A250001)
  app.post('/api/members', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const {
        student_name,
        student_name_en,
        guardian_name,
        national_id,
        birth_date,
        school_stage,
        scout_join_year,
        medical_condition,
        father_phone,
        mother_phone,
        leader_phone,
        mother_email,
        leader_email,
        father_job,
        mother_name,
        mother_job,
        address,
        talents_skills,
        member_type,
        tribe_id,
        photo_path,
      } = req.body;

      // Validation
      if (!student_name || !student_name.trim()) {
        return res.status(400).json({ error: 'اسم الطالبة حقل إجباري' });
      }
      const safeGuardianName = (guardian_name && guardian_name.trim()) || student_name.trim();
      if (!national_id || !/^\d{14}$/.test(national_id.trim())) {
        return res.status(400).json({ error: 'الرقم القومي يجب أن يتكون من 14 رقماً بالضبط وبدون حروف' });
      }
      if (!birth_date || isNaN(Date.parse(birth_date))) {
        return res.status(400).json({ error: 'تاريخ الميلاد غير صحيح' });
      }
      const allowedStages = [
        ...SCHOOL_GRADES_LIST,
        'ابتدائي',
        'إعدادي',
        'ثانوي',
        'جامعة',
        'تمهيدي',
      ];
      if (!allowedStages.includes(school_stage)) {
        return res.status(400).json({ error: 'الصف الدراسي غير صالح' });
      }
      const joinYear = parseInt(scout_join_year, 10);
      if (isNaN(joinYear) || joinYear < 1980 || joinYear > 2050) {
        return res.status(400).json({ error: 'سنة الالتحاق بالكشافة غير صحيحة' });
      }
      if (!['عضوة', 'قائد'].includes(member_type)) {
        return res.status(400).json({ error: 'الصفة يجب أن تكون عضوة أو قائد' });
      }

      if (mother_email && String(mother_email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(mother_email).trim())) {
        return res.status(400).json({ error: 'البريد الإلكتروني للأم غير صالح' });
      }
      if (leader_email && String(leader_email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(leader_email).trim())) {
        return res.status(400).json({ error: 'البريد الإلكتروني للقائد غير صالح' });
      }

      const db = await getDb();

      // Check National ID Uniqueness
      const existing = queryOne(db, 'SELECT id, student_name FROM members WHERE national_id = ?', [national_id.trim()]);
      if (existing) {
        return res.status(400).json({
          error: `الرقم القومي (${national_id.trim()}) مسجل مسبقاً باسم: ${existing.student_name}`,
        });
      }

      // Generate Permanent Unique Member Code (A250001...)
      const memberCode = generateNextMemberCode(db);

      const parsedTribeId = tribe_id ? parseInt(tribe_id, 10) : null;
      const now = new Date().toISOString();

      const effectiveLeaderPhone = member_type === 'قائد' 
        ? ((leader_phone && leader_phone.trim()) || (father_phone && father_phone.trim()) || null)
        : null;
      const effectiveFatherPhone = member_type === 'قائد' 
        ? effectiveLeaderPhone 
        : (father_phone ? father_phone.trim() : null);
      const effectiveMotherPhone = member_type === 'قائد' 
        ? null 
        : (mother_phone ? mother_phone.trim() : null);

      const effectiveLeaderEmail = member_type === 'قائد'
        ? (leader_email && String(leader_email).trim() ? String(leader_email).trim() : null)
        : null;
      const effectiveMotherEmail = member_type === 'عضوة'
        ? (mother_email && String(mother_email).trim() ? String(mother_email).trim() : null)
        : null;

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          INSERT INTO members (
            member_code, student_name, student_name_en, guardian_name, national_id, birth_date, school_stage,
            scout_join_year, medical_condition, father_phone, mother_phone, leader_phone,
            mother_email, leader_email,
            father_job, mother_name, mother_job, address, talents_skills,
            member_type, tribe_id, photo_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run([
          memberCode,
          student_name.trim(),
          student_name_en ? student_name_en.trim() : null,
          safeGuardianName,
          national_id.trim(),
          birth_date.trim(),
          school_stage,
          joinYear,
          medical_condition ? medical_condition.trim() : null,
          effectiveFatherPhone,
          effectiveMotherPhone,
          effectiveLeaderPhone,
          effectiveMotherEmail,
          effectiveLeaderEmail,
          father_job ? father_job.trim() : null,
          mother_name ? mother_name.trim() : null,
          mother_job ? mother_job.trim() : null,
          address ? address.trim() : null,
          talents_skills ? talents_skills.trim() : null,
          member_type,
          parsedTribeId,
          photo_path ? photo_path.trim() : null,
          now,
          now,
        ]);
        stmt.free();

        const inserted = queryOne(db, 'SELECT last_insert_rowid() as id');
        const newMemberId = inserted?.id || null;

        db.run('COMMIT;');
        saveDb();

        // Audit Logs
        logAudit(
          user.username,
          'MEMBER_CODE_GENERATED',
          newMemberId,
          student_name.trim(),
          `توليد كود عضوية فريد: ${memberCode}`
        );

        logAudit(
          user.username,
          'ADD',
          newMemberId,
          student_name.trim(),
          `إضافة ${member_type}: ${student_name.trim()} (الكود: ${memberCode} - الرقم القومي: ${national_id.trim()})`
        );

        if (parsedTribeId) {
          const tribeObj = queryOne(db, 'SELECT name FROM tribes WHERE id = ?', [parsedTribeId]);
          logAudit(
            user.username,
            'ADD_MEMBER_TO_TRIBE',
            newMemberId,
            student_name.trim(),
            `إضافة العضو ${student_name.trim()} إلى عشيرة ${tribeObj?.name || parsedTribeId}`
          );
        }

        res.status(201).json({
          success: true,
          message: `تم إضافة العضو بنجاح وتعيين الكود: ${memberCode}`,
          id: newMemberId,
          member_code: memberCode,
        });
      } catch (insertErr) {
        safeRollback(db);
        throw insertErr;
      }
    } catch (err: any) {
      console.error('Add member error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء حفظ بيانات العضو. تم إلغاء العملية للحفاظ على البيانات.' });
    }
  });

  // Edit member (Member Code is permanent and preserved)
  app.put('/api/members/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const memberId = parseInt(req.params.id, 10);
      const {
        student_name,
        student_name_en,
        guardian_name,
        national_id,
        birth_date,
        school_stage,
        scout_join_year,
        medical_condition,
        father_phone,
        mother_phone,
        leader_phone,
        mother_email,
        leader_email,
        father_job,
        mother_name,
        mother_job,
        address,
        talents_skills,
        member_type,
        tribe_id,
        photo_path,
      } = req.body;

      if (!student_name || !student_name.trim()) {
        return res.status(400).json({ error: 'اسم الطالبة حقل إجباري' });
      }
      if (!national_id || !/^\d{14}$/.test(national_id.trim())) {
        return res.status(400).json({ error: 'الرقم القومي يجب أن يتكون من 14 رقماً بالضبط' });
      }
      if (!birth_date || isNaN(Date.parse(birth_date))) {
        return res.status(400).json({ error: 'تاريخ الميلاد غير صحيح' });
      }
      const allowedStages = [
        ...SCHOOL_GRADES_LIST,
        'ابتدائي',
        'إعدادي',
        'ثانوي',
        'جامعة',
        'تمهيدي',
      ];
      if (!allowedStages.includes(school_stage)) {
        return res.status(400).json({ error: 'الصف الدراسي غير صالح' });
      }
      const joinYear = parseInt(scout_join_year, 10);
      if (isNaN(joinYear) || joinYear < 1980 || joinYear > 2050) {
        return res.status(400).json({ error: 'سنة الالتحاق بالكشافة غير صحيحة' });
      }
      if (!['عضوة', 'قائد'].includes(member_type)) {
        return res.status(400).json({ error: 'الصفة يجب أن تكون عضوة أو قائد' });
      }

      if (mother_email && String(mother_email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(mother_email).trim())) {
        return res.status(400).json({ error: 'البريد الإلكتروني للأم غير صالح' });
      }
      if (leader_email && String(leader_email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(leader_email).trim())) {
        return res.status(400).json({ error: 'البريد الإلكتروني للقائد غير صالح' });
      }

      const db = await getDb();

      // Check existence
      const currentMember = queryOne(db, 'SELECT * FROM members WHERE id = ?', [memberId]);
      if (!currentMember) {
        return res.status(404).json({ error: 'العضو المراد تعديله غير موجود' });
      }

      const isUpgradingToLeader = currentMember.member_type === 'عضوة' && member_type === 'قائد';

      // Check National ID uniqueness excluding self
      const existing = queryOne(
        db,
        'SELECT id, student_name FROM members WHERE national_id = ? AND id != ?',
        [national_id.trim(), memberId]
      );
      if (existing) {
        return res.status(400).json({
          error: `الرقم القومي (${national_id.trim()}) مستخدم بالفعل بواسطة: ${existing.student_name}`,
        });
      }

      const parsedTribeId = tribe_id ? parseInt(tribe_id, 10) : null;
      const now = new Date().toISOString();

      const effectiveLeaderPhone = member_type === 'قائد'
        ? ((leader_phone && leader_phone.trim()) || (father_phone && father_phone.trim()) || currentMember.leader_phone || currentMember.father_phone || null)
        : null;

      if (isUpgradingToLeader && (!effectiveLeaderPhone || !effectiveLeaderPhone.trim())) {
        return res.status(400).json({ error: 'يرجى إدخال رقم تليفون القائد لإتمام الترقية' });
      }

      const effectiveFatherPhone = member_type === 'قائد'
        ? effectiveLeaderPhone
        : (father_phone ? father_phone.trim() : null);
      const effectiveMotherPhone = member_type === 'قائد'
        ? null
        : (mother_phone ? mother_phone.trim() : null);

      const effectiveLeaderEmail = member_type === 'قائد'
        ? (leader_email !== undefined ? (leader_email && String(leader_email).trim() ? String(leader_email).trim() : null) : (currentMember.leader_email || null))
        : null;
      const effectiveMotherEmail = member_type === 'عضوة'
        ? (mother_email !== undefined ? (mother_email && String(mother_email).trim() ? String(mother_email).trim() : null) : (currentMember.mother_email || null))
        : null;

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          UPDATE members SET
            student_name = ?,
            student_name_en = ?,
            guardian_name = ?,
            national_id = ?,
            birth_date = ?,
            school_stage = ?,
            scout_join_year = ?,
            medical_condition = ?,
            father_phone = ?,
            mother_phone = ?,
            leader_phone = ?,
            mother_email = ?,
            leader_email = ?,
            father_job = ?,
            mother_name = ?,
            mother_job = ?,
            address = ?,
            talents_skills = ?,
            member_type = ?,
            tribe_id = ?,
            photo_path = ?,
            updated_at = ?
          WHERE id = ?
        `);

        stmt.run([
          student_name.trim(),
          student_name_en ? student_name_en.trim() : null,
          (guardian_name && guardian_name.trim()) || currentMember.guardian_name || student_name.trim(),
          national_id.trim(),
          birth_date.trim(),
          school_stage,
          joinYear,
          medical_condition ? medical_condition.trim() : null,
          effectiveFatherPhone,
          effectiveMotherPhone,
          effectiveLeaderPhone,
          effectiveMotherEmail,
          effectiveLeaderEmail,
          father_job ? father_job.trim() : null,
          mother_name ? mother_name.trim() : null,
          mother_job ? mother_job.trim() : null,
          address ? address.trim() : null,
          talents_skills ? talents_skills.trim() : null,
          member_type,
          parsedTribeId,
          photo_path !== undefined ? (photo_path ? photo_path.trim() : null) : currentMember.photo_path,
          now,
          memberId,
        ]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        // Audit Logs
        if (isUpgradingToLeader) {
          logAudit(
            user.username,
            'PROMOTION',
            memberId,
            student_name.trim(),
            `ترقية العضوة إلى رتبة قائد (${student_name.trim()} - الكود: ${currentMember.member_code}) برقم تليفون: ${effectiveLeaderPhone || 'غير مسجل'}`
          );
        } else {
          logAudit(
            user.username,
            'EDIT',
            memberId,
            student_name.trim(),
            `تعديل بيانات ${member_type}: ${student_name.trim()} (الكود: ${currentMember.member_code})`
          );
        }

        if (currentMember.tribe_id !== parsedTribeId) {
          if (parsedTribeId) {
            const tribeObj = queryOne(db, 'SELECT name FROM tribes WHERE id = ?', [parsedTribeId]);
            logAudit(
              user.username,
              'ADD_MEMBER_TO_TRIBE',
              memberId,
              student_name.trim(),
              `تغيير عشيرة العضو إلى: ${tribeObj?.name || parsedTribeId}`
            );
          } else {
            logAudit(
              user.username,
              'REMOVE_MEMBER_FROM_TRIBE',
              memberId,
              student_name.trim(),
              `إزالة العضو من العشيرة السابقة`
            );
          }
        }

        if (photo_path && photo_path !== currentMember.photo_path) {
          logAudit(user.username, 'PHOTO_UPDATE', memberId, student_name.trim(), 'تحديث الصورة الشخصية للعضو');
        } else if (!photo_path && currentMember.photo_path) {
          logAudit(user.username, 'PHOTO_DELETE', memberId, student_name.trim(), 'حذف الصورة الشخصية للعضو');
        }

        res.json({ success: true, message: 'تم تحديث بيانات العضو بنجاح' });
      } catch (editErr) {
        safeRollback(db);
        throw editErr;
      }
    } catch (err) {
      console.error('Edit member error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء تعديل البيانات. تم التراجع عن التغييرات.' });
    }
  });

  // Promote member to leader (Requires Leader Phone)
  app.post('/api/members/:id/promote-to-leader', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const memberId = parseInt(req.params.id, 10);
      const { leader_phone, leader_email } = req.body;

      if (!leader_phone || !String(leader_phone).trim()) {
        return res.status(400).json({ error: 'يرجى إدخال رقم تليفون القائد لإتمام الترقية' });
      }

      const phoneCleaned = String(leader_phone).trim();
      if (!/^01[0125][0-9]{8}$/.test(phoneCleaned) && !/^[0-9]{7,15}$/.test(phoneCleaned)) {
        return res.status(400).json({ error: 'رقم تليفون القائد غير صالح (مثال: 01012345678)' });
      }

      const emailCleaned = leader_email && String(leader_email).trim() ? String(leader_email).trim() : null;
      if (emailCleaned && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCleaned)) {
        return res.status(400).json({ error: 'البريد الإلكتروني للقائد غير صالح' });
      }

      const db = await getDb();
      const currentMember = queryOne(db, 'SELECT * FROM members WHERE id = ?', [memberId]);
      if (!currentMember) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION;');
      try {
        db.run(`
          UPDATE members SET
            member_type = 'قائد',
            leader_phone = ?,
            father_phone = ?,
            leader_email = ?,
            mother_email = NULL,
            updated_at = ?
          WHERE id = ?
        `, [phoneCleaned, phoneCleaned, emailCleaned, now, memberId]);

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'PROMOTION',
          memberId,
          currentMember.student_name,
          `ترقية العضوة إلى رتبة قائد (${currentMember.student_name} - الكود: ${currentMember.member_code}) برقم تليفون: ${phoneCleaned}${emailCleaned ? ` وبريد: ${emailCleaned}` : ''}`
        );

        const updated = queryOne(
          db,
          `SELECT m.*, t.name as tribe_name, t.code as tribe_code 
           FROM members m 
           LEFT JOIN tribes t ON m.tribe_id = t.id 
           WHERE m.id = ?`,
          [memberId]
        );

        res.json({
          success: true,
          message: `تم ترقية العضوة (${currentMember.student_name}) إلى قائد بنجاح`,
          member: updated,
        });
      } catch (sqlErr) {
        safeRollback(db);
        throw sqlErr;
      }
    } catch (err) {
      console.error('Promote member error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء ترقية العضوة إلى قائد' });
    }
  });

  // Delete member (ADMIN ONLY - Member Code is never reused)
  app.delete('/api/members/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const memberId = parseInt(req.params.id, 10);
      const db = await getDb();

      const member = queryOne(db, 'SELECT * FROM members WHERE id = ?', [memberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو المراد حذفه غير موجود' });
      }

      db.run('BEGIN TRANSACTION;');
      try {
        // Clear leader/deputy in tribes if this member held the role
        db.run('UPDATE tribes SET leader_id = NULL WHERE leader_id = ?', [memberId]);
        db.run('UPDATE tribes SET deputy_id = NULL WHERE deputy_id = ?', [memberId]);

        const stmt = db.prepare('DELETE FROM members WHERE id = ?');
        stmt.run([memberId]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'DELETE',
          memberId,
          member.student_name,
          `حذف ${member.member_type}: ${member.student_name} - الكود: ${member.member_code} - الرقم القومي: ${member.national_id}`
        );

        res.json({ success: true, message: `تم حذف ${member.student_name} بنجاح` });
      } catch (delErr) {
        safeRollback(db);
        throw delErr;
      }
    } catch (err) {
      console.error('Delete member error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء حذف العضو' });
    }
  });

  // --- BULK OPERATIONS FOR MEMBERS (Admin Only) ---
  // 1. Bulk Delete Members
  app.post('/api/members/bulk-delete', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { member_ids } = req.body;
      if (!Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد الأعضاء المراد حذفهم' });
      }

      const db = await getDb();
      const validIds = member_ids.map((id: any) => parseInt(id, 10)).filter((n: number) => !isNaN(n) && n > 0);
      if (validIds.length === 0) {
        return res.status(400).json({ error: 'قائمة المعرفات غير صالحة' });
      }

      db.run('BEGIN TRANSACTION;');
      try {
        let deletedCount = 0;
        const deletedNames: string[] = [];

        for (const memberId of validIds) {
          const member = queryOne(db, 'SELECT id, student_name, member_code, national_id, member_type FROM members WHERE id = ?', [memberId]);
          if (!member) continue;

          // Clear leader/deputy in tribes if this member held the role
          db.run('UPDATE tribes SET leader_id = NULL WHERE leader_id = ?', [memberId]);
          db.run('UPDATE tribes SET deputy_id = NULL WHERE deputy_id = ?', [memberId]);

          // Clear member badges
          db.run('DELETE FROM member_badges WHERE member_id = ?', [memberId]);
          // Clear member wallet transactions
          db.run('DELETE FROM wallet_transactions WHERE member_id = ?', [memberId]);

          const stmt = db.prepare('DELETE FROM members WHERE id = ?');
          stmt.run([memberId]);
          stmt.free();

          deletedCount++;
          deletedNames.push(`${member.student_name} (${member.member_code})`);
        }

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'DELETE',
          null,
          null,
          `حذف جماعي لعدد ${deletedCount} من الأعضاء والقادة: ${deletedNames.slice(0, 10).join('، ')}${deletedNames.length > 10 ? ` و ${deletedNames.length - 10} آخرين` : ''}`
        );

        res.json({
          success: true,
          message: `تم حذف ${deletedCount} عضو/قائد بنجاح`,
          affected_count: deletedCount,
        });
      } catch (delErr) {
        safeRollback(db);
        throw delErr;
      }
    } catch (err: any) {
      console.error('Bulk delete members error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ الحذف الجماعي' });
    }
  });

  // 2. Bulk Transfer Members to a Tribe (or remove from tribe if tribe_id is null)
  app.post('/api/members/bulk-transfer-tribe', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { member_ids, tribe_id } = req.body;
      if (!Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد الأعضاء المراد نقلهم' });
      }

      const db = await getDb();
      const validIds = member_ids.map((id: any) => parseInt(id, 10)).filter((n: number) => !isNaN(n) && n > 0);
      if (validIds.length === 0) {
        return res.status(400).json({ error: 'قائمة المعرفات غير صالحة' });
      }

      let targetTribeName = 'بدون عشيرة (إلغاء التنسيب)';
      let targetTribeId: number | null = null;

      if (tribe_id !== null && tribe_id !== undefined && tribe_id !== '') {
        targetTribeId = parseInt(tribe_id, 10);
        const tribe = queryOne(db, 'SELECT id, name FROM tribes WHERE id = ?', [targetTribeId]);
        if (!tribe) {
          return res.status(404).json({ error: 'العشيرة المستهدفة غير موجودة' });
        }
        targetTribeName = tribe.name;
      }

      db.run('BEGIN TRANSACTION;');
      try {
        let updatedCount = 0;
        const now = new Date().toISOString();

        for (const memberId of validIds) {
          const member = queryOne(db, 'SELECT id, student_name, tribe_id FROM members WHERE id = ?', [memberId]);
          if (!member) continue;

          // If member is being removed from their old tribe and was a leader/deputy, clear it
          if (member.tribe_id && member.tribe_id !== targetTribeId) {
            db.run('UPDATE tribes SET leader_id = NULL WHERE id = ? AND leader_id = ?', [member.tribe_id, memberId]);
            db.run('UPDATE tribes SET deputy_id = NULL WHERE id = ? AND deputy_id = ?', [member.tribe_id, memberId]);
          }

          const stmt = db.prepare('UPDATE members SET tribe_id = ?, updated_at = ? WHERE id = ?');
          stmt.run([targetTribeId, now, memberId]);
          stmt.free();

          updatedCount++;
        }

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'BULK_TRANSFER_TRIBE',
          null,
          null,
          `نقل جماعي لعدد ${updatedCount} عضو إلى ${targetTribeName}`
        );

        res.json({
          success: true,
          message: `تم نقل ${updatedCount} عضو بنجاح إلى (${targetTribeName})`,
          affected_count: updatedCount,
        });
      } catch (transferErr) {
        safeRollback(db);
        throw transferErr;
      }
    } catch (err: any) {
      console.error('Bulk transfer tribe error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء النقل الجماعي للعشيرة' });
    }
  });

  // 3. Bulk Award Badge to Members
  app.post('/api/members/bulk-award-badge', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { member_ids, badge_id, awarded_at, reason, notes } = req.body;
      if (!Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد الأعضاء المراد منحهم الوسام' });
      }
      if (!badge_id) {
        return res.status(400).json({ error: 'يرجى تحديد الوسام المراد منحه' });
      }

      const db = await getDb();
      const badge = queryOne(db, 'SELECT id, name FROM badges WHERE id = ?', [badge_id]);
      if (!badge) {
        return res.status(404).json({ error: 'الوسام المطلوب غير موجود' });
      }

      const validIds = member_ids.map((id: any) => parseInt(id, 10)).filter((n: number) => !isNaN(n) && n > 0);
      const now = new Date().toISOString();
      const awardDate = awarded_at || now.split('T')[0];
      const awardedBy = user.full_name || user.username || 'مدير النظام';

      db.run('BEGIN TRANSACTION;');
      try {
        let awardedCount = 0;
        let skippedCount = 0;

        for (const memberId of validIds) {
          const existing = queryOne(db, 'SELECT id FROM member_badges WHERE member_id = ? AND badge_id = ?', [memberId, badge_id]);
          if (existing) {
            skippedCount++;
            continue;
          }

          const stmt = db.prepare(`
            INSERT INTO member_badges (member_id, badge_id, awarded_at, awarded_by, reason, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run([
            memberId,
            badge_id,
            awardDate,
            awardedBy,
            reason ? String(reason).trim() : 'منح جماعي للتميز والمشاركة الكشفية',
            notes ? String(notes).trim() : null,
            now,
            now,
          ]);
          stmt.free();
          awardedCount++;
        }

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'BULK_AWARD_BADGE',
          null,
          null,
          `منح وسام (${badge.name}) جماعياً لعدد ${awardedCount} عضو`
        );

        res.json({
          success: true,
          message: `تم منح وسام (${badge.name}) لعدد ${awardedCount} عضو بنجاح${skippedCount > 0 ? ` (تجاوز ${skippedCount} عضو حاصلين عليه مسبقاً)` : ''}`,
          affected_count: awardedCount,
        });
      } catch (awardErr) {
        safeRollback(db);
        throw awardErr;
      }
    } catch (err: any) {
      console.error('Bulk award badge error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء منح الوسام جماعياً' });
    }
  });

  // 4. Bulk Export ID Cards directly to Server/Client Disk (C:\scoutsystem\scoutphoto or local fallback)
  app.post('/api/members/bulk-export-cards', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { cards, target_directory } = req.body;

      if (!Array.isArray(cards) || cards.length === 0) {
        return res.status(400).json({ error: 'لا توجد بطاقات للتصدير' });
      }

      // Default requested path: C:\scoutsystem\scoutphoto
      const preferredDir = target_directory && typeof target_directory === 'string' && target_directory.trim()
        ? target_directory.trim()
        : (process.platform === 'win32' ? 'C:\\scoutsystem\\scoutphoto' : path.join(PROJECT_ROOT, 'data', 'scoutphoto'));

      let resolvedDir = preferredDir;
      try {
        if (!fs.existsSync(resolvedDir)) {
          fs.mkdirSync(resolvedDir, { recursive: true });
        }
      } catch (mkdirErr) {
        // Fallback to project root / data / scoutphoto if drive C:\ cannot be created (e.g. running in sandbox/linux or restricted permissions)
        console.warn(`Could not create preferred directory ${preferredDir}, falling back to local photos:`, mkdirErr);
        resolvedDir = path.join(PROJECT_ROOT, 'data', 'scoutphoto');
        if (!fs.existsSync(resolvedDir)) {
          fs.mkdirSync(resolvedDir, { recursive: true });
        }
      }

      const savedFiles: string[] = [];

      for (const card of cards) {
        const { student_name, member_code, front_base64, back_base64 } = card;
        const cleanName = (student_name || 'عضو').replace(/[/\\?%*:|"<>]/g, '_').trim();
        const cleanCode = (member_code || 'CODE').replace(/[/\\?%*:|"<>]/g, '_').trim();

        if (front_base64 && typeof front_base64 === 'string') {
          const base64Data = front_base64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `${cleanCode}_${cleanName}_وجه.png`;
          const filePath = path.join(resolvedDir, fileName);
          fs.writeFileSync(filePath, buffer);
          savedFiles.push(fileName);
        }

        if (back_base64 && typeof back_base64 === 'string') {
          const base64Data = back_base64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `${cleanCode}_${cleanName}_ظهر.png`;
          const filePath = path.join(resolvedDir, fileName);
          fs.writeFileSync(filePath, buffer);
          savedFiles.push(fileName);
        }
      }

      logAudit(
        user.username,
        'BULK_EXPORT_CARDS',
        null,
        null,
        `تصدير بطاقات كارنيه لعدد ${cards.length} عضو (${savedFiles.length} ملف PNG) إلى المسار: ${resolvedDir}`
      );

      res.json({
        success: true,
        message: `تم تصدير ${savedFiles.length} بطاقة كارنيه PNG بنجاح إلى المجلد (${resolvedDir})`,
        affected_count: cards.length,
        exported_paths: savedFiles,
        target_directory: resolvedDir,
      });
    } catch (err: any) {
      console.error('Bulk export cards error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء تصدير بطاقات الكارنيه' });
    }
  });

  // --- 4. TRIBES (العشيرة) MODULE ---
  // List Tribes with Leader, Deputy and Member Count
  app.get('/api/tribes', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const sql = `
        SELECT 
          t.*,
          l.student_name as leader_name,
          l.member_code as leader_code,
          d.student_name as deputy_name,
          d.member_code as deputy_code,
          (SELECT COUNT(*) FROM members WHERE tribe_id = t.id) as member_count
        FROM tribes t
        LEFT JOIN members l ON t.leader_id = l.id
        LEFT JOIN members d ON t.deputy_id = d.id
        ORDER BY t.name ASC
      `;
      const tribes = queryAll(db, sql);
      res.json({ tribes });
    } catch (err) {
      console.error('Tribes fetch error:', err);
      res.status(500).json({ error: 'فشل تحميل قائمة العشائر' });
    }
  });

  // Get single Tribe with assigned members
  app.get('/api/tribes/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const tribeId = parseInt(req.params.id, 10);
      const tribe = queryOne(
        db,
        `SELECT 
          t.*,
          l.student_name as leader_name,
          l.member_code as leader_code,
          d.student_name as deputy_name,
          d.member_code as deputy_code,
          (SELECT COUNT(*) FROM members WHERE tribe_id = t.id) as member_count
        FROM tribes t
        LEFT JOIN members l ON t.leader_id = l.id
        LEFT JOIN members d ON t.deputy_id = d.id
        WHERE t.id = ?`,
        [tribeId]
      );

      if (!tribe) {
        return res.status(404).json({ error: 'العشيرة غير موجودة' });
      }

      const members = queryAll(db, 'SELECT * FROM members WHERE tribe_id = ? ORDER BY student_name ASC', [tribeId]);
      tribe.members = members;

      res.json({ tribe });
    } catch (err) {
      res.status(500).json({ error: 'فشل جلب تفاصيل العشيرة' });
    }
  });

  // Create Tribe (ADMIN ONLY)
  app.post('/api/tribes', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { name, code, leader_id, deputy_id, description } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'اسم العشيرة حقل إجباري' });
      }

      const db = await getDb();

      // Check name uniqueness
      const existingName = queryOne(db, 'SELECT id FROM tribes WHERE name = ?', [name.trim()]);
      if (existingName) {
        return res.status(400).json({ error: 'اسم العشيرة مستخدم مسبقاً' });
      }

      // Generate or validate Tribe code
      let tribeCode = (code || '').trim();
      if (!tribeCode) {
        const count = queryOne(db, 'SELECT COUNT(*) as cnt FROM tribes')?.cnt || 0;
        tribeCode = `TR-${String(count + 1).padStart(3, '0')}`;
      }

      const existingCode = queryOne(db, 'SELECT id FROM tribes WHERE code = ?', [tribeCode]);
      if (existingCode) {
        tribeCode = `TR-${Date.now().toString().slice(-4)}`;
      }

      const parsedLeaderId = leader_id ? parseInt(leader_id, 10) : null;
      const parsedDeputyId = deputy_id ? parseInt(deputy_id, 10) : null;
      const now = new Date().toISOString();

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          INSERT INTO tribes (code, name, leader_id, deputy_id, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          tribeCode,
          name.trim(),
          parsedLeaderId,
          parsedDeputyId,
          description ? description.trim() : null,
          now,
          now,
        ]);
        stmt.free();

        const inserted = queryOne(db, 'SELECT last_insert_rowid() as id');
        const newTribeId = inserted?.id || null;

        // If leader/deputy was chosen, make sure their tribe_id points to this tribe
        if (parsedLeaderId && newTribeId) {
          db.run('UPDATE members SET tribe_id = ? WHERE id = ?', [newTribeId, parsedLeaderId]);
        }
        if (parsedDeputyId && newTribeId) {
          db.run('UPDATE members SET tribe_id = ? WHERE id = ?', [newTribeId, parsedDeputyId]);
        }

        db.run('COMMIT;');
        saveDb();

        logAudit(user.username, 'CREATE_TRIBE', null, null, `إنشاء عشيرة جديدة: ${name.trim()} (الكود: ${tribeCode})`);

        if (parsedLeaderId) {
          const lObj = queryOne(db, 'SELECT student_name FROM members WHERE id = ?', [parsedLeaderId]);
          logAudit(user.username, 'ASSIGN_TRIBE_LEADER', parsedLeaderId, lObj?.student_name, `تعيين قائد العشيرة: ${lObj?.student_name}`);
        }
        if (parsedDeputyId) {
          const dObj = queryOne(db, 'SELECT student_name FROM members WHERE id = ?', [parsedDeputyId]);
          logAudit(user.username, 'ASSIGN_TRIBE_DEPUTY', parsedDeputyId, dObj?.student_name, `تعيين نائب قائد العشيرة: ${dObj?.student_name}`);
        }

        res.status(201).json({
          success: true,
          message: 'تم إنشاء العشيرة بنجاح',
          id: newTribeId,
          code: tribeCode,
        });
      } catch (insertErr) {
        safeRollback(db);
        throw insertErr;
      }
    } catch (err) {
      console.error('Create tribe error:', err);
      res.status(500).json({ error: 'فشل إنشاء العشيرة' });
    }
  });

  // Edit Tribe (ADMIN ONLY)
  app.put('/api/tribes/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const tribeId = parseInt(req.params.id, 10);
      const { name, code, leader_id, deputy_id, description } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'اسم العشيرة حقل إجباري' });
      }

      const db = await getDb();
      const currentTribe = queryOne(db, 'SELECT * FROM tribes WHERE id = ?', [tribeId]);
      if (!currentTribe) {
        return res.status(404).json({ error: 'العشيرة غير موجودة' });
      }

      const existingName = queryOne(db, 'SELECT id FROM tribes WHERE name = ? AND id != ?', [name.trim(), tribeId]);
      if (existingName) {
        return res.status(400).json({ error: 'اسم العشيرة مستخدم مسبقاً' });
      }

      const parsedLeaderId = leader_id ? parseInt(leader_id, 10) : null;
      const parsedDeputyId = deputy_id ? parseInt(deputy_id, 10) : null;
      const now = new Date().toISOString();

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          UPDATE tribes SET
            name = ?,
            code = ?,
            leader_id = ?,
            deputy_id = ?,
            description = ?,
            updated_at = ?
          WHERE id = ?
        `);
        stmt.run([
          name.trim(),
          code ? code.trim() : currentTribe.code,
          parsedLeaderId,
          parsedDeputyId,
          description !== undefined ? (description ? description.trim() : null) : currentTribe.description,
          now,
          tribeId,
        ]);
        stmt.free();

        // Assign leader/deputy to tribe if they were selected
        if (parsedLeaderId) {
          db.run('UPDATE members SET tribe_id = ? WHERE id = ?', [tribeId, parsedLeaderId]);
        }
        if (parsedDeputyId) {
          db.run('UPDATE members SET tribe_id = ? WHERE id = ?', [tribeId, parsedDeputyId]);
        }

        db.run('COMMIT;');
        saveDb();

        logAudit(user.username, 'EDIT_TRIBE', null, null, `تعديل بيانات عشيرة: ${name.trim()}`);

        if (currentTribe.leader_id !== parsedLeaderId && parsedLeaderId) {
          const lObj = queryOne(db, 'SELECT student_name FROM members WHERE id = ?', [parsedLeaderId]);
          logAudit(user.username, 'ASSIGN_TRIBE_LEADER', parsedLeaderId, lObj?.student_name, `تعيين قائد العشيرة: ${lObj?.student_name}`);
        }
        if (currentTribe.deputy_id !== parsedDeputyId && parsedDeputyId) {
          const dObj = queryOne(db, 'SELECT student_name FROM members WHERE id = ?', [parsedDeputyId]);
          logAudit(user.username, 'ASSIGN_TRIBE_DEPUTY', parsedDeputyId, dObj?.student_name, `تعيين نائب قائد العشيرة: ${dObj?.student_name}`);
        }

        res.json({ success: true, message: 'تم تحديث بيانات العشيرة بنجاح' });
      } catch (updateErr) {
        safeRollback(db);
        throw updateErr;
      }
    } catch (err) {
      console.error('Edit tribe error:', err);
      res.status(500).json({ error: 'فشل تعديل بيانات العشيرة' });
    }
  });

  // Delete Tribe (ADMIN ONLY - Disassociates members without deleting them)
  app.delete('/api/tribes/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const tribeId = parseInt(req.params.id, 10);
      const db = await getDb();

      const tribe = queryOne(db, 'SELECT * FROM tribes WHERE id = ?', [tribeId]);
      if (!tribe) {
        return res.status(404).json({ error: 'العشيرة غير موجودة' });
      }

      db.run('BEGIN TRANSACTION;');
      try {
        // Disassociate members safely
        db.run('UPDATE members SET tribe_id = NULL WHERE tribe_id = ?', [tribeId]);

        const stmt = db.prepare('DELETE FROM tribes WHERE id = ?');
        stmt.run([tribeId]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(user.username, 'DELETE_TRIBE', null, null, `حذف عشيرة: ${tribe.name} (الكود: ${tribe.code})`);

        res.json({ success: true, message: `تم حذف عشيرة ${tribe.name} بنجاح` });
      } catch (delErr) {
        safeRollback(db);
        throw delErr;
      }
    } catch (err) {
      console.error('Delete tribe error:', err);
      res.status(500).json({ error: 'فشل حذف العشيرة' });
    }
  });

  // Add members to tribe (ADMIN ONLY)
  app.post('/api/tribes/:id/members', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const tribeId = parseInt(req.params.id, 10);
      const { member_ids } = req.body;

      if (!Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ error: 'يرجى اختيار عضو واحد على الأقل' });
      }

      const db = await getDb();
      const tribe = queryOne(db, 'SELECT * FROM tribes WHERE id = ?', [tribeId]);
      if (!tribe) {
        return res.status(404).json({ error: 'العشيرة غير موجودة' });
      }

      const addedMembersInfo: { id: number; name: string }[] = [];
      db.run('BEGIN TRANSACTION;');
      try {
        for (const mid of member_ids) {
          const memberId = parseInt(mid, 10);
          db.run('UPDATE members SET tribe_id = ? WHERE id = ?', [tribeId, memberId]);
          const mObj = queryOne(db, 'SELECT student_name FROM members WHERE id = ?', [memberId]);
          addedMembersInfo.push({ id: memberId, name: mObj?.student_name || '' });
        }

        db.run('COMMIT;');
        saveDb();

        for (const item of addedMembersInfo) {
          logAudit(user.username, 'ADD_MEMBER_TO_TRIBE', item.id, item.name, `إضافة العضو إلى عشيرة: ${tribe.name}`);
        }

        res.json({ success: true, message: 'تم إضافة الأعضاء للعشيرة بنجاح' });
      } catch (err) {
        safeRollback(db);
        throw err;
      }
    } catch (err) {
      res.status(500).json({ error: 'فشل إضافة الأعضاء للعشيرة' });
    }
  });

  // Remove member from tribe (ADMIN ONLY)
  app.delete('/api/tribes/:id/members/:memberId', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const tribeId = parseInt(req.params.id, 10);
      const memberId = parseInt(req.params.memberId, 10);
      const db = await getDb();

      const tribe = queryOne(db, 'SELECT * FROM tribes WHERE id = ?', [tribeId]);
      const member = queryOne(db, 'SELECT * FROM members WHERE id = ?', [memberId]);

      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      db.run('BEGIN TRANSACTION;');
      try {
        db.run('UPDATE members SET tribe_id = NULL WHERE id = ?', [memberId]);
        // If this member was leader/deputy, clear from tribe
        if (tribe && tribe.leader_id === memberId) {
          db.run('UPDATE tribes SET leader_id = NULL WHERE id = ?', [tribeId]);
        }
        if (tribe && tribe.deputy_id === memberId) {
          db.run('UPDATE tribes SET deputy_id = NULL WHERE id = ?', [tribeId]);
        }

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'REMOVE_MEMBER_FROM_TRIBE',
          memberId,
          member.student_name,
          `إزالة العضو من عشيرة: ${tribe?.name || tribeId}`
        );

        res.json({ success: true, message: 'تم إزالة العضو من العشيرة بنجاح' });
      } catch (err) {
        safeRollback(db);
        throw err;
      }
    } catch (err) {
      res.status(500).json({ error: 'فشل إزالة العضو من العشيرة' });
    }
  });

  // --- 4.2 TRIBE MEETINGS & ATTENDANCE (اجتماعات وسجل حضور العشيرة) ---

  // Helper for Arabic Day of Week name
  function getArabicDayName(dateStr: string): string {
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
        return dayNames[d.getDay()] || '';
      }
    } catch (e) {}
    return '';
  }

  // 1. Get all meetings for a tribe with attendance statistics
  app.get('/api/tribes/:id/meetings', authenticate, async (req: Request, res: Response) => {
    try {
      const tribeId = parseInt(req.params.id, 10);
      const db = await getDb();

      const tribe = queryOne(db, 'SELECT * FROM tribes WHERE id = ?', [tribeId]);
      if (!tribe) {
        return res.status(404).json({ error: 'العشيرة غير موجودة' });
      }

      const totalTribeMembers = (
        queryOne(db, 'SELECT COUNT(*) as count FROM members WHERE tribe_id = ?', [tribeId]) as any
      )?.count || 0;

      const meetings = queryAll(
        db,
        `SELECT m.*,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.meeting_id = m.id) as attendance_records_count,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.meeting_id = m.id AND ta.status = 'PRESENT') as present_count,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.meeting_id = m.id AND ta.status = 'ABSENT') as absent_count,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.meeting_id = m.id AND ta.status = 'EXCUSED') as excused_count,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.meeting_id = m.id AND ta.status = 'LATE') as late_count
         FROM tribe_meetings m
         WHERE m.tribe_id = ?
         ORDER BY m.meeting_date DESC, m.id DESC`,
        [tribeId]
      );

      const meetingsWithStats = meetings.map((m: any) => {
        const isRecorded = Number(m.attendance_records_count) > 0;
        const total = isRecorded ? Number(m.attendance_records_count) : totalTribeMembers;
        const attended = Number(m.present_count) + Number(m.late_count);
        const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;
        const dayName = getArabicDayName(m.meeting_date);

        return {
          ...m,
          day_name: dayName,
          total_members: total,
          attendance_rate: attendanceRate,
          is_recorded: isRecorded,
        };
      });

      res.json({
        success: true,
        tribe: { id: tribe.id, name: tribe.name, code: tribe.code, total_members: totalTribeMembers },
        meetings: meetingsWithStats,
      });
    } catch (err) {
      console.error('Error fetching tribe meetings:', err);
      res.status(500).json({ error: 'فشل جلب اجتماعات العشيرة' });
    }
  });

  // 2. Create meeting (single or bulk recurring Saturdays)
  app.post('/api/tribes/:id/meetings', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const tribeId = parseInt(req.params.id, 10);
      const db = await getDb();

      const tribe = queryOne(db, 'SELECT * FROM tribes WHERE id = ?', [tribeId]);
      if (!tribe) {
        return res.status(404).json({ error: 'العشيرة غير موجودة' });
      }

      const now = new Date().toISOString();
      const { bulk, dates, meeting_date, title, notes } = req.body;

      db.run('BEGIN TRANSACTION;');
      try {
        const createdMeetings: any[] = [];

        if (bulk && Array.isArray(dates) && dates.length > 0) {
          // Bulk create dates (e.g. all Saturdays in a month)
          for (const d of dates) {
            const dateStr = String(d).trim();
            if (!dateStr) continue;
            const dayName = getArabicDayName(dateStr);
            const meetingTitle = title ? String(title).trim() : `اجتماع ${dayName || 'السبت'} الأسبوعي`;

            // Check if meeting already exists on that date for this tribe
            const existing = queryOne(db, 'SELECT id FROM tribe_meetings WHERE tribe_id = ? AND meeting_date = ?', [
              tribeId,
              dateStr,
            ]);
            if (!existing) {
              const stmt = db.prepare(`
                INSERT INTO tribe_meetings (tribe_id, meeting_date, title, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `);
              stmt.run([tribeId, dateStr, meetingTitle, notes || null, now, now]);
              stmt.free();
            }
          }
        } else {
          // Single meeting creation
          if (!meeting_date || !String(meeting_date).trim()) {
            safeRollback(db);
            return res.status(400).json({ error: 'تاريخ الاجتماع إجباري' });
          }
          const dateStr = String(meeting_date).trim();
          const dayName = getArabicDayName(dateStr);
          const meetingTitle = title && String(title).trim() ? String(title).trim() : `اجتماع ${dayName || 'السبت'} الأسبوعي`;

          const stmt = db.prepare(`
            INSERT INTO tribe_meetings (tribe_id, meeting_date, title, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          stmt.run([tribeId, dateStr, meetingTitle, notes || null, now, now]);
          stmt.free();
        }

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'TRIBE_MEETING_CREATE',
          null,
          null,
          `إضافة اجتماعات لعشيرة: ${tribe.name} (${tribe.code})`
        );

        res.json({ success: true, message: 'تمت إضافة الاجتماع/الاجتماعات بنجاح' });
      } catch (err) {
        safeRollback(db);
        throw err;
      }
    } catch (err: any) {
      console.error('Error creating tribe meeting:', err);
      res.status(500).json({ error: err.message || 'فشل إضافة الاجتماع' });
    }
  });

  // 3. Delete meeting and its attendance records
  app.delete('/api/tribes/:id/meetings/:meetingId', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const tribeId = parseInt(req.params.id, 10);
      const meetingId = parseInt(req.params.meetingId, 10);
      const db = await getDb();

      const meeting = queryOne(db, 'SELECT * FROM tribe_meetings WHERE id = ? AND tribe_id = ?', [meetingId, tribeId]);
      if (!meeting) {
        return res.status(404).json({ error: 'الاجتماع غير موجود' });
      }

      db.run('BEGIN TRANSACTION;');
      try {
        db.run('DELETE FROM tribe_attendance WHERE meeting_id = ?', [meetingId]);
        db.run('DELETE FROM tribe_meetings WHERE id = ?', [meetingId]);
        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'TRIBE_MEETING_DELETE',
          null,
          null,
          `حذف اجتماع (${meeting.title} - ${meeting.meeting_date}) لعشيرة ID: ${tribeId}`
        );

        res.json({ success: true, message: 'تم حذف الاجتماع وسجل حضوره بنجاح' });
      } catch (err) {
        safeRollback(db);
        throw err;
      }
    } catch (err) {
      console.error('Error deleting tribe meeting:', err);
      res.status(500).json({ error: 'فشل حذف الاجتماع' });
    }
  });

  // 4. Get attendance sheet for a specific meeting
  app.get('/api/tribes/:id/meetings/:meetingId/attendance', authenticate, async (req: Request, res: Response) => {
    try {
      const tribeId = parseInt(req.params.id, 10);
      const meetingId = parseInt(req.params.meetingId, 10);
      const db = await getDb();

      const meeting = queryOne(db, 'SELECT * FROM tribe_meetings WHERE id = ? AND tribe_id = ?', [meetingId, tribeId]);
      if (!meeting) {
        return res.status(404).json({ error: 'الاجتماع غير موجود' });
      }

      const tribe = queryOne(db, 'SELECT * FROM tribes WHERE id = ?', [tribeId]);

      // Fetch all members of this tribe
      const members = queryAll(
        db,
        `SELECT m.id, m.member_code, m.student_name, m.photo_path, m.school_stage, m.mother_phone, m.father_phone
         FROM members m
         WHERE m.tribe_id = ?
         ORDER BY m.student_name ASC`,
        [tribeId]
      );

      // Fetch existing attendance records for this meeting
      const attendanceRows = queryAll(
        db,
        'SELECT member_id, status, notes FROM tribe_attendance WHERE meeting_id = ?',
        [meetingId]
      );
      const attendanceMap = new Map<number, { status: string; notes: string | null }>();
      attendanceRows.forEach((row: any) => {
        attendanceMap.set(row.member_id, { status: row.status, notes: row.notes });
      });

      const dayName = getArabicDayName(meeting.meeting_date);

      const records = members.map((m: any) => {
        const existing = attendanceMap.get(m.id);
        return {
          member_id: m.id,
          member_code: m.member_code,
          student_name: m.student_name,
          photo_path: m.photo_path,
          school_stage: m.school_stage,
          phone: m.mother_phone || m.father_phone,
          status: existing ? existing.status : 'PRESENT',
          notes: existing ? existing.notes || '' : '',
          is_saved: !!existing,
        };
      });

      const stats = {
        total: records.length,
        present: records.filter((r) => r.status === 'PRESENT').length,
        absent: records.filter((r) => r.status === 'ABSENT').length,
        excused: records.filter((r) => r.status === 'EXCUSED').length,
        late: records.filter((r) => r.status === 'LATE').length,
      };

      res.json({
        success: true,
        meeting: {
          ...meeting,
          day_name: dayName,
        },
        tribe,
        stats,
        is_recorded: attendanceRows.length > 0,
        records,
      });
    } catch (err) {
      console.error('Error fetching meeting attendance:', err);
      res.status(500).json({ error: 'فشل جلب كشف الحضور' });
    }
  });

  // 5. Save/Update attendance for a specific meeting
  app.post('/api/tribes/:id/meetings/:meetingId/attendance', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const tribeId = parseInt(req.params.id, 10);
      const meetingId = parseInt(req.params.meetingId, 10);
      const db = await getDb();

      const meeting = queryOne(db, 'SELECT * FROM tribe_meetings WHERE id = ? AND tribe_id = ?', [meetingId, tribeId]);
      if (!meeting) {
        return res.status(404).json({ error: 'الاجتماع غير موجود' });
      }

      const { records } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: 'بيانات الحضور غير صحيحة' });
      }

      const now = new Date().toISOString();

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          INSERT INTO tribe_attendance (meeting_id, tribe_id, member_id, status, notes, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(meeting_id, member_id) DO UPDATE SET
            status = excluded.status,
            notes = excluded.notes,
            recorded_at = excluded.recorded_at
        `);

        for (const item of records) {
          const memberId = parseInt(item.member_id, 10);
          const status = ['PRESENT', 'ABSENT', 'EXCUSED', 'LATE'].includes(item.status) ? item.status : 'PRESENT';
          const notes = item.notes ? String(item.notes).trim() : null;

          stmt.run([meetingId, tribeId, memberId, status, notes, now]);
        }
        stmt.free();

        // Update meeting updated_at
        db.run('UPDATE tribe_meetings SET updated_at = ? WHERE id = ?', [now, meetingId]);

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'TRIBE_ATTENDANCE_RECORD',
          null,
          null,
          `تسجيل حضور اجتماع: ${meeting.title} (${meeting.meeting_date}) - عدد السجلات: ${records.length}`
        );

        res.json({ success: true, message: 'تم حفظ وتحديث سجل الحضور بنجاح' });
      } catch (err) {
        safeRollback(db);
        throw err;
      }
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      res.status(500).json({ error: err.message || 'فشل حفظ سجل الحضور' });
    }
  });

  // 6. Cumulative attendance summary report for all members in a tribe
  app.get('/api/tribes/:id/attendance-summary', authenticate, async (req: Request, res: Response) => {
    try {
      const tribeId = parseInt(req.params.id, 10);
      const db = await getDb();

      const tribe = queryOne(db, 'SELECT * FROM tribes WHERE id = ?', [tribeId]);
      if (!tribe) {
        return res.status(404).json({ error: 'العشيرة غير موجودة' });
      }

      const totalMeetings = (
        queryOne(db, 'SELECT COUNT(*) as count FROM tribe_meetings WHERE tribe_id = ?', [tribeId]) as any
      )?.count || 0;

      const members = queryAll(
        db,
        `SELECT m.id, m.member_code, m.student_name, m.photo_path, m.school_stage,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.member_id = m.id AND ta.tribe_id = ? AND ta.status = 'PRESENT') as present_count,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.member_id = m.id AND ta.tribe_id = ? AND ta.status = 'ABSENT') as absent_count,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.member_id = m.id AND ta.tribe_id = ? AND ta.status = 'EXCUSED') as excused_count,
                (SELECT COUNT(*) FROM tribe_attendance ta WHERE ta.member_id = m.id AND ta.tribe_id = ? AND ta.status = 'LATE') as late_count
         FROM members m
         WHERE m.tribe_id = ?
         ORDER BY m.student_name ASC`,
        [tribeId, tribeId, tribeId, tribeId]
      );

      const summary = members.map((m: any) => {
        const attended = Number(m.present_count) + Number(m.late_count);
        const rate = totalMeetings > 0 ? Math.round((attended / totalMeetings) * 100) : 100;
        return {
          member_id: m.id,
          member_code: m.member_code,
          student_name: m.student_name,
          photo_path: m.photo_path,
          school_stage: m.school_stage,
          present_count: Number(m.present_count),
          absent_count: Number(m.absent_count),
          excused_count: Number(m.excused_count),
          late_count: Number(m.late_count),
          attended_count: attended,
          total_meetings: totalMeetings,
          attendance_rate: rate,
        };
      });

      res.json({
        success: true,
        tribe,
        total_meetings: totalMeetings,
        summary,
      });
    } catch (err) {
      console.error('Error fetching tribe attendance summary:', err);
      res.status(500).json({ error: 'فشل جلب ملخص حضور العشيرة' });
    }
  });

  // --- 4.5 ACTIVITIES & CAMPS (أنشطة ومعسكرات) ---
  // List all activities
  app.get('/api/activities', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const activities = queryAll(
        db,
        `SELECT a.*,
                (SELECT COUNT(*) FROM activity_participants ap WHERE ap.activity_id = a.id) as participant_count,
                (SELECT COALESCE(SUM(paid_amount), 0) FROM activity_participants ap WHERE ap.activity_id = a.id) as total_fees_collected
         FROM activities a
         ORDER BY a.id DESC`
      );

      res.json({ activities });
    } catch (err) {
      console.error('List activities error:', err);
      res.status(500).json({ error: 'فشل جلب قائمة الأنشطة والمعسكرات' });
    }
  });

  // Get single activity details with participants
  app.get('/api/activities/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id, 10);
      const db = await getDb();

      const activity = queryOne(
        db,
        `SELECT a.*,
                (SELECT COUNT(*) FROM activity_participants ap WHERE ap.activity_id = a.id) as participant_count,
                (SELECT COALESCE(SUM(paid_amount), 0) FROM activity_participants ap WHERE ap.activity_id = a.id) as total_fees_collected
         FROM activities a
         WHERE a.id = ?`,
        [activityId]
      );

      if (!activity) {
        return res.status(404).json({ error: 'النشاط أو المعسكر غير موجود' });
      }

      const participants = queryAll(
        db,
        `SELECT ap.*,
                m.member_code,
                m.student_name,
                m.student_name_en,
                m.guardian_name,
                m.national_id,
                m.school_stage,
                m.member_type,
                m.father_phone,
                m.mother_phone,
                m.photo_path,
                t.name as tribe_name
         FROM activity_participants ap
         JOIN members m ON ap.member_id = m.id
         LEFT JOIN tribes t ON m.tribe_id = t.id
         WHERE ap.activity_id = ?
         ORDER BY ap.registered_at DESC, m.student_name ASC`,
        [activityId]
      );

      activity.participants = participants;
      res.json({ activity });
    } catch (err) {
      console.error('Get activity error:', err);
      res.status(500).json({ error: 'فشل جلب تفاصيل النشاط أو المعسكر' });
    }
  });

  // Create new activity or camp (ADMIN or DATA_ENTRY)
  app.post('/api/activities', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const {
        name,
        type = 'معسكر',
        location,
        address = '',
        start_date = '',
        end_date = '',
        fee = 0,
        leader_name = '',
        deputy_name = '',
        max_participants = 0,
        description = '',
        status = 'مفتوح',
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'اسم النشاط أو المعسكر حقل إجباري' });
      }

      if (!location || !location.trim()) {
        return res.status(400).json({ error: 'المكان حقل إجباري' });
      }

      const parsedFee = parseFloat(fee) || 0;
      const parsedMax = parseInt(max_participants, 10) || 0;
      const validTypes = ['معسكر', 'نشاط'];
      const finalType = validTypes.includes(type) ? type : 'معسكر';
      const now = new Date().toISOString();

      const db = await getDb();
      const stmt = db.prepare(`
        INSERT INTO activities (
          type, name, location, address, start_date, end_date, fee,
          leader_name, deputy_name, max_participants, description, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        finalType,
        name.trim(),
        location.trim(),
        address ? address.trim() : null,
        start_date || null,
        end_date || null,
        parsedFee,
        leader_name ? leader_name.trim() : null,
        deputy_name ? deputy_name.trim() : null,
        parsedMax,
        description ? description.trim() : null,
        status || 'مفتوح',
        now,
        now,
      ]);
      stmt.free();
      saveDb();

      const inserted = queryOne(db, 'SELECT last_insert_rowid() as id');
      const newId = inserted?.id;

      logAudit(
        user.username,
        'ACTIVITY_CREATE',
        null,
        null,
        `إضافة ${finalType}: ${name.trim()} - المكان: ${location.trim()} - الاشتراك: ${parsedFee} ج.م`
      );

      res.status(201).json({
        success: true,
        id: newId,
        message: `تمت إضافة ${finalType} "${name.trim()}" بنجاح`,
      });
    } catch (err) {
      console.error('Create activity error:', err);
      res.status(500).json({ error: 'فشل إضافة النشاط أو المعسكر' });
    }
  });

  // Update activity or camp
  app.put('/api/activities/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const activityId = parseInt(req.params.id, 10);
      const {
        name,
        type = 'معسكر',
        location,
        address = '',
        start_date = '',
        end_date = '',
        fee = 0,
        leader_name = '',
        deputy_name = '',
        max_participants = 0,
        description = '',
        status = 'مفتوح',
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'اسم النشاط أو المعسكر حقل إجباري' });
      }

      if (!location || !location.trim()) {
        return res.status(400).json({ error: 'المكان حقل إجباري' });
      }

      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM activities WHERE id = ?', [activityId]);
      if (!existing) {
        return res.status(404).json({ error: 'النشاط أو المعسكر غير موجود' });
      }

      const parsedFee = parseFloat(fee) || 0;
      const parsedMax = parseInt(max_participants, 10) || 0;
      const validTypes = ['معسكر', 'نشاط'];
      const finalType = validTypes.includes(type) ? type : 'معسكر';
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        UPDATE activities SET
          type = ?, name = ?, location = ?, address = ?, start_date = ?, end_date = ?,
          fee = ?, leader_name = ?, deputy_name = ?, max_participants = ?,
          description = ?, status = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt.run([
        finalType,
        name.trim(),
        location.trim(),
        address ? address.trim() : null,
        start_date || null,
        end_date || null,
        parsedFee,
        leader_name ? leader_name.trim() : null,
        deputy_name ? deputy_name.trim() : null,
        parsedMax,
        description ? description.trim() : null,
        status || 'مفتوح',
        now,
        activityId,
      ]);
      stmt.free();
      saveDb();

      logAudit(
        user.username,
        'ACTIVITY_UPDATE',
        null,
        null,
        `تعديل بيانات ${finalType}: ${name.trim()} (ID: ${activityId})`
      );

      res.json({ success: true, message: 'تم حفظ وتحديث بيانات النشاط/المعسكر بنجاح' });
    } catch (err) {
      console.error('Update activity error:', err);
      res.status(500).json({ error: 'فشل تعديل بيانات النشاط أو المعسكر' });
    }
  });

  // Delete activity or camp (ADMIN ONLY)
  app.delete('/api/activities/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const activityId = parseInt(req.params.id, 10);
      const db = await getDb();

      const existing = queryOne(db, 'SELECT * FROM activities WHERE id = ?', [activityId]);
      if (!existing) {
        return res.status(404).json({ error: 'النشاط أو المعسكر غير موجود' });
      }

      const stmt1 = db.prepare('DELETE FROM activity_participants WHERE activity_id = ?');
      stmt1.run([activityId]);
      stmt1.free();

      const stmt2 = db.prepare('DELETE FROM activities WHERE id = ?');
      stmt2.run([activityId]);
      stmt2.free();

      saveDb();

      logAudit(
        user.username,
        'ACTIVITY_DELETE',
        null,
        null,
        `حذف ${existing.type}: ${existing.name} (ID: ${activityId}) مع جميع اشتراكاته`
      );

      res.json({ success: true, message: `تم حذف ${existing.type} "${existing.name}" بنجاح` });
    } catch (err) {
      console.error('Delete activity error:', err);
      res.status(500).json({ error: 'فشل حذف النشاط أو المعسكر' });
    }
  });

  // Add participant(s) to activity
  app.post('/api/activities/:id/participants', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const activityId = parseInt(req.params.id, 10);
      const {
        member_ids,
        member_id,
        payment_status = 'مدفوع',
        paid_amount,
        notes = '',
      } = req.body;

      const db = await getDb();
      const activity = queryOne(db, 'SELECT * FROM activities WHERE id = ?', [activityId]);
      if (!activity) {
        return res.status(404).json({ error: 'النشاط أو المعسكر غير موجود' });
      }

      const targetMemberIds: number[] = Array.isArray(member_ids) && member_ids.length > 0
        ? member_ids.map((id: any) => parseInt(id, 10)).filter((n: number) => !isNaN(n))
        : member_id ? [parseInt(member_id, 10)] : [];

      if (targetMemberIds.length === 0) {
        return res.status(400).json({ error: 'يرجى اختيار عضو واحد على الأقل للاشتراك' });
      }

      const defaultAmount = paid_amount !== undefined && paid_amount !== null && paid_amount !== ''
        ? parseFloat(paid_amount)
        : payment_status === 'مدفوع'
        ? Number(activity.fee)
        : 0;

      const now = new Date().toISOString();
      let addedCount = 0;
      let skippedCount = 0;
      const addedMembersList: { id: number; name: string }[] = [];

      for (const mId of targetMemberIds) {
        const member = queryOne(db, 'SELECT id, student_name FROM members WHERE id = ?', [mId]);
        if (!member) {
          skippedCount++;
          continue;
        }

        const existingPart = queryOne(
          db,
          'SELECT id FROM activity_participants WHERE activity_id = ? AND member_id = ?',
          [activityId, mId]
        );

        if (existingPart) {
          skippedCount++;
          continue;
        }

        const stmt = db.prepare(`
          INSERT INTO activity_participants (
            activity_id, member_id, payment_status, paid_amount, notes, registered_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run([
          activityId,
          mId,
          payment_status,
          defaultAmount,
          notes ? notes.trim() : null,
          now,
        ]);
        stmt.free();
        addedCount++;
        addedMembersList.push({ id: mId, name: member.student_name });
      }

      saveDb();

      // Log audit outside database write cycle
      for (const item of addedMembersList) {
        try {
          logAudit(
            user.username,
            'ACTIVITY_PARTICIPANT_ADD',
            item.id,
            item.name,
            `تسجيل اشتراك في ${activity.type}: ${activity.name} (حالة الدفع: ${payment_status} - ${defaultAmount} ج.م)`
          );
        } catch (auditErr) {
          console.error('Audit logging error for participant:', auditErr);
        }
      }

      res.json({
        success: true,
        addedCount,
        skippedCount,
        message:
          addedCount === 1
            ? 'تم تسجيل اشتراك العضو بنجاح'
            : `تم تسجيل اشتراك (${addedCount}) عضو بنجاح في ${activity.type}`,
      });
    } catch (err) {
      console.error('Add participants error:', err);
      res.status(500).json({ error: 'فشل إضافة المشتركين للنشاط/المعسكر' });
    }
  });

  // Update participant status / payment
  app.put('/api/activities/:id/participants/:participantId', authenticate, async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id, 10);
      const participantId = parseInt(req.params.participantId, 10);
      const { payment_status = 'مدفوع', paid_amount = 0, notes = '' } = req.body;

      const db = await getDb();
      const existing = queryOne(
        db,
        'SELECT * FROM activity_participants WHERE id = ? AND activity_id = ?',
        [participantId, activityId]
      );

      if (!existing) {
        return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
      }

      const stmt = db.prepare(`
        UPDATE activity_participants SET
          payment_status = ?, paid_amount = ?, notes = ?
        WHERE id = ?
      `);

      stmt.run([
        payment_status,
        parseFloat(paid_amount) || 0,
        notes ? notes.trim() : null,
        participantId,
      ]);
      stmt.free();
      saveDb();

      res.json({ success: true, message: 'تم تحديث حالة اشتراك العضو بنجاح' });
    } catch (err) {
      console.error('Update participant error:', err);
      res.status(500).json({ error: 'فشل تحديث بيانات المشترك' });
    }
  });

  // Remove participant from activity
  app.delete('/api/activities/:id/participants/:participantId', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const activityId = parseInt(req.params.id, 10);
      const participantId = parseInt(req.params.participantId, 10);

      const db = await getDb();
      const existing = queryOne(
        db,
        `SELECT ap.*, m.student_name, a.name as activity_name, a.type as activity_type
         FROM activity_participants ap
         JOIN members m ON ap.member_id = m.id
         JOIN activities a ON ap.activity_id = a.id
         WHERE ap.id = ? AND ap.activity_id = ?`,
        [participantId, activityId]
      );

      if (!existing) {
        return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
      }

      const stmt = db.prepare('DELETE FROM activity_participants WHERE id = ?');
      stmt.run([participantId]);
      stmt.free();
      saveDb();

      logAudit(
        user.username,
        'ACTIVITY_PARTICIPANT_REMOVE',
        existing.member_id,
        existing.student_name,
        `إلغاء اشتراك العضو من ${existing.activity_type}: ${existing.activity_name}`
      );

      res.json({ success: true, message: 'تم إلغاء اشتراك العضو من النشاط/المعسكر بنجاح' });
    } catch (err) {
      console.error('Remove participant error:', err);
      res.status(500).json({ error: 'فشل إلغاء اشتراك العضو' });
    }
  });

  // --- 5. REPORTS ---
  app.get('/api/reports/summary', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();

      const allMembers = queryAll(
        db,
        `SELECT m.*, t.name as tribe_name, t.code as tribe_code 
         FROM members m 
         LEFT JOIN tribes t ON m.tribe_id = t.id 
         ORDER BY m.school_stage, m.student_name`
      );

      const allTribes = queryAll(
        db,
        `SELECT t.*, 
                l.student_name as leader_name, 
                d.student_name as deputy_name,
                (SELECT COUNT(*) FROM members WHERE tribe_id = t.id) as member_count
         FROM tribes t
         LEFT JOIN members l ON t.leader_id = l.id
         LEFT JOIN members d ON t.deputy_id = d.id
         ORDER BY t.name ASC`
      );

      const stagesBreakdown: Record<string, { total: number; females: number; leaders: number }> = {};
      SCHOOL_GRADES_LIST.forEach((g) => {
        stagesBreakdown[g] = { total: 0, females: 0, leaders: 0 };
      });

      const joinYearBreakdown: Record<number, number> = {};
      const medicalCases: any[] = [];
      const leadersList: any[] = [];
      const femalesList: any[] = [];

      for (const m of allMembers) {
        const stageKey = m.school_stage || 'أخرى';
        if (!stagesBreakdown[stageKey]) {
          stagesBreakdown[stageKey] = { total: 0, females: 0, leaders: 0 };
        }
        stagesBreakdown[stageKey].total += 1;
        if (m.member_type === 'عضوة') stagesBreakdown[stageKey].females += 1;
        if (m.member_type === 'قائد') stagesBreakdown[stageKey].leaders += 1;

        joinYearBreakdown[m.scout_join_year] = (joinYearBreakdown[m.scout_join_year] || 0) + 1;

        if (m.medical_condition && m.medical_condition.trim()) {
          medicalCases.push(m);
        }

        if (m.member_type === 'قائد') {
          leadersList.push(m);
        } else {
          femalesList.push(m);
        }
      }

      const tribesBreakdown = allTribes.map((t) => ({
        id: t.id,
        name: t.name,
        count: t.member_count || 0,
      }));

      res.json({
        total: allMembers.length,
        totalFemales: femalesList.length,
        totalLeaders: leadersList.length,
        totalTribes: allTribes.length,
        stagesBreakdown,
        joinYearBreakdown,
        tribesBreakdown,
        medicalCasesCount: medicalCases.length,
        medicalCases,
        allMembers,
        tribes: allTribes,
      });
    } catch (err) {
      console.error('Reports error:', err);
      res.status(500).json({ error: 'فشل استخراج بيانات التقارير' });
    }
  });

  // ==========================================
  // --- 5.4.5 ANNUAL SUBSCRIPTIONS (الاشتراك السنوي) ---
  // ==========================================
  // Get all configured years
  app.get('/api/annual-subscriptions/years', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const feeRows = queryAll(db, 'SELECT year, amount, amount_with_uniform, description FROM annual_subscription_fees ORDER BY year DESC');
      
      // Also check distinct years from payments
      const paymentYears = queryAll(db, 'SELECT DISTINCT year FROM annual_subscription_payments');
      
      const currentCalendarYear = new Date().getFullYear();
      const yearsSet = new Set<number>([currentCalendarYear, currentCalendarYear - 1, currentCalendarYear + 1]);
      
      feeRows.forEach((r) => yearsSet.add(r.year));
      paymentYears.forEach((p) => yearsSet.add(p.year));

      const feeMap = new Map<number, { amount: number; amountWithUniform: number; description: string }>();
      feeRows.forEach((r) => feeMap.set(r.year, {
        amount: Number(r.amount) || 0,
        amountWithUniform: Number(r.amount_with_uniform) || 0,
        description: r.description || '',
      }));

      const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
      const result = sortedYears.map((y) => ({
        year: y,
        amount: feeMap.get(y)?.amount || 0,
        amountWithUniform: feeMap.get(y)?.amountWithUniform || 0,
        description: feeMap.get(y)?.description || (y === currentCalendarYear ? `الاشتراك السنوي لعام ${y}` : ''),
        isConfigured: feeMap.has(y),
      }));

      res.json({ years: result, currentYear: currentCalendarYear });
    } catch (err) {
      console.error('Fetch subscription years error:', err);
      res.status(500).json({ error: 'فشل تحميل سنوات الاشتراك السنوي' });
    }
  });

  // Get subscription data & member payments for a specific year
  app.get('/api/annual-subscriptions/year/:year', authenticate, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.params.year, 10);
      if (isNaN(year) || year < 1980 || year > 2060) {
        return res.status(400).json({ error: 'سنة الاشتراك غير صالحة' });
      }

      const db = await getDb();

      // Get fees for this year (regular and with uniform)
      const feeRow = queryOne(
        db,
        'SELECT year, amount, amount_with_uniform, description FROM annual_subscription_fees WHERE year = ?',
        [year]
      );
      const unifiedFee = feeRow ? Number(feeRow.amount) : 0;
      const feeWithUniform = feeRow ? Number(feeRow.amount_with_uniform || 0) : 0;
      const feeDescription = feeRow ? (feeRow.description || '') : '';

      // Get all members joined with payments for this year
      const members = queryAll(
        db,
        `SELECT 
          m.id as member_id,
          m.member_code,
          m.student_name,
          m.student_name_en,
          m.national_id,
          m.member_type,
          m.school_stage,
          m.tribe_id,
          t.name as tribe_name,
          m.leader_phone,
          m.father_phone,
          m.mother_phone,
          p.id as payment_id,
          COALESCE(p.status, 'غير مسدد') as status,
          COALESCE(p.subscription_type, 'اشتراك سنوي') as subscription_type,
          COALESCE(p.paid_amount, 0) as paid_amount,
          p.payment_date,
          p.receipt_number,
          p.notes,
          p.recorded_by
        FROM members m
        LEFT JOIN tribes t ON m.tribe_id = t.id
        LEFT JOIN annual_subscription_payments p ON m.id = p.member_id AND p.year = ?
        ORDER BY 
          CASE WHEN m.member_type = 'قائد' THEN 0 ELSE 1 END,
          m.student_name ASC`,
        [year]
      );

      // Process contact phones and stats
      let paidCount = 0;
      let totalCollected = 0;
      let leadersCount = 0;
      let leadersPaid = 0;
      let girlsCount = 0;
      let girlsPaid = 0;
      let regularCount = 0;
      let regularCollected = 0;
      let uniformCount = 0;
      let uniformCollected = 0;

      const processedMembers = members.map((m) => {
        const isPaid = m.status === 'مسدد';
        const subType = m.subscription_type === 'اشتراك سنوي بالزي' ? 'اشتراك سنوي بالزي' : 'اشتراك سنوي';
        const paidAmount = Number(m.paid_amount || 0);

        if (isPaid) {
          paidCount++;
          totalCollected += paidAmount;
          if (subType === 'اشتراك سنوي بالزي') {
            uniformCount++;
            uniformCollected += paidAmount;
          } else {
            regularCount++;
            regularCollected += paidAmount;
          }
        }

        if (m.member_type === 'قائد') {
          leadersCount++;
          if (isPaid) leadersPaid++;
        } else {
          girlsCount++;
          if (isPaid) girlsPaid++;
        }

        const phone = m.member_type === 'قائد'
          ? (m.leader_phone || m.father_phone || '')
          : (m.father_phone || m.mother_phone || '');

        return {
          ...m,
          phone,
          subscription_type: subType,
          paid_amount: paidAmount,
          isPaid,
        };
      });

      const totalMembers = processedMembers.length;
      const unpaidCount = totalMembers - paidCount;
      // Target based on regular fee baseline
      const totalTarget = totalMembers * (unifiedFee || feeWithUniform);
      const collectionRate = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 1000) / 10 : 0;

      res.json({
        year,
        unifiedFee,
        feeWithUniform,
        feeDescription,
        members: processedMembers,
        stats: {
          totalMembers,
          paidCount,
          unpaidCount,
          unifiedFee,
          feeWithUniform,
          totalTarget,
          totalCollected,
          collectionRate,
          leadersCount,
          leadersPaid,
          girlsCount,
          girlsPaid,
          regularCount,
          regularCollected,
          uniformCount,
          uniformCollected,
        },
      });
    } catch (err) {
      console.error('Fetch annual subscription data error:', err);
      res.status(500).json({ error: 'فشل تحميل بيانات الاشتراك السنوي' });
    }
  });

  // Set or update fees for a specific year (regular & with uniform)
  app.post('/api/annual-subscriptions/fee', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (user.role !== 'ADMIN' && user.role !== 'DATA_ENTRY') {
        return res.status(403).json({ error: 'صلاحية تحديد قيمة الاشتراك السنوي مخصصة لمديري النظام' });
      }

      const { year, amount, amount_with_uniform, amountWithUniform, description } = req.body;
      const parsedYear = parseInt(year, 10);
      const parsedAmount = parseFloat(amount);
      const parsedAmountWithUniform = parseFloat(amount_with_uniform ?? amountWithUniform ?? 0);

      if (isNaN(parsedYear) || parsedYear < 1980 || parsedYear > 2060) {
        return res.status(400).json({ error: 'يرجى تحديد سنة صحيحة' });
      }

      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ error: 'قيمة الاشتراك السنوي العادي يجب أن تكون رقماً موجباً' });
      }

      const validAmountWithUniform = isNaN(parsedAmountWithUniform) || parsedAmountWithUniform < 0 ? 0 : parsedAmountWithUniform;

      const db = await getDb();
      const now = new Date().toISOString();
      const desc = description ? String(description).trim() : `الاشتراك السنوي لعام ${parsedYear}`;

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          INSERT INTO annual_subscription_fees (year, amount, amount_with_uniform, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(year) DO UPDATE SET
            amount = excluded.amount,
            amount_with_uniform = excluded.amount_with_uniform,
            description = excluded.description,
            updated_at = excluded.updated_at
        `);
        stmt.run([parsedYear, parsedAmount, validAmountWithUniform, desc, now, now]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'ANNUAL_FEE_UPDATE',
          null,
          null,
          `تحديد قيمة الاشتراك السنوي لسنة ${parsedYear}: ${parsedAmount} ج.م (عادي) / ${validAmountWithUniform} ج.م (بالزي)`
        );

        res.json({
          success: true,
          message: `تم حفظ أسعار الاشتراك السنوي لسنة ${parsedYear} بنجاح (${parsedAmount} ج.م عادي / ${validAmountWithUniform} ج.م بالزي)`,
          year: parsedYear,
          amount: parsedAmount,
          amountWithUniform: validAmountWithUniform,
          description: desc,
        });
      } catch (e: any) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Save unified fee error:', err);
      res.status(500).json({ error: err.message || 'فشل حفظ قيمة الاشتراك السنوي' });
    }
  });

  // Record or update payment for a single member
  app.post('/api/annual-subscriptions/payment', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { year, member_id, status, subscription_type, paid_amount, payment_date, receipt_number, notes, payment_method } = req.body;

      const parsedYear = parseInt(year, 10);
      const parsedMemberId = parseInt(member_id, 10);

      if (isNaN(parsedYear) || isNaN(parsedMemberId)) {
        return res.status(400).json({ error: 'بيانات السنة أو كود العضو غير صالحة' });
      }

      const db = await getDb();

      // Check member existence
      const member = queryOne(db, 'SELECT id, member_code, student_name, member_type FROM members WHERE id = ?', [parsedMemberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود في قاعدة البيانات' });
      }

      // Check fees for this year (regular and with uniform)
      const feeRow = queryOne(db, 'SELECT amount, amount_with_uniform FROM annual_subscription_fees WHERE year = ?', [parsedYear]);
      const regularFee = feeRow ? Number(feeRow.amount) : 0;
      const uniformFee = feeRow ? (Number(feeRow.amount_with_uniform) || regularFee) : 0;

      const subType = subscription_type === 'اشتراك سنوي بالزي' ? 'اشتراك سنوي بالزي' : 'اشتراك سنوي';
      const targetFee = subType === 'اشتراك سنوي بالزي' ? uniformFee : regularFee;

      const paymentStatus = status === 'غير مسدد' ? 'غير مسدد' : 'مسدد';
      const effectivePaidAmount = paymentStatus === 'مسدد'
        ? (paid_amount !== undefined && paid_amount !== null && !isNaN(Number(paid_amount)) ? Number(paid_amount) : targetFee)
        : 0;

      // Deduct from wallet if paid via wallet
      let walletReceiptNumber: string | null = null;
      if (payment_method === 'WALLET' && paymentStatus === 'مسدد' && effectivePaidAmount > 0) {
        const curBal = getMemberWalletBalance(db, parsedMemberId);
        if (curBal < effectivePaidAmount) {
          return res.status(400).json({
            error: `رصيد المحفظة الحالي (${curBal} ج.م) غير كافٍ لسداد ${subType} المطلوب (${effectivePaidAmount} ج.م). يرجى شحن رصيد المحفظة أولاً.`,
          });
        }
        const wRes = recordWalletTransaction(db, {
          memberId: parsedMemberId,
          type: 'PAYMENT',
          amount: effectivePaidAmount,
          category: 'SUBSCRIPTION',
          referenceId: String(parsedYear),
          referenceTitle: `${subType} ${parsedYear}`,
          description: notes ? `${notes} (خصم من المحفظة)` : `سداد ${subType} لسنة ${parsedYear} من رصيد المحفظة`,
          recordedBy: user.full_name || user.username,
        });
        if (!wRes.success) {
          return res.status(400).json({ error: wRes.error || 'تعذر الخصم من المحفظة' });
        }
        walletReceiptNumber = wRes.receiptNumber;
      }

      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];
      const effectiveDate = paymentStatus === 'مسدد' ? (payment_date || todayDate) : null;
      const effectiveReceipt = paymentStatus === 'مسدد'
        ? (receipt_number || walletReceiptNumber || `REC-${parsedYear}-${String(member.id).padStart(4, '0')}`)
        : null;
      const effectiveNotes = payment_method === 'WALLET'
        ? (notes ? `${notes} [تم السداد من المحفظة]` : `[تم السداد من المحفظة - إيصال: ${effectiveReceipt}]`)
        : (notes ? String(notes).trim() : null);

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          INSERT INTO annual_subscription_payments (
            year, member_id, status, subscription_type, paid_amount, payment_date, receipt_number, notes, recorded_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(year, member_id) DO UPDATE SET
            status = excluded.status,
            subscription_type = excluded.subscription_type,
            paid_amount = excluded.paid_amount,
            payment_date = excluded.payment_date,
            receipt_number = excluded.receipt_number,
            notes = excluded.notes,
            recorded_by = excluded.recorded_by,
            updated_at = excluded.updated_at
        `);

        stmt.run([
          parsedYear,
          parsedMemberId,
          paymentStatus,
          subType,
          effectivePaidAmount,
          effectiveDate,
          effectiveReceipt,
          effectiveNotes,
          user.username,
          now.toISOString(),
          now.toISOString(),
        ]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          paymentStatus === 'مسدد' ? 'ANNUAL_SUBSCRIPTION_PAY' : 'ANNUAL_SUBSCRIPTION_CANCEL',
          member.id,
          member.student_name,
          paymentStatus === 'مسدد'
            ? `تسجيل سداد ${subType} لسنة ${parsedYear}: مبلغ ${effectivePaidAmount} ج.م (إيصال: ${effectiveReceipt})`
            : `تعديل حالة الاشتراك السنوي لسنة ${parsedYear} إلى غير مسدد`
        );

        res.json({
          success: true,
          message: paymentStatus === 'مسدد'
            ? `تم تسجيل سداد ${subType} (${member.student_name}) بمبلغ ${effectivePaidAmount} ج.م`
            : `تم إلغاء سداد اشتراك (${member.student_name}) لسنة ${parsedYear}`,
          payment: {
            year: parsedYear,
            member_id: parsedMemberId,
            status: paymentStatus,
            subscription_type: subType,
            paid_amount: effectivePaidAmount,
            payment_date: effectiveDate,
            receipt_number: effectiveReceipt,
            notes: notes || null,
          },
        });
      } catch (e: any) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Record payment error:', err);
      res.status(500).json({ error: err.message || 'فشل تسجيل سداد الاشتراك' });
    }
  });

  // Bulk record payment for selected members
  app.post('/api/annual-subscriptions/bulk-payment', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { year, member_ids, subscription_type, payment_date, notes } = req.body;

      const parsedYear = parseInt(year, 10);
      if (isNaN(parsedYear) || !Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد السنة واختيار عضو واحد على الأقل' });
      }

      const db = await getDb();
      // Get fee based on selected subscription type
      const feeRow = queryOne(db, 'SELECT amount, amount_with_uniform FROM annual_subscription_fees WHERE year = ?', [parsedYear]);
      const subType = subscription_type === 'اشتراك سنوي بالزي' ? 'اشتراك سنوي بالزي' : 'اشتراك سنوي';
      const targetFee = subType === 'اشتراك سنوي بالزي'
        ? (Number(feeRow?.amount_with_uniform) || Number(feeRow?.amount) || 0)
        : (Number(feeRow?.amount) || 0);

      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];
      const effectiveDate = payment_date || todayDate;
      const isoNow = now.toISOString();

      db.run('BEGIN TRANSACTION;');
      try {
        let count = 0;
        for (const mid of member_ids) {
          const parsedId = parseInt(mid, 10);
          if (isNaN(parsedId)) continue;

          const receipt = `REC-${parsedYear}-${String(parsedId).padStart(4, '0')}`;
          const stmt = db.prepare(`
            INSERT INTO annual_subscription_payments (
              year, member_id, status, subscription_type, paid_amount, payment_date, receipt_number, notes, recorded_by, created_at, updated_at
            ) VALUES (?, ?, 'مسدد', ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(year, member_id) DO UPDATE SET
              status = 'مسدد',
              subscription_type = excluded.subscription_type,
              paid_amount = excluded.paid_amount,
              payment_date = excluded.payment_date,
              receipt_number = excluded.receipt_number,
              notes = excluded.notes,
              recorded_by = excluded.recorded_by,
              updated_at = excluded.updated_at
          `);
          stmt.run([
            parsedYear,
            parsedId,
            subType,
            targetFee,
            effectiveDate,
            receipt,
            notes ? String(notes).trim() : `سداد جماعي موحد (${subType})`,
            user.username,
            isoNow,
            isoNow,
          ]);
          stmt.free();
          count++;
        }

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'ANNUAL_SUBSCRIPTION_BULK_PAY',
          null,
          null,
          `تسجيل سداد جماعي لـ (${subType}) لسنة ${parsedYear} لعدد (${count}) عضواً وقائداً بالقيمة (${targetFee} ج.م)`
        );

        res.json({
          success: true,
          message: `تم تسجيل سداد (${subType}) لعدد (${count}) عضواً وقائداً بنجاح`,
          count,
        });
      } catch (e: any) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Bulk payment error:', err);
      res.status(500).json({ error: err.message || 'فشل تسجيل السداد الجماعي' });
    }
  });

  // Cancel payment (revert to unpaid)
  app.delete('/api/annual-subscriptions/payment/:year/:memberId', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const year = parseInt(req.params.year, 10);
      const memberId = parseInt(req.params.memberId, 10);

      if (isNaN(year) || isNaN(memberId)) {
        return res.status(400).json({ error: 'بيانات غير صالحة' });
      }

      const db = await getDb();
      const member = queryOne(db, 'SELECT student_name FROM members WHERE id = ?', [memberId]);

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare('DELETE FROM annual_subscription_payments WHERE year = ? AND member_id = ?');
        stmt.run([year, memberId]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'ANNUAL_SUBSCRIPTION_CANCEL',
          memberId,
          member?.student_name || null,
          `إلغاء سداد الاشتراك السنوي لسنة ${year} للعضو ${member?.student_name || memberId}`
        );

        res.json({ success: true, message: 'تم إلغاء سداد الاشتراك بنجاح' });
      } catch (e: any) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Cancel payment error:', err);
      res.status(500).json({ error: err.message || 'فشل إلغاء سداد الاشتراك' });
    }
  });

  // Export annual subscription list to Excel
  app.get('/api/annual-subscriptions/year/:year/export', authenticate, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.params.year, 10);
      if (isNaN(year)) {
        return res.status(400).json({ error: 'السنة غير صالحة' });
      }

      const db = await getDb();
      const feeRow = queryOne(db, 'SELECT amount, amount_with_uniform, description FROM annual_subscription_fees WHERE year = ?', [year]);
      const regularFee = feeRow ? Number(feeRow.amount) : 0;
      const uniformFee = feeRow ? Number(feeRow.amount_with_uniform || 0) : 0;

      const members = queryAll(
        db,
        `SELECT 
          m.member_code as [كود العضو],
          m.student_name as [اسم العضو / القائد],
          m.member_type as [الصفة],
          m.school_stage as [الصف الدراسي],
          t.name as [العشيرة],
          CASE 
            WHEN m.member_type = 'قائد' THEN COALESCE(m.leader_phone, m.father_phone, '')
            ELSE COALESCE(m.father_phone, m.mother_phone, '')
          END as [رقم الهاتف],
          COALESCE(p.status, 'غير مسدد') as [حالة السداد],
          COALESCE(p.subscription_type, 'اشتراك سنوي') as [نوع الاشتراك],
          COALESCE(p.paid_amount, 0) as [المبلغ المسدد],
          COALESCE(p.payment_date, '-') as [تاريخ السداد],
          COALESCE(p.receipt_number, '-') as [رقم الإيصال],
          COALESCE(p.notes, '-') as [ملاحظات],
          COALESCE(p.recorded_by, '-') as [مسجل بواسطة]
        FROM members m
        LEFT JOIN tribes t ON m.tribe_id = t.id
        LEFT JOIN annual_subscription_payments p ON m.id = p.member_id AND p.year = ?
        ORDER BY 
          CASE WHEN m.member_type = 'قائد' THEN 0 ELSE 1 END,
          m.student_name ASC`,
        [year]
      );

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Detailed List
      const wsDetails = XLSX.utils.json_to_sheet(members);
      XLSX.utils.book_append_sheet(wb, wsDetails, `اشتراكات_${year}`);

      // Sheet 2: Summary Stats
      const totalMembers = members.length;
      const paidMembers = members.filter((m: any) => m['حالة السداد'] === 'مسدد');
      const paidCount = paidMembers.length;
      const regularPaidCount = paidMembers.filter((m: any) => m['نوع الاشتراك'] !== 'اشتراك سنوي بالزي').length;
      const uniformPaidCount = paidMembers.filter((m: any) => m['نوع الاشتراك'] === 'اشتراك سنوي بالزي').length;
      const unpaidCount = totalMembers - paidCount;
      const totalCollected = members.reduce((sum: number, m: any) => sum + Number(m['المبلغ المسدد'] || 0), 0);
      const totalTarget = totalMembers * (regularFee || uniformFee);
      const rate = totalTarget > 0 ? ((totalCollected / totalTarget) * 100).toFixed(1) + '%' : '0%';

      const summaryData = [
        { [ 'البند']: 'سنة الاشتراك', [ 'القيمة']: year },
        { [ 'البند']: 'قيمة الاشتراك السنوي العادي', [ 'القيمة']: `${regularFee} ج.م` },
        { [ 'البند']: 'قيمة الاشتراك السنوي بالزي', [ 'القيمة']: `${uniformFee} ج.م` },
        { [ 'البند']: 'إجمالي عدد الأعضاء والقادة', [ 'القيمة']: totalMembers },
        { [ 'البند']: 'إجمالي المسددين', [ 'القيمة']: paidCount },
        { [ 'البند']: 'مسدد باشتراك سنوي عادي', [ 'القيمة']: regularPaidCount },
        { [ 'البند']: 'مسدد باشتراك سنوي بالزي', [ 'القيمة']: uniformPaidCount },
        { [ 'البند']: 'عدد غير المسددين', [ 'القيمة']: unpaidCount },
        { [ 'البند']: 'إجمالي المبلغ المحصل', [ 'القيمة']: `${totalCollected} ج.م` },
        { [ 'البند']: 'نسبة التحصيل التقريبية', [ 'القيمة']: rate },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص_التحصيل');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const fileName = `Scout_Annual_Subscriptions_${year}.xlsx`;

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (err) {
      console.error('Export subscription Excel error:', err);
      res.status(500).json({ error: 'فشل تصدير كشف الاشتراكات إلى Excel' });
    }
  });

  // ==========================================
  // --- 5.4.6 STORE & MERCHANDISE (قسم المتجر والأصناف) ---
  // ==========================================
  // 1. Get all store items
  app.get('/api/store/items', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const items = queryAll(
        db,
        `SELECT id, name, description, stock, sizes, price, image_url, category, created_at, updated_at
         FROM store_items
         ORDER BY id DESC`
      );

      // Compute stats
      let totalStock = 0;
      let outOfStockCount = 0;
      let totalInventoryValue = 0;

      items.forEach((item: any) => {
        const stock = Number(item.stock) || 0;
        const price = Number(item.price) || 0;
        totalStock += stock;
        if (stock === 0) outOfStockCount++;
        totalInventoryValue += stock * price;
      });

      res.json({
        items,
        stats: {
          totalItems: items.length,
          totalStock,
          outOfStockCount,
          totalInventoryValue,
        },
      });
    } catch (err: any) {
      console.error('Get store items error:', err);
      res.status(500).json({ error: 'فشل جلب أصناف المتجر' });
    }
  });

  // 2. Get single store item
  app.get('/api/store/items/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.id, 10);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'معرف الصنف غير صالح' });
      }

      const db = await getDb();
      const item = queryOne(db, 'SELECT * FROM store_items WHERE id = ?', [itemId]);
      if (!item) {
        return res.status(404).json({ error: 'الصنف غير موجود' });
      }

      res.json(item);
    } catch (err: any) {
      console.error('Get single store item error:', err);
      res.status(500).json({ error: 'فشل جلب بيانات الصنف' });
    }
  });

  // 3. Create new store item
  app.post('/api/store/items', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { name, description, stock, sizes, price, image_url, category } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'يرجى إدخال اسم الصنف' });
      }

      const parsedStock = Math.max(0, parseInt(stock, 10) || 0);
      const parsedPrice = Math.max(0, parseFloat(price) || 0);
      const trimmedName = name.trim();
      const trimmedDesc = description ? String(description).trim() : '';
      const sizesStr = sizes ? String(sizes).trim() : '';
      const categoryStr = category ? String(category).trim() : 'مهمات الكشافة';
      const imageUrlStr = image_url ? String(image_url).trim() : null;
      const now = new Date().toISOString();

      const db = await getDb();
      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          INSERT INTO store_items (name, description, stock, sizes, price, image_url, category, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
          trimmedName,
          trimmedDesc || null,
          parsedStock,
          sizesStr || null,
          parsedPrice,
          imageUrlStr || null,
          categoryStr,
          now,
          now,
        ]);
        stmt.free();

        const inserted = queryOne(db, 'SELECT last_insert_rowid() as id');
        const newId = inserted?.id;

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'STORE_ITEM_CREATE',
          newId || null,
          trimmedName,
          `إضافة صنف جديد للمتجر: "${trimmedName}" - السعر: ${parsedPrice} ج.م - المخزون: ${parsedStock} قطعة`
        );

        const newItem = queryOne(db, 'SELECT * FROM store_items WHERE id = ?', [newId]);

        res.status(201).json({
          success: true,
          message: 'تم إضافة الصنف للمتجر بنجاح',
          item: newItem,
        });
      } catch (e: any) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Create store item error:', err);
      res.status(500).json({ error: err.message || 'فشل إضافة الصنف' });
    }
  });

  // 4. Update existing store item
  app.put('/api/store/items/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const itemId = parseInt(req.params.id, 10);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'معرف الصنف غير صالح' });
      }

      const { name, description, stock, sizes, price, image_url, category } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'يرجى إدخال اسم الصنف' });
      }

      const parsedStock = Math.max(0, parseInt(stock, 10) || 0);
      const parsedPrice = Math.max(0, parseFloat(price) || 0);
      const trimmedName = name.trim();
      const trimmedDesc = description !== undefined ? String(description).trim() : null;
      const sizesStr = sizes !== undefined ? String(sizes).trim() : null;
      const categoryStr = category ? String(category).trim() : 'مهمات الكشافة';
      const imageUrlStr = image_url !== undefined ? (image_url ? String(image_url).trim() : null) : undefined;
      const now = new Date().toISOString();

      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM store_items WHERE id = ?', [itemId]);
      if (!existing) {
        return res.status(404).json({ error: 'الصنف المراد تعديله غير موجود' });
      }

      db.run('BEGIN TRANSACTION;');
      try {
        const finalImageUrl = imageUrlStr !== undefined ? imageUrlStr : existing.image_url;

        const stmt = db.prepare(`
          UPDATE store_items SET
            name = ?,
            description = ?,
            stock = ?,
            sizes = ?,
            price = ?,
            image_url = ?,
            category = ?,
            updated_at = ?
          WHERE id = ?
        `);
        stmt.run([
          trimmedName,
          trimmedDesc,
          parsedStock,
          sizesStr,
          parsedPrice,
          finalImageUrl,
          categoryStr,
          now,
          itemId,
        ]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'STORE_ITEM_UPDATE',
          itemId,
          trimmedName,
          `تعديل بيانات صنف في المتجر: "${trimmedName}" (المخزون: ${parsedStock}، السعر: ${parsedPrice} ج.م)`
        );

        const updatedItem = queryOne(db, 'SELECT * FROM store_items WHERE id = ?', [itemId]);

        res.json({
          success: true,
          message: 'تم تحديث بيانات الصنف بنجاح',
          item: updatedItem,
        });
      } catch (e: any) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Update store item error:', err);
      res.status(500).json({ error: err.message || 'فشل تحديث بيانات الصنف' });
    }
  });

  // 5. Delete store item
  app.delete('/api/store/items/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const itemId = parseInt(req.params.id, 10);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'معرف الصنف غير صالح' });
      }

      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM store_items WHERE id = ?', [itemId]);
      if (!existing) {
        return res.status(404).json({ error: 'الصنف غير موجود أو تم حذفه مسبقاً' });
      }

      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare('DELETE FROM store_items WHERE id = ?');
        stmt.run([itemId]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'STORE_ITEM_DELETE',
          itemId,
          existing.name,
          `حذف الصنف من المتجر: "${existing.name}"`
        );

        res.json({
          success: true,
          message: `تم حذف الصنف "${existing.name}" بنجاح`,
        });
      } catch (e: any) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Delete store item error:', err);
      res.status(500).json({ error: err.message || 'فشل حذف الصنف' });
    }
  });

  // 6. Quick stock adjustment
  app.patch('/api/store/items/:id/stock', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const itemId = parseInt(req.params.id, 10);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'معرف الصنف غير صالح' });
      }

      const { delta, newStock } = req.body;
      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM store_items WHERE id = ?', [itemId]);
      if (!existing) {
        return res.status(404).json({ error: 'الصنف غير موجود' });
      }

      let updatedStock = Number(existing.stock) || 0;
      if (typeof newStock === 'number') {
        updatedStock = Math.max(0, newStock);
      } else if (typeof delta === 'number') {
        updatedStock = Math.max(0, updatedStock + delta);
      } else {
        return res.status(400).json({ error: 'يرجى تحديد كمية التعديل' });
      }

      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare('UPDATE store_items SET stock = ?, updated_at = ? WHERE id = ?');
        stmt.run([updatedStock, now, itemId]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'STORE_STOCK_UPDATE',
          itemId,
          existing.name,
          `تعديل مخزون الصنف "${existing.name}": من ${existing.stock} إلى ${updatedStock}`
        );

        res.json({
          success: true,
          message: 'تم تحديث المخزون بنجاح',
          stock: updatedStock,
        });
      } catch (e: any) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Update stock error:', err);
      res.status(500).json({ error: err.message || 'فشل تحديث المخزون' });
    }
  });

  // ==========================================
  // --- 5.4 STORE RESERVATIONS & SALES ---
  // ==========================================

  function enrichOrderWithContactInfo(order: any, db: any) {
    if (!order) return order;
    let member = null;
    if (order.member_id) {
      member = queryOne(db, 'SELECT * FROM members WHERE id = ?', [order.member_id]);
    }
    if (!member && order.user_id) {
      const userRow = queryOne(db, 'SELECT member_id, phone FROM users WHERE id = ?', [order.user_id]);
      if (userRow?.member_id) {
        member = queryOne(db, 'SELECT * FROM members WHERE id = ?', [userRow.member_id]);
      }
      if (!order.buyer_phone && userRow?.phone) {
        order.buyer_phone = userRow.phone;
      }
    }
    if (!member && order.buyer_name) {
      member = queryOne(db, 'SELECT * FROM members WHERE TRIM(student_name) = TRIM(?)', [order.buyer_name]);
    }

    if (member) {
      order.father_phone = member.father_phone || null;
      order.mother_phone = member.mother_phone || null;
      order.leader_phone = member.leader_phone || null;
      order.guardian_name = member.guardian_name || null;
      order.member_type_field = member.member_type || null;
    }

    const isLeader =
      order.buyer_type === 'LEADER' ||
      order.user_role === 'LEADER' ||
      order.member_type_field === 'قائد';

    let targetPhone = '';
    let phoneType = '';

    if (isLeader) {
      targetPhone = order.leader_phone || order.buyer_phone || order.father_phone || order.mother_phone || '';
      phoneType = 'الرقم الشخصي (قائد)';
    } else {
      targetPhone = order.father_phone || order.mother_phone || order.buyer_phone || order.leader_phone || '';
      phoneType = order.father_phone ? 'رقم ولي الأمر (الأب)' : (order.mother_phone ? 'رقم ولي الأمر (الأم)' : 'رقم ولي الأمر');
    }

    order.target_phone = targetPhone;
    order.phone_type = phoneType;
    return order;
  }

  // 7. Get store orders / reservations
  app.get('/api/store/orders', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const db = await getDb();
      const isManager = user.role === 'ADMIN' || user.role === 'DATA_ENTRY';

      let sql = `
        SELECT o.*
        FROM store_orders o
      `;
      const params: any[] = [];

      if (!isManager) {
        sql += ' WHERE o.user_id = ? ';
        params.push(user.id);
      }

      sql += ' ORDER BY o.id DESC';

      const orders = queryAll(db, sql, params);

      // Fetch items for each order and enrich contact info
      for (const order of orders) {
        order.items = queryAll(
          db,
          `SELECT * FROM store_order_items WHERE order_id = ? ORDER BY id ASC`,
          [order.id]
        );
        enrichOrderWithContactInfo(order, db);
      }

      // Compute statistics
      const allOrders = isManager ? orders : queryAll(db, 'SELECT * FROM store_orders');
      let pendingCount = 0;
      let waitingPickupCount = 0;
      let soldCount = 0;
      let cancelledCount = 0;
      let totalSoldRevenue = 0;
      let pendingRevenue = 0;
      let totalPiecesSold = 0;

      allOrders.forEach((ord: any) => {
        const price = Number(ord.total_price) || 0;
        const count = Number(ord.total_items) || 0;
        if (ord.status === 'PENDING') {
          pendingCount++;
        } else if (ord.status === 'WAITING_PICKUP') {
          waitingPickupCount++;
          pendingRevenue += price;
        } else if (ord.status === 'SOLD') {
          soldCount++;
          totalSoldRevenue += price;
          totalPiecesSold += count;
        } else if (ord.status === 'CANCELLED') {
          cancelledCount++;
        }
      });

      res.json({
        orders,
        stats: {
          pendingCount,
          waitingPickupCount,
          soldCount,
          cancelledCount,
          totalSoldRevenue,
          pendingRevenue,
          totalPiecesSold,
          totalOrders: allOrders.length,
        },
      });
    } catch (err: any) {
      console.error('Get store orders error:', err);
      res.status(500).json({ error: 'فشل جلب قائمة الحجوزات والطلبات' });
    }
  });

  // 8. Create new store reservation / order
  app.post('/api/store/orders', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { buyer_name, buyer_phone, buyer_type, notes, items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'يرجى اختيار صنف واحد على الأقل لإتمام الحجز' });
      }

      const effectiveBuyerName = (buyer_name || user.full_name || user.username || '').trim();
      if (!effectiveBuyerName) {
        return res.status(400).json({ error: 'يرجى إدخال اسم صاحب الحجز' });
      }

      const db = await getDb();

      // Validate items & stock availability
      let totalCalculatedPrice = 0;
      let totalCalculatedItems = 0;
      const processedItems: Array<{
        item_id: number;
        item_name: string;
        size: string | null;
        quantity: number;
        unit_price: number;
        total_price: number;
        image_url: string | null;
      }> = [];

      for (const reqItem of items) {
        const itemId = parseInt(reqItem.item_id, 10);
        const qty = Math.max(1, parseInt(reqItem.quantity, 10) || 1);
        if (isNaN(itemId)) continue;

        const storeItem = queryOne(db, 'SELECT * FROM store_items WHERE id = ?', [itemId]);
        if (!storeItem) {
          return res.status(400).json({ error: `الصنف ذو المعرف #${itemId} غير موجود في المتجر` });
        }

        if (storeItem.stock < qty) {
          return res.status(400).json({
            error: `الكمية المطلوبة للصنف "${storeItem.name}" (${qty} قطعة) غير متوفرة في المخزون الحالي (المتبقي: ${storeItem.stock} قطعة فقط)`,
          });
        }

        const unitPrice = Number(storeItem.price) || 0;
        const lineTotal = unitPrice * qty;
        totalCalculatedPrice += lineTotal;
        totalCalculatedItems += qty;

        processedItems.push({
          item_id: itemId,
          item_name: storeItem.name,
          size: reqItem.size ? String(reqItem.size).trim() : null,
          quantity: qty,
          unit_price: unitPrice,
          total_price: lineTotal,
          image_url: storeItem.image_url || null,
        });
      }

      if (processedItems.length === 0) {
        return res.status(400).json({ error: 'لا توجد أصناف صالحة للحجز' });
      }

      const now = new Date().toISOString();

      db.run('BEGIN TRANSACTION;');
      try {
        // Generate sequential order number
        const lastOrder = queryOne(db, 'SELECT id FROM store_orders ORDER BY id DESC LIMIT 1');
        const nextId = (lastOrder?.id || 0) + 1;
        const orderNumber = `ORD-${String(nextId).padStart(4, '0')}`;

        // Insert Order
        const orderStmt = db.prepare(`
          INSERT INTO store_orders (
            order_number, user_id, user_name, user_role,
            buyer_name, buyer_phone, buyer_type,
            member_id, tribe_id, tribe_name,
            total_items, total_price, status,
            notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
        `);

        orderStmt.run([
          orderNumber,
          user.id,
          user.username,
          user.role,
          effectiveBuyerName,
          buyer_phone ? String(buyer_phone).trim() : user.phone || null,
          buyer_type || (user.role === 'LEADER' ? 'LEADER' : 'MEMBER'),
          user.member_id || null,
          user.tribe_id || null,
          user.tribe_name || null,
          totalCalculatedItems,
          totalCalculatedPrice,
          notes ? String(notes).trim() : null,
          now,
          now,
        ]);
        orderStmt.free();

        const inserted = queryOne(db, 'SELECT last_insert_rowid() as id');
        const orderId = inserted.id;

        // Insert Items & Deduct Stock
        const itemStmt = db.prepare(`
          INSERT INTO store_order_items (
            order_id, item_id, item_name, size, quantity, unit_price, total_price, image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const updateStockStmt = db.prepare(`
          UPDATE store_items
          SET stock = stock - ?, updated_at = ?
          WHERE id = ?
        `);

        for (const itm of processedItems) {
          itemStmt.run([
            orderId,
            itm.item_id,
            itm.item_name,
            itm.size,
            itm.quantity,
            itm.unit_price,
            itm.total_price,
            itm.image_url,
          ]);

          updateStockStmt.run([itm.quantity, now, itm.item_id]);
        }

        itemStmt.free();
        updateStockStmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'STORE_RESERVATION_CREATE',
          orderId,
          effectiveBuyerName,
          `حجز جديد رقم ${orderNumber} - عدد الأصناف: ${processedItems.length} - الإجمالي: ${totalCalculatedPrice} ج.م`
        );

        const createdOrder = queryOne(db, 'SELECT * FROM store_orders WHERE id = ?', [orderId]);
        createdOrder.items = queryAll(db, 'SELECT * FROM store_order_items WHERE order_id = ?', [orderId]);
        enrichOrderWithContactInfo(createdOrder, db);

        res.status(201).json({
          success: true,
          message: `تم تسجيل طلب الحجز بنجاح برقم ${orderNumber}`,
          order: createdOrder,
        });
      } catch (transErr: any) {
        safeRollback(db);
        throw transErr;
      }
    } catch (err: any) {
      console.error('Create store order error:', err);
      res.status(500).json({ error: err.message || 'فشل إتمام طلب الحجز' });
    }
  });

  // 9. Confirm store reservation (moves to WAITING_PICKUP)
  app.patch('/api/store/orders/:id/confirm', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (user.role !== 'ADMIN' && user.role !== 'DATA_ENTRY') {
        return res.status(403).json({ error: 'عفواً، تأكيد الحجوزات متاح للمسؤولين ومدخلي البيانات فقط' });
      }

      const orderId = parseInt(req.params.id, 10);
      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM store_orders WHERE id = ?', [orderId]);
      if (!existing) {
        return res.status(404).json({ error: 'طلب الحجز غير موجود' });
      }

      if (existing.status !== 'PENDING') {
        return res.status(400).json({ error: `لا يمكن تأكيد الحجز لأن حالته الحالية هي: ${existing.status}` });
      }

      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          UPDATE store_orders
          SET status = 'WAITING_PICKUP',
              confirmed_at = ?,
              confirmed_by = ?,
              updated_at = ?
          WHERE id = ?
        `);
        stmt.run([now, user.username, now, orderId]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'STORE_RESERVATION_CONFIRM',
          orderId,
          existing.buyer_name,
          `تأكيد طلب الحجز رقم ${existing.order_number} - الحالة أصبحت: في انتظار الاستلام`
        );

        const updatedOrder = queryOne(db, 'SELECT * FROM store_orders WHERE id = ?', [orderId]);
        updatedOrder.items = queryAll(db, 'SELECT * FROM store_order_items WHERE order_id = ?', [orderId]);
        enrichOrderWithContactInfo(updatedOrder, db);

        res.json({
          success: true,
          message: `تم تأكيد الحجز رقم ${existing.order_number} وأصبح في انتظار الاستلام`,
          order: updatedOrder,
        });
      } catch (e) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Confirm order error:', err);
      res.status(500).json({ error: err.message || 'فشل تأكيد الحجز' });
    }
  });

  // 10. Pay store reservation (moves to SOLD)
  app.patch('/api/store/orders/:id/pay', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (user.role !== 'ADMIN' && user.role !== 'DATA_ENTRY') {
        return res.status(403).json({ error: 'عفواً، تسجيل السداد متاح للمسؤولين ومدخلي البيانات فقط' });
      }

      const orderId = parseInt(req.params.id, 10);
      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM store_orders WHERE id = ?', [orderId]);
      if (!existing) {
        return res.status(404).json({ error: 'طلب الحجز غير موجود' });
      }

      if (existing.status === 'SOLD') {
        return res.status(400).json({ error: 'تم سداد هذا الطلب مسبقاً' });
      }
      if (existing.status === 'CANCELLED') {
        return res.status(400).json({ error: 'لا يمكن سداد طلب ملغي' });
      }

      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION;');
      try {
        const stmt = db.prepare(`
          UPDATE store_orders
          SET status = 'SOLD',
              paid_at = ?,
              paid_by = ?,
              updated_at = ?
          WHERE id = ?
        `);
        stmt.run([now, user.username, now, orderId]);
        stmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'STORE_SALE_PAY',
          orderId,
          existing.buyer_name,
          `سداد وإتمام بيع طلب رقم ${existing.order_number} - المبلغ: ${existing.total_price} ج.م`
        );

        const updatedOrder = queryOne(db, 'SELECT * FROM store_orders WHERE id = ?', [orderId]);
        updatedOrder.items = queryAll(db, 'SELECT * FROM store_order_items WHERE order_id = ?', [orderId]);
        enrichOrderWithContactInfo(updatedOrder, db);

        res.json({
          success: true,
          message: `تم تسجيل سداد الطلب رقم ${existing.order_number} بنجاح وتحويله إلى "تم البيع"`,
          order: updatedOrder,
        });
      } catch (e) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Pay order error:', err);
      res.status(500).json({ error: err.message || 'فشل تسجيل السداد' });
    }
  });

  // 11. Cancel store reservation (returns stock)
  app.patch('/api/store/orders/:id/cancel', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const orderId = parseInt(req.params.id, 10);
      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM store_orders WHERE id = ?', [orderId]);
      if (!existing) {
        return res.status(404).json({ error: 'طلب الحجز غير موجود' });
      }

      if (existing.status === 'CANCELLED') {
        return res.status(400).json({ error: 'الطلب ملغي بالفعل' });
      }

      // Check permission: only admin, data entry, or the user who created it (if still pending)
      const isManager = user.role === 'ADMIN' || user.role === 'DATA_ENTRY';
      if (!isManager && (existing.user_id !== user.id || existing.status !== 'PENDING')) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لإلغاء هذا الطلب' });
      }

      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION;');
      try {
        // Return stock for items
        const items = queryAll(db, 'SELECT * FROM store_order_items WHERE order_id = ?', [orderId]);
        const returnStockStmt = db.prepare(`
          UPDATE store_items
          SET stock = stock + ?, updated_at = ?
          WHERE id = ?
        `);

        for (const itm of items) {
          returnStockStmt.run([itm.quantity, now, itm.item_id]);
        }
        returnStockStmt.free();

        // Update status to CANCELLED
        const updateStmt = db.prepare(`
          UPDATE store_orders
          SET status = 'CANCELLED', updated_at = ?
          WHERE id = ?
        `);
        updateStmt.run([now, orderId]);
        updateStmt.free();

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'STORE_RESERVATION_CANCEL',
          orderId,
          existing.buyer_name,
          `إلغاء طلب الحجز رقم ${existing.order_number} وإعادة الكميات للمخزون`
        );

        res.json({
          success: true,
          message: `تم إلغاء الطلب رقم ${existing.order_number} وإعادة كميات الأصناف إلى المخزون`,
        });
      } catch (e) {
        safeRollback(db);
        throw e;
      }
    } catch (err: any) {
      console.error('Cancel order error:', err);
      res.status(500).json({ error: err.message || 'فشل إلغاء الطلب' });
    }
  });

  // 12. Sales, Accounts & Inventory Audit Report
  app.get('/api/store/sales-audit', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (user.role !== 'ADMIN' && user.role !== 'DATA_ENTRY') {
        return res.status(403).json({ error: 'عفواً، تقرير الحسابات والمبيعات مخصص للمسؤولين فقط' });
      }

      const db = await getDb();

      // All completed sales (SOLD)
      const completedSales = queryAll(
        db,
        `SELECT * FROM store_orders WHERE status = 'SOLD' ORDER BY paid_at DESC, id DESC`
      );
      for (const sale of completedSales) {
        sale.items = queryAll(db, 'SELECT * FROM store_order_items WHERE order_id = ?', [sale.id]);
        enrichOrderWithContactInfo(sale, db);
      }

      // All active reservations (PENDING or WAITING_PICKUP)
      const activeReservations = queryAll(
        db,
        `SELECT * FROM store_orders WHERE status IN ('PENDING', 'WAITING_PICKUP') ORDER BY id DESC`
      );
      for (const resv of activeReservations) {
        resv.items = queryAll(db, 'SELECT * FROM store_order_items WHERE order_id = ?', [resv.id]);
        enrichOrderWithContactInfo(resv, db);
      }

      // Inventory with sales stats
      const items = queryAll(db, `SELECT * FROM store_items ORDER BY id DESC`);
      const itemSalesStats = queryAll(
        db,
        `SELECT soi.item_id, SUM(soi.quantity) as sold_units, SUM(soi.total_price) as sold_revenue
         FROM store_order_items soi
         JOIN store_orders so ON so.id = soi.order_id
         WHERE so.status = 'SOLD'
         GROUP BY soi.item_id`
      );

      const salesMap: Record<number, { sold_units: number; sold_revenue: number }> = {};
      itemSalesStats.forEach((s: any) => {
        salesMap[s.item_id] = {
          sold_units: Number(s.sold_units) || 0,
          sold_revenue: Number(s.sold_revenue) || 0,
        };
      });

      let totalRemainingStock = 0;
      let totalInventoryValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const inventory = items.map((item: any) => {
        const stock = Number(item.stock) || 0;
        const price = Number(item.price) || 0;
        totalRemainingStock += stock;
        totalInventoryValue += stock * price;
        if (stock === 0) outOfStockCount++;
        else if (stock <= 5) lowStockCount++;

        const stat = salesMap[item.id] || { sold_units: 0, sold_revenue: 0 };
        return {
          ...item,
          sold_units: stat.sold_units,
          sold_revenue: stat.sold_revenue,
          inventory_value: stock * price,
        };
      });

      // Financial calculations
      let totalSoldRevenue = 0;
      let totalSoldUnits = 0;
      completedSales.forEach((s: any) => {
        totalSoldRevenue += Number(s.total_price) || 0;
        totalSoldUnits += Number(s.total_items) || 0;
      });

      let pendingRevenue = 0;
      activeReservations.forEach((r: any) => {
        if (r.status === 'WAITING_PICKUP') {
          pendingRevenue += Number(r.total_price) || 0;
        }
      });

      res.json({
        financialSummary: {
          totalSoldRevenue,
          pendingRevenue,
          totalSoldUnits,
          totalSoldOrders: completedSales.length,
          activeReservationsCount: activeReservations.length,
          totalRemainingStock,
          totalInventoryValue,
          lowStockCount,
          outOfStockCount,
        },
        completedSales,
        activeReservations,
        inventory,
      });
    } catch (err: any) {
      console.error('Sales audit error:', err);
      res.status(500).json({ error: 'فشل استخراج تقرير المبيعات والمخزون' });
    }
  });

  // --- 5.5 CSV TEMPLATE & BATCH IMPORT ---
  // Download Blank CSV Template (For Data Entry & Admin)
  app.get('/api/csv/template', authenticate, async (req: Request, res: Response) => {
    try {
      const headers = [
        'اسم الطالبة',
        'اسم الطالبة بالإنجليزية',
        'اسم ولي الأمر',
        'وظيفة الأب',
        'اسم الأم',
        'وظيفة الأم',
        'الرقم القومي',
        'تاريخ الميلاد',
        'المرحلة الدراسية',
        'سنة الالتحاق',
        'الصفة',
        'اسم العشيرة',
        'عنوان المنزل بالتفصيل',
        'الموهبة والمهارة',
        'الحالة المرضية',
        'تليفون الأب',
        'تليفون الأم',
        'رابط الصورة',
      ];

      const sampleRow = [
        'مريم هاني ميخائيل',
        'Mary Hany Mikhail',
        'هاني ميخائيل',
        'مهندس',
        'ماريان سمير',
        'صيدلانية',
        '31008150109988',
        '2010-08-15',
        'إعدادي',
        '2024',
        'عضوة',
        'عشيرة النسور',
        'العبور - الحي السابع - عمارة 15',
        'الرسم والعزف الموسيقي',
        'سليم معافى',
        '01234567890',
        '01098765432',
        'https://drive.google.com/file/d/1a2b3c4d5e/view?usp=sharing',
      ];

      const csvContent =
        '\uFEFF' +
        headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') +
        '\r\n' +
        sampleRow.map((v) => `"${v.replace(/"/g, '""')}"`).join(',') +
        '\r\n';

      const fileName = 'Scout_Members_Template.csv';
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(Buffer.from(csvContent, 'utf-8'));
    } catch (err) {
      console.error('CSV template error:', err);
      res.status(500).json({ error: 'فشل تحميل نموذج CSV' });
    }
  });

  // Download All Members as CSV
  app.get('/api/csv/export', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const members = queryAll(
        db,
        `SELECT 
          m.member_code as [كود العضو],
          m.student_name as [اسم الطالبة],
          COALESCE(m.student_name_en, '') as [اسم الطالبة بالإنجليزية],
          m.guardian_name as [اسم ولي الأمر],
          COALESCE(m.father_job, '') as [وظيفة الأب],
          COALESCE(m.mother_name, '') as [اسم الأم],
          COALESCE(m.mother_job, '') as [وظيفة الأم],
          m.national_id as [الرقم القومي],
          m.birth_date as [تاريخ الميلاد],
          m.school_stage as [الصف الدراسي],
          m.scout_join_year as [سنة الالتحاق],
          m.member_type as [الصفة],
          COALESCE(t.name, '') as [العشيرة],
          COALESCE(m.address, '') as [عنوان المنزل بالتفصيل],
          COALESCE(m.talents_skills, '') as [الموهبة والمهارة],
          COALESCE(m.medical_condition, '') as [الحالة المرضية],
          COALESCE(m.father_phone, '') as [تليفون الأب],
          COALESCE(m.mother_phone, '') as [تليفون الأم],
          COALESCE(m.photo_path, '') as [رابط الصورة]
        FROM members m
        LEFT JOIN tribes t ON m.tribe_id = t.id
        ORDER BY m.id ASC`
      );

      if (members.length === 0) {
        const headers = [
          'كود العضو',
          'اسم الطالبة',
          'اسم الطالبة بالإنجليزية',
          'اسم ولي الأمر',
          'وظيفة الأب',
          'اسم الأم',
          'وظيفة الأم',
          'الرقم القومي',
          'تاريخ الميلاد',
          'المرحلة الدراسية',
          'سنة الالتحاق',
          'الصفة',
          'العشيرة',
          'عنوان المنزل بالتفصيل',
          'الموهبة والمهارة',
          'الحالة المرضية',
          'تليفون الأب',
          'تليفون الأم',
          'رابط الصورة',
        ];
        const emptyCsv = '\uFEFF' + headers.map((h) => `"${h}"`).join(',') + '\r\n';
        res.setHeader('Content-Disposition', 'attachment; filename="Scout_Members_Export.csv"');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send(Buffer.from(emptyCsv, 'utf-8'));
      }

      const headers = Object.keys(members[0]);
      const csvLines = [
        '\uFEFF' + headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ];

      for (const row of members) {
        const line = headers.map((h) => {
          const val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',');
        csvLines.push(line);
      }

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const fileName = `Scout_Members_${yyyy}-${mm}-${dd}.csv`;

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(Buffer.from(csvLines.join('\r\n'), 'utf-8'));
    } catch (err) {
      console.error('CSV export error:', err);
      res.status(500).json({ error: 'فشل تصدير ملف CSV' });
    }
  });

  // Batch Import Members from CSV or Excel (For Admin & Data Entry)
  app.post('/api/members/batch-import', authenticate, upload.single('file'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'يرجى اختيار ملف CSV أو Excel (.xlsx)' });
      }

      let rows: any[] = [];
      const fileName = req.file.originalname || '';
      const isCsv = fileName.toLowerCase().endsWith('.csv') || req.file.mimetype.includes('csv');

      if (isCsv) {
        // Parse CSV with UTF-8 support
        const csvStr = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
        try {
          const wb = XLSX.read(csvStr, { type: 'string' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(firstSheet);
        } catch {
          // Fallback simple CSV parser
          const lines = csvStr.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 1) {
            const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split(',').map((p) => p.replace(/^["']|["']$/g, '').trim());
              const obj: any = {};
              headers.forEach((h, idx) => {
                obj[h] = parts[idx] || '';
              });
              rows.push(obj);
            }
          }
        }
      } else {
        // Parse Excel workbook
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames.find((s) => s.toLowerCase().includes('member') || s.includes('أعضاء')) || wb.SheetNames[0];
        rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'الملف المرفوع فارغ أو لا يحتوي على أي صفوف بيانات صالحة' });
      }

      const getVal = (row: any, ...keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
          }
        }
        return '';
      };

      const db = await getDb();

      // Query existing national IDs to prevent duplicates
      const existingMembers = queryAll(db, 'SELECT national_id, member_code FROM members');
      const existingNatIds = new Set(existingMembers.map((m) => String(m.national_id).trim()));
      const existingCodes = new Set(existingMembers.map((m) => String(m.member_code).trim()));

      // Get existing tribes map
      const existingTribes = queryAll(db, 'SELECT id, name FROM tribes');
      const tribeMap = new Map<string, number>();
      for (const t of existingTribes) {
        tribeMap.set(t.name.trim(), t.id);
      }

      const seenNatIdsInBatch = new Set<string>();
      const validatedList: any[] = [];
      const skippedRows: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 2; // header is row 1

        const studentName = getVal(r, 'اسم الطالبة', 'student_name', 'Student Name', 'الاسم', 'اسم الطالب');
        const studentNameEn = getVal(r, 'اسم الطالبة بالإنجليزية', 'اسم الطالبة بالانجليزية', 'student_name_en', 'Student Name En', 'English Name');
        const guardianName = getVal(r, 'اسم ولي الأمر', 'guardian_name', 'Guardian Name', 'ولي الأمر') || studentName;
        const fatherJob = getVal(r, 'وظيفة الأب', 'father_job', 'Father Job', 'مهنة الأب');
        const motherName = getVal(r, 'اسم الأم', 'mother_name', 'Mother Name');
        const motherJob = getVal(r, 'وظيفة الأم', 'mother_job', 'Mother Job', 'مهنة الأم');
        const rawNatId = getVal(r, 'الرقم القومي', 'national_id', 'National ID', 'الرقم_القومي');
        const nationalId = rawNatId.replace(/\D/g, '');
        const memberCode = getVal(r, 'كود العضو', 'member_code', 'Member Code', 'الكود');
        const birthDate = getVal(r, 'تاريخ الميلاد', 'birth_date', 'Birth Date');
        const schoolStage = normalizeGrade(getVal(r, 'الصف الدراسي', 'الصف', 'المرحلة الدراسية', 'المرحلة', 'school_stage', 'Stage', 'Grade'));
        const scoutJoinYearStr = getVal(r, 'سنة الالتحاق', 'scout_join_year', 'Join Year');
        const memberType = getVal(r, 'الصفة', 'member_type', 'Type') || 'عضوة';
        const tribeName = getVal(r, 'اسم العشيرة', 'العشيرة', 'tribe_name', 'Tribe');
        const address = getVal(r, 'عنوان المنزل بالتفصيل', 'عنوان المنزل', 'العنوان', 'address', 'Address');
        const talentsSkills = getVal(r, 'الموهبة والمهارة', 'الموهبة و المهارة', 'الموهبة', 'المهارة', 'talents_skills', 'Talents and Skills');
        const medicalCondition = getVal(r, 'الحالة المرضية', 'medical_condition', 'Medical');
        const fatherPhone = getVal(r, 'تليفون الأب', 'father_phone', 'Father Phone', 'هاتف الأب');
        const motherPhone = getVal(r, 'تليفون الأم', 'mother_phone', 'Mother Phone', 'هاتف الأم');
        const rawPhotoUrl = getVal(
          r,
          'رابط الصورة',
          'رابط صورة العضو',
          'لينك الصورة',
          'الصورة',
          'photo_url',
          'Photo URL',
          'photo_link',
          'image_url',
          'رابط استرداد صور العضو',
          'رابط استرداد الصورة',
          'مسار الصورة',
          'photo_path'
        );

        // Ignore dummy or template sample rows
        if (studentName === 'مريم هاني ميخائيل' && nationalId === '31008150109988' && rows.length > 1) {
          continue;
        }

        if (!studentName) {
          skippedRows.push(`الصف ${rowNum}: تم تخطيه لعدم وجود اسم الطالبة`);
          continue;
        }

        if (!nationalId || nationalId.length !== 14) {
          skippedRows.push(`الصف ${rowNum} (${studentName}): تم تخطيه لأن الرقم القومي [${rawNatId}] غير صحيح (يجب أن يكون 14 رقماً)`);
          continue;
        }

        if (existingNatIds.has(nationalId)) {
          skippedRows.push(`الصف ${rowNum} (${studentName}): الرقم القومي (${nationalId}) مسجل مسبقاً في النظام`);
          continue;
        }

        if (seenNatIdsInBatch.has(nationalId)) {
          skippedRows.push(`الصف ${rowNum} (${studentName}): الرقم القومي مكرر أكثر من مرة داخل نفس الملف المرفوع`);
          continue;
        }

        seenNatIdsInBatch.add(nationalId);

        let finalStage: 'تمهيدي' | 'ابتدائي' | 'إعدادي' | 'ثانوي' | 'جامعة' = 'ابتدائي';
        if (schoolStage.includes('تمهيد')) finalStage = 'تمهيدي';
        else if (schoolStage.includes('إعداد') || schoolStage.includes('اعداد')) finalStage = 'إعدادي';
        else if (schoolStage.includes('ثانو') || schoolStage.includes('ثانوي')) finalStage = 'ثانوي';
        else if (schoolStage.includes('جامع')) finalStage = 'جامعة';

        let joinYear = parseInt(scoutJoinYearStr, 10);
        if (isNaN(joinYear) || joinYear < 1980 || joinYear > 2100) {
          joinYear = new Date().getFullYear();
        }

        validatedList.push({
          studentName,
          studentNameEn: studentNameEn || null,
          guardianName,
          fatherJob: fatherJob || null,
          motherName: motherName || null,
          motherJob: motherJob || null,
          nationalId,
          memberCode: memberCode || null,
          birthDate: birthDate || '2012-01-01',
          schoolStage: finalStage,
          joinYear,
          memberType: memberType.includes('قائد') ? 'قائد' : 'عضوة',
          tribeName: tribeName || null,
          address: address || null,
          talentsSkills: talentsSkills || null,
          medicalCondition: medicalCondition || null,
          fatherPhone: fatherPhone || null,
          motherPhone: motherPhone || null,
          rawPhotoUrl: rawPhotoUrl || null,
          downloadedPhotoPath: null as string | null,
        });
      }

      if (validatedList.length === 0) {
        return res.status(400).json({
          error: 'لم يتم العثور على أي صفوف بيانات صالحة للإضافة',
          details: skippedRows,
        });
      }

      // Download member photos from external URLs (Google Drive, etc.) asynchronously BEFORE database transaction
      let downloadedPhotosCount = 0;
      for (const m of validatedList) {
        if (m.rawPhotoUrl) {
          try {
            const savedLocalPath = await downloadImageAndSaveLocally(
              m.rawPhotoUrl,
              `batch_${m.nationalId}`
            );
            if (savedLocalPath) {
              m.downloadedPhotoPath = savedLocalPath;
              downloadedPhotosCount++;
            }
          } catch (photoErr: any) {
            console.warn(`[BATCH_IMPORT] Could not download photo for nationalId ${m.nationalId}:`, photoErr?.message);
          }
        }
      }

      // Execute Batch Insertion in Transaction
      db.run('BEGIN TRANSACTION;');
      try {
        const now = new Date().toISOString();

        // 1. Create any missing tribes referenced in the batch
        for (const m of validatedList) {
          if (m.tribeName && !tribeMap.has(m.tribeName)) {
            const countStmt = queryOne(db, 'SELECT COUNT(*) as count FROM tribes');
            const nextCode = `TR-${String((countStmt?.count || 0) + 1).padStart(3, '0')}`;
            db.run(
              'INSERT INTO tribes (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
              [nextCode, m.tribeName, now, now]
            );
            const insertedTribe = queryOne(db, 'SELECT last_insert_rowid() as id');
            if (insertedTribe?.id) {
              tribeMap.set(m.tribeName, insertedTribe.id);
            }
          }
        }

        // 2. Determine next sequence counter for member codes starting from sc000150
        let maxSeq = 149;
        const counterStmt = queryOne(db, "SELECT value FROM system_counters WHERE key = 'member_seq'");
        if (counterStmt?.value && Number(counterStmt.value) >= 149 && Number(counterStmt.value) < 250000) {
          maxSeq = Number(counterStmt.value);
        }

        // Check max sequence from existing codes in database
        for (const existing of existingCodes) {
          const match = existing.match(/^sc0*(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxSeq) maxSeq = num;
          }
        }

        let insertedCount = 0;
        for (const m of validatedList) {
          let code = m.memberCode;
          if (!code || existingCodes.has(code)) {
            maxSeq++;
            code = formatMemberCode(maxSeq);
            while (existingCodes.has(code)) {
              maxSeq++;
              code = formatMemberCode(maxSeq);
            }
          }
          existingCodes.add(code);

          const tribeId = m.tribeName ? tribeMap.get(m.tribeName) || null : null;

          const stmt = db.prepare(`
            INSERT INTO members (
              member_code, student_name, student_name_en, guardian_name, national_id, birth_date,
              school_stage, scout_join_year, medical_condition, father_phone, mother_phone,
              father_job, mother_name, mother_job, address, talents_skills,
              member_type, tribe_id, photo_path, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          stmt.run([
            code,
            m.studentName,
            m.studentNameEn,
            m.guardianName,
            m.nationalId,
            m.birthDate,
            m.schoolStage,
            m.joinYear,
            m.medicalCondition,
            m.fatherPhone,
            m.motherPhone,
            m.fatherJob,
            m.motherName,
            m.motherJob,
            m.address,
            m.talentsSkills,
            m.memberType,
            tribeId,
            m.downloadedPhotoPath || null,
            now,
            now,
          ]);
          stmt.free();
          insertedCount++;
        }

        // Update system counter
        db.run("UPDATE system_counters SET value = ? WHERE key = 'member_seq'", [maxSeq]);

        db.run('COMMIT;');
        saveDb();

        logAudit(
          user.username,
          'BATCH_IMPORT',
          null,
          null,
          `إضافة جماعية لعدد (${insertedCount}) عضو دفعة واحدة من ملف ${fileName} (مع استرداد ${downloadedPhotosCount} صورة بنجاح)`
        );

        res.json({
          success: true,
          count: insertedCount,
          skippedCount: skippedRows.length,
          skippedDetails: skippedRows,
          downloadedPhotosCount,
          message: `تمت إضافة (${insertedCount}) عضو جديد بنجاح إلى النظام دفعة واحدة${downloadedPhotosCount > 0 ? ` واسترداد (${downloadedPhotosCount}) صورة شخصية` : ''}`,
        });
      } catch (transErr) {
        safeRollback(db);
        throw transErr;
      }
    } catch (err: any) {
      console.error('Batch import error:', err);
      res.status(500).json({ error: err.message || 'فشلت عملية استيراد الأعضاء دفعة واحدة' });
    }
  });

  // --- 6. EXCEL BACKUP & RESTORE (.XLSX) ---
  // Download Excel Backup (ADMIN ONLY - Classifies Members & Leaders into separate sheets)
  app.get('/api/backup/excel/download', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const db = await getDb();
      saveDb();

      // 1. Members Data (عضوة)
      const members = queryAll(
        db,
        `SELECT 
          m.member_code as [كود العضو],
          m.student_name as [اسم الطالبة],
          COALESCE(m.student_name_en, '') as [اسم الطالبة بالإنجليزية],
          m.guardian_name as [اسم ولي الأمر],
          COALESCE(m.father_job, '') as [وظيفة الأب],
          COALESCE(m.father_phone, '') as [تليفون الأب],
          COALESCE(m.mother_name, '') as [اسم الأم],
          COALESCE(m.mother_job, '') as [وظيفة الأم],
          COALESCE(m.mother_phone, '') as [تليفون الأم],
          COALESCE(m.mother_email, '') as [البريد الإلكتروني للأم],
          m.national_id as [الرقم القومي],
          m.birth_date as [تاريخ الميلاد],
          m.school_stage as [الصف الدراسي],
          m.scout_join_year as [سنة الالتحاق],
          m.member_type as [الصفة],
          COALESCE(t.name, '') as [العشيرة],
          COALESCE(m.address, '') as [عنوان المنزل بالتفصيل],
          COALESCE(m.talents_skills, '') as [الموهبة والمهارة],
          COALESCE(m.medical_condition, '') as [الحالة المرضية],
          COALESCE(m.photo_path, '') as [مسار الصورة],
          m.created_at as [تاريخ الإنشاء],
          m.updated_at as [تاريخ التعديل]
        FROM members m
        LEFT JOIN tribes t ON m.tribe_id = t.id
        WHERE m.member_type = 'عضوة'
        ORDER BY m.id ASC`
      );

      // 2. Leaders Data (قائد)
      const leaders = queryAll(
        db,
        `SELECT 
          m.member_code as [كود القائد],
          m.student_name as [اسم القائد],
          COALESCE(m.student_name_en, '') as [اسم القائد بالإنجليزية],
          COALESCE(m.leader_phone, m.father_phone, m.mother_phone, '') as [رقم تليفون القائد],
          COALESCE(m.leader_email, '') as [البريد الإلكتروني للقائد],
          m.national_id as [الرقم القومي],
          m.birth_date as [تاريخ الميلاد],
          m.school_stage as [الصف الدراسي],
          m.scout_join_year as [سنة الالتحاق],
          m.member_type as [الصفة],
          COALESCE(t.name, '') as [العشيرة],
          COALESCE(m.address, '') as [عنوان المنزل بالتفصيل],
          COALESCE(m.talents_skills, '') as [الموهبة والمهارة],
          COALESCE(m.medical_condition, '') as [الحالة المرضية],
          COALESCE(m.photo_path, '') as [مسار الصورة],
          m.created_at as [تاريخ الإنشاء],
          m.updated_at as [تاريخ التعديل]
        FROM members m
        LEFT JOIN tribes t ON m.tribe_id = t.id
        WHERE m.member_type = 'قائد'
        ORDER BY m.id ASC`
      );

      // 3. Tribes Data
      const tribes = queryAll(
        db,
        `SELECT 
          t.code as [كود العشيرة],
          t.name as [اسم العشيرة],
          COALESCE(l.student_name, '') as [القائد],
          COALESCE(l.member_code, '') as [كود القائد],
          COALESCE(d.student_name, '') as [النائب],
          COALESCE(d.member_code, '') as [كود النائب],
          COALESCE(t.description, '') as [الوصف],
          (SELECT COUNT(*) FROM members WHERE tribe_id = t.id) as [عدد الأعضاء],
          t.created_at as [تاريخ الإنشاء],
          t.updated_at as [تاريخ التعديل]
        FROM tribes t
        LEFT JOIN members l ON t.leader_id = l.id
        LEFT JOIN members d ON t.deputy_id = d.id
        ORDER BY t.id ASC`
      );

      // 4. Audit Log Data
      const logs = queryAll(
        db,
        `SELECT 
          date as [التاريخ],
          time as [الوقت],
          user as [المستخدم],
          action as [العملية],
          COALESCE(member_name, '') as [اسم العضو],
          COALESCE(details, '') as [التفاصيل],
          created_at as [تاريخ التسجيل]
        FROM audit_log
        ORDER BY id DESC LIMIT 1000`
      );

      const wb = XLSX.utils.book_new();

      const wsMembers = XLSX.utils.json_to_sheet(members);
      XLSX.utils.book_append_sheet(wb, wsMembers, 'الأعضاء (Members)');

      const wsLeaders = XLSX.utils.json_to_sheet(leaders);
      XLSX.utils.book_append_sheet(wb, wsLeaders, 'القادة (Leaders)');

      const wsTribes = XLSX.utils.json_to_sheet(tribes);
      XLSX.utils.book_append_sheet(wb, wsTribes, 'العشائر (Tribes)');

      const wsAudit = XLSX.utils.json_to_sheet(logs);
      XLSX.utils.book_append_sheet(wb, wsAudit, 'سجل العمليات (AuditLog)');

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');

      const fileName = `Scout_Backup_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.xlsx`;
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      logAudit(user.username, 'EXCEL_BACKUP', null, null, `تصدير نسخة احتياطية Excel كاملة: ${fileName}`);

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(excelBuffer);
    } catch (err) {
      console.error('Excel backup error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء إنشاء نسخة Excel الاحتياطية' });
    }
  });

  // Helper to execute full Excel restore from buffer with robust parsing & persistence
  async function executeExcelRestore(buffer: Buffer, username: string) {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (parseErr) {
      throw new Error('الملف المرفوع غير صالح أو ليس ملف Excel معتمد');
    }

    const sheetNames = wb.SheetNames;
    if (!sheetNames || sheetNames.length === 0) {
      throw new Error('ملف Excel لا يحتوي على أي صفحات بيانات');
    }

    // Save uploaded file copy to persistent storage
    try {
      const dataDir = path.dirname(BACKUP_EXCEL_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(BACKUP_EXCEL_FILE, buffer);
      fs.writeFileSync(path.join(PROJECT_ROOT, 'scout_backup_latest.xlsx'), buffer);
    } catch (saveErr) {
      console.error('[RESTORE] Warning: Could not save raw Excel backup file copy:', saveErr);
    }

    // Identify tribes sheet
    const tribesSheetName = sheetNames.find((s) => {
      const lower = s.toLowerCase();
      return lower.includes('tribe') || s.includes('عشائر') || s.includes('العشيرة') || s.includes('عشيرة');
    });
    const tribesRaw: any[] = tribesSheetName ? XLSX.utils.sheet_to_json(wb.Sheets[tribesSheetName], { defval: '' }) : [];

    // Collect members from all non-tribes and non-audit sheets
    let membersRaw: any[] = [];
    for (const sName of sheetNames) {
      if (sName === tribesSheetName) continue;
      const lower = sName.toLowerCase();
      if (lower.includes('audit') || sName.includes('سجل') || sName.includes('عمليات')) {
        continue;
      }
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sName], { defval: '' });
      const isLeaderSheet = lower.includes('leader') || sName.includes('قادة') || sName.includes('القادة');
      for (const r of rows) {
        if (isLeaderSheet && !r._isLeaderSheet) {
          r._isLeaderSheet = true;
        }
        membersRaw.push(r);
      }
    }

    if (membersRaw.length === 0 && sheetNames.length > 0) {
      membersRaw = XLSX.utils.sheet_to_json(wb.Sheets[sheetNames[0]], { defval: '' });
    }

    // Helper to get field by Arabic or English key (trimmed & case-insensitive)
    const getVal = (row: any, ...keys: string[]) => {
      if (!row || typeof row !== 'object') return '';
      const rowKeys = Object.keys(row);
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
        const foundKey = rowKeys.find((rk) => rk.trim().toLowerCase() === k.trim().toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
          return String(row[foundKey]).trim();
        }
      }
      return '';
    };

    const parseDateVal = (val: any): string => {
      if (!val) return '2012-01-01';
      if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().split('T')[0];
      }
      const str = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      const num = parseFloat(str);
      if (!isNaN(num) && num > 1000 && num < 100000) {
        try {
          const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
          if (!isNaN(jsDate.getTime())) {
            return jsDate.toISOString().split('T')[0];
          }
        } catch (e) {}
      }
      return '2012-01-01';
    };

    const seenNationalIds = new Set<string>();
    const seenMemberCodes = new Set<string>();
    const validatedMembers: any[] = [];

    for (let i = 0; i < membersRaw.length; i++) {
      const row = membersRaw[i];
      const studentName = getVal(
        row,
        'اسم الطالبة', 'اسم الطالب', 'اسم العضو', 'اسم العضوة', 'اسم القائد', 'اسم القائدة',
        'الاسم', 'الاسم بالكامل', 'الاسم رباعي', 'اسم المشترك', 'اسم الخادم', 'اسم التلميذ', 'اسم التلميذة',
        'student_name', 'Student Name', 'name', 'Name', 'full_name', 'Full Name', 'member_name', 'Member Name', 'leader_name', 'Leader Name'
      );
      if (!studentName) continue;

      const studentNameEn = getVal(
        row,
        'اسم الطالبة بالإنجليزية', 'اسم الطالبة بالانجليزية', 'اسم الطالب بالإنجليزية', 'اسم القائد بالإنجليزية',
        'اسم القائد بالانجليزية', 'اسم العضو بالإنجليزية', 'الاسم بالإنجليزية', 'الاسم بالانجليزية',
        'student_name_en', 'Student Name En', 'English Name', 'english_name'
      );

      const guardianName = getVal(
        row,
        'اسم ولي الأمر', 'ولي الأمر', 'اسم الأب', 'الوالد', 'guardian_name', 'Guardian Name', 'father_name', 'Father Name'
      ) || studentName;

      const fatherJob = getVal(row, 'وظيفة الأب', 'father_job', 'Father Job', 'مهنة الأب');
      const motherName = getVal(row, 'اسم الأم', 'mother_name', 'Mother Name');
      const motherJob = getVal(row, 'وظيفة الأم', 'mother_job', 'Mother Job', 'مهنة الأم');

      let rawNatId = getVal(
        row,
        'الرقم القومي', 'رقم قومي', 'الرقم القومي للطالبة', 'الرقم القومي للطالب', 'الرقم القومي للقائد', 'الرقم_القومي', 'بطاقة الرقم القومي', 'national_id', 'National ID', 'id_number'
      );
      let nationalId = rawNatId.replace(/\D/g, '');
      if (!nationalId || nationalId.length < 10) {
        nationalId = `300000${String(i + 1).padStart(8, '0')}`;
      } else if (nationalId.length > 14) {
        nationalId = nationalId.substring(0, 14);
      }

      if (seenNationalIds.has(nationalId)) {
        nationalId = `300000${String(i + 1).padStart(8, '0')}`;
      }
      seenNationalIds.add(nationalId);

      const memberCode = getVal(
        row,
        'كود العضو', 'كود القائد', 'كود العضوة', 'كود', 'الكود', 'رقم القيد', 'member_code', 'Member Code', 'code', 'Code'
      );
      if (memberCode) {
        seenMemberCodes.add(memberCode);
      }

      const rawBirthDate = getVal(row, 'تاريخ الميلاد', 'birth_date', 'Birth Date');
      const birthDate = parseDateVal(row['تاريخ الميلاد'] || rawBirthDate);

      const rawStage = getVal(row, 'الصف الدراسي', 'الصف', 'المرحلة الدراسية', 'المرحلة', 'school_stage', 'Stage', 'Grade');
      const schoolStage = normalizeGrade(rawStage);

      const scoutJoinYearStr = getVal(row, 'سنة الالتحاق', 'scout_join_year', 'Join Year');
      let joinYear = parseInt(scoutJoinYearStr, 10);
      if (isNaN(joinYear) || joinYear < 1980 || joinYear > 2100) {
        joinYear = new Date().getFullYear();
      }

      const rawMemberType = getVal(row, 'الصفة', 'نوع العضو', 'member_type', 'Type', 'الصفه');
      let memberType: 'عضوة' | 'قائد' = 'عضوة';
      if (
        row._isLeaderSheet ||
        rawMemberType.includes('قائد') ||
        rawMemberType.includes('leader') ||
        row['كود القائد'] ||
        row['اسم القائد'] ||
        row['رقم تليفون القائد'] ||
        row['البريد الإلكتروني للقائد']
      ) {
        memberType = 'قائد';
      }

      const tribeName = getVal(row, 'العشيرة', 'اسم العشيرة', 'الفريق', 'tribe_name', 'Tribe');
      const address = getVal(row, 'عنوان المنزل بالتفصيل', 'عنوان المنزل', 'العنوان', 'address', 'Address');
      const talentsSkills = getVal(row, 'الموهبة والمهارة', 'الموهبة و المهارة', 'الموهبة', 'المهارة', 'talents_skills', 'Talents and Skills');
      const medicalCondition = getVal(row, 'الحالة المرضية', 'medical_condition', 'Medical');
      const leaderPhone = getVal(row, 'رقم تليفون القائد', 'تليفون القائد', 'هاتف القائد', 'موبايل القائد', 'leader_phone', 'Leader Phone');
      let fatherPhone = getVal(row, 'تليفون الأب', 'هاتف الأب', 'موبايل الأب', 'رقم تليفون الأب', 'father_phone', 'Father Phone', 'رقم الهاتف', 'الهاتف', 'الموبايل', 'التليفون', 'phone', 'mobile');
      let motherPhone = getVal(row, 'تليفون الأم', 'هاتف الأم', 'موبايل الأم', 'رقم تليفون الأم', 'mother_phone', 'Mother Phone');
      let motherEmail = getVal(row, 'البريد الإلكتروني للأم', 'بريد الأم', 'mother_email', 'Mother Email');
      let leaderEmail = getVal(row, 'البريد الإلكتروني للقائد', 'بريد القائد', 'البريد الإلكتروني', 'البريد', 'الإيميل', 'leader_email', 'Leader Email', 'email', 'Email');

      if (memberType === 'قائد' && leaderPhone) {
        fatherPhone = leaderPhone;
        motherPhone = '';
        motherEmail = '';
      }
      if (memberType === 'عضوة') {
        leaderEmail = '';
      }

      const photoPath = getVal(
        row,
        'رابط الصورة',
        'رابط صورة العضو',
        'لينك الصورة',
        'الصورة',
        'photo_url',
        'Photo URL',
        'photo_link',
        'image_url',
        'رابط استرداد صور العضو',
        'رابط استرداد الصورة',
        'مسار الصورة',
        'photo_path',
        'Photo Path'
      );

      validatedMembers.push({
        studentName,
        studentNameEn: studentNameEn || null,
        guardianName,
        fatherJob: fatherJob || null,
        motherName: motherName || null,
        motherJob: motherJob || null,
        nationalId,
        memberCode,
        birthDate,
        schoolStage,
        joinYear,
        memberType,
        tribeName,
        address: address || null,
        talentsSkills: talentsSkills || null,
        medicalCondition: medicalCondition || null,
        fatherPhone: fatherPhone || null,
        motherPhone: motherPhone || null,
        leaderPhone: leaderPhone || (memberType === 'قائد' ? fatherPhone : null) || null,
        motherEmail: motherEmail || null,
        leaderEmail: leaderEmail || null,
        photoPath: photoPath || null,
      });
    }

    if (validatedMembers.length === 0) {
      throw new Error('لم يتم العثور على أي بيانات أعضاء صالحة داخل ملف Excel المرفوع');
    }

    // Process photo download for members if photoPath is an external URL (e.g. Google Drive)
    for (const m of validatedMembers) {
      if (m.photoPath && (m.photoPath.startsWith('http://') || m.photoPath.startsWith('https://') || m.photoPath.startsWith('data:image/'))) {
        try {
          const downloadedPath = await downloadImageAndSaveLocally(
            m.photoPath,
            `restore_${m.nationalId || m.memberCode || Date.now()}`
          );
          if (downloadedPath) {
            m.photoPath = downloadedPath;
          }
        } catch (photoErr: any) {
          console.warn(`[RESTORE] Could not download photo for member ${m.studentName}:`, photoErr?.message);
        }
      }
    }

    // Validated Tribes
    const validatedTribes: any[] = [];
    const seenTribeNames = new Set<string>();
    for (const tRow of tribesRaw) {
      const tName = getVal(tRow, 'اسم العشيرة', 'name', 'Tribe Name');
      const tCode = getVal(tRow, 'كود العشيرة', 'code', 'Tribe Code');
      const tLeader = getVal(tRow, 'القائد', 'كود القائد', 'leader');
      const tDeputy = getVal(tRow, 'النائب', 'كود النائب', 'deputy');
      const tDesc = getVal(tRow, 'الوصف', 'description', 'Description');

      if (tName && !seenTribeNames.has(tName)) {
        seenTribeNames.add(tName);
        validatedTribes.push({
          name: tName,
          code: tCode || `TR-${String(validatedTribes.length + 1).padStart(3, '0')}`,
          leaderRef: tLeader,
          deputyRef: tDeputy,
          description: tDesc || null,
        });
      }
    }

    for (const m of validatedMembers) {
      if (m.tribeName && !seenTribeNames.has(m.tribeName)) {
        seenTribeNames.add(m.tribeName);
        validatedTribes.push({
          name: m.tribeName,
          code: `TR-${String(validatedTribes.length + 1).padStart(3, '0')}`,
          leaderRef: '',
          deputyRef: '',
          description: null,
        });
      }
    }

    const db = await getDb();
    const now = new Date().toISOString();

    try {
      db.run('BEGIN TRANSACTION;');
      db.run('PRAGMA foreign_keys = OFF;');
      db.run('DELETE FROM activity_participants;');
      db.run('DELETE FROM members;');
      db.run('DELETE FROM tribes;');
      db.run('PRAGMA foreign_keys = ON;');

      // 1. Insert Tribes
      const tribeMap = new Map<string, number>();
      for (const tr of validatedTribes) {
        const tStmt = db.prepare(`
          INSERT INTO tribes (code, name, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        tStmt.run([tr.code, tr.name, tr.description, now, now]);
        tStmt.free();

        const tInsert = queryOne(db, 'SELECT last_insert_rowid() as id');
        if (tInsert?.id) {
          tribeMap.set(tr.name, tInsert.id);
        }
      }

      // 2. Insert Members
      let maxSeq = 149;
      const memberCodeToIdMap = new Map<string, number>();

      for (const m of validatedMembers) {
        let code = m.memberCode;
        if (!code) {
          maxSeq++;
          code = formatMemberCode(maxSeq);
        } else {
          const matchSC = code.match(/^sc0*(\d+)$/i);
          const matchA = code.match(/^A(\d+)$/i);
          const matchOldSC = code.match(/^SC-(\d+)$/i);
          if (matchSC && matchSC[1]) {
            const num = parseInt(matchSC[1], 10);
            if (num > maxSeq) maxSeq = num;
          } else if (matchA && matchA[1]) {
            const num = parseInt(matchA[1], 10);
            if (num > maxSeq && num < 250000) maxSeq = num;
          } else if (matchOldSC && matchOldSC[1]) {
            const num = parseInt(matchOldSC[1], 10);
            if (num > maxSeq && num < 250000) maxSeq = num;
          }
        }

        const tribeId = m.tribeName ? tribeMap.get(m.tribeName) || null : null;

        const effectiveLeaderPhone = m.memberType === 'قائد' ? (m.leaderPhone || m.fatherPhone || null) : null;
        const effectiveFatherPhone = m.memberType === 'قائد' ? effectiveLeaderPhone : (m.fatherPhone || null);
        const effectiveMotherPhone = m.memberType === 'قائد' ? null : (m.motherPhone || null);
        const effectiveLeaderEmail = m.memberType === 'قائد' ? (m.leaderEmail || null) : null;
        const effectiveMotherEmail = m.memberType === 'عضوة' ? (m.motherEmail || null) : null;

        const mStmt = db.prepare(`
          INSERT INTO members (
            member_code, student_name, student_name_en, guardian_name, national_id, birth_date,
            school_stage, scout_join_year, medical_condition, father_phone, mother_phone, leader_phone,
            mother_email, leader_email,
            father_job, mother_name, mother_job, address, talents_skills,
            member_type, tribe_id, photo_path, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        mStmt.run([
          code,
          m.studentName,
          m.studentNameEn,
          m.guardianName,
          m.nationalId,
          m.birthDate,
          m.schoolStage,
          m.joinYear,
          m.medicalCondition,
          effectiveFatherPhone,
          effectiveMotherPhone,
          effectiveLeaderPhone,
          effectiveMotherEmail,
          effectiveLeaderEmail,
          m.fatherJob,
          m.motherName,
          m.motherJob,
          m.address,
          m.talentsSkills,
          m.memberType,
          tribeId,
          m.photoPath,
          now,
          now,
        ]);
        mStmt.free();

        const mInsert = queryOne(db, 'SELECT last_insert_rowid() as id');
        if (mInsert?.id) {
          memberCodeToIdMap.set(code, mInsert.id);
          memberCodeToIdMap.set(m.studentName, mInsert.id);
        }
      }

      // 3. Link Leader & Deputy in Tribes
      for (const tr of validatedTribes) {
        const tId = tribeMap.get(tr.name);
        if (tId) {
          const leaderId = tr.leaderRef ? memberCodeToIdMap.get(tr.leaderRef) || null : null;
          const deputyId = tr.deputyRef ? memberCodeToIdMap.get(tr.deputyRef) || null : null;
          if (leaderId || deputyId) {
            const uStmt = db.prepare('UPDATE tribes SET leader_id = ?, deputy_id = ? WHERE id = ?');
            uStmt.run([leaderId, deputyId, tId]);
            uStmt.free();
          }
        }
      }

      // 4. Update system sequence counter
      const seqStmt = db.prepare('UPDATE system_counters SET value = ? WHERE key = "member_seq"');
      seqStmt.run([maxSeq]);
      seqStmt.free();

      // 5. Commit transaction
      db.run('COMMIT;');

      // 6. Force write to disk with fsync and persist snapshot
      saveDb();

      logAudit(
        username,
        'EXCEL_RESTORE',
        null,
        null,
        `استعادة ناجحة من ملف Excel: ${validatedMembers.length} عضو، ${validatedTribes.length} عشيرة`
      );

      console.log(`[RESTORE] Successfully restored ${validatedMembers.length} members and saved to disk & snapshot at: ${DB_PATH}`);

      return {
        memberCount: validatedMembers.length,
        tribeCount: validatedTribes.length,
        message: `تم استعادة وحفظ البيانات بنجاح: تم استيراد (${validatedMembers.length}) عضو و (${validatedTribes.length}) عشيرة`,
      };
    } catch (transErr: any) {
      try {
        safeRollback(db);
      } catch (rbErr) {}
      throw transErr;
    }
  }

  // Restore from Excel (ADMIN ONLY - Full Validation, Persistent Snapshot & Resilient Rollback)
  app.post('/api/backup/excel/restore', authenticate, requireAdmin, upload.single('excelFile'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'يرجى اختيار ملف Excel (.xlsx)' });
      }

      const result = await executeExcelRestore(req.file.buffer, user.username);
      res.json({
        success: true,
        message: result.message,
        memberCount: result.memberCount,
        tribeCount: result.tribeCount,
      });
    } catch (err: any) {
      console.error('Excel restore error:', err);
      res.status(500).json({ error: err.message || 'فشلت عملية استعادة البيانات من Excel' });
    }
  });

  // Check persistent backup and snapshot status
  app.get('/api/backup/status', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const memCount = queryOne(db, 'SELECT COUNT(*) as count FROM members')?.count || 0;
      const tribeCount = queryOne(db, 'SELECT COUNT(*) as count FROM tribes')?.count || 0;

      let hasSnapshot = false;
      let snapshotCount = 0;
      let snapshotDate: string | null = null;
      if (fs.existsSync(SNAPSHOT_FILE)) {
        try {
          const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
          if (snap && Array.isArray(snap.members)) {
            hasSnapshot = true;
            snapshotCount = snap.members.length;
            snapshotDate = snap.updated_at || null;
          }
        } catch (e) {}
      }

      const hasBackupExcel = fs.existsSync(BACKUP_EXCEL_FILE);

      res.json({
        totalMembers: memCount,
        totalTribes: tribeCount,
        hasSnapshot,
        snapshotCount,
        snapshotDate,
        hasBackupExcel,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Re-apply saved backup from disk (Excel or JSON Snapshot)
  app.post('/api/backup/excel/reapply-last', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;

      if (fs.existsSync(BACKUP_EXCEL_FILE)) {
        const buffer = fs.readFileSync(BACKUP_EXCEL_FILE);
        const result = await executeExcelRestore(buffer, user.username);
        return res.json({
          success: true,
          source: 'excel',
          message: `تم إعادة تطبيق أحدث نسخة Excel محفوظة بنجاح: ${result.memberCount} عضو`,
          memberCount: result.memberCount,
          tribeCount: result.tribeCount,
        });
      }

      // Fallback to snapshot
      const db = await getDb();
      const hydrated = hydrateFromSnapshotIfBetter(db);
      if (hydrated) {
        saveDb();
        const memCount = queryOne(db, 'SELECT COUNT(*) as count FROM members')?.count || 0;
        return res.json({
          success: true,
          source: 'snapshot',
          message: `تم استعادة ${memCount} عضو من لقطة البيانات المحفوظة بنجاح`,
          memberCount: memCount,
        });
      }

      return res.status(404).json({ error: 'لا توجد نسخة احتياطية محفوظة سابقة على القرص' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'فشلت إعادة تطبيق النسخة المحفوظة' });
    }
  });

  // --- 7. SQLITE & FULL SYSTEM BACKUP & RESTORE ---

  // Full System Backup Download (.zip: scout.db + photos + system metadata)
  app.get('/api/backup/full-system/download', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const db = await getDb();
      saveDb();

      if (!fs.existsSync(DB_PATH)) {
        return res.status(500).json({ error: 'ملف قاعدة البيانات غير موجود على القرص' });
      }

      const zip = new JSZip();
      const dbBuffer = fs.readFileSync(DB_PATH);
      zip.file('scout.db', dbBuffer);

      // Add photos directory if exists
      if (fs.existsSync(PHOTOS_DIR)) {
        const photosFolder = zip.folder('photos');
        const photoFiles = fs.readdirSync(PHOTOS_DIR);
        for (const file of photoFiles) {
          const fullPath = path.join(PHOTOS_DIR, file);
          if (fs.statSync(fullPath).isFile()) {
            const fileData = fs.readFileSync(fullPath);
            photosFolder?.file(file, fileData);
          }
        }
      }

      // Add backup metadata manifest
      const counts = {
        members: (queryOne(db, 'SELECT COUNT(*) as c FROM members')?.c as number) || 0,
        leaders: (queryOne(db, "SELECT COUNT(*) as c FROM members WHERE member_type = 'قائد'")?.c as number) || 0,
        tribes: (queryOne(db, 'SELECT COUNT(*) as c FROM tribes')?.c as number) || 0,
        users: (queryOne(db, 'SELECT COUNT(*) as c FROM users')?.c as number) || 0,
        badges: (queryOne(db, 'SELECT COUNT(*) as c FROM badges')?.c as number) || 0,
        activities: (queryOne(db, 'SELECT COUNT(*) as c FROM activities')?.c as number) || 0,
      };

      const manifest = {
        app: 'Scout Management System - St. Joseph School',
        version: '1.0.0',
        type: 'FULL_SYSTEM_BACKUP',
        created_at: new Date().toISOString(),
        created_by: user.username,
        stats: counts,
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const zipFileName = `Scout_FullSystem_Backup_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.zip`;

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      logAudit(user.username, 'FULL_SYSTEM_BACKUP', null, null, `إنشاء وتحميل نسخة احتياطية شاملة للنظام: ${zipFileName} (${counts.members} عضو، ${counts.tribes} عشيرة)`);

      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.setHeader('Content-Type', 'application/zip');
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Full system backup error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية الشاملة للنظام: ' + (err?.message || '') });
    }
  });

  // Restore Full System Backup (.zip or raw .db) (ADMIN ONLY)
  app.post('/api/backup/full-system/restore', authenticate, requireAdmin, upload.single('fullBackupFile'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'يرجى اختيار ملف النسخة الاحتياطية (.zip أو .db)' });
      }

      const buffer = req.file.buffer;
      const originalName = req.file.originalname.toLowerCase();

      let targetDbBuffer: Buffer | null = null;
      let restoredPhotosCount = 0;

      if (originalName.endsWith('.zip') || buffer.slice(0, 4).toString('hex') === '504b0304') {
        // Handle ZIP Archive
        const zip = await JSZip.loadAsync(buffer);

        // Find scout.db in zip root or any folder
        let dbZipFile = zip.file('scout.db');
        if (!dbZipFile) {
          const allFiles = Object.keys(zip.files);
          const foundDbPath = allFiles.find((f) => f.endsWith('.db') || f.endsWith('.sqlite'));
          if (foundDbPath) {
            dbZipFile = zip.file(foundDbPath);
          }
        }

        if (!dbZipFile) {
          return res.status(400).json({ error: 'ملف الـ ZIP لا يحتوي على ملف قاعدة البيانات scout.db' });
        }

        targetDbBuffer = await dbZipFile.async('nodebuffer');

        // Extract photos if present
        if (!fs.existsSync(PHOTOS_DIR)) {
          fs.mkdirSync(PHOTOS_DIR, { recursive: true });
        }

        const photoEntries = Object.keys(zip.files).filter(
          (fileName) => !zip.files[fileName].dir && (fileName.startsWith('photos/') || fileName.includes('/photos/'))
        );

        for (const photoPath of photoEntries) {
          const entry = zip.file(photoPath);
          if (entry) {
            const fileName = path.basename(photoPath);
            if (fileName && !fileName.startsWith('.')) {
              const photoData = await entry.async('nodebuffer');
              const destPath = path.join(PHOTOS_DIR, fileName);
              fs.writeFileSync(destPath, photoData);
              restoredPhotosCount++;
            }
          }
        }
      } else {
        // Raw .db file fallback
        targetDbBuffer = buffer;
      }

      // Validate SQLite Header ("SQLite format 3\0")
      const headerStr = targetDbBuffer.slice(0, 16).toString('utf-8');
      if (!headerStr.startsWith('SQLite format 3')) {
        return res.status(400).json({ error: 'ملف قاعدة البيانات المستخرج ليس ملف SQLite صالحاً' });
      }

      const SQL = await initSqlJs();
      const testDb = new SQL.Database(targetDbBuffer);

      // Verify essential tables exist
      const checkTables = queryAll(testDb, "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('members', 'users')");
      if (checkTables.length < 2) {
        return res.status(400).json({ error: 'ملف النسخة الاحتياطية لا يحتوي على جداول النظام المطلوبة (members, users)' });
      }

      const restoredMembersCount = (queryOne(testDb, 'SELECT COUNT(*) as c FROM members')?.c as number) || 0;
      const restoredTribesCount = (queryOne(testDb, 'SELECT COUNT(*) as c FROM tribes')?.c as number) || 0;

      // Backup existing database before overwriting
      try {
        if (fs.existsSync(DB_PATH)) {
          fs.copyFileSync(DB_PATH, `${DB_PATH}.bak`);
        }
      } catch (e) {}

      // Write to scout.db
      fs.writeFileSync(DB_PATH, targetDbBuffer);

      // Reload global db in memory
      reloadDbFromDisk();

      logAudit(
        user.username,
        'FULL_SYSTEM_RESTORE',
        null,
        null,
        `استعادة شاملة للنظام من ملف: ${req.file.originalname} (${restoredMembersCount} عضو، ${restoredTribesCount} عشيرة، ${restoredPhotosCount} صورة)`
      );

      res.json({
        success: true,
        message: `تم استعادة النظام بالكامل بنجاح: (${restoredMembersCount}) عضو، (${restoredTribesCount}) عشيرة${restoredPhotosCount > 0 ? `، و(${restoredPhotosCount}) صورة وملف شعار` : ''}`,
        stats: {
          members: restoredMembersCount,
          tribes: restoredTribesCount,
          photos: restoredPhotosCount,
        },
      });
    } catch (err: any) {
      console.error('Full system restore error:', err);
      res.status(500).json({ error: 'فشلت عملية استعادة النظام الشاملة: ' + (err?.message || 'تأكد من سلامة ملف النسخة الاحتياطية') });
    }
  });

  // Create & Download SQLite Backup
  app.get('/api/backup/download', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const db = await getDb();
      saveDb();

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');

      const fileName = `Scout_Backup_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.db`;

      if (!fs.existsSync(DB_PATH)) {
        return res.status(500).json({ error: 'ملف قاعدة البيانات غير موجود' });
      }

      const fileBuffer = fs.readFileSync(DB_PATH);

      logAudit(user.username, 'BACKUP', null, null, `إنشاء وتحميل نسخة احتياطية SQLite: ${fileName}`);

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/x-sqlite3');
      res.send(fileBuffer);
    } catch (err) {
      console.error('Backup error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية' });
    }
  });

  // Restore SQLite Backup (ADMIN ONLY)
  app.post('/api/backup/restore', authenticate, requireAdmin, upload.single('backupFile'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'يرجى اختيار ملف النسخة الاحتياطية (.db)' });
      }

      const buffer = req.file.buffer;

      // Validate SQLite Header ("SQLite format 3\0")
      const headerStr = buffer.slice(0, 16).toString('utf-8');
      if (!headerStr.startsWith('SQLite format 3')) {
        return res.status(400).json({ error: 'الملف المرفوع ليس ملف قاعدة بيانات SQLite صالحاً' });
      }

      const SQL = await initSqlJs();
      const testDb = new SQL.Database(buffer);

      // Verify essential tables exist
      const checkTables = queryAll(testDb, "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('members', 'users')");
      if (checkTables.length < 2) {
        return res.status(400).json({ error: 'ملف النسخة الاحتياطية لا يحتوي على جداول النظام المطلوبة (members, users)' });
      }

      // Write to scout.db
      fs.writeFileSync(DB_PATH, buffer);

      // Reload global db in memory
      reloadDbFromDisk();

      logAudit(user.username, 'RESTORE', null, null, `استعادة قاعدة البيانات SQLite من ملف: ${req.file.originalname}`);

      res.json({ success: true, message: 'تم استعادة النسخة الاحتياطية وتحديث قاعدة البيانات بنجاح' });
    } catch (err) {
      console.error('Restore error:', err);
      res.status(500).json({ error: 'فشل استعادة النسخة الاحتياطية. تأكد من سلامة ملف .db المرفوع.' });
    }
  });

  // --- 8. AUDIT LOG (ADMIN ONLY) ---
  app.get('/api/audit-logs', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const logs = queryAll(db, 'SELECT * FROM audit_log ORDER BY id DESC LIMIT 500');
      res.json({ logs });
    } catch (err) {
      console.error('Audit logs error:', err);
      res.status(500).json({ error: 'فشل جلب سجل العمليات' });
    }
  });

  // --- 9. SETTINGS & USERS (ADMIN ONLY) ---
  app.get('/api/settings', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const settingsRows = queryAll(db, 'SELECT * FROM settings');
      const settingsMap: Record<string, string> = {};
      for (const row of settingsRows) {
        settingsMap[row.key] = row.value;
      }
      res.json({ settings: settingsMap });
    } catch (err) {
      res.status(500).json({ error: 'فشل جلب إعدادات النظام' });
    }
  });

  app.post('/api/settings', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const {
        school_name,
        system_name,
        current_year,
        scout_group_name,
        scout_group_name_en,
        scout_logo_url,
        group_slogan,
      } = req.body;
      const db = await getDb();

      if (school_name !== undefined) {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['school_name', String(school_name).trim()]);
      }
      if (system_name !== undefined) {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['system_name', String(system_name).trim()]);
      }
      if (current_year !== undefined) {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['current_year', String(current_year).trim()]);
      }
      if (scout_group_name !== undefined) {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['scout_group_name', String(scout_group_name).trim()]);
      }
      if (scout_group_name_en !== undefined) {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['scout_group_name_en', String(scout_group_name_en).trim()]);
      }
      if (scout_logo_url !== undefined) {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['scout_logo_url', String(scout_logo_url)]);
      }
      if (group_slogan !== undefined) {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['group_slogan', String(group_slogan).trim()]);
      }

      saveDb();
      res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
    } catch (err) {
      res.status(500).json({ error: 'فشل حفظ الإعدادات' });
    }
  });

  // User management
  app.get('/api/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      ensureUsersTableColumns(db);
      const users = queryAll(
        db,
        `SELECT u.id, u.username, u.role, u.full_name, u.member_id, u.tribe_id, u.phone, u.is_active, u.created_at, u.updated_at,
                t.name as tribe_name, t.code as tribe_code,
                m.member_code, m.student_name as member_name
         FROM users u
         LEFT JOIN tribes t ON t.id = u.tribe_id
         LEFT JOIN members m ON m.id = u.member_id
         ORDER BY u.id ASC`
      );
      res.json({ users });
    } catch (err: any) {
      console.error('Error fetching users with joins, attempting fallback:', err);
      try {
        const db = await getDb();
        ensureUsersTableColumns(db);
        const users = queryAll(db, 'SELECT * FROM users ORDER BY id ASC');
        res.json({ users });
      } catch (fallbackErr: any) {
        console.error('Critical fallback error fetching users:', fallbackErr);
        res.status(500).json({ error: 'فشل جلب قائمة المستخدمين: ' + (err?.message || 'خطأ في قاعدة البيانات') });
      }
    }
  });

  app.post('/api/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { username, password, role, full_name, member_id, tribe_id, phone } = req.body;
      if (!username || !username.trim()) {
        return res.status(400).json({ error: 'اسم المستخدم مطلوب' });
      }
      if (!password || password.length < 4) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' });
      }
      if (!['ADMIN', 'DATA_ENTRY', 'LEADER'].includes(role)) {
        return res.status(400).json({ error: 'نوع الصلاحية غير صحيح' });
      }

      const db = await getDb();
      ensureUsersTableColumns(db);
      const existing = queryOne(db, 'SELECT id FROM users WHERE username = ?', [username.trim()]);
      if (existing) {
        return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً' });
      }

      const now = new Date().toISOString();
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      const parsedMemberId = member_id ? parseInt(member_id, 10) : null;
      const parsedTribeId = tribe_id ? parseInt(tribe_id, 10) : null;

      const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, role, full_name, member_id, tribe_id, phone, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      stmt.run([
        username.trim(),
        hash,
        role,
        full_name ? full_name.trim() : null,
        parsedMemberId,
        parsedTribeId,
        phone ? phone.trim() : null,
        now,
        now,
      ]);
      stmt.free();

      if (parsedMemberId && parsedTribeId) {
        try {
          db.run('UPDATE members SET tribe_id = ? WHERE id = ? AND (tribe_id IS NULL OR tribe_id = 0)', [parsedTribeId, parsedMemberId]);
        } catch (syncErr) {}
      }

      saveDb();

      logAudit((req as any).user.username, 'ADD', null, null, `إضافة مستخدم جديد: ${username.trim()} (${role})`);
      res.status(201).json({ success: true, message: 'تم إضافة المستخدم بنجاح' });
    } catch (err) {
      console.error('Create user error:', err);
      res.status(500).json({ error: 'فشل إضافة المستخدم' });
    }
  });

  app.put('/api/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { role, is_active, new_password, full_name, member_id, tribe_id, phone } = req.body;
      const db = await getDb();
      ensureUsersTableColumns(db);

      const targetUser = queryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]);
      if (!targetUser) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      const now = new Date().toISOString();

      if (new_password && new_password.trim().length >= 4) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(new_password.trim(), salt);
        const stmt = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
        stmt.run([hash, now, userId]);
        stmt.free();
      }

      if (role && ['ADMIN', 'DATA_ENTRY', 'LEADER'].includes(role)) {
        const stmt = db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?');
        stmt.run([role, now, userId]);
        stmt.free();
      }

      if (full_name !== undefined) {
        const stmt = db.prepare('UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?');
        stmt.run([full_name ? full_name.trim() : null, now, userId]);
        stmt.free();
      }

      if (member_id !== undefined) {
        const parsedMemberId = member_id ? parseInt(member_id, 10) : null;
        const stmt = db.prepare('UPDATE users SET member_id = ?, updated_at = ? WHERE id = ?');
        stmt.run([parsedMemberId, now, userId]);
        stmt.free();
      }

      if (tribe_id !== undefined) {
        const parsedTribeId = tribe_id ? parseInt(tribe_id, 10) : null;
        const stmt = db.prepare('UPDATE users SET tribe_id = ?, updated_at = ? WHERE id = ?');
        stmt.run([parsedTribeId, now, userId]);
        stmt.free();
      }

      if (phone !== undefined) {
        const stmt = db.prepare('UPDATE users SET phone = ?, updated_at = ? WHERE id = ?');
        stmt.run([phone ? phone.trim() : null, now, userId]);
        stmt.free();
      }

      if (is_active !== undefined) {
        const activeVal = is_active ? 1 : 0;
        if (targetUser.username === 'admin' && activeVal === 0) {
          return res.status(400).json({ error: 'لا يمكن تعطيل حساب المسؤول الرئيسي admin' });
        }
        const stmt = db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?');
        stmt.run([activeVal, now, userId]);
        stmt.free();
      }

      saveDb();
      res.json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح' });
    } catch (err) {
      res.status(500).json({ error: 'فشل تحديث بيانات المستخدم' });
    }
  });

  app.delete('/api/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const db = await getDb();
      const targetUser = queryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]);
      if (!targetUser) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      if (targetUser.username === 'admin') {
        return res.status(400).json({ error: 'لا يمكن حذف حساب المسؤول الرئيسي admin' });
      }

      const stmt = db.prepare('DELETE FROM users WHERE id = ?');
      stmt.run([userId]);
      stmt.free();
      saveDb();

      logAudit((req as any).user.username, 'DELETE', null, null, `حذف المستخدم: ${targetUser.username}`);
      res.json({ success: true, message: `تم حذف المستخدم ${targetUser.username} بنجاح` });
    } catch (err) {
      res.status(500).json({ error: 'فشل حذف المستخدم' });
    }
  });

  // ==========================================
  // --- SCOUT BADGES & MEDALS (الأوسمة الكشفية) ---
  // ==========================================

  // 1. Get all badges with awarded count
  app.get('/api/badges', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const badges = queryAll(
        db,
        `SELECT b.*, 
          (SELECT COUNT(*) FROM member_badges mb WHERE mb.badge_id = b.id) as awarded_count
         FROM badges b
         ORDER BY b.id ASC`
      );
      res.json(badges);
    } catch (err: any) {
      console.error('Error fetching badges:', err);
      res.status(500).json({ error: 'فشل تحميل قائمة الأوسمة الكشفية' });
    }
  });

  // 2. Create new badge (Admin only)
  app.post('/api/badges', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, name_en, category, icon, color, description, requirements } = req.body;
      if (!name || !description || !requirements) {
        return res.status(400).json({ error: 'اسم الوسام وشرحه وشروط الحصول عليه مطلوبة' });
      }

      const db = await getDb();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO badges (name, name_en, category, icon, color, description, requirements, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        name.trim(),
        name_en ? name_en.trim() : null,
        category || 'جدارة',
        icon || 'Award',
        color || 'amber',
        description.trim(),
        requirements.trim(),
        now,
        now,
      ]);
      stmt.free();
      saveDb();

      const newBadge = queryOne(db, 'SELECT * FROM badges ORDER BY id DESC LIMIT 1');
      logAudit(
        (req as any).user.username,
        'BADGE_CREATE',
        null,
        null,
        `إضافة وسام كشفي جديد: ${name}`
      );

      res.status(201).json(newBadge);
    } catch (err: any) {
      console.error('Error creating badge:', err);
      res.status(500).json({ error: 'فشل إضافة الوسام الكشفي الجديد' });
    }
  });

  // 3. Update existing badge (Admin only)
  app.put('/api/badges/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const badgeId = parseInt(req.params.id, 10);
      const { name, name_en, category, icon, color, description, requirements } = req.body;
      if (!name || !description || !requirements) {
        return res.status(400).json({ error: 'اسم الوسام وشرحه وشروط الحصول عليه مطلوبة' });
      }

      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM badges WHERE id = ?', [badgeId]);
      if (!existing) {
        return res.status(404).json({ error: 'الوسام المطلوب غير موجود' });
      }

      const now = new Date().toISOString();
      const stmt = db.prepare(`
        UPDATE badges 
        SET name = ?, name_en = ?, category = ?, icon = ?, color = ?, description = ?, requirements = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run([
        name.trim(),
        name_en ? name_en.trim() : null,
        category || existing.category,
        icon || existing.icon,
        color || existing.color,
        description.trim(),
        requirements.trim(),
        now,
        badgeId,
      ]);
      stmt.free();
      saveDb();

      const updated = queryOne(db, 'SELECT * FROM badges WHERE id = ?', [badgeId]);
      logAudit(
        (req as any).user.username,
        'BADGE_UPDATE',
        null,
        null,
        `تعديل الوسام الكشفي: ${name}`
      );

      res.json(updated);
    } catch (err: any) {
      console.error('Error updating badge:', err);
      res.status(500).json({ error: 'فشل تعديل الوسام الكشفي' });
    }
  });

  // 4. Delete badge (Admin only)
  app.delete('/api/badges/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const badgeId = parseInt(req.params.id, 10);
      const db = await getDb();
      const existing = queryOne(db, 'SELECT * FROM badges WHERE id = ?', [badgeId]);
      if (!existing) {
        return res.status(404).json({ error: 'الوسام المطلوب غير موجود' });
      }

      // Delete member_badges associations first
      const delMb = db.prepare('DELETE FROM member_badges WHERE badge_id = ?');
      delMb.run([badgeId]);
      delMb.free();

      // Delete badge
      const stmt = db.prepare('DELETE FROM badges WHERE id = ?');
      stmt.run([badgeId]);
      stmt.free();
      saveDb();

      logAudit(
        (req as any).user.username,
        'BADGE_DELETE',
        null,
        null,
        `حذف الوسام الكشفي: ${existing.name}`
      );

      res.json({ success: true, message: `تم حذف وسام "${existing.name}" بنجاح` });
    } catch (err: any) {
      console.error('Error deleting badge:', err);
      res.status(500).json({ error: 'فشل حذف الوسام الكشفي' });
    }
  });

  // 5. Get all member badges summary (for all members, grouped or flat list)
  app.get('/api/badges/member-summary', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const records = queryAll(
        db,
        `SELECT 
          mb.id as award_id,
          mb.member_id,
          mb.badge_id,
          mb.awarded_at,
          mb.awarded_by,
          mb.reason,
          mb.notes,
          b.name as badge_name,
          b.name_en as badge_name_en,
          b.category as badge_category,
          b.icon as badge_icon,
          b.color as badge_color,
          b.description as badge_description,
          b.requirements as badge_requirements,
          m.student_name,
          m.member_code,
          m.member_type,
          m.photo_path,
          m.school_stage,
          t.name as tribe_name
         FROM member_badges mb
         JOIN badges b ON mb.badge_id = b.id
         JOIN members m ON mb.member_id = m.id
         LEFT JOIN tribes t ON m.tribe_id = t.id
         ORDER BY mb.awarded_at DESC`
      );
      res.json(records);
    } catch (err: any) {
      console.error('Error fetching member badges summary:', err);
      res.status(500).json({ error: 'فشل تحميل كشف الأوسمة الممنوحة' });
    }
  });

  // 6. Get badges awarded to a specific member
  app.get('/api/members/:memberId/badges', authenticate, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId, 10);
      const db = await getDb();
      const badges = queryAll(
        db,
        `SELECT 
          mb.id as award_id,
          mb.member_id,
          mb.badge_id,
          mb.awarded_at,
          mb.awarded_by,
          mb.reason,
          mb.notes,
          b.name,
          b.name_en,
          b.category,
          b.icon,
          b.color,
          b.description,
          b.requirements
         FROM member_badges mb
         JOIN badges b ON mb.badge_id = b.id
         WHERE mb.member_id = ?
         ORDER BY mb.awarded_at DESC`,
        [memberId]
      );
      res.json(badges);
    } catch (err: any) {
      console.error('Error fetching member badges:', err);
      res.status(500).json({ error: 'فشل تحميل أوسمة العضو' });
    }
  });

  // 7. Award badge to member (Admin only)
  app.post('/api/members/:memberId/badges', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId, 10);
      const { badge_id, awarded_at, reason, notes } = req.body;

      if (!badge_id) {
        return res.status(400).json({ error: 'يرجى تحديد الوسام المراد منحه' });
      }

      const db = await getDb();
      const member = queryOne(db, 'SELECT id, student_name, member_code, member_type FROM members WHERE id = ?', [memberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو أو القائد غير موجود' });
      }

      const badge = queryOne(db, 'SELECT id, name, category FROM badges WHERE id = ?', [badge_id]);
      if (!badge) {
        return res.status(404).json({ error: 'الوسام المطلوب غير موجود' });
      }

      const alreadyAwarded = queryOne(
        db,
        'SELECT id FROM member_badges WHERE member_id = ? AND badge_id = ?',
        [memberId, badge_id]
      );
      if (alreadyAwarded) {
        return res.status(400).json({ error: `العضو حاصل على وسام "${badge.name}" بالفعل مسبقاً` });
      }

      const now = new Date().toISOString();
      const awardDate = awarded_at || now.split('T')[0];
      const awardedBy = (req as any).user.full_name || (req as any).user.username || 'مدير النظام';

      const stmt = db.prepare(`
        INSERT INTO member_badges (member_id, badge_id, awarded_at, awarded_by, reason, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        memberId,
        badge_id,
        awardDate,
        awardedBy,
        reason ? reason.trim() : 'استيفاء الشروط الكشفية والتميز الميداني',
        notes ? notes.trim() : null,
        now,
        now,
      ]);
      stmt.free();
      saveDb();

      logAudit(
        (req as any).user.username,
        'BADGE_AWARD',
        memberId,
        member.student_name,
        `منح وسام "${badge.name}" للعضو/القائد ${member.student_name} (${member.member_code || memberId})`
      );

      // Return refreshed member badges
      const updatedBadges = queryAll(
        db,
        `SELECT 
          mb.id as award_id,
          mb.member_id,
          mb.badge_id,
          mb.awarded_at,
          mb.awarded_by,
          mb.reason,
          mb.notes,
          b.name,
          b.name_en,
          b.category,
          b.icon,
          b.color,
          b.description,
          b.requirements
         FROM member_badges mb
         JOIN badges b ON mb.badge_id = b.id
         WHERE mb.member_id = ?
         ORDER BY mb.awarded_at DESC`,
        [memberId]
      );

      res.status(201).json({
        success: true,
        message: `تم منح وسام "${badge.name}" بنجاح إلى ${member.student_name}`,
        badges: updatedBadges,
      });
    } catch (err: any) {
      console.error('Error awarding badge:', err);
      res.status(500).json({ error: 'فشل منح الوسام للعضو' });
    }
  });

  // 8. Revoke badge from member (Admin only)
  app.delete('/api/members/:memberId/badges/:badgeId', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId, 10);
      const badgeId = parseInt(req.params.badgeId, 10);

      const db = await getDb();
      const member = queryOne(db, 'SELECT id, student_name, member_code FROM members WHERE id = ?', [memberId]);
      const badge = queryOne(db, 'SELECT id, name FROM badges WHERE id = ?', [badgeId]);

      const stmt = db.prepare('DELETE FROM member_badges WHERE member_id = ? AND badge_id = ?');
      stmt.run([memberId, badgeId]);
      stmt.free();
      saveDb();

      if (member && badge) {
        logAudit(
          (req as any).user.username,
          'BADGE_REVOKE',
          memberId,
          member.student_name,
          `سحب وسام "${badge.name}" من العضو/القائد ${member.student_name}`
        );
      }

      res.json({
        success: true,
        message: `تم سحب الوسام بنجاح من سجل العضو`,
      });
    } catch (err: any) {
      console.error('Error revoking badge:', err);
      res.status(500).json({ error: 'فشل سحب الوسام' });
    }
  });

  // =========================================================================
  // SCOUT WALLET SYSTEM (محفظة الأعضاء والقادة الكشفية)
  // =========================================================================

  // 1. Get all wallets summary & member list with balance
  app.get('/api/wallets', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();

      // Retrieve all members with wallet balance and transaction aggregates
      const members = queryAll(
        db,
        `SELECT 
          m.id,
          m.member_code,
          m.student_name,
          m.student_name_en,
          m.member_type,
          m.school_stage,
          m.tribe_id,
          t.name as tribe_name,
          m.photo_path,
          m.father_phone,
          m.mother_phone,
          m.leader_phone,
          COALESCE(w.balance, 0) as balance,
          COALESCE(w.updated_at, m.created_at) as last_updated,
          (SELECT COALESCE(SUM(wt.amount), 0) FROM wallet_transactions wt WHERE wt.member_id = m.id AND wt.type = 'DEPOSIT') as total_deposits,
          (SELECT COALESCE(SUM(wt.amount), 0) FROM wallet_transactions wt WHERE wt.member_id = m.id AND wt.type = 'PAYMENT') as total_spent,
          (SELECT COUNT(*) FROM wallet_transactions wt WHERE wt.member_id = m.id) as transactions_count,
          (SELECT MAX(wt.created_at) FROM wallet_transactions wt WHERE wt.member_id = m.id) as last_transaction_at
         FROM members m
         LEFT JOIN tribes t ON m.tribe_id = t.id
         LEFT JOIN member_wallets w ON m.id = w.member_id
         ORDER BY COALESCE(w.balance, 0) DESC, m.student_name ASC`
      );

      // System aggregates
      const totalBalanceRow = queryOne(db, 'SELECT COALESCE(SUM(balance), 0) as total FROM member_wallets');
      const totalDepositsRow = queryOne(db, "SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions WHERE type = 'DEPOSIT'");
      const totalPaymentsRow = queryOne(db, "SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions WHERE type = 'PAYMENT'");
      const membersWithBalanceRow = queryOne(db, 'SELECT COUNT(*) as count FROM member_wallets WHERE balance > 0');

      res.json({
        summary: {
          total_system_balance: Number(totalBalanceRow?.total || 0),
          total_deposits: Number(totalDepositsRow?.total || 0),
          total_payments: Number(totalPaymentsRow?.total || 0),
          members_with_balance_count: Number(membersWithBalanceRow?.count || 0),
          total_members_count: members.length,
        },
        members,
      });
    } catch (err: any) {
      console.error('Error fetching wallets:', err);
      res.status(500).json({ error: 'فشل تحميل بيانات المحافظ' });
    }
  });

  // 2. Get specific member wallet details and transaction history
  app.get('/api/wallets/member/:memberId', authenticate, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId, 10);
      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'كود العضو غير صالح' });
      }

      const db = await getDb();
      const member = queryOne(
        db,
        `SELECT m.id, m.member_code, m.student_name, m.member_type, m.school_stage, m.tribe_id, t.name as tribe_name, m.photo_path
         FROM members m
         LEFT JOIN tribes t ON m.tribe_id = t.id
         WHERE m.id = ?`,
        [memberId]
      );

      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      const balance = getMemberWalletBalance(db, memberId);

      const transactions = queryAll(
        db,
        `SELECT id, member_id, type, amount, balance_before, balance_after, category,
                reference_id, reference_title, description, receipt_number, recorded_by, created_at
         FROM wallet_transactions
         WHERE member_id = ?
         ORDER BY created_at DESC, id DESC`,
        [memberId]
      );

      res.json({
        member,
        balance,
        transactions,
      });
    } catch (err: any) {
      console.error('Error fetching member wallet:', err);
      res.status(500).json({ error: 'فشل تحميل محفظة العضو' });
    }
  });

  // 3. Top-up / Deposit into Member Wallet (شحن رصيد المحفظة)
  app.post('/api/wallets/topup', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { member_id, amount, notes, payment_method } = req.body;

      const memberId = parseInt(member_id, 10);
      const parsedAmount = parseFloat(amount);

      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'كود العضو غير صالح' });
      }
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'المبلغ يجب أن يكون رقماً أكبر من صفر' });
      }

      const db = await getDb();
      const member = queryOne(db, 'SELECT id, student_name, member_code, member_type FROM members WHERE id = ?', [memberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      const methodLabel = payment_method || 'نقداً (كاش)';
      const description = notes
        ? `${notes.trim()} - [طريقة الإيداع: ${methodLabel}]`
        : `إيداع وشحن رصيد المحفظة الكشفية - [${methodLabel}]`;

      const result = recordWalletTransaction(db, {
        memberId,
        type: 'DEPOSIT',
        amount: parsedAmount,
        category: 'TOPUP',
        description,
        recordedBy: user.full_name || user.username,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || 'فشل إتمام عملية الإيداع' });
      }

      logAudit(
        user.username,
        'WALLET_TOPUP',
        memberId,
        member.student_name,
        `شحن رصيد محفظة ${member.member_type}: ${member.student_name} بمبلغ ${parsedAmount} ج.م (إيصال: ${result.receiptNumber})`
      );

      res.status(201).json({
        success: true,
        message: `تم شحن رصيد المحفظة بنجاح بمبلغ ${parsedAmount} ج.م. الرصيد الحالي: ${result.balanceAfter} ج.م`,
        balance: result.balanceAfter,
        receiptNumber: result.receiptNumber,
        transactionId: result.transactionId,
        member,
      });
    } catch (err: any) {
      console.error('Error topping up wallet:', err);
      res.status(500).json({ error: 'فشل شحن رصيد المحفظة' });
    }
  });

  // 4. Pay Annual Subscription from Wallet (سداد الاشتراك السنوي من المحفظة)
  app.post('/api/wallets/pay-subscription', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { member_id, year, subscription_type, notes } = req.body;

      const memberId = parseInt(member_id, 10);
      const parsedYear = parseInt(year, 10);

      if (isNaN(memberId) || isNaN(parsedYear)) {
        return res.status(400).json({ error: 'بيانات العضو أو السنة غير صالحة' });
      }

      const db = await getDb();
      const member = queryOne(db, 'SELECT id, student_name, member_code, member_type FROM members WHERE id = ?', [memberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      // Check annual fee
      const feeRow = queryOne(db, 'SELECT amount, amount_with_uniform FROM annual_subscription_fees WHERE year = ?', [parsedYear]);
      const chosenType = subscription_type === 'اشتراك سنوي بالزي' ? 'اشتراك سنوي بالزي' : 'اشتراك سنوي';
      const feeAmount = chosenType === 'اشتراك سنوي بالزي'
        ? (Number(feeRow?.amount_with_uniform) || Number(feeRow?.amount) || 0)
        : (Number(feeRow?.amount) || 0);

      if (feeAmount <= 0) {
        return res.status(400).json({ error: `لم يتم تحديد قيمة ${chosenType} لسنة ${parsedYear}` });
      }

      // Check current wallet balance
      const currentBal = getMemberWalletBalance(db, memberId);
      if (currentBal < feeAmount) {
        return res.status(400).json({
          error: `رصيد المحفظة الحالي (${currentBal} ج.م) غير كافٍ لسداد ${chosenType} (${feeAmount} ج.م). يرجى شحن المحفظة أولاً.`,
        });
      }

      // Record wallet transaction
      const txResult = recordWalletTransaction(db, {
        memberId,
        type: 'PAYMENT',
        amount: feeAmount,
        category: 'SUBSCRIPTION',
        referenceId: String(parsedYear),
        referenceTitle: `${chosenType} ${parsedYear}`,
        description: notes ? `${notes} (سداد من المحفظة)` : `سداد ${chosenType} لسنة ${parsedYear} من رصيد المحفظة`,
        recordedBy: user.full_name || user.username,
      });

      if (!txResult.success) {
        return res.status(400).json({ error: txResult.error || 'فشل الخصم من المحفظة' });
      }

      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];

      // Upsert subscription payment directly with db.run
      db.run(`
        INSERT INTO annual_subscription_payments (
          year, member_id, status, subscription_type, paid_amount, payment_date, receipt_number, notes, recorded_by, created_at, updated_at
        ) VALUES (?, ?, 'مسدد', ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, member_id) DO UPDATE SET
          status = 'مسدد',
          subscription_type = excluded.subscription_type,
          paid_amount = excluded.paid_amount,
          payment_date = excluded.payment_date,
          receipt_number = excluded.receipt_number,
          notes = excluded.notes,
          recorded_by = excluded.recorded_by,
          updated_at = excluded.updated_at
      `, [
        parsedYear,
        memberId,
        chosenType,
        feeAmount,
        todayDate,
        txResult.receiptNumber,
        notes ? `${notes} [سداد من المحفظة]` : `[تم السداد من المحفظة إيصال: ${txResult.receiptNumber}]`,
        user.username,
        now.toISOString(),
        now.toISOString(),
      ]);
      saveDb();

      logAudit(
        user.username,
        'WALLET_PAY_SUBSCRIPTION',
        memberId,
        member.student_name,
        `سداد ${chosenType} ${parsedYear} من محفظة ${member.student_name}: مبلغ ${feeAmount} ج.م (إيصال: ${txResult.receiptNumber})`
      );

      res.json({
        success: true,
        message: `تم سداد ${chosenType} لسنة ${parsedYear} بنجاح من رصيد المحفظة (${feeAmount} ج.م)`,
        balance: txResult.balanceAfter,
        receiptNumber: txResult.receiptNumber,
      });
    } catch (err: any) {
      console.error('Error paying subscription from wallet:', err);
      res.status(500).json({ error: 'فشل سداد الاشتراك من المحفظة' });
    }
  });

  // 5. Pay Activity / Camp fee from Wallet (سداد رسوم نشاط أو معسكر من المحفظة)
  app.post('/api/wallets/pay-activity', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { member_id, activity_id, amount, notes } = req.body;

      const memberId = parseInt(member_id, 10);
      const activityId = parseInt(activity_id, 10);
      const parsedAmount = parseFloat(amount);

      if (isNaN(memberId) || isNaN(activityId)) {
        return res.status(400).json({ error: 'بيانات العضو أو النشاط غير صالحة' });
      }

      const db = await getDb();
      const member = queryOne(db, 'SELECT id, student_name, member_code FROM members WHERE id = ?', [memberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      const activity = queryOne(db, 'SELECT id, name, fee, status FROM activities WHERE id = ?', [activityId]);
      if (!activity) {
        return res.status(404).json({ error: 'النشاط غير موجود' });
      }

      const feeToPay = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : Number(activity.fee);
      if (feeToPay <= 0) {
        return res.status(400).json({ error: 'قيمة الرسوم يجب أن تكون أكبر من الصفر' });
      }

      const currentBal = getMemberWalletBalance(db, memberId);
      if (currentBal < feeToPay) {
        return res.status(400).json({
          error: `رصيد المحفظة الحالي (${currentBal} ج.م) لا يكفي لسداد رسوم النشاط (${feeToPay} ج.م).`,
        });
      }

      // Record transaction
      const txResult = recordWalletTransaction(db, {
        memberId,
        type: 'PAYMENT',
        amount: feeToPay,
        category: 'ACTIVITY',
        referenceId: String(activityId),
        referenceTitle: activity.name,
        description: notes ? `${notes} - ${activity.name}` : `سداد رسوم نشاط/معسكر: ${activity.name} من رصيد المحفظة`,
        recordedBy: user.full_name || user.username,
      });

      if (!txResult.success) {
        return res.status(400).json({ error: txResult.error || 'فشل الخصم من المحفظة' });
      }

      const now = new Date().toISOString();

      // Upsert participant record
      const partStmt = db.prepare(`
        INSERT INTO activity_participants (
          activity_id, member_id, payment_status, paid_amount, notes, registered_at
        ) VALUES (?, ?, 'مدفوع', ?, ?, ?)
        ON CONFLICT(activity_id, member_id) DO UPDATE SET
          payment_status = 'مدفوع',
          paid_amount = excluded.paid_amount,
          notes = excluded.notes
      `);
      partStmt.run([
        activityId,
        memberId,
        feeToPay,
        notes ? `${notes} [سداد من المحفظة - ${txResult.receiptNumber}]` : `[سداد من المحفظة - ${txResult.receiptNumber}]`,
        now,
      ]);
      partStmt.free();
      saveDb();

      logAudit(
        user.username,
        'WALLET_PAY_ACTIVITY',
        memberId,
        member.student_name,
        `سداد رسوم نشاط "${activity.name}" من محفظة ${member.student_name}: مبلغ ${feeToPay} ج.م (إيصال: ${txResult.receiptNumber})`
      );

      res.json({
        success: true,
        message: `تم سداد رسوم نشاط "${activity.name}" بنجاح (${feeToPay} ج.م)`,
        balance: txResult.balanceAfter,
        receiptNumber: txResult.receiptNumber,
      });
    } catch (err: any) {
      console.error('Error paying activity from wallet:', err);
      res.status(500).json({ error: 'فشل سداد رسوم النشاط من المحفظة' });
    }
  });

  // 6. Pay Store Order from Wallet (سداد مشتريات المتجر من المحفظة)
  app.post('/api/wallets/pay-store-order', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { order_id, member_id } = req.body;

      const orderId = parseInt(order_id, 10);
      const memberId = parseInt(member_id, 10);

      if (isNaN(orderId) || isNaN(memberId)) {
        return res.status(400).json({ error: 'بيانات الطلب أو العضو غير صالحة' });
      }

      const db = await getDb();
      const order = queryOne(db, 'SELECT * FROM store_orders WHERE id = ?', [orderId]);
      if (!order) {
        return res.status(404).json({ error: 'طلب الشراء غير موجود' });
      }
      if (order.is_paid) {
        return res.status(400).json({ error: 'هذا الطلب مسدد بالفعل مسبقاً' });
      }

      const member = queryOne(db, 'SELECT id, student_name FROM members WHERE id = ?', [memberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      const totalAmount = Number(order.total_price);
      const currentBal = getMemberWalletBalance(db, memberId);
      if (currentBal < totalAmount) {
        return res.status(400).json({
          error: `رصيد المحفظة الحالي (${currentBal} ج.م) غير كافٍ لسداد إجمالي مشتريات المتجر (${totalAmount} ج.م).`,
        });
      }

      // Record transaction
      const txResult = recordWalletTransaction(db, {
        memberId,
        type: 'PAYMENT',
        amount: totalAmount,
        category: 'STORE',
        referenceId: String(orderId),
        referenceTitle: `مشتريات متجر #${orderId}`,
        description: `سداد طلب متجر الكشافة #${orderId} من رصيد المحفظة`,
        recordedBy: user.full_name || user.username,
      });

      if (!txResult.success) {
        return res.status(400).json({ error: txResult.error || 'فشل الخصم من المحفظة' });
      }

      // Update store order as paid
      const updateOrderStmt = db.prepare(`
        UPDATE store_orders SET
          is_paid = 1,
          payment_method = 'محفظة',
          status = 'CONFIRMED',
          notes = COALESCE(notes, '') || ' [سداد من المحفظة - إيصال: ' || ? || ']',
          updated_at = ?
        WHERE id = ?
      `);
      updateOrderStmt.run([txResult.receiptNumber, new Date().toISOString(), orderId]);
      updateOrderStmt.free();
      saveDb();

      logAudit(
        user.username,
        'WALLET_PAY_STORE',
        memberId,
        member.student_name,
        `سداد طلب متجر #${orderId} من محفظة ${member.student_name}: مبلغ ${totalAmount} ج.م (إيصال: ${txResult.receiptNumber})`
      );

      res.json({
        success: true,
        message: `تم سداد طلب المتجر بنجاح من رصيد المحفظة (${totalAmount} ج.م)`,
        balance: txResult.balanceAfter,
        receiptNumber: txResult.receiptNumber,
      });
    } catch (err: any) {
      console.error('Error paying store order from wallet:', err);
      res.status(500).json({ error: 'فشل سداد طلب المتجر من المحفظة' });
    }
  });

  // 7. Adjust / Withdraw / Refund Wallet Balance (Admin & Manager / Data Entry)
  app.post('/api/wallets/adjust', authenticate, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { member_id, type, amount, reason, direction } = req.body;

      const memberId = parseInt(member_id, 10);
      const parsedAmount = parseFloat(amount);

      if (isNaN(memberId)) {
        return res.status(400).json({ error: 'كود العضو غير صالح' });
      }
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'المبلغ يجب أن يكون رقماً موجباً' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'يرجى كتابة سبب التعديل أو التحكم' });
      }

      const validTypes = ['WITHDRAW', 'ADJUSTMENT', 'REFUND'];
      const actionType = validTypes.includes(type) ? type : 'ADJUSTMENT';

      const db = await getDb();
      const member = queryOne(db, 'SELECT id, student_name, member_code FROM members WHERE id = ?', [memberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      const txResult = recordWalletTransaction(db, {
        memberId,
        type: actionType as any,
        amount: parsedAmount,
        category: actionType === 'REFUND' ? 'REFUND' : 'ADJUSTMENT',
        description: reason.trim(),
        recordedBy: user.full_name || user.username,
        adjustmentDirection: direction === 'ADD' ? 'ADD' : 'DEDUCT',
      });

      if (!txResult.success) {
        return res.status(400).json({ error: txResult.error || 'فشل تعديل وتحكم رصيد المحفظة' });
      }

      const dirLabel = actionType === 'ADJUSTMENT' ? (direction === 'ADD' ? 'إضافة رصيد' : 'خصم رصيد') : actionType;
      logAudit(
        user.username,
        actionType === 'REFUND' ? 'WALLET_REFUND' : 'WALLET_ADJUSTMENT',
        memberId,
        member.student_name,
        `تحكم وتعديل رصيد محفظة ${member.student_name}: عملية ${dirLabel} بمبلغ ${parsedAmount} ج.م. السبب: ${reason.trim()}`
      );

      res.json({
        success: true,
        message: `تم تنفيذ العملية بنجاح. الرصيد الحالي: ${txResult.balanceAfter} ج.م`,
        balance: txResult.balanceAfter,
        receiptNumber: txResult.receiptNumber,
      });
    } catch (err: any) {
      console.error('Error adjusting wallet:', err);
      res.status(500).json({ error: 'فشل تعديل رصيد المحفظة' });
    }
  });

  // 8. Get Members Eligible for Subscription Rollover from Wallet (الأعضاء المؤهلين لترحيل الاشتراك من المحفظة)
  app.get('/api/wallets/eligible-subscription-rollover', authenticate, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const subType = req.query.subscription_type === 'اشتراك سنوي بالزي' ? 'اشتراك سنوي بالزي' : 'اشتراك سنوي';
      const db = await getDb();

      const feeRow = queryOne(db, 'SELECT amount, amount_with_uniform, description FROM annual_subscription_fees WHERE year = ?', [year]);
      const regularFee = feeRow ? Number(feeRow.amount) : 0;
      const uniformFee = feeRow ? (Number(feeRow.amount_with_uniform) || regularFee) : 0;
      const targetFee = subType === 'اشتراك سنوي بالزي' ? uniformFee : regularFee;

      const members = queryAll(
        db,
        `SELECT 
          m.id as member_id,
          m.member_code,
          m.student_name,
          m.student_name_en,
          m.member_type,
          m.school_stage,
          t.name as tribe_name,
          COALESCE(w.balance, 0) as balance,
          COALESCE(p.status, 'غير مسدد') as payment_status
        FROM members m
        LEFT JOIN tribes t ON m.tribe_id = t.id
        LEFT JOIN member_wallets w ON m.id = w.member_id
        LEFT JOIN annual_subscription_payments p ON m.id = p.member_id AND p.year = ?
        WHERE COALESCE(p.status, 'غير مسدد') != 'مسدد'
        ORDER BY 
          CASE WHEN COALESCE(w.balance, 0) >= ? THEN 0 ELSE 1 END,
          COALESCE(w.balance, 0) DESC,
          m.student_name ASC`,
        [year, targetFee]
      );

      const mapped = members.map((m) => {
        const bal = Number(m.balance || 0);
        const isEligible = targetFee > 0 && bal >= targetFee;
        return {
          member_id: m.member_id,
          member_code: m.member_code,
          student_name: m.student_name,
          student_name_en: m.student_name_en,
          member_type: m.member_type,
          school_stage: m.school_stage,
          tribe_name: m.tribe_name,
          balance: bal,
          is_eligible: isEligible,
          remaining_balance: isEligible ? bal - targetFee : bal,
        };
      });

      const eligibleMembers = mapped.filter((m) => m.is_eligible);

      res.json({
        year,
        fee: targetFee,
        amount: regularFee,
        amountWithUniform: uniformFee,
        subscriptionType: subType,
        feeDescription: feeRow?.description || '',
        members: mapped,
        eligibleCount: eligibleMembers.length,
        totalEligibleAmount: eligibleMembers.length * targetFee,
        unpaidCount: mapped.length,
      });
    } catch (err: any) {
      console.error('Error fetching eligible subscription rollover:', err);
      res.status(500).json({ error: 'فشل تحميل بيانات ترحيل الاشتراكات' });
    }
  });

  // 9. Bulk Rollover of Annual Subscriptions from Wallet (ترحيل اشتراكات الأعضاء من المحفظة)
  app.post('/api/wallets/bulk-rollover-subscriptions', authenticate, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { year, member_ids, subscription_type, notes } = req.body;

      const parsedYear = parseInt(year, 10);
      if (isNaN(parsedYear)) {
        return res.status(400).json({ error: 'السنة المحددة غير صالحة' });
      }

      const db = await getDb();
      const feeRow = queryOne(db, 'SELECT amount, amount_with_uniform FROM annual_subscription_fees WHERE year = ?', [parsedYear]);
      const chosenType = subscription_type === 'اشتراك سنوي بالزي' ? 'اشتراك سنوي بالزي' : 'اشتراك سنوي';
      const feeAmount = chosenType === 'اشتراك سنوي بالزي'
        ? (Number(feeRow?.amount_with_uniform) || Number(feeRow?.amount) || 0)
        : (Number(feeRow?.amount) || 0);

      if (feeAmount <= 0) {
        return res.status(400).json({ error: `لم يتم تحديد قيمة ${chosenType} لسنة ${parsedYear}` });
      }

      // Determine candidate members
      let candidateIds: number[] = [];
      if (Array.isArray(member_ids) && member_ids.length > 0) {
        candidateIds = member_ids.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
      } else {
        const eligible = queryAll(
          db,
          `SELECT m.id 
           FROM members m 
           JOIN member_wallets w ON m.id = w.member_id 
           LEFT JOIN annual_subscription_payments p ON m.id = p.member_id AND p.year = ?
           WHERE COALESCE(p.status, 'غير مسدد') != 'مسدد' AND w.balance >= ?`,
          [parsedYear, feeAmount]
        );
        candidateIds = eligible.map((r) => r.id);
      }

      if (candidateIds.length === 0) {
        return res.status(400).json({ error: 'لا يوجد أعضاء مؤهلين للترحيل (يرجى التأكد من وجود رصيد كافٍ بالمحفظة)' });
      }

      const results: any[] = [];
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];

      for (const mId of candidateIds) {
        const member = queryOne(db, 'SELECT id, student_name, member_code FROM members WHERE id = ?', [mId]);
        if (!member) continue;

        const currentBal = getMemberWalletBalance(db, mId);
        if (currentBal < feeAmount) {
          results.push({
            memberId: mId,
            studentName: member.student_name,
            memberCode: member.member_code,
            amount: feeAmount,
            balanceAfter: currentBal,
            receiptNumber: '',
            success: false,
            error: `الرصيد غير كافٍ (${currentBal} ج.م)`,
          });
          continue;
        }

        const txResult = recordWalletTransaction(db, {
          memberId: mId,
          type: 'PAYMENT',
          amount: feeAmount,
          category: 'SUBSCRIPTION',
          referenceId: String(parsedYear),
          referenceTitle: `${chosenType} ${parsedYear}`,
          description: notes
            ? `${notes.trim()} - (ترحيل ${chosenType} من المحفظة)`
            : `ترحيل وسداد ${chosenType} لسنة ${parsedYear} من رصيد المحفظة`,
          recordedBy: user.full_name || user.username,
        });

        if (!txResult.success) {
          results.push({
            memberId: mId,
            studentName: member.student_name,
            memberCode: member.member_code,
            amount: feeAmount,
            balanceAfter: currentBal,
            receiptNumber: '',
            success: false,
            error: txResult.error,
          });
          continue;
        }

        // Direct db.run to avoid prepared statement invalidation across saveDb()
        db.run(`
          INSERT INTO annual_subscription_payments (
            year, member_id, status, subscription_type, paid_amount, payment_date, receipt_number, notes, recorded_by, created_at, updated_at
          ) VALUES (?, ?, 'مسدد', ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(year, member_id) DO UPDATE SET
            status = 'مسدد',
            subscription_type = excluded.subscription_type,
            paid_amount = excluded.paid_amount,
            payment_date = excluded.payment_date,
            receipt_number = excluded.receipt_number,
            notes = excluded.notes,
            recorded_by = excluded.recorded_by,
            updated_at = excluded.updated_at
        `, [
          parsedYear,
          mId,
          chosenType,
          feeAmount,
          todayDate,
          txResult.receiptNumber,
          notes ? `${notes} [ترحيل من المحفظة]` : `[ترحيل وسداد ${chosenType} من المحفظة - إيصال: ${txResult.receiptNumber}]`,
          user.username,
          now.toISOString(),
          now.toISOString(),
        ]);

        results.push({
          memberId: mId,
          studentName: member.student_name,
          memberCode: member.member_code,
          amount: feeAmount,
          balanceAfter: txResult.balanceAfter,
          receiptNumber: txResult.receiptNumber,
          success: true,
        });
      }

      saveDb();

      const successCount = results.filter((r) => r.success).length;
      const totalAmount = successCount * feeAmount;

      logAudit(
        user.username,
        'WALLET_SUBSCRIPTION_ROLLOVER',
        null,
        null,
        `ترحيل اشتراكات (${chosenType}) لسنة ${parsedYear}: تم ترحيل ${successCount} عضو بنجاح بإجمالي مبلغ ${totalAmount} ج.م`
      );

      res.json({
        success: true,
        message: `تم بنجاح ترحيل وسداد الاشتراكات لعدد ${successCount} عضو بإجمالي ${totalAmount} ج.م`,
        processedCount: successCount,
        totalAmount,
        results,
      });
    } catch (err: any) {
      console.error('Error in bulk rollover subscriptions:', err);
      const errMsg = (err && (err.message || String(err))) || 'فشل ترحيل الاشتراكات من المحفظة';
      res.status(500).json({ error: errMsg });
    }
  });

  // 10. Rollover/Refund Subscription Back into Wallet (ترحيل واسترداد اشتراك إلى رصيد المحفظة)
  app.post('/api/wallets/rollover-subscription-refund', authenticate, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as SessionUser;
      const { member_id, year, amount, reason } = req.body;

      const memberId = parseInt(member_id, 10);
      const parsedYear = parseInt(year, 10);

      if (isNaN(memberId) || isNaN(parsedYear)) {
        return res.status(400).json({ error: 'بيانات العضو أو السنة غير صالحة' });
      }

      const db = await getDb();
      const member = queryOne(db, 'SELECT id, student_name, member_code FROM members WHERE id = ?', [memberId]);
      if (!member) {
        return res.status(404).json({ error: 'العضو غير موجود' });
      }

      const payment = queryOne(db, 'SELECT * FROM annual_subscription_payments WHERE year = ? AND member_id = ?', [parsedYear, memberId]);
      if (!payment || payment.status !== 'مسدد') {
        return res.status(400).json({ error: 'لا يوجد اشتراك مسدد لهذا العضو في هذه السنة لترحيله إلى المحفظة' });
      }

      const refundAmount = amount ? parseFloat(amount) : Number(payment.paid_amount || 0);
      if (refundAmount <= 0) {
        return res.status(400).json({ error: 'مبلغ الاسترداد غير صالح' });
      }

      // Record refund transaction into wallet
      const txResult = recordWalletTransaction(db, {
        memberId,
        type: 'REFUND',
        amount: refundAmount,
        category: 'SUBSCRIPTION',
        referenceId: String(parsedYear),
        referenceTitle: `استرداد اشتراك ${parsedYear}`,
        description: reason
          ? `${reason.trim()} - (ترحيل واسترداد إلى المحفظة)`
          : `ترحيل واسترداد الاشتراك السنوي لسنة ${parsedYear} إلى رصيد المحفظة`,
        recordedBy: user.full_name || user.username,
      });

      if (!txResult.success) {
        return res.status(400).json({ error: txResult.error || 'فشل إيداع المبلغ بالمحفظة' });
      }

      // Mark payment as cancelled or refunded
      const now = new Date().toISOString();
      db.run(
        `UPDATE annual_subscription_payments 
         SET status = 'غير مسدد', notes = ?, updated_at = ? 
         WHERE year = ? AND member_id = ?`,
        [`[تم ترحيل واسترداد المبلغ (${refundAmount} ج.م) إلى المحفظة إيصال: ${txResult.receiptNumber}]`, now, parsedYear, memberId]
      );
      saveDb();

      logAudit(
        user.username,
        'WALLET_SUBSCRIPTION_REFUND',
        memberId,
        member.student_name,
        `ترحيل واسترداد اشتراك سنة ${parsedYear} إلى محفظة ${member.student_name} بمبلغ ${refundAmount} ج.م`
      );

      res.json({
        success: true,
        message: `تم بنجاح ترحيل واسترداد مبلغ ${refundAmount} ج.م إلى محفظة العضو. الرصيد الحالي: ${txResult.balanceAfter} ج.م`,
        balance: txResult.balanceAfter,
        receiptNumber: txResult.receiptNumber,
      });
    } catch (err: any) {
      console.error('Error rolling over subscription refund:', err);
      res.status(500).json({ error: 'فشل ترحيل الاشتراك إلى المحفظة' });
    }
  });

  // 8. General Wallet Transactions Ledger (سجل حركات المحافظ العام)
  app.get('/api/wallets/transactions', authenticate, async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const limit = parseInt(req.query.limit as string, 10) || 200;

      const transactions = queryAll(
        db,
        `SELECT 
          wt.id,
          wt.member_id,
          wt.type,
          wt.amount,
          wt.balance_before,
          wt.balance_after,
          wt.category,
          wt.reference_id,
          wt.reference_title,
          wt.description,
          wt.receipt_number,
          wt.recorded_by,
          wt.created_at,
          m.student_name,
          m.member_code,
          m.member_type,
          m.photo_path,
          t.name as tribe_name
         FROM wallet_transactions wt
         JOIN members m ON wt.member_id = m.id
         LEFT JOIN tribes t ON m.tribe_id = t.id
         ORDER BY wt.created_at DESC, wt.id DESC
         LIMIT ?`,
        [limit]
      );

      res.json({ transactions });
    } catch (err: any) {
      console.error('Error fetching wallet transactions:', err);
      res.status(500).json({ error: 'فشل تحميل سجل حركات المحافظ' });
    }
  });

  // Local Network (LAN / Wi-Fi) Connection Info
  app.get('/api/network-info', authenticate, (req: Request, res: Response) => {
    try {
      const interfaces = os.networkInterfaces();
      const localIps: string[] = [];
      for (const name of Object.keys(interfaces)) {
        const ifaceList = interfaces[name];
        if (ifaceList) {
          for (const iface of ifaceList) {
            if (iface.family === 'IPv4' && !iface.internal) {
              localIps.push(iface.address);
            }
          }
        }
      }
      const port = 3000;
      const urls = localIps.map((ip) => `http://${ip}:${port}`);
      res.json({
        port,
        localIps: localIps.length > 0 ? localIps : ['127.0.0.1'],
        urls: urls.length > 0 ? urls : [`http://localhost:${port}`],
      });
    } catch (err) {
      res.status(500).json({ error: 'فشل استعلام معلومات الشبكة' });
    }
  });

  const httpServer = http.createServer(app);

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Look in current directory (where server.cjs is bundled) or process.cwd()/dist or CURRENT_DIR/dist
    let distPath = CURRENT_DIR;
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      distPath = path.join(CURRENT_DIR, 'dist');
    }
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      distPath = path.join(process.cwd(), 'dist');
    }
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      distPath = process.cwd();
    }
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Scout Management System running on http://localhost:${PORT}`);
  });

  const onShutdown = () => {
    console.log('[SERVER] Shutting down, persisting database...');
    try {
      saveDb();
    } catch (e) {}
    process.exit(0);
  };

  process.on('SIGINT', onShutdown);
  process.on('SIGTERM', onShutdown);

  return server;
}

startServer();

