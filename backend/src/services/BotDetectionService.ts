import { logger } from '../lib/logger';
import crypto from 'crypto';

interface RegistrationData {
  email: string;
  username: string;
  recaptchaToken?: string;
  timestamp: Date;
}

interface LoginData {
  email: string;
  recaptchaToken?: string;
  deviceFingerprint?: string;
  timestamp: Date;
}

interface BotAnalysisResult {
  isBot: boolean;
  trustScore: number;
  reasons: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class BotDetectionService {
  private suspiciousPatterns = {
    emails: [
      /^[a-z]+\d{4,}@/,  // Common bot pattern: name1234@
      /^test/i,
      /^bot/i,
      /^spam/i,
      /\+\d+@/,  // Plus addressing with numbers
      /@(mailinator|guerrillamail|temp-mail|10minutemail)/i
    ],
    usernames: [
      /^user\d{6,}$/,  // user123456
      /^[a-z]{3}\d{5,}$/,  // abc12345
      /^test/i,
      /^bot/i,
      /\d{8,}/  // Excessive numbers
    ]
  };
  
  private recentRegistrations = new Map<string, Date[]>();
  private ipAddressHistory = new Map<string, number>();
  
  async analyzeRegistration(data: RegistrationData): Promise<BotAnalysisResult> {
    const reasons: string[] = [];
    let riskScore = 0;
    
    // Check email patterns
    const emailRisk = this.checkEmailPatterns(data.email);
    if (emailRisk.isRisky) {
      reasons.push(...emailRisk.reasons);
      riskScore += emailRisk.score;
    }
    
    // Check username patterns
    const usernameRisk = this.checkUsernamePatterns(data.username);
    if (usernameRisk.isRisky) {
      reasons.push(...usernameRisk.reasons);
      riskScore += usernameRisk.score;
    }
    
    // Check registration velocity
    const velocityRisk = this.checkRegistrationVelocity(data.email);
    if (velocityRisk.isRisky) {
      reasons.push(...velocityRisk.reasons);
      riskScore += velocityRisk.score;
    }
    
    // Check recaptcha if provided
    if (!data.recaptchaToken) {
      reasons.push('Missing CAPTCHA verification');
      riskScore += 30;
    } else {
      const recaptchaValid = await this.verifyRecaptcha(data.recaptchaToken);
      if (!recaptchaValid) {
        reasons.push('Failed CAPTCHA verification');
        riskScore += 50;
      }
    }
    
    // Check for common bot indicators
    const commonIndicators = this.checkCommonBotIndicators(data);
    if (commonIndicators.isRisky) {
      reasons.push(...commonIndicators.reasons);
      riskScore += commonIndicators.score;
    }
    
    // Calculate final scores
    const trustScore = Math.max(0, 1 - (riskScore / 100));
    const isBot = riskScore >= 60;
    const riskLevel = this.calculateRiskLevel(riskScore);
    
    if (isBot) {
      logger.warn(`Bot detected during registration`, {
        email: data.email,
        username: data.username,
        riskScore,
        reasons
      });
    }
    
    return {
      isBot,
      trustScore,
      reasons,
      riskLevel
    };
  }
  
  async analyzeLogin(data: LoginData): Promise<BotAnalysisResult> {
    const reasons: string[] = [];
    let riskScore = 0;
    
    // Check device fingerprint
    if (!data.deviceFingerprint) {
      reasons.push('Missing device fingerprint');
      riskScore += 20;
    } else {
      const fingerprintRisk = this.analyzeDeviceFingerprint(data.deviceFingerprint);
      if (fingerprintRisk.isRisky) {
        reasons.push(...fingerprintRisk.reasons);
        riskScore += fingerprintRisk.score;
      }
    }
    
    // Check recaptcha for suspicious logins
    if (!data.recaptchaToken) {
      reasons.push('Missing CAPTCHA for suspicious login');
      riskScore += 15;
    }
    
    // Check login patterns
    const loginPatterns = this.checkLoginPatterns(data.email);
    if (loginPatterns.isRisky) {
      reasons.push(...loginPatterns.reasons);
      riskScore += loginPatterns.score;
    }
    
    // Check for automated behavior
    const automationCheck = this.checkForAutomation(data);
    if (automationCheck.isRisky) {
      reasons.push(...automationCheck.reasons);
      riskScore += automationCheck.score;
    }
    
    const trustScore = Math.max(0, 1 - (riskScore / 100));
    const isBot = riskScore >= 50;
    const riskLevel = this.calculateRiskLevel(riskScore);
    
    if (riskScore > 30) {
      logger.info(`Suspicious login attempt`, {
        email: data.email,
        riskScore,
        reasons
      });
    }
    
    return {
      isBot,
      trustScore,
      reasons,
      riskLevel
    };
  }
  
  private checkEmailPatterns(email: string): { isRisky: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    for (const pattern of this.suspiciousPatterns.emails) {
      if (pattern.test(email)) {
        reasons.push('Suspicious email pattern detected');
        score += 25;
        break;
      }
    }
    
    // Check for disposable email domains
    const domain = email.split('@')[1];
    if (this.isDisposableEmailDomain(domain)) {
      reasons.push('Disposable email address');
      score += 40;
    }
    
    // Check for unusual characters
    if (/[^a-zA-Z0-9@._+-]/.test(email)) {
      reasons.push('Unusual characters in email');
      score += 15;
    }
    
    return { isRisky: score > 0, score, reasons };
  }
  
  private checkUsernamePatterns(username: string): { isRisky: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    for (const pattern of this.suspiciousPatterns.usernames) {
      if (pattern.test(username)) {
        reasons.push('Suspicious username pattern');
        score += 20;
        break;
      }
    }
    
    // Check username entropy
    const entropy = this.calculateEntropy(username);
    if (entropy < 2) {
      reasons.push('Low username entropy');
      score += 15;
    }
    
    // Check for keyboard walks
    if (this.isKeyboardWalk(username)) {
      reasons.push('Keyboard walk pattern detected');
      score += 25;
    }
    
    return { isRisky: score > 0, score, reasons };
  }
  
  private checkRegistrationVelocity(identifier: string): { isRisky: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    const now = new Date();
    const recentRegs = this.recentRegistrations.get(identifier) || [];
    
    // Check for rapid registrations
    const recentCount = recentRegs.filter(
      date => (now.getTime() - date.getTime()) < 3600000 // 1 hour
    ).length;
    
    if (recentCount > 2) {
      reasons.push('Rapid registration attempts');
      score += 40;
    }
    
    // Update history
    recentRegs.push(now);
    this.recentRegistrations.set(identifier, recentRegs.slice(-10));
    
    return { isRisky: score > 0, score, reasons };
  }
  
  private checkCommonBotIndicators(data: RegistrationData): { isRisky: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    // Check for sequential patterns
    if (this.hasSequentialPattern(data.username)) {
      reasons.push('Sequential pattern in username');
      score += 15;
    }
    
    // Check registration time (bots often register at odd hours)
    const hour = data.timestamp.getHours();
    if (hour >= 2 && hour <= 5) {
      reasons.push('Registration during unusual hours');
      score += 10;
    }
    
    // Check for common bot name patterns
    const commonBotNames = ['admin', 'test', 'user', 'demo', 'bot'];
    if (commonBotNames.some(name => data.username.toLowerCase().includes(name))) {
      reasons.push('Common bot name pattern');
      score += 20;
    }
    
    return { isRisky: score > 0, score, reasons };
  }
  
  private analyzeDeviceFingerprint(fingerprint: string): { isRisky: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    // Check fingerprint format
    if (fingerprint.length < 32) {
      reasons.push('Invalid device fingerprint');
      score += 30;
    }
    
    // Check for known bot fingerprints
    const knownBotFingerprints = [
      '0000000000000000',
      '1111111111111111',
      'ffffffffffffffff'
    ];
    
    if (knownBotFingerprints.some(known => fingerprint.includes(known))) {
      reasons.push('Known bot fingerprint');
      score += 50;
    }
    
    return { isRisky: score > 0, score, reasons };
  }
  
  private checkLoginPatterns(email: string): { isRisky: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    // This would normally check against a database of login patterns
    // For now, we'll implement basic checks
    
    return { isRisky: score > 0, score, reasons };
  }
  
  private checkForAutomation(data: LoginData): { isRisky: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    // Check for signs of automated behavior
    // In production, this would analyze timing patterns, mouse movements, etc.
    
    return { isRisky: score > 0, score, reasons };
  }
  
  private async verifyRecaptcha(token: string): Promise<boolean> {
    // In production, this would verify with Google reCAPTCHA
    // For now, we'll do a basic check
    return token.length > 20;
  }
  
  private isDisposableEmailDomain(domain: string): boolean {
    const disposableDomains = [
      'mailinator.com',
      'guerrillamail.com',
      'temp-mail.org',
      '10minutemail.com',
      'throwaway.email',
      'yopmail.com'
    ];
    
    return disposableDomains.includes(domain.toLowerCase());
  }
  
  private calculateEntropy(str: string): number {
    const freq: { [key: string]: number } = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }
  
  private isKeyboardWalk(str: string): boolean {
    const keyboards = [
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
      '1234567890'
    ];
    
    const lower = str.toLowerCase();
    
    for (const keyboard of keyboards) {
      for (let i = 0; i < keyboard.length - 3; i++) {
        if (lower.includes(keyboard.substring(i, i + 4))) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  private hasSequentialPattern(str: string): boolean {
    for (let i = 0; i < str.length - 2; i++) {
      const code1 = str.charCodeAt(i);
      const code2 = str.charCodeAt(i + 1);
      const code3 = str.charCodeAt(i + 2);
      
      if (code2 === code1 + 1 && code3 === code2 + 1) {
        return true;
      }
    }
    
    return false;
  }
  
  private calculateRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }
}