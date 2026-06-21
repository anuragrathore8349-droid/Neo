const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const cryptoRandomString = require('crypto-random-string');
const User = require('../models/user.model');
const emailService = require('./email.service');
const config = require('../config');
const ms = require('ms');
const { logger } = require('../api/middlewares/logger.middleware');

// Helper to create an error with an explicit HTTP status code so the
// error middleware returns the right status instead of defaulting to 500.
function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

class AuthService {
  async register(userData) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw httpError('Email already registered', 409);
    }

    const verificationToken = cryptoRandomString({ length: 32, type: 'url-safe' });

    logger.info('Creating new user account', { email: userData.email });
    const user = new User({
      ...userData,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + ms('24h'))
    });

    await user.save();
    logger.info('User saved to database', { userId: user._id, email: user.email });

    // Send verification email (non-blocking failure - registration still succeeds)
    try {
      logger.debug('Sending verification email', { email: user.email });
      await emailService.sendEmail({
        to: user.email,
        subject: 'Verify your email',
        template: 'emailVerification',
        context: {
          name: user.firstName,
          verificationUrl: `${config.appUrl}/verify-email/${verificationToken}`
        }
      });
      logger.info('Verification email sent successfully', { email: user.email });
    } catch (err) {
      logger.error('Failed to send verification email', { email: user.email, error: err.message });
    }

    return {
      userId: user._id,
      email: user.email
    };
  }

  async resendVerificationEmail(email) {
    const user = await User.findOne({ email });
    // Don't reveal whether the account exists
    if (!user) return;
    if (user.isEmailVerified) return;

    const verificationToken = cryptoRandomString({ length: 32, type: 'url-safe' });

    await User.findByIdAndUpdate(user._id, {
      $set: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + ms('24h'))
      }
    });

    await emailService.sendEmail({
      to: user.email,
      subject: 'Verify your email',
      template: 'emailVerification',
      context: {
        name: user.firstName,
        verificationUrl: `${config.appUrl}/verify-email/${verificationToken}`
      }
    });
  }

  async login(email, password, twoFactorCode = null) {
    const user = await User.findOne({ email });
    if (!user) {
      throw httpError('Invalid credentials', 401);
    }

    if (user.isLocked()) {
      throw httpError('Account is locked. Try again later', 423);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw httpError('Invalid credentials', 401);
    }

    if (user.isTwoFactorEnabled) {
      if (!twoFactorCode) {
        throw httpError('2FA code required', 401, 'TWO_FACTOR_REQUIRED');
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1
      });

      if (!isValid) {
        throw httpError('Invalid 2FA code', 401);
      }
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Reset failed login attempts and update last login atomically
    // Track activity log (keep last 50 entries)
    const activityEntry = {
      action: 'login',
      ip: 'unknown', // Will be updated by controller if request object available
      userAgent: 'unknown', // Will be updated by controller if request object available
      timestamp: new Date(),
    };

    await User.findByIdAndUpdate(user._id, {
      $set: {
        failedLoginAttempts: 0,
        lockUntil: null,
        lastLogin: new Date()
      },
      $push: {
        activityLog: {
          $each: [activityEntry],
          $slice: -50 // Keep last 50 entries
        },
        refreshTokens: {
          token: refreshToken,
          expiresAt: new Date(Date.now() + ms(config.jwt.refreshTokenExpiry))
        }
      }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        profession: user.profession,
        avatar: user.avatar,
        bio: user.bio,
        plan: user.plan,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        preferences: user.preferences
      }
    };
  }

  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw httpError('Refresh token is required', 400);
    }

    // First, find the user and validate the refresh token atomically
    const user = await User.findOneAndUpdate(
      {
        'refreshTokens.token': refreshToken,
        'refreshTokens.expiresAt': { $gt: new Date() }
      },
      {
        $pull: { refreshTokens: { token: refreshToken } }
      },
      { new: true }
    );

    if (!user) {
      throw httpError('Invalid or expired refresh token', 401);
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    // Add new refresh token atomically
    await User.findByIdAndUpdate(user._id, {
      $push: {
        refreshTokens: {
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + ms(config.jwt.refreshTokenExpiry))
        }
      }
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(refreshToken) {
    if (!refreshToken) return;
    await User.findOneAndUpdate(
      { 'refreshTokens.token': refreshToken },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      // Return success even if user not found for security
      return;
    }

    const resetToken = cryptoRandomString({ length: 32, type: 'url-safe' });

    // Update reset token atomically
    await User.findByIdAndUpdate(user._id, {
      $set: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: new Date(Date.now() + ms('1h'))
      }
    });

    await emailService.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      template: 'passwordReset',
      context: {
        name: user.firstName,
        resetUrl: `${config.appUrl}/reset-password?token=${resetToken}`
      }
    });
  }

  async resetPassword(token, newPassword) {
    // IMPORTANT: load the document and call .save() so the
    // pre('save') bcrypt hashing hook actually runs. Using
    // findOneAndUpdate() here would write the plaintext password
    // directly to the database and lock the user out permanently.
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      throw httpError('Invalid or expired reset token', 400);
    }

    user.password = newPassword; // triggers pre('save') hashing
    user.refreshTokens = [];     // log out all sessions on password reset
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();
  }

  async verifyEmail(token) {
    const user = await User.findOneAndUpdate(
      {
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
      },
      {
        $set: {
          isEmailVerified: true
        },
        $unset: {
          emailVerificationToken: undefined,
          emailVerificationExpires: undefined
        }
      },
      { new: true }
    );

    if (!user) {
      throw httpError('Invalid or expired verification token', 400);
    }

    return user;
  }

  async setup2FA(userId) {
    // Fetch user first
    const user = await User.findById(userId);
    if (!user) {
      throw httpError('User not found', 404);
    }

    const secret = speakeasy.generateSecret({
      name: `NeoFin:${user.email}`
    });

    await User.findByIdAndUpdate(userId, {
      $set: { twoFactorSecret: secret.base32 }
    }, { new: true });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    return {
      secret: secret.base32,
      qrCode: qrCodeUrl
    };
  }

  async verify2FA(userId, token) {
    const user = await User.findById(userId);
    if (!user) {
      throw httpError('User not found', 404);
    }

    if (!user.twoFactorSecret) {
      throw httpError('2FA has not been set up for this account', 400);
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (isValid) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          isTwoFactorEnabled: true
        }
      });
    }

    return isValid;
  }

  async disable2FA(userId) {
    await User.findByIdAndUpdate(userId, {
      $set: { isTwoFactorEnabled: false },
      $unset: { twoFactorSecret: '' }
    });
  }

  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user._id,
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiry }
    );
  }

  generateRefreshToken(_user) {
    return cryptoRandomString({ length: 40, type: 'url-safe' });
  }
}

module.exports = new AuthService();
