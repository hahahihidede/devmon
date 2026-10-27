import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Preferred production path on Ubuntu VM, or fallback to relative ./data/screenshots
const PREFERRED_DIR = process.env.SCREENSHOTS_DIR || '/srv/app-data/screenshots/';
const FALLBACK_DIR = path.resolve(process.cwd(), 'data', 'screenshots');

let activeStorageDir = PREFERRED_DIR;

// Determine and initialize safe storage directory
export function initStorage(): { path: string; isPreferred: boolean; isWritable: boolean; error?: string } {
  try {
    // Try preferred directory first
    if (!fs.existsSync(PREFERRED_DIR)) {
      try {
        fs.mkdirSync(PREFERRED_DIR, { recursive: true, mode: 0o750 });
      } catch (err: any) {
        console.warn(`[Storage] Cannot create preferred dir ${PREFERRED_DIR} (${err.message}). Using fallback: ${FALLBACK_DIR}`);
        activeStorageDir = FALLBACK_DIR;
      }
    } else {
      activeStorageDir = PREFERRED_DIR;
    }

    // If active storage is fallback or preferred failed, ensure fallback exists
    if (!fs.existsSync(activeStorageDir)) {
      fs.mkdirSync(activeStorageDir, { recursive: true, mode: 0o750 });
    }

    // Test write permission
    const testFile = path.join(activeStorageDir, `.test_write_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return {
      path: activeStorageDir,
      isPreferred: activeStorageDir === PREFERRED_DIR,
      isWritable: true,
    };
  } catch (err: any) {
    console.error(`[Storage] Storage directory error:`, err);
    return {
      path: activeStorageDir,
      isPreferred: false,
      isWritable: false,
      error: err.message,
    };
  }
}

export function getStorageDir(): string {
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
