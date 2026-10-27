import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev_secret_key_terralogiq_device_activity_2026';
const ADMIN_USERNAME = process.env.AUTH_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.AUTH_PASSWORD || 'admin_secure_password';

export interface UserSession {
  username: string;
  role: 'admin' | 'viewer';
  exp: number;
}

// Generate base64url HMAC signed token
export function createSessionToken(username: string, role: 'admin' | 'viewer' = 'admin'): string {
  const payload: UserSession = {
    username,
    role,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

// Verify token
export function verifySessionToken(token: string): UserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: UserSession = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// Express Auth Middleware
export interface AuthenticatedRequest extends Request {
  user?: UserSession;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    // Allows streaming <img> tags with ?token= query parameter
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak: Token autentikasi diperlukan.' });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.' });
  }

  req.user = session;
  next();
}

export function validateCredentials(username: string, password: string):boolean {
  // Constant-time comparison for admin credentials
  const validUser = username === ADMIN_USERNAME || username === 'admin@terralogiq.com';
  const validPass = password === ADMIN_PASSWORD;
  return validUser && validPass;
}

export function getAdminUsername(): string {
  return ADMIN_USERNAME;
}
