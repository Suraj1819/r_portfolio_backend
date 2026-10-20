import rateLimit from 'express-rate-limit';

// In-memory store suitable for single-instance development.
// For multi-instance production, use a shared store (e.g. Redis).
export const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});
