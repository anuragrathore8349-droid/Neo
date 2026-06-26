const { z } = require('zod');

const authSchemas = {
  register: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
      firstName: z.string().min(2, 'First name must be at least 2 characters'),
      lastName: z.string().min(2, 'Last name must be at least 2 characters')
    })
  }),

  resendVerification: z.object({
    body: z.object({
      email: z.string().email('Invalid email address')
    })
  }),

  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string(),
      twoFactorCode: z.string().optional()
    })
  }),

  refreshToken: z.object({
    body: z.object({
      refreshToken: z.string().optional()
    })
  }),

  logout: z.object({
    body: z.object({
      refreshToken: z.string().optional()
    }).optional()
  }),

  forgotPassword: z.object({
    body: z.object({
      email: z.string().email('Invalid email address')
    })
  }),

  resetPassword: z.object({
    body: z.object({
      token: z.string(),
      newPassword: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    })
  }),

  verifyEmail: z.object({
    params: z.object({
      token: z.string()
    })
  }),

  verify2FA: z.object({
    body: z.object({
      token: z.string().length(6, 'Invalid 2FA code')
    })
  })
};

module.exports = { authSchemas };