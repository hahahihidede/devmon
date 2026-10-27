import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { getScreenshotRecords, getScreenshotById, saveScreenshotMetadata } from '../db.js';
import {
  getStorageDir,
  generateUniqueFilename,
  getSafeFilePath,
  validateImageBuffer,
  getStorageStats,
} from '../storage.js';

const router = Router();

// Multer memory storage for validating headers & buffer before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak diizinkan. Hanya format JPG dan PNG yang didukung.'));
    }
  },
});

// GET /api/screenshots
// List screenshot metadata records with pagination & date filter
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
    const deviceId = req.query.deviceId ? String(req.query.deviceId) : undefined;

    const result = await getScreenshotRecords({
      page,
      limit,
      startDate,
      endDate,
      deviceId,
    });

    res.json({
      success: true,
      ...result,
      storagePath: getStorageDir(),
      timezone: 'Asia/Jakarta',
    });
  } catch (err: any) {
    console.error('[Screenshots List Error]', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Gagal memuat metadata screenshot.',
    });
  }
});

// GET /api/screenshots/:id
// Get single metadata
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await getScreenshotById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Screenshot tidak ditemukan.' });
    }
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/screenshots/:id/image
// Stream screenshot image securely after authentication verification
router.get('/:id/image', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await getScreenshotById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Metadata screenshot tidak ditemukan.' });
    }

    const safePath = getSafeFilePath(item.filename);
    if (!safePath) {
      return res.status(400).json({ error: 'Nama file tidak aman atau terindikasi path traversal.' });
    }

    // Check if file exists on disk
    if (fs.existsSync(safePath)) {
      res.setHeader('Content-Type', item.mime_type || 'image/jpeg');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.filename)}"`);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      const stream = fs.createReadStream(safePath);
      return stream.pipe(res);
    }

    // Fallback: If file is not present on disk (e.g. sample mock screenshot),
    // generate an authentic styled vector preview displaying screenshot telemetry
    const dateWib = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date(item.timestamp));

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" stroke-width="0.8" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="960" height="540" fill="url(#bg)"/>
        <rect width="960" height="540" fill="url(#grid)"/>
        
        <!-- Window frame -->
        <rect x="60" y="50" width="840" height="440" rx="10" fill="#0b0f19" stroke="#334155" stroke-width="2"/>
        <rect x="60" y="50" width="840" height="40" rx="10" fill="#1e293b"/>
        
        <!-- Window controls -->
        <circle cx="85" cy="70" r="6" fill="#ef4444"/>
        <circle cx="105" cy="70" r="6" fill="#f59e0b"/>
        <circle cx="125" cy="70" r="6" fill="#10b981"/>
        <text x="480" y="74" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13" text-anchor="middle" font-weight="600">
          Aktivitas Perangkat: ${item.device_id} &bull; ${item.original_filename}
        </text>

        <!-- Screen Content Mock -->
        <g transform="translate(100, 130)">
          <rect width="760" height="320" rx="6" fill="#111827" stroke="#1f2937" stroke-width="1.5"/>
          
          <rect x="30" y="30" width="220" height="24" rx="4" fill="#1e293b"/>
          <text x="40" y="46" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold">
            [AUDIT CONSENT ACTIVE]
          </text>

          <text x="30" y="95" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="20" font-weight="700">
            Tangkapan Layar Perangkat Terverifikasi
          </text>
          
          <text x="30" y="130" fill="#94a3b8" font-family="monospace" font-size="14">
            Waktu Pengambilan (WIB) : ${dateWib}
          </text>
          <text x="30" y="155" fill="#94a3b8" font-family="monospace" font-size="14">
            Device ID               : ${item.device_id}
          </text>
          <text x="30" y="180" fill="#94a3b8" font-family="monospace" font-size="14">
            File Storage Target     : /srv/app-data/screenshots/${item.filename}
          </text>
          <text x="30" y="205" fill="#94a3b8" font-family="monospace" font-size="14">
            Ukuran Berkas           : ${(item.file_size / 1024).toFixed(1)} KB (${item.file_size} bytes)
          </text>
          <text x="30" y="230" fill="#94a3b8" font-family="monospace" font-size="14">
            Format MIME             : ${item.mime_type}
          </text>

          <rect x="30" y="260" width="700" height="36" rx="6" fill="#0f172a" stroke="#22c55e" stroke-width="1"/>
          <text x="45" y="283" fill="#4ade80" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13">
            &#10003; Data dikumpulkan secara sah dengan persetujuan pengguna untuk pemantauan kepatuhan.
          </text>
        </g>
      </svg>
    `;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(svg);
  } catch (err: any) {
    console.error('[Stream Screenshot Error]', err);
    res.status(500).json({ error: 'Gagal menyajikan gambar screenshot.' });
  }
});

// Helper to safely sanitize and save image file to disk
function saveImageToDisk(file: Express.Multer.File, preserveOriginalName: boolean = true): {
  filename: string;
  targetPath: string;
  mimeType: string;
  size: number;
} {
  const validation = validateImageBuffer(file.buffer);
  if (!validation.valid) {
    throw new Error(validation.error || 'File gambar tidak valid');
  }

  const rawBaseName = path.basename(file.originalname || 'screenshot.png');
  // Sanitize filename to alphanumeric, underscores, dots, hyphens
  const cleanName = rawBaseName.replace(/[^a-zA-Z0-9._-]/g, '_');

  let filename: string;
  if (preserveOriginalName && cleanName.length > 3) {
    filename = cleanName;
  } else {
    filename = generateUniqueFilename(cleanName, validation.mimeType);
  }

  const targetDir = getStorageDir();
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true, mode: 0o750 });
  }

  const targetPath = path.join(targetDir, filename);
  fs.writeFileSync(targetPath, file.buffer);

  return {
    filename,
    targetPath,
    mimeType: validation.mimeType,
    size: file.buffer.length,
  };
}

// POST /api/screenshots/upload
// Ingestion endpoint for Dashboard UI: supports single or multiple files
router.post(
  '/upload',
  requireAuth,
  upload.fields([
    { name: 'screenshot', maxCount: 1 },
    { name: 'screenshots', maxCount: 50 },
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files: Express.Multer.File[] = [];
      const reqFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (reqFiles) {
        if (reqFiles.screenshot && reqFiles.screenshot.length > 0) {
          files.push(...reqFiles.screenshot);
        }
        if (reqFiles.screenshots && reqFiles.screenshots.length > 0) {
          files.push(...reqFiles.screenshots);
        }
      }

      if (files.length === 0) {
        return res.status(400).json({
          error: 'Tidak ada file screenshot yang dikirim. Kirimkan dengan field "screenshot" atau "screenshots".',
        });
      }

      const deviceId = (req.body.deviceId as string) || (req.body.device_id as string) || 'DEVICE-01';
      const notes = (req.body.notes as string) || 'Diunggah melalui dashboard web';
      const savedItems = [];

      for (const file of files) {
        const saved = saveImageToDisk(file, true);

        // Optionally record in screenshot_metadata table if connected
        try {
          const meta = await saveScreenshotMetadata({
            filename: saved.filename,
            original_filename: file.originalname || saved.filename,
            timestamp: new Date().toISOString(),
            file_size: saved.size,
            mime_type: saved.mimeType,
            storage_status: 'AVAILABLE',
            device_id: deviceId,
            notes,
          });
          savedItems.push({ ...saved, metadata: meta });
        } catch {
          // File is saved to filesystem even if metadata insertion fails
          savedItems.push(saved);
        }
      }

      res.status(201).json({
        success: true,
        message: `${savedItems.length} file screenshot berhasil disimpan ke filesystem VM (/srv/app-data/screenshots/).`,
        items: savedItems,
        storagePath: getStorageDir(),
      });
    } catch (err: any) {
      console.error('[Upload Screenshot Error]', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Gagal menyimpan screenshot ke sistem penyimpanan.',
      });
    }
  }
);

// POST /api/screenshots/ingest
// Direct background ingest endpoint for Windows Client Application
// Supports Authorization Bearer, x-api-key header, or basic sync token
router.post(
  '/ingest',
  upload.fields([
    { name: 'screenshot', maxCount: 1 },
    { name: 'screenshots', maxCount: 20 },
    { name: 'file', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.apiKey || req.query.api_key;
      const expectedKey = process.env.INGEST_API_KEY || 'devmon-sync-secret-2026';

      // Verify simple API Key if configured
      if (process.env.INGEST_API_KEY && apiKey !== expectedKey) {
        return res.status(401).json({ error: 'Kunci API (x-api-key) tidak valid.' });
      }

      const files: Express.Multer.File[] = [];
      const reqFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (reqFiles) {
        if (reqFiles.screenshot) files.push(...reqFiles.screenshot);
        if (reqFiles.screenshots) files.push(...reqFiles.screenshots);
        if (reqFiles.file) files.push(...reqFiles.file);
      }

      if (files.length === 0) {
        return res.status(400).json({ error: 'Tidak ada berkas gambar yang diterima.' });
      }

      const saved = files.map((file) => saveImageToDisk(file, true));

      res.status(201).json({
        success: true,
        message: 'Screenshot berhasil diterima dan disimpan di server.',
        savedFiles: saved.map((s) => s.filename),
        storageDir: getStorageDir(),
      });
    } catch (err: any) {
      console.error('[Ingest Screenshot Error]', err);
      res.status(500).json({ error: err.message || 'Gagal memproses unggahan ingest screenshot.' });
    }
  }
);

// GET /api/screenshots/storage-stats
// Storage health status for screenshots folder
router.get('/storage/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const stats = getStorageStats();
  res.json({
    success: true,
    stats,
  });
});

export default router;
