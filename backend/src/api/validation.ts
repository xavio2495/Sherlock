import Joi from 'joi';

/**
 * Validation schemas for API requests
 */

// RWA Create Request Schema
export const rwaCreateSchema = Joi.object({
  issuerAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Ethereum address format',
      'any.required': 'Issuer address is required',
    }),
  
  documentHash: Joi.string()
    .min(1)
    .max(256)
    .required()
    .messages({
      'string.min': 'Document hash cannot be empty',
      'string.max': 'Document hash too long',
      'any.required': 'Document hash is required',
    }),
  
  totalValue: Joi.number()
    .integer()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .required()
    .messages({
      'number.min': 'Total value must be at least 1',
      'number.integer': 'Total value must be an integer',
      'any.required': 'Total value is required',
    }),
  
  fractionCount: Joi.number()
    .integer()
    .min(1)
    .max(1000000)
    .required()
    .messages({
      'number.min': 'Fraction count must be at least 1',
      'number.max': 'Fraction count cannot exceed 1,000,000',
      'number.integer': 'Fraction count must be an integer',
      'any.required': 'Fraction count is required',
    }),
  
  minFractionSize: Joi.number()
    .integer()
    .min(1)
    .max(Joi.ref('fractionCount'))
    .required()
    .messages({
      'number.min': 'Minimum fraction size must be at least 1',
      'number.max': 'Minimum fraction size cannot exceed total fraction count',
      'number.integer': 'Minimum fraction size must be an integer',
      'any.required': 'Minimum fraction size is required',
    }),
  
  lockupPeriod: Joi.number()
    .integer()
    .min(0)
    .max(520)
    .default(0)
    .messages({
      'number.min': 'Lockup period cannot be negative',
      'number.max': 'Lockup period cannot exceed 520 weeks (10 years)',
      'number.integer': 'Lockup period must be an integer',
    }),
  
  assetType: Joi.string()
    .valid('invoice', 'bond', 'real-estate')
    .required()
    .messages({
      'any.only': 'Asset type must be one of: invoice, bond, real-estate',
      'any.required': 'Asset type is required',
    }),
  
  zkProofInput: Joi.object({
    commitment: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{64}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid commitment format (must be 32-byte hex with 0x prefix)',
        'any.required': 'ZK proof commitment is required',
      }),
    
    secret: Joi.string()
      .min(1)
      .max(256)
      .required()
      .messages({
        'string.min': 'Secret cannot be empty',
        'any.required': 'ZK proof secret is required',
      }),
    
    nullifier: Joi.string()
      .min(1)
      .max(256)
      .required()
      .messages({
        'string.min': 'Nullifier cannot be empty',
        'any.required': 'ZK proof nullifier is required',
      }),
  }).required().messages({
    'any.required': 'ZK proof input is required',
  }),
});

// ZK Proof Generation Request Schema
export const zkProofSchema = Joi.object({
  proofType: Joi.string()
    .valid('eligibility', 'range')
    .required()
    .messages({
      'any.only': 'Proof type must be either eligibility or range',
      'any.required': 'Proof type is required',
    }),
  
  userAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Ethereum address format',
      'any.required': 'User address is required',
    }),
  
  inputs: Joi.object({
    commitment: Joi.string().optional(),
    secret: Joi.string().optional(),
    nullifier: Joi.string().optional(),
    tokenId: Joi.number().integer().min(0).optional(),
    actualAmount: Joi.number().integer().min(0).optional(),
    minRange: Joi.number().integer().min(0).optional(),
    maxRange: Joi.number().integer().min(0).optional(),
  }).required(),
});

// Purchase Request Schema
export const purchaseSchema = Joi.object({
  tokenId: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      'number.min': 'Token ID cannot be negative',
      'number.integer': 'Token ID must be an integer',
      'any.required': 'Token ID is required',
    }),
  
  amount: Joi.number()
    .integer()
    .min(1)
    .max(1000000)
    .required()
    .messages({
      'number.min': 'Amount must be at least 1',
      'number.max': 'Amount cannot exceed 1,000,000',
      'number.integer': 'Amount must be an integer',
      'any.required': 'Amount is required',
    }),
  
  buyerAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Ethereum address format',
      'any.required': 'Buyer address is required',
    }),
  
  zkProofInput: Joi.object({
    commitment: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{64}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid commitment format (must be 32-byte hex with 0x prefix)',
        'any.required': 'ZK proof commitment is required',
      }),
    
    secret: Joi.string()
      .min(1)
      .max(256)
      .required()
      .messages({
        'string.min': 'Secret cannot be empty',
        'any.required': 'ZK proof secret is required',
      }),
    
    nullifier: Joi.string()
      .min(1)
      .max(256)
      .required()
      .messages({
        'string.min': 'Nullifier cannot be empty',
        'any.required': 'ZK proof nullifier is required',
      }),
  }).required()
    .messages({
      'any.required': 'Secret is required',
    }),
  
  nullifier: Joi.string()
    .required()
    .messages({
      'any.required': 'Nullifier is required',
    }),
});

// Oracle Update Request Schema
export const oracleUpdateSchema = Joi.object({
  priceIds: Joi.array()
    .items(
      Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/)
    )
    .min(1)
    .max(10)
    .optional()
    .messages({
      'array.min': 'At least one price ID is required',
      'array.max': 'Cannot update more than 10 price feeds at once',
      'string.pattern.base': 'Invalid price ID format',
    }),
});

/**
 * Middleware factory for request validation
 */
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorMessages,
      });
    }

    req.body = value;
    next();
  };
};
