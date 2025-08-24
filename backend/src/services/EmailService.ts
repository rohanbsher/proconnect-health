// Email service placeholder for MVP
// Will be implemented when we add authentication in Step 4

import { logger } from '../lib/logger';

export class EmailService {
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    // Placeholder - log to console for now
    logger.info(`[EMAIL] Verification email would be sent to ${email}`);
    logger.info(`[EMAIL] Verification link: http://localhost:3000/verify?token=${token}`);
  }
  
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // Placeholder - log to console for now
    logger.info(`[EMAIL] Password reset email would be sent to ${email}`);
    logger.info(`[EMAIL] Reset link: http://localhost:3000/reset-password?token=${token}`);
  }
  
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    // Placeholder - log to console for now
    logger.info(`[EMAIL] Welcome email would be sent to ${name} at ${email}`);
  }
  
  async sendJobApplicationConfirmation(email: string, jobTitle: string, company: string): Promise<void> {
    // Placeholder - log to console for now
    logger.info(`[EMAIL] Application confirmation for ${jobTitle} at ${company} would be sent to ${email}`);
  }
}