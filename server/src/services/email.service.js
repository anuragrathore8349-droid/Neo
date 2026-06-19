const nodemailer = require('nodemailer');
const config = require('../config');

class EmailService {
  constructor() {
    console.log('📧 Initializing email service...');
    console.log('📧 SMTP Config:', {
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      user: config.email.user ? '***configured***' : 'NOT SET',
      from: config.email.from
    });

    if (!config.email.host || !config.email.user || !config.email.password) {
      console.warn('📧 SMTP not fully configured - emails will not be sent');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password
      }
    });

    console.log('📧 Email transporter created successfully');
  }

  async sendEmail({ to, subject, template, context }) {
    if (!this.transporter) {
      console.warn('📧 Email not sent: SMTP not configured');
      return;
    }

    console.log('📧 Preparing to send email...');
    console.log('📧 Email details:', {
      to,
      subject,
      template,
      contextKeys: Object.keys(context)
    });

    const templates = {
      emailVerification: (context) => `
        <h1>Welcome to NeoFin, ${context.name}!</h1>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${context.verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
      passwordReset: (context) => `
        <h1>Password Reset Request</h1>
        <p>Hello ${context.name},</p>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <a href="${context.resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    console.log('📧 Generating email template content...');
    const htmlContent = templates[template](context);
    console.log('📧 Template generated, content length:', htmlContent.length);

    console.log('📧 Sending email via SMTP...');
    try {
      const result = await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html: htmlContent
      });

      console.log('✅ Email sent successfully!');
      console.log('📧 Send result:', {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response
      });

      return result;
    } catch (error) {
      console.error('❌ Email sending failed!');
      console.error('📧 Error details:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response
      });
      throw error;
    }
  }

  getEmailVerificationTemplate(context) {
    return `
      <h1>Welcome to NeoFin, ${context.name}!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${context.verificationUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `;
  }

  getPasswordResetTemplate(context) {
    return `
      <h1>Password Reset Request</h1>
      <p>Hello ${context.name},</p>
      <p>You requested to reset your password. Click the link below to proceed:</p>
      <a href="${context.resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
  }
}

module.exports = new EmailService();