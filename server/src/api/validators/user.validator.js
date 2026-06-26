const { z } = require('zod');

const userSchemas = {
  updateProfile: z.object({
    body: z.object({
      fullName: z.string()
        .min(2, 'Full name must be at least 2 characters')
        .optional(),
      firstName: z.string()
        .min(2, 'First name must be at least 2 characters')
        .optional(),
      lastName: z.string()
        .min(2, 'Last name must be at least 2 characters')
        .optional(),
      phoneNumber: z.string()
        .min(5, 'Phone number must be at least 5 characters')
        .max(20, 'Phone number must not exceed 20 characters')
        .optional(),
      country: z.string()
        .optional(),
      dateOfBirth: z.string()
        .optional(),
      profession: z.string()
        .optional(),
      avatar: z.string()
        .optional(),
      bio: z.string()
        .optional(),
      timezone: z.string()
        .optional(),
      language: z.string()
        .length(2, 'Invalid language code')
        .optional(),
      currency: z.string()
        .length(3, 'Invalid currency code')
        .optional()
    })
  }),

  changePassword: z.object({
    body: z.object({
      currentPassword: z.string()
        .min(1, 'Current password is required'),
      newPassword: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    })
  }),

  updateNotifications: z.object({
    body: z.object({
      marketAlerts: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
      newsDigest: z.boolean().optional(),
      tradingUpdates: z.boolean().optional(),
      portfolioSummary: z.boolean().optional()
    })
  }),

  createApiKey: z.object({
    body: z.object({
      name: z.string()
        .min(1, 'API key name is required')
        .max(50, 'API key name cannot exceed 50 characters'),
      permissions: z.array(
        z.enum(['read', 'trade', 'withdraw'])
      ),
      ipWhitelist: z.array(
        z.string().ip()
      ).optional(),
      expiresAt: z.string()
        .datetime()
        .optional()
    })
  }),

  deleteApiKey: z.object({
    params: z.object({
      id: z.string()
        .min(1, 'API key ID is required')
    })
  })
};

module.exports = { userSchemas };