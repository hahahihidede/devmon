import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Preferred production path on Ubuntu VM, or fallback to relative ./data/screenshots
export const PREFERRED_DIR = process.env.SCREENSHOTS_DIR || '/srv/app-data/screenshots/';
export const FALLBACK_DIR = path.resolve(process.cwd(), 'data', 'screenshots');

let activeStorageDir = PREFERRED_DIR;

// Determine and initialize safe storage directory
export function initStorage(): { path: string; isPreferred: boolean; isWritable: boolean; error?: string } {
  // First test if PREFERRED_DIR is usable and writable
  try {
    if (!fs.existsSync(PREFERRED_DIR)) {
      fs.mkdirSync(PREFERRED_DIR, { recursive: true, mode: 0o775 });
    }
    // Test write permission on PREFERRED_DIR
    const testFile = path.join(PREFERRED_DIR, `.test_write_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    activeStorageDir = PREFERRED_DIR;
    return {
      path: activeStorageDir,
      isPreferred: true,
      isWritable: true,
    };
  } catch (err: any) {
    console.warn(`[Storage] Preferred directory ${PREFERRED_DIR} is not writable (${err.message}). Falling back to: ${FALLBACK_DIR}`);
    
    // Fallback to FALLBACK_DIR inside application directory
    try {
      if (!fs.existsSync(FALLBACK_DIR)) {
        fs.mkdirSync(FALLBACK_DIR, { recursive: true, mode: 0o775 });
      }
      const testFile = path.join(FALLBACK_DIR, `.test_write_${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      activeStorageDir = FALLBACK_DIR;
      return {
        path: activeStorageDir,
        isPreferred: false,
        isWritable: true,
        error: `Preferred dir ${PREFERRED_DIR} not writable: ${err.message}. Menggunakan fallback lokal.`,
      };
    } catch (fallbackErr: any) {
      console.error(`[Storage] Fallback directory also failed:`, fallbackErr);
      return {
        path: activeStorageDir,
        isPreferred: false,
        isWritable: false,
        error: fallbackErr.message,
      };
    }
  }
}

export function getStorageDir(): string {
  // Re-verify if preferred directory became writable (e.g. after user ran chown/chmod)
  if (activeStorageDir !== PREFERRED_DIR) {
    try {
      if (fs.existsSync(PREFERRED_DIR)) {
        const testFile = path.join(PREFERRED_DIR, `.perm_check_${Date.now()}`);
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        activeStorageDir = PREFERRED_DIR;
        console.log(`[Storage] Detected write permission on ${PREFERRED_DIR}! Restored as active storage.`);
      }
    } catch {
      // Still not writable, keep fallback
    }
  }
  return activeStorageDir;
}

// Generate unique, non-guessable filename
export function generateUniqueFilename(originalName: string, mimeType: string): string {
  const ext = mimeType === 'image/png' || originalName.toLowerCase().endsWith('.png') ? '.png' : '.jpg';
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  return `screen_${timestamp}_${randomSuffix}${ext}`;
}

// Prevent path traversal and safely locate screenshot file
export function getSafeFilePath(filename: string): string | null {
  // Sanitize and extract just the base filename
  const baseFilename = path.basename(filename.replace(/\\/g, '/')).trim();
  if (!baseFilename || baseFilename.includes('..') || baseFilename.includes('\0')) {
    return null;
  }

  // Candidate locations
  const candidates = [
    path.resolve(activeStorageDir, baseFilename),
    path.resolve(activeStorageDir, 'screenshots', baseFilename),
    path.resolve(process.cwd(), 'screenshots', baseFilename),
    path.resolve(process.cwd(), 'data', 'screenshots', baseFilename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Return primary resolved path inside activeStorageDir
  return path.resolve(activeStorageDir, baseFilename);
}

// Validate image file header / mime
export function validateImageBuffer(buffer: Buffer): { valid: boolean; mimeType: string; error?: string } {
  if (buffer.length < 8) {
    return { valid: false, mimeType: '', error: 'Ukuran file terlalu kecil atau file kosong.' };
  }

  // Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: 'image/png' };
  }

  // Check JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  return {
    valid: false,
    mimeType: '',
    error: 'Format file tidak didukung. Hanya file JPG/JPEG dan PNG yang diizinkan.',
  };
}

// Inspect storage metrics (file count, total size)
export function getStorageStats() {
  try {
    if (!fs.existsSync(activeStorageDir)) {
      return { fileCount: 0, totalBytes: 0, path: activeStorageDir, writable: false };
    }

    const files = fs.readdirSync(activeStorageDir);
    let totalBytes = 0;
    let fileCount = 0;

    for (const file of files) {
      if (file.startsWith('.')) continue;
      try {
        const stats = fs.statSync(path.join(activeStorageDir, file));
        if (stats.isFile()) {
          fileCount++;
          totalBytes += stats.size;
        }
      } catch {
        // Skip inaccessible files
      }
    }

    return {
      fileCount,
      totalBytes,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      path: activeStorageDir,
      isPreferred: activeStorageDir === PREFERRED_DIR,
      writable: true,
    };
  } catch (err: any) {
    return {
      fileCount: 0,
      totalBytes: 0,
      totalMB: '0',
      path: activeStorageDir,
      isPreferred: false,
      writable: false,
      error: err.message,
    };
  }
}
