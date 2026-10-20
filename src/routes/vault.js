import { Router } from 'express';
import multer from 'multer';
import { query } from '../config/db.js';
import { env } from '../config/env.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'vault-documents';

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */
async function uploadToStorage(filePath, buffer, mimeType) {
  console.log('📤 Uploading to Supabase Storage:', filePath);
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': mimeType,
        'x-upsert': 'false',
      },
      body: buffer,
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Storage upload failed: ${response.status} ${errText}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
}

async function deleteFromStorage(filePath) {
  console.log('🗑️  Deleting from Storage:', filePath);
  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filePath}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Storage delete failed:', response.status, errText);
      throw new Error(`Storage delete failed: ${response.status} ${errText}`);
    }
    console.log('✅ Storage file deleted:', filePath);
    return true;
  } catch (err) {
    console.error('❌ deleteFromStorage error:', err.message);
    throw err;
  }
}

async function checkFileExists(filePath) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filePath}`,
      {
        method: 'HEAD',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      }
    );
    return response.ok;
  } catch (err) {
    console.warn(`[vault] File check failed for ${filePath}:`, err.message);
    return true;
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/v1/vault/documents  — Upload new document               */
/* ------------------------------------------------------------------ */
router.post('/documents', upload.single('file'), async (req, res) => {
  try {
    console.log('📥 Upload request received');
    console.log('📥 Body fields received:', Object.keys(req.body || {}));
    console.log('📥 Detailed field values:');
    console.log('   - certificateNumber:', req.body.certificateNumber);
    console.log('   - issueDate:', req.body.issueDate);
    console.log('   - startDate:', req.body.startDate);
    console.log('   - endDate:', req.body.endDate);
    console.log('   - expiryDate:', req.body.expiryDate);
    console.log('   - credentialUrl:', req.body.credentialUrl);
    console.log('   - scoreGrade:', req.body.scoreGrade);
    console.log('   - duration:', req.body.duration);
    console.log('   - location:', req.body.location);
    console.log('   - mode:', req.body.mode);
    console.log('   - mentorInstructor:', req.body.mentorInstructor);
    console.log('   - teamSize:', req.body.teamSize);
    console.log('   - rolePosition:', req.body.rolePosition);
    console.log('   - file:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'MISSING');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please choose a file.',
      });
    }

    const {
      title,
      category,
      description = '',
      organization = '',
      date = '',
      tags = '',
      featured = false,
      // NEW detailed fields
      certificateNumber = '',
      issueDate = '',
      startDate = '',
      endDate = '',
      expiryDate = '',
      credentialUrl = '',
      scoreGrade = '',
      duration = '',
      location = '',
      mode = '',
      mentorInstructor = '',
      teamSize = '',
      rolePosition = '',
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title and category are required.',
      });
    }

    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;
    const filePath = `documents/${uniqueName}`;

    const fileUrl = await uploadToStorage(filePath, req.file.buffer, req.file.mimetype);
    console.log('✅ Storage upload done. Saving metadata...');

    const tagsArray =
      typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : Array.isArray(tags)
          ? tags
          : [];

    const result = await query(
      `INSERT INTO vault_documents
        (title, category, description, organization, date, tags, featured,
         file_name, file_path, file_url, mime_type, size,
         certificate_number, issue_date, start_date, end_date, expiry_date,
         credential_url, score_grade, duration, location, mode,
         mentor_instructor, team_size, role_position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
       RETURNING id, created_at`,
      [
        title,
        category,
        description,
        organization,
        date,
        tagsArray,
        featured === 'true' || featured === true,
        req.file.originalname,
        filePath,
        fileUrl,
        req.file.mimetype,
        req.file.size,
        certificateNumber,
        issueDate,
        startDate,
        endDate,
        expiryDate,
        credentialUrl,
        scoreGrade,
        duration,
        location,
        mode,
        mentorInstructor,
        teamSize,
        rolePosition,
      ]
    );

    console.log('✅ Metadata saved. ID:', result.rows[0].id);

    // Verify by fetching back
    const verifyResult = await query(
      'SELECT certificate_number, issue_date, start_date, end_date, role_position, mentor_instructor FROM vault_documents WHERE id = $1',
      [result.rows[0].id]
    );
    console.log('🔍 Verification — DB row contents:', verifyResult.rows[0]);

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[vault] POST /documents failed:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File size exceeds 25 MB limit.',
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to upload document.',
    });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/v1/vault/documents  — List all documents                 */
/*  AUTO-CLEANUP: Removes orphaned rows (file deleted from Storage)   */
/* ------------------------------------------------------------------ */
router.get('/documents', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM vault_documents ORDER BY created_at DESC`
    );

    // === AUTO-CLEANUP ===
    const orphanedIds = [];
    const validRows = [];

    const checks = await Promise.all(
      result.rows.map(async (row) => {
        const exists = await checkFileExists(row.file_path);
        return { row, exists };
      })
    );

    for (const { row, exists } of checks) {
      if (exists) {
        validRows.push(row);
      } else {
        orphanedIds.push(row.id);
        console.log(`🧹 Orphaned row detected: ID ${row.id} — "${row.title}" (file missing in Storage)`);
      }
    }

    if (orphanedIds.length > 0) {
      try {
        await Promise.all(
          orphanedIds.map((id) =>
            query('DELETE FROM vault_documents WHERE id = $1', [id])
          )
        );
        console.log(`🧹 Auto-cleanup: Removed ${orphanedIds.length} orphaned row(s) from database`);
      } catch (cleanupErr) {
        console.error('[vault] Cleanup failed:', cleanupErr.message);
        validRows.push(...result.rows.filter((r) => orphanedIds.includes(r.id)));
      }
    }

    // Convert snake_case to camelCase for frontend
    const documents = validRows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      description: row.description || '',
      organization: row.organization || '',
      date: row.date || '',
      tags: row.tags || [],
      featured: row.featured || false,
      fileName: row.file_name,
      filePath: row.file_path,
      fileUrl: row.file_url,
      mimeType: row.mime_type || '',
      size: row.size || 0,
      link: row.file_url,
      source: 'upload',
      blob: null,
      createdAt: new Date(row.created_at).getTime(),
      // NEW detailed fields
      certificateNumber: row.certificate_number || '',
      issueDate: row.issue_date || '',
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      expiryDate: row.expiry_date || '',
      credentialUrl: row.credential_url || '',
      scoreGrade: row.score_grade || '',
      duration: row.duration || '',
      location: row.location || '',
      mode: row.mode || '',
      mentorInstructor: row.mentor_instructor || '',
      teamSize: row.team_size || '',
      rolePosition: row.role_position || '',
    }));

    return res.json({
      success: true,
      data: documents,
      cleanup: orphanedIds.length > 0 ? {
        removed: orphanedIds.length,
        message: `${orphanedIds.length} orphaned document(s) cleaned up`,
      } : undefined,
    });
  } catch (err) {
    console.error('[vault] GET /documents failed:', err);
    if (err.code === '42P01') {
      return res.status(500).json({
        success: false,
        message: 'vault_documents table does not exist. Run the SQL setup script.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch documents.',
    });
  }
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/v1/vault/documents/:id                                */
/* ------------------------------------------------------------------ */
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️  Delete request for document ID:', id);

    const docResult = await query(
      'SELECT id, title, file_path, file_url FROM vault_documents WHERE id = $1',
      [id]
    );

    if (docResult.rows.length === 0) {
      console.log('❌ Document not found in DB');
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    const { file_path: filePath, title } = docResult.rows[0];
    console.log('📄 Found document:', title, '| file_path:', filePath);

    let storageDeleted = false;
    try {
      await deleteFromStorage(filePath);
      storageDeleted = true;
    } catch (storageErr) {
      console.error('⚠️  Storage delete failed (continuing with DB delete):', storageErr.message);
    }

    await query('DELETE FROM vault_documents WHERE id = $1', [id]);
    console.log('✅ DB row deleted for ID:', id);

    return res.json({
      success: true,
      message: storageDeleted
        ? 'Document deleted from Supabase Storage and database.'
        : 'Document deleted from database. (Storage file may have been already removed.)',
      data: { id, storageDeleted },
    });
  } catch (err) {
    console.error('[vault] DELETE failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete document.',
      error: err.message,
    });
  }
});

/* ------------------------------------------------------------------ */
/*  PATCH /api/v1/vault/documents/:id                                 */
/*  Updates document metadata (title, category, dates, etc.)          */
/*  If `featured` is provided alone, only toggles featured status     */
/* ------------------------------------------------------------------ */
router.patch('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    console.log('📝 PATCH request for document ID:', id);
    console.log('📝 Fields received:', Object.keys(body));

    // Check if document exists
    const checkResult = await query(
      'SELECT id, title FROM vault_documents WHERE id = $1',
      [id]
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    // Build dynamic UPDATE query based on provided fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Helper to add a field to updates
    const addField = (camelKey, snakeKey, value) => {
      if (body[camelKey] !== undefined) {
        updates.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    };

    // Core fields
    addField('title', 'title', body.title);
    addField('category', 'category', body.category);
    addField('description', 'description', body.description);
    addField('organization', 'organization', body.organization);
    addField('date', 'date', body.date);
    addField('featured', 'featured', body.featured === 'true' || body.featured === true ? true : (body.featured === 'false' || body.featured === false ? false : body.featured));

    // Tags (special handling — array)
    if (body.tags !== undefined) {
      const tagsArray = typeof body.tags === 'string'
        ? body.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : Array.isArray(body.tags) ? body.tags : [];
      updates.push(`tags = $${paramIndex}`);
      values.push(tagsArray);
      paramIndex++;
    }

    // Detailed fields
    addField('certificateNumber', 'certificate_number', body.certificateNumber);
    addField('issueDate', 'issue_date', body.issueDate);
    addField('startDate', 'start_date', body.startDate);
    addField('endDate', 'end_date', body.endDate);
    addField('expiryDate', 'expiry_date', body.expiryDate);
    addField('credentialUrl', 'credential_url', body.credentialUrl);
    addField('scoreGrade', 'score_grade', body.scoreGrade);
    addField('duration', 'duration', body.duration);
    addField('location', 'location', body.location);
    addField('mode', 'mode', body.mode);
    addField('mentorInstructor', 'mentor_instructor', body.mentorInstructor);
    addField('teamSize', 'team_size', body.teamSize);
    addField('rolePosition', 'role_position', body.rolePosition);

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      // Only updated_at — nothing to update
      return res.json({
        success: true,
        message: 'No fields to update.',
        data: checkResult.rows[0],
      });
    }

    // Add id as last parameter
    values.push(id);

    const updateQuery = `
      UPDATE vault_documents
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log('📝 SQL:', updateQuery);
    console.log('📝 Values:', values);

    const result = await query(updateQuery, values);

    console.log('✅ Document updated. ID:', id);

    return res.json({
      success: true,
      message: 'Document updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[vault] PATCH failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update document.',
      error: err.message,
    });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/v1/vault/health                                           */
/* ------------------------------------------------------------------ */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    storage: SUPABASE_URL ? 'configured' : 'missing',
    bucket: BUCKET_NAME,
    timestamp: new Date().toISOString(),
  });
});

export default router;