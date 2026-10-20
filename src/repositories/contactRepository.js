import { randomUUID } from 'crypto';
import { query } from '../config/db.js';

export async function insertContactMessage({
  name,
  email,
  subject,
  inquiryType,
  message,
}) {
  const id = randomUUID();
  const result = await query(
    `INSERT INTO contact_messages
      (id, name, email, subject, inquiry_type, message, status, email_status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'new', 'pending', NOW(), NOW())
     RETURNING id, created_at`,
    [id, name, email, subject, inquiryType || null, message]
  );
  return result.rows[0];
}

export async function updateEmailStatus(id, emailStatus) {
  await query(
    `UPDATE contact_messages
     SET email_status = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, emailStatus]
  );
}
