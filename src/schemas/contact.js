import { z } from 'zod';

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(254, 'Email is too long'),
  subject: z
    .string()
    .trim()
    .min(3, 'Subject is too short')
    .max(180, 'Subject must be 180 characters or less'),
  inquiryType: z
    .enum(['freelance', 'job', 'internship', 'collaboration', 'technical', 'other'])
    .optional()
    .nullable(),
  message: z
    .string()
    .trim()
    .min(10, 'Message is too short')
    .max(5000, 'Message must be 5000 characters or less'),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Privacy acknowledgement is required' }),
  }),
});
