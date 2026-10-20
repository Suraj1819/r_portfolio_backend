import { contactSchema } from '../schemas/contact.js';
import { insertContactMessage, updateEmailStatus } from '../repositories/contactRepository.js';
import { sendOwnerNotification } from '../services/emailService.js';

export async function submitContact(req, res) {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Unable to submit your message. Please check the form and try again.',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;

    let record;
    try {
      record = await insertContactMessage({
        name: data.name,
        email: data.email,
        subject: data.subject,
        inquiryType: data.inquiryType,
        message: data.message,
      });
    } catch (dbErr) {
      console.error('Contact insert failed:', dbErr.message);
      return res.status(503).json({
        success: false,
        message: 'Unable to submit your message. Please try again.',
      });
    }

    const emailResult = await sendOwnerNotification({
      name: data.name,
      email: data.email,
      subject: data.subject,
      inquiryType: data.inquiryType,
      message: data.message,
      createdAt: record.created_at,
    });

    try {
      await updateEmailStatus(record.id, emailResult.sent ? 'sent' : 'failed');
    } catch (updErr) {
      console.error('Email status update failed:', updErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Your message has been received.',
    });
  } catch (err) {
    console.error('Contact handler error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to submit your message. Please try again.',
    });
  }
}
