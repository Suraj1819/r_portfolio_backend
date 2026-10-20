import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Verify admin password against Supabase admin_passwords table.
 *
 * Body:
 *   password  string  required
 *
 * Response:
 *   200 { success: true,  message, token }
 *   401 { success: false, message: "Incorrect password." }
 *   400 { success: false, message: "Password is required." }
 *   500 { success: false, message: "..." }
 */
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body || {};

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
    }

    // Fetch the admin password from Supabase
    const result = await query(
      'SELECT id, username, password FROM admin_passwords WHERE username = $1 LIMIT 1',
      ['admin']
    );

    if (result.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Admin not configured. Please set up an admin password in the database.',
      });
    }

    const storedPassword = result.rows[0].password;

    // Plain-text comparison — replace with bcrypt for stronger security later
    if (password === storedPassword) {
      // Simple session token (in production, use JWT signed with a secret)
      const token = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        token,
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Incorrect password. Please try again.',
    });
  } catch (err) {
    console.error('[auth] POST /api/v1/auth/login failed:', err);

    if (err.code === '42P01') {
      return res.status(500).json({
        success: false,
        message: 'Server error: admin_passwords table does not exist. Run the SQL setup script.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
});

/**
 * GET /api/v1/auth/health
 * Quick check that auth route is mounted.
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    endpoint: '/api/v1/auth/login',
    timestamp: new Date().toISOString(),
  });
});

export default router;