import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { getKeywordLogs, inspectDatabaseSchema } from '../db.js';

const router = Router();

// GET /api/keywords
// Query keyword & event records with date filtering, search, and pagination
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const tableName = req.query.tableName ? String(req.query.tableName) : undefined;

    const result = await getKeywordLogs({
      page,
      limit,
      startDate,
      endDate,
      search,
      tableName,
    });

    res.json({
      success: true,
      ...result,
      timezone: 'Asia/Jakarta',
    });
  } catch (err: any) {
    console.error('[Keywords API Error]', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Gagal mengambil data keyword dari database.',
    });
  }
});

// GET /api/keywords/schema
// Returns detected source table and columns
router.get('/schema', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = await inspectDatabaseSchema();
    res.json({
      success: true,
      schema,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Gagal memeriksa schema tabel database.',
    });
  }
});

export default router;
