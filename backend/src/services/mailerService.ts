import nodemailer from 'nodemailer';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

const env = getEnv();

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
    });
  }

  return transporter;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetLink: string;
  expiresAt: Date;
}): Promise<void> {
  if (!env.PASSWORD_RESET_SMTP_ENABLED) {
    return;
  }

  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    throw new Error('SMTP is enabled but required SMTP configuration is missing');
  }

  const transport = getTransporter();
  const expiresAtText = params.expiresAt.toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short' });

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: params.to,
    subject: 'Reset your password',
    text: `A password reset was requested for your account.\n\nReset link: ${params.resetLink}\n\nThis link expires at ${expiresAtText}.\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <p>A password reset was requested for your account.</p>
      <p><a href="${params.resetLink}">Reset your password</a></p>
      <p>This link expires at ${expiresAtText}.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}

export async function verifyMailerTransport(): Promise<boolean> {
  if (!env.PASSWORD_RESET_SMTP_ENABLED) {
    return true;
  }
  try {
    await getTransporter().verify();
    return true;
  } catch (error) {
    logger.warn('smtp_verify_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

