// utils/validators.js
const Joi = require('joi');
const { VALIDATION } = require('../config/constants');

/**
 * Validation Schemas using Joi
 */

// Auth Validations
const authValidators = {
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(VALIDATION.PASSWORD_MIN_LENGTH).required().messages({
      'string.min': `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      'any.required': 'Password is required',
    }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  }),

  resetPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    otp: Joi.string().pattern(/^\d{6}$/).required().messages({
      'string.pattern.base': 'OTP must be a 6-digit number',
      'any.required': 'OTP is required',
    }),
    newPassword: Joi.string().min(VALIDATION.PASSWORD_MIN_LENGTH).required().messages({
      'string.min': `New password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      'any.required': 'New password is required',
    }),
  }),

  updatePassword: Joi.object({
    email: Joi.string().email().required(),
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required',
    }),
    newPassword: Joi.string().min(VALIDATION.PASSWORD_MIN_LENGTH).required().messages({
      'string.min': `New password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      'any.required': 'New password is required',
    }),
  }),
};

// Chat Validations
const chatValidators = {
  sendMessage: Joi.object({
    message: Joi.string().required().min(1).max(1000).messages({
      'string.empty': 'Message cannot be empty',
      'string.max': 'Message is too long (max 1000 characters)',
      'any.required': 'Message is required',
    }),
    sessionId: Joi.string().uuid().optional(),
    userId: Joi.string().uuid().optional(),
    role: Joi.string().valid('admin', 'guest').optional(),
  }),

  createSession: Joi.object({
    title: Joi.string().required().max(100),
    model: Joi.string().optional(),
    userId: Joi.string().uuid().optional(),
  }),
};

// Contact Validations
const contactValidators = {
  contactForm: Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
      'string.min': 'Name must be at least 2 characters',
      'any.required': 'Name is required',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    subject: Joi.string().required().min(5).max(200).messages({
      'string.min': 'Subject must be at least 5 characters',
      'any.required': 'Subject is required',
    }),
    message: Joi.string().required().min(10).max(2000).messages({
      'string.min': 'Message must be at least 10 characters',
      'any.required': 'Message is required',
    }),
  }),
};

// Profile Validations
const profileValidators = {
  updateProfile: Joi.object({
    full_name: Joi.string().min(2).max(100).optional(),
    location: Joi.string().max(100).optional(),
    email: Joi.string().email().optional(),
    primary_phone: Joi.string().max(20).optional(),
    linkedin: Joi.string().uri().optional(),
    website: Joi.string().uri().optional(),
    description: Joi.string().max(2000).optional(),
    skills: Joi.array().items(Joi.string()).optional(),
    themes: Joi.array().optional(),
    currenttheme: Joi.string().optional(),
  }),
};

/**
 * Validation middleware factory
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(422).json({
        success: false,
        statusCode: 422,
        message: 'Validation Error',
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
};

module.exports = {
  authValidators,
  chatValidators,
  contactValidators,
  profileValidators,
  validate,
};
