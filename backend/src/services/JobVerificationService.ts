import { PrismaClient, JobStatus, VerificationStatus } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { OpenAI } from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

const JobPostingSchema = z.object({
  title: z.string().min(3).max(100),
  company: z.string().min(2).max(100),
  companyUrl: z.string().url().optional(),
  location: z.string().optional(),
  remote: z.boolean(),
  hybrid: z.boolean().optional(),
  description: z.string().min(100).max(10000),
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  benefits: z.string().optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  salaryCurrency: z.string().default('USD'),
  experienceMin: z.number().min(0).default(0),
  experienceMax: z.number().positive().optional(),
  contactEmail: z.string().email().optional(),
  expiresAt: z.date().optional()
});

interface VerificationResult {
  isVerified: boolean;
  verificationScore: number;
  reasons: string[];
  companyData?: {
    name: string;
    website: string;
    industry?: string;
    size?: string;
    verified: boolean;
  };
  warnings: string[];
}

export class JobVerificationService {
  private prisma: PrismaClient;
  private openai: OpenAI;
  private verifiedCompanies = new Map<string, boolean>();
  
  constructor() {
    this.prisma = new PrismaClient();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  async verifyJobPosting(jobData: z.infer<typeof JobPostingSchema>, userId: string): Promise<VerificationResult> {
    try {
      const validated = JobPostingSchema.parse(jobData);
      const warnings: string[] = [];
      const reasons: string[] = [];
      let verificationScore = 0;
      
      // 1. Verify company exists
      const companyVerification = await this.verifyCompany(
        validated.company,
        validated.companyUrl
      );
      
      if (!companyVerification.exists) {
        reasons.push('Company could not be verified');
        warnings.push('Company verification failed - manual review required');
      } else {
        verificationScore += 30;
        reasons.push('Company verified');
      }
      
      // 2. Check for ghost job indicators
      const ghostJobCheck = await this.checkForGhostJob(validated);
      if (ghostJobCheck.isGhostJob) {
        warnings.push(...ghostJobCheck.indicators);
        verificationScore -= 20;
      } else {
        verificationScore += 20;
        reasons.push('No ghost job indicators found');
      }
      
      // 3. Verify recruiter/poster legitimacy
      const posterVerification = await this.verifyPoster(userId, validated.company);
      if (posterVerification.isLegitimate) {
        verificationScore += 25;
        reasons.push('Poster verified as legitimate recruiter');
      } else {
        warnings.push(...posterVerification.warnings);
        verificationScore -= 10;
      }
      
      // 4. AI content analysis
      const contentAnalysis = await this.analyzeJobContent(validated);
      if (contentAnalysis.isAuthentic) {
        verificationScore += 15;
        reasons.push('Job content appears authentic');
      } else {
        warnings.push(...contentAnalysis.issues);
        verificationScore -= 15;
      }
      
      // 5. Check against known scam patterns
      const scamCheck = this.checkScamPatterns(validated);
      if (scamCheck.hasScamIndicators) {
        warnings.push(...scamCheck.indicators);
        verificationScore -= 30;
      } else {
        verificationScore += 10;
        reasons.push('No scam indicators detected');
      }
      
      // 6. Verify salary range
      const salaryCheck = this.verifySalaryRange(validated);
      if (!salaryCheck.isRealistic) {
        warnings.push(...salaryCheck.issues);
        verificationScore -= 10;
      }
      
      // Calculate final verification status
      const isVerified = verificationScore >= 60 && warnings.length < 3;
      
      // Store verification result
      await this.storeVerificationResult(jobData, userId, {
        isVerified,
        verificationScore,
        reasons,
        warnings
      });
      
      logger.info(`Job posting verification completed`, {
        company: validated.company,
        title: validated.title,
        isVerified,
        score: verificationScore
      });
      
      return {
        isVerified,
        verificationScore: Math.max(0, Math.min(100, verificationScore)),
        reasons,
        companyData: companyVerification.data,
        warnings
      };
    } catch (error) {
      logger.error('Job verification error:', error);
      throw error;
    }
  }
  
  private async verifyCompany(companyName: string, companyUrl?: string): Promise<{
    exists: boolean;
    data?: any;
  }> {
    try {
      // Check cache first
      if (this.verifiedCompanies.has(companyName)) {
        return { exists: this.verifiedCompanies.get(companyName)! };
      }
      
      // If URL provided, verify it
      if (companyUrl) {
        const urlValid = await this.verifyCompanyWebsite(companyUrl, companyName);
        if (urlValid) {
          this.verifiedCompanies.set(companyName, true);
          return {
            exists: true,
            data: {
              name: companyName,
              website: companyUrl,
              verified: true
            }
          };
        }
      }
      
      // Check against known companies database
      // In production, this would query a comprehensive company database
      const knownCompanies = await this.checkKnownCompanies(companyName);
      if (knownCompanies) {
        this.verifiedCompanies.set(companyName, true);
        return { exists: true, data: knownCompanies };
      }
      
      // Use AI to verify if company seems legitimate
      const aiVerification = await this.aiCompanyVerification(companyName);
      
      this.verifiedCompanies.set(companyName, aiVerification.exists);
      return aiVerification;
    } catch (error) {
      logger.error('Company verification error:', error);
      return { exists: false };
    }
  }
  
  private async verifyCompanyWebsite(url: string, companyName: string): Promise<boolean> {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'ProConnect-AI-Verification-Bot/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      const pageTitle = $('title').text().toLowerCase();
      const metaDescription = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
      
      const companyNameLower = companyName.toLowerCase();
      
      // Check if company name appears in title or meta description
      return pageTitle.includes(companyNameLower) || 
             metaDescription.includes(companyNameLower);
    } catch (error) {
      logger.warn(`Failed to verify company website: ${url}`);
      return false;
    }
  }
  
  private async checkKnownCompanies(companyName: string): Promise<any> {
    // In production, this would query a database of verified companies
    // For now, we'll check against a list of Fortune 500 companies
    const majorCompanies = [
      'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix',
      'Tesla', 'IBM', 'Oracle', 'Salesforce', 'Adobe', 'Intel'
    ];
    
    const normalizedName = companyName.toLowerCase();
    const isKnown = majorCompanies.some(
      company => normalizedName.includes(company.toLowerCase())
    );
    
    if (isKnown) {
      return {
        name: companyName,
        verified: true,
        industry: 'Technology'
      };
    }
    
    return null;
  }
  
  private async aiCompanyVerification(companyName: string): Promise<{ exists: boolean; data?: any }> {
    try {
      const prompt = `
        Is "${companyName}" a legitimate company? Consider:
        1. Is this a known company name?
        2. Does it sound like a real company?
        3. Are there any obvious red flags?
        
        Respond with JSON: { "legitimate": true/false, "confidence": 0-1, "reason": "brief explanation" }
      `;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 100
      });
      
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        exists: result.legitimate && result.confidence > 0.7,
        data: result.legitimate ? { name: companyName, verified: false } : undefined
      };
    } catch (error) {
      logger.error('AI company verification error:', error);
      return { exists: false };
    }
  }
  
  private async checkForGhostJob(job: any): Promise<{
    isGhostJob: boolean;
    indicators: string[];
  }> {
    const indicators: string[] = [];
    
    // Check for vague requirements
    if (!job.requirements || job.requirements.length < 50) {
      indicators.push('Vague or missing job requirements');
    }
    
    // Check for unrealistic combinations
    if (job.experienceMin === 0 && job.salaryMax && job.salaryMax > 200000) {
      indicators.push('Unrealistic salary for entry-level position');
    }
    
    // Check for generic descriptions
    const genericPhrases = [
      'rockstar', 'ninja', 'guru', 'wizard',
      'competitive salary', 'great benefits',
      'fast-paced environment', 'wear many hats'
    ];
    
    const descLower = job.description.toLowerCase();
    const genericCount = genericPhrases.filter(phrase => descLower.includes(phrase)).length;
    
    if (genericCount >= 3) {
      indicators.push('Excessive use of generic phrases');
    }
    
    // Check for missing contact information
    if (!job.contactEmail && !job.companyUrl) {
      indicators.push('No contact information provided');
    }
    
    // Check for perpetual job postings
    if (job.expiresAt) {
      const daysUntilExpiry = Math.floor(
        (job.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilExpiry > 90) {
        indicators.push('Unusually long posting duration');
      }
    }
    
    return {
      isGhostJob: indicators.length >= 2,
      indicators
    };
  }
  
  private async verifyPoster(userId: string, companyName: string): Promise<{
    isLegitimate: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          jobPostings: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      
      if (!user) {
        warnings.push('User not found');
        return { isLegitimate: false, warnings };
      }
      
      // Check if user is verified
      if (user.verificationStatus !== 'VERIFIED') {
        warnings.push('Poster email not verified');
      }
      
      // Check trust score
      if (user.trustScore < 0.5) {
        warnings.push('Low poster trust score');
      }
      
      // Check if recruiter/employer role
      if (user.role === 'JOB_SEEKER') {
        warnings.push('Job posted by non-recruiter account');
      }
      
      // Check posting patterns
      if (user.jobPostings.length > 5) {
        const uniqueCompanies = new Set(
          user.jobPostings.map(job => job.company)
        ).size;
        
        if (uniqueCompanies > 3) {
          warnings.push('User posting for multiple unrelated companies');
        }
      }
      
      // Check if company email matches
      if (user.email && companyName) {
        const emailDomain = user.email.split('@')[1];
        const companyDomain = companyName.toLowerCase().replace(/\s+/g, '');
        
        if (!emailDomain.includes(companyDomain) && 
            !['gmail.com', 'outlook.com'].includes(emailDomain)) {
          warnings.push('Email domain does not match company');
        }
      }
      
      return {
        isLegitimate: warnings.length < 2,
        warnings
      };
    } catch (error) {
      logger.error('Poster verification error:', error);
      warnings.push('Error verifying poster');
      return { isLegitimate: false, warnings };
    }
  }
  
  private async analyzeJobContent(job: any): Promise<{
    isAuthentic: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      const prompt = `
        Analyze this job posting for authenticity:
        Title: ${job.title}
        Company: ${job.company}
        Description: ${job.description.substring(0, 500)}
        
        Check for:
        1. AI-generated or template content
        2. Inconsistencies
        3. Professionalism
        4. Specific vs generic language
        
        Respond with JSON: { "authentic": true/false, "issues": ["issue1", "issue2"], "score": 0-100 }
      `;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150
      });
      
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (!result.authentic) {
        issues.push(...(result.issues || ['Content appears inauthentic']));
      }
      
      return {
        isAuthentic: result.authentic && result.score > 70,
        issues
      };
    } catch (error) {
      logger.error('Content analysis error:', error);
      return { isAuthentic: true, issues: [] };
    }
  }
  
  private checkScamPatterns(job: any): {
    hasScamIndicators: boolean;
    indicators: string[];
  } {
    const indicators: string[] = [];
    const description = job.description.toLowerCase();
    
    // Check for common scam patterns
    const scamPhrases = [
      'no experience necessary',
      'make money from home',
      'unlimited earning potential',
      'be your own boss',
      'work from anywhere',
      'passive income',
      'get rich',
      'mlm', 'multi-level marketing',
      'upfront payment',
      'processing fee',
      'training fee'
    ];
    
    for (const phrase of scamPhrases) {
      if (description.includes(phrase)) {
        indicators.push(`Scam phrase detected: "${phrase}"`);
      }
    }
    
    // Check for suspicious salary claims
    if (job.salaryMin && job.experienceMin === 0 && job.salaryMin > 100000) {
      indicators.push('Unrealistic salary for entry-level position');
    }
    
    // Check for missing company information
    if (!job.company || job.company.length < 3) {
      indicators.push('Missing or invalid company name');
    }
    
    // Check for personal email addresses
    if (job.contactEmail) {
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      const emailDomain = job.contactEmail.split('@')[1];
      
      if (personalDomains.includes(emailDomain)) {
        indicators.push('Personal email address used for business');
      }
    }
    
    return {
      hasScamIndicators: indicators.length > 0,
      indicators
    };
  }
  
  private verifySalaryRange(job: any): {
    isRealistic: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    if (job.salaryMin && job.salaryMax) {
      // Check if range is reasonable
      if (job.salaryMax < job.salaryMin) {
        issues.push('Maximum salary less than minimum');
      }
      
      if (job.salaryMax > job.salaryMin * 3) {
        issues.push('Salary range too wide');
      }
      
      // Check against market rates (simplified)
      const marketRates: { [key: string]: { min: number; max: number } } = {
        'entry': { min: 40000, max: 80000 },
        'mid': { min: 70000, max: 130000 },
        'senior': { min: 120000, max: 250000 }
      };
      
      const level = job.experienceMin < 2 ? 'entry' : 
                   job.experienceMin < 5 ? 'mid' : 'senior';
      
      const market = marketRates[level];
      
      if (job.salaryMin < market.min * 0.5) {
        issues.push('Salary significantly below market rate');
      }
      
      if (job.salaryMax > market.max * 2) {
        issues.push('Salary significantly above market rate');
      }
    }
    
    return {
      isRealistic: issues.length === 0,
      issues
    };
  }
  
  private async storeVerificationResult(
    jobData: any,
    userId: string,
    result: VerificationResult
  ) {
    try {
      // Store verification metadata
      await this.prisma.activity.create({
        data: {
          userId,
          type: 'JOB_VERIFICATION',
          description: `Job verification: ${jobData.title} at ${jobData.company}`,
          metadata: {
            jobTitle: jobData.title,
            company: jobData.company,
            verificationScore: result.verificationScore,
            isVerified: result.isVerified,
            warnings: result.warnings
          }
        }
      });
    } catch (error) {
      logger.error('Failed to store verification result:', error);
    }
  }
}