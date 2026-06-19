const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const cryptoRandomString = require('crypto-random-string');
const User = require('../models/user.model');
const emailService = require('./email.service');
const config = require('../config');
const ms = require('ms');
const { logger } = require('../api/middlewares/logger.middleware');

class AuthService {
  async register(userData) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('Email already registered');
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

    // Send verification email
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

    return { userId: user._id };
  }

  async login(email, password, twoFactorCode = null) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (user.isLocked()) {
      throw new Error('Account is locked. Try again later');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw new Error('Invalid credentials');
    }

    if (user.isTwoFactorEnabled) {
      if (!twoFactorCode) {
        throw new Error('2FA code required');
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode
      });

      if (!isValid) {
        throw new Error('Invalid 2FA code');
      }
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Reset failed login attempts and update last login atomically
    await User.findByIdAndUpdate(user._id, {
      $set: {
        failedLoginAttempts: 0,
        lockUntil: null,
        lastLogin: new Date()
      },
      $push: {
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
        preferences: user.preferences
      }
    };
  }

  async refreshToken(refreshToken) {
    if (!refreshToken) {
      const error = new Error('Refresh token is required');
      error.status = 400;
      throw error;
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
      const error = new Error('Invalid or expired refresh token');
      error.status = 401;
      throw error;
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
        resetUrl: `${config.appUrl}/reset-password/${resetToken}`
      }
    });
  }

  async resetPassword(token, newPassword) {
    const user = await User.findOneAndUpdate(
      {
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
      },
      {
        $set: {
          password: newPassword,
          refreshTokens: [],  // ✅ clear the array properly
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined
        }
      },
      { new: true }
    );

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }
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
      throw new Error('Invalid or expired verification token');
    }

    return user;
  }

  async setup2FA(userId) {
    // ✅ Fetch user FIRST
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `NeoFin:${user.email}`  // ✅ user exists now
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
      throw new Error('User not found');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token
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

  generateRefreshToken(user) {
    return cryptoRandomString({ length: 40, type: 'url-safe' });
  }
}

module.exports = new AuthService();