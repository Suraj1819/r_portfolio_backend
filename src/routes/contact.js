import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

/**
 * POST /api/v1/contact
 * Submit a contact form message — inserts into Supabase (contact_messages table)
 *
 * Body:
 *   name             string  required  (max 100)
 *   email            string  required  (valid email, max 254)
 *   subject          string  required  (3-180 chars)
 *   inquiryType      string  optional  (freelance|job|internship|collaboration|technical|other)
 *   message          string  required  (10-5000 chars)
 *   privacyAccepted  boolean required  (must be true)
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      subject,
      inquiryType,
      message,
      privacyAccepted,
    } = req.body || {};

    // ---------- Server-side validation ----------
    const errors = {};

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) errors.name = 'Name is required.';
    else if (trimmedName.length > 100) errors.name = 'Name must be 100 characters or less.';

    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    if (!trimmedEmail) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Enter a valid email address.';
    } else if (trimmedEmail.length > 254) {
      errors.email = 'Email is too long.';
    }

    const trimmedSubject = typeof subject === 'string' ? subject.trim() : '';
    if (!trimmedSubject) errors.subject = 'Subject is required.';
    else if (trimmedSubject.length < 3) errors.subject = 'Subject is too short.';
    else if (trimmedSubject.length > 180) {
      errors.subject = 'Subject must be 180 characters or less.';
    }

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    if (!trimmedMessage) errors.message = 'Message is required.';
    else if (trimmedMessage.length < 10) {
      errors.message = 'Please write a more detailed message.';
    } else if (trimmedMessage.length > 5000) {
      errors.message = 'Message must be 5000 characters or less.';
    }

    if (!privacyAccepted) {
      errors.privacyAccepted = 'Please acknowledge the privacy notice.';
    }

    const allowedInquiryTypes = [
      'freelance', 'job', 'internship', 'collaboration', 'technical', 'other',
    ];
    const safeInquiryType =
      typeof inquiryType === 'string' && allowedInquiryTypes.includes(inquiryType)
        ? inquiryType
        : null;

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the errors and try again.',
        errors,
      });
    }

    // ---------- Insert into Supabase (PostgreSQL) ----------
    // Using parameterized query — prevents SQL injection.
    // Note: column names are snake_case (inquiry_type, privacy_accepted) to match SQL convention.
    const insertQuery = `
      INSERT INTO contact_messages
        (name, email, subject, inquiry_type, message, privacy_accepted, ip_address, user_agent)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, created_at
    `;

    const values = [
      trimmedName,
      trimmedEmail,
      trimmedSubject,
      safeInquiryType,
      trimmedMessage,
      Boolean(privacyAccepted),
      req.ip || req.socket?.remoteAddress || null,
      req.get('User-Agent') || null,
    ];

    const result = await query(insertQuery, values);
    const row = result.rows?.[0];

    return res.status(201).json({
      success: true,
      message: 'Thank you for reaching out. Your message has been received.',
      data: row ? { id: row.id, createdAt: row.created_at } : undefined,
    });
  } catch (err) {
    console.error('[contact] POST /api/v1/contact failed:', err);

    // Handle specific PostgreSQL errors with friendly messages
    if (err.code === '42P01') {
      // undefined_table
      return res.status(500).json({
        success: false,
        message: 'Server error: contact_messages table does not exist. Run the SQL setup script.',
      });
    }
    if (err.code === '28P01') {
      // invalid_password
      return res.status(500).json({
        success: false,
        message: 'Server error: database authentication failed. Check DATABASE_URL.',
      });
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        message: 'Server error: cannot connect to database. Please try again later.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Your message could not be submitted. Please try again or use the contact links.',
    });
  }
});

// GET /api/v1/contact/health — quick health check (useful for debugging)
router.get('/health', async (req, res) => {
  try {
    const result = await query('SELECT 1 as ok');
    return res.json({
      success: true,
      db: result.rows?.[0]?.ok === 1 ? 'connected' : 'unknown',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      db: 'disconnected',
      error: err.message,
    });
  }
});

export default router;
