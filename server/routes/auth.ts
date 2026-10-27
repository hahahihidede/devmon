import { Router, Request, Response } from 'express';
import { createSessionToken, validateCredentials, requireAuth, AuthenticatedRequest, getAdminUsername } from '../auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/email dan password wajib diisi.' });
  }

  const isValid = validateCredentials(username.trim(), password);
  if (!isValid) {
    return res.status(401).json({ error: 'Kredensial tidak valid. Silakan periksa kembali username dan password Anda.' });
  }

  const token = createSessionToken(username.trim(), 'admin');
  res.json({
    success: true,
    token,
    user: {
      username: username.trim(),
      role: 'admin',
    },
    message: 'Login berhasil.',
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Sesi berhasil diakhiri.',
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.user,
  });
});

// GET /api/auth/default-credentials-hint
// Gives administrator guidance on configured auth username
router.get('/hint', (req: Request, res: Response) => {
  res.json({
    configuredUser: getAdminUsername(),
    note: 'Gunakan akun yang telah dikonfigurasi pada environment variable AUTH_USERNAME & AUTH_PASSWORD.',
  });
});

export default router;
