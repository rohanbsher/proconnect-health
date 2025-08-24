import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, User, VerificationStatus } from '@prisma/client';
import { z } from 'zod';
import { RedisClient } from '../lib/redis';
import { EmailService } from './EmailService';
import { BotDetectionService } from './BotDetectionService';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['JOB_SEEKER', 'RECRUITER', 'EMPLOYER']),
  recaptchaToken: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  recaptchaToken: z.string().optional(),
  deviceFingerprint: z.string().optional()
});

export class AuthService {
  private prisma: PrismaClient;
  private redis: RedisClient;
  private emailService: EmailService;
  private botDetection: BotDetectionService;
  
  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new RedisClient();
    this.emailService = new EmailService();
    this.botDetection = new BotDetectionService();
  }
  
  async register(data: z.infer<typeof RegisterSchema>) {
    try {
      const validated = RegisterSchema.parse(data);
      
      // Bot detection
      const botScore = await this.botDetection.analyzeRegistration({
        email: validated.email,
        username: validated.username,
        recaptchaToken: validated.recaptchaToken,
        timestamp: new Date()
      });
      
      if (botScore.isBot) {
        logger.warn(`Bot registration attempt blocked: ${validated.email}`);
        throw new Error('Registration failed security check');
      }
      
      // Check for existing user
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: validated.email },
            { username: validated.username }
          ]
        }
      });
      
      if (existingUser) {
        throw new Error('Email or username already exists');
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(validated.password, 12);
      
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      // Create user with transaction
      const user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: validated.email,
            username: validated.username,
            passwordHash,
            role: validated.role,
            verificationToken,
            verificationStatus: 'UNVERIFIED',
            trustScore: botScore.trustScore,
            profile: {
              create: {
                firstName: validated.firstName,
                lastName: validated.lastName,
                linkedinUrl: validated.linkedinUrl,
                githubUrl: validated.githubUrl
              }
            }
          },
          include: {
            profile: true
          }
        });
        
        // Log registration activity
        await tx.activity.create({
          data: {
            userId: newUser.id,
            type: 'REGISTRATION',
            description: 'User registered',
            metadata: {
              source: 'web',
              trustScore: botScore.trustScore
            }
          }
        });
        
        return newUser;
      });
      
      // Send verification email
      await this.emailService.sendVerificationEmail(
        user.email,
        verificationToken
      );
      
      // Generate tokens
      const tokens = this.generateTokens(user);
      
      // Cache session
      await this.redis.setSession(user.id, {
        userId: user.id,
        email: user.email,
        role: user.role,
        trustScore: user.trustScore
      });
      
      logger.info(`User registered successfully: ${user.email}`);
      
      return {
        user: this.sanitizeUser(user),
        ...tokens
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }
  
  async login(data: z.infer<typeof LoginSchema>) {
    try {
      const validated = LoginSchema.parse(data);
      
      // Bot detection for login
      const botScore = await this.botDetection.analyzeLogin({
        email: validated.email,
        recaptchaToken: validated.recaptchaToken,
        deviceFingerprint: validated.deviceFingerprint,
        timestamp: new Date()
      });
      
      if (botScore.isBot) {
        logger.warn(`Bot login attempt blocked: ${validated.email}`);
        await this.recordFailedLogin(validated.email, 'BOT_DETECTED');
        throw new Error('Login failed security check');
      }
      
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email: validated.email },
        include: { profile: true }
      });
      
      if (!user) {
        await this.recordFailedLogin(validated.email, 'USER_NOT_FOUND');
        throw new Error('Invalid credentials');
      }
      
      // Check if account is locked
      const isLocked = await this.isAccountLocked(user.id);
      if (isLocked) {
        throw new Error('Account temporarily locked due to multiple failed attempts');
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(
        validated.password,
        user.passwordHash
      );
      
      if (!isValidPassword) {
        await this.recordFailedLogin(user.email, 'INVALID_PASSWORD');
        throw new Error('Invalid credentials');
      }
      
      // Update last login and trust score
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          trustScore: Math.min(1, user.trustScore + 0.01)
        }
      });
      
      // Generate tokens
      const tokens = this.generateTokens(user);
      
      // Create session
      await this.redis.setSession(user.id, {
        userId: user.id,
        email: user.email,
        role: user.role,
        trustScore: user.trustScore,
        loginAt: new Date().toISOString()
      });
      
      // Log successful login
      await this.prisma.activity.create({
        data: {
          userId: user.id,
          type: 'LOGIN',
          description: 'User logged in',
          metadata: {
            deviceFingerprint: validated.deviceFingerprint,
            trustScore: botScore.trustScore
          }
        }
      });
      
      logger.info(`User logged in successfully: ${user.email}`);
      
      return {
        user: this.sanitizeUser(user),
        ...tokens
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }
  
  async verifyEmail(token: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { verificationToken: token }
      });
      
      if (!user) {
        throw new Error('Invalid verification token');
      }
      
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationToken: null,
          verificationStatus: 'VERIFIED',
          trustScore: Math.min(1, user.trustScore + 0.2)
        }
      });
      
      logger.info(`Email verified for user: ${user.email}`);
      
      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
  }
  
  async refreshToken(refreshToken: string) {
    try {
      const payload = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET!
      ) as any;
      
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: { profile: true }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const tokens = this.generateTokens(user);
      
      return {
        user: this.sanitizeUser(user),
        ...tokens
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw new Error('Invalid refresh token');
    }
  }
  
  async logout(userId: string) {
    try {
      await this.redis.deleteSession(userId);
      
      await this.prisma.activity.create({
        data: {
          userId,
          type: 'LOGOUT',
          description: 'User logged out',
          metadata: {}
        }
      });
      
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }
  
  async requestPasswordReset(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email }
      });
      
      if (!user) {
        // Don't reveal if user exists
        return { success: true, message: 'If account exists, reset email sent' };
      }
      
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 3600000); // 1 hour
      
      await this.redis.set(
        `password-reset:${resetToken}`,
        user.id,
        3600
      );
      
      await this.emailService.sendPasswordResetEmail(
        user.email,
        resetToken
      );
      
      return { success: true, message: 'If account exists, reset email sent' };
    } catch (error) {
      logger.error('Password reset request error:', error);
      throw error;
    }
  }
  
  async resetPassword(token: string, newPassword: string) {
    try {
      const userId = await this.redis.get(`password-reset:${token}`);
      
      if (!userId) {
        throw new Error('Invalid or expired reset token');
      }
      
      const passwordHash = await bcrypt.hash(newPassword, 12);
      
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash }
      });
      
      await this.redis.delete(`password-reset:${token}`);
      
      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      logger.error('Password reset error:', error);
      throw error;
    }
  }
  
  private generateTokens(user: User) {
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
    );
    
    return { accessToken, refreshToken };
  }
  
  private sanitizeUser(user: any) {
    const { passwordHash, verificationToken, ...sanitized } = user;
    return sanitized;
  }
  
  private async recordFailedLogin(email: string, reason: string) {
    const key = `failed-login:${email}`;
    const attempts = await this.redis.incr(key);
    
    if (attempts === 1) {
      await this.redis.expire(key, 900); // 15 minutes
    }
    
    logger.warn(`Failed login attempt for ${email}: ${reason}`);
  }
  
  private async isAccountLocked(userId: string): Promise<boolean> {
    const key = `failed-login:${userId}`;
    const attempts = await this.redis.get(key);
    return parseInt(attempts || '0') >= 5;
  }
}