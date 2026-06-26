const { z } = require('zod');

const addressBookSchemas = {
  getAddressBook: z.object({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:  z.coerce.number().int().min(0).optional().default(0),
    }).optional(),
  }),

  addAddress: z.object({
    body: z.object({
      name: z.string()
        .min(1, 'Address name is required')
        .max(100, 'Address name cannot exceed 100 characters'),
      address: z.string()
        .min(1, 'Wallet address is required')
        .max(255, 'Address cannot exceed 255 characters'),
      network: z.string()
        .min(1, 'Network is required')
        .default('Ethereum'),
      notes: z.string()
        .max(500, 'Notes cannot exceed 500 characters')
        .optional()
    })
  }),

  updateAddress: z.object({
    params: z.object({
      id: z.string()
        .min(1, 'Address ID is required')
    }),
    body: z.object({
      name: z.string()
        .min(1, 'Address name is required')
        .max(100, 'Address name cannot exceed 100 characters')
        .optional(),
      address: z.string()
        .min(1, 'Wallet address is required')
        .max(255, 'Address cannot exceed 255 characters')
        .optional(),
      network: z.string()
        .min(1, 'Network is required')
        .optional(),
      notes: z.string()
        .max(500, 'Notes cannot exceed 500 characters')
        .optional()
    })
  }),

  deleteAddress: z.object({
    params: z.object({
      id: z.string()
        .min(1, 'Address ID is required')
    })
  })
};

module.exports = { addressBookSchemas };
