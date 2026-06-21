const authService = require('../../services/auth.service');
const jwt = require('jsonwebtoken');
const config = require('../../config');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.validatedData.body);
      res.status(201).json({
        status: 'success',
        message: 'Registration successful. Please check your email to verify your account.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password, twoFactorCode } = req.validatedData.body;
      const result = await authService.login(email, password, twoFactorCode);
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken, // Also return in response as backup
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const refreshToken = req.validatedData.body.refreshToken || req.cookies.refreshToken;
      const tokens = await authService.refreshToken(refreshToken);

      // Update refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        status: 'success',
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      });
    } catch (error) {
      if (error?.status === 401 || error?.message?.toLowerCase().includes('refresh token')) {
        res.clearCookie('refreshToken');
      }
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken;
      await authService.logout(refreshToken);

      res.clearCookie('refreshToken');
      res.json({
        status: 'success',
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      await authService.forgotPassword(req.validatedData.body.email);
      res.json({
        status: 'success',
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.validatedData.body;
      await authService.resetPassword(token, newPassword);
      res.json({
        status: 'success',
        message: 'Password has been reset successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const user = await authService.verifyEmail(req.params.token);
      
      // Generate access token for auto-login
      const accessToken = jwt.sign(
        { id: user._id, userId: user._id.toString(), email: user.email, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.accessTokenExpiry }
      );
      
      res.json({
        status: 'success',
        message: 'Email verified successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            plan: user.plan,
            isEmailVerified: user.isEmailVerified
          },
          accessToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async setup2FA(req, res, next) {
    try {
      const result = await authService.setup2FA(req.user.userId);
      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async verify2FA(req, res, next) {
    try {
      const isValid = await authService.verify2FA(
        req.user.userId,
        req.validatedData.body.token
      );
      res.json({
        status: 'success',
        data: {
          verified: isValid
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();