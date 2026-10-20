import { Resend } from 'resend';
import { env } from '../config/env.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendOwnerNotification({ name, email, subject, inquiryType, message, createdAt }) {
  if (!env.emailConfigured) {
    console.warn('Email not configured; skipping owner notification');
    return { sent: false, reason: 'not_configured' };
  }

  const resend = new Resend(env.EMAIL_API_KEY);
  const safeSubject = escapeHtml(subject);
  const html = `
    <h2>New Portfolio Enquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Inquiry type:</strong> ${escapeHtml(inquiryType || '—')}</p>
    <p><strong>Subject:</strong> ${safeSubject}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(String(createdAt || new Date().toISOString()))}</p>
    <hr />
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(message)}</pre>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: env.CONTACT_FROM_EMAIL,
      to: env.CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `New Portfolio Enquiry: ${subject.slice(0, 80)}`,
      html,
    });

    if (error) {
      console.error('Resend error:', error.message || error);
      return { sent: false, reason: error.message || 'send_failed' };
    }
    return { sent: true, id: data?.id };
  } catch (err) {
    console.error('Email send exception:', err.message);
    return { sent: false, reason: err.message };
  }
}
