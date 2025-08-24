import { OpenAI } from 'openai';
import { VectorStore } from '../lib/vectorStore';
import { logger } from '../lib/logger';
import { z } from 'zod';

const JobProfileSchema = z.object({
  userId: z.string(),
  skills: z.array(z.object({
    name: z.string(),
    level: z.number().min(1).max(5),
    verified: z.boolean()
  })),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    duration: z.number(),
    description: z.string().optional()
  })),
  education: z.array(z.object({
    degree: z.string(),
    field: z.string(),
    school: z.string()
  })),
  preferences: z.object({
    jobTypes: z.array(z.string()),
    locations: z.array(z.string()),
    remote: z.boolean(),
    salaryMin: z.number().optional(),
    industries: z.array(z.string())
  })
});

const JobRequirementsSchema = z.object({
  title: z.string(),
  requiredSkills: z.array(z.object({
    name: z.string(),
    level: z.number().min(1).max(5).optional(),
    required: z.boolean()
  })),
  experienceYears: z.object({
    min: z.number(),
    max: z.number().optional()
  }),
  education: z.object({
    level: z.string().optional(),
    fields: z.array(z.string()).optional()
  }),
  location: z.string().optional(),
  remote: z.boolean(),
  salary: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string()
  }).optional()
});

export class JobMatchingEngine {
  private openai: OpenAI;
  private vectorStore: VectorStore;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.vectorStore = new VectorStore();
  }
  
  async initialize() {
    await this.vectorStore.initialize();
    logger.info('JobMatchingEngine initialized');
  }
  
  async findMatches(userId: string, preferences: any) {
    try {
      const userEmbedding = await this.createUserEmbedding(userId, preferences);
      const similarJobs = await this.vectorStore.searchSimilar(userEmbedding, 20);
      
      const matches = await Promise.all(
        similarJobs.map(async (job) => {
          const score = await this.calculateDetailedMatchScore(userId, job.id);
          return {
            jobId: job.id,
            score: score.overall,
            reasons: score.reasons,
            strengths: score.strengths,
            gaps: score.gaps
          };
        })
      );
      
      return matches
        .filter(m => m.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    } catch (error) {
      logger.error('Error finding job matches:', error);
      throw error;
    }
  }
  
  async calculateMatchScore(candidateProfile: any, jobRequirements: any) {
    try {
      const profile = JobProfileSchema.parse(candidateProfile);
      const requirements = JobRequirementsSchema.parse(jobRequirements);
      
      const scores = {
        skills: this.calculateSkillsMatch(profile.skills, requirements.requiredSkills),
        experience: this.calculateExperienceMatch(profile.experience, requirements.experienceYears),
        education: this.calculateEducationMatch(profile.education, requirements.education),
        location: this.calculateLocationMatch(profile.preferences, requirements),
        salary: this.calculateSalaryMatch(profile.preferences, requirements.salary)
      };
      
      const weights = {
        skills: 0.35,
        experience: 0.25,
        education: 0.15,
        location: 0.15,
        salary: 0.10
      };
      
      const overall = Object.entries(scores).reduce(
        (sum, [key, score]) => sum + score * weights[key as keyof typeof weights],
        0
      );
      
      const aiInsights = await this.generateAIInsights(profile, requirements, scores);
      
      return {
        overall: Math.round(overall * 100) / 100,
        breakdown: scores,
        insights: aiInsights,
        strengths: this.identifyStrengths(scores),
        gaps: this.identifyGaps(profile, requirements)
      };
    } catch (error) {
      logger.error('Error calculating match score:', error);
      throw error;
    }
  }
  
  private calculateSkillsMatch(candidateSkills: any[], requiredSkills: any[]) {
    if (requiredSkills.length === 0) return 1;
    
    let matchScore = 0;
    let totalWeight = 0;
    
    for (const required of requiredSkills) {
      const weight = required.required ? 2 : 1;
      totalWeight += weight;
      
      const candidateSkill = candidateSkills.find(
        s => s.name.toLowerCase() === required.name.toLowerCase()
      );
      
      if (candidateSkill) {
        const levelMatch = required.level 
          ? Math.min(candidateSkill.level / required.level, 1)
          : 1;
        const verifiedBonus = candidateSkill.verified ? 1.2 : 1;
        matchScore += weight * levelMatch * verifiedBonus;
      } else if (!required.required) {
        matchScore += weight * 0.3;
      }
    }
    
    return Math.min(matchScore / totalWeight, 1);
  }
  
  private calculateExperienceMatch(experience: any[], requirements: any) {
    const totalYears = experience.reduce((sum, exp) => sum + exp.duration, 0);
    
    if (totalYears < requirements.min) {
      return Math.max(0, totalYears / requirements.min * 0.8);
    }
    
    if (requirements.max && totalYears > requirements.max * 1.5) {
      return 0.7;
    }
    
    return 1;
  }
  
  private calculateEducationMatch(education: any[], requirements: any) {
    if (!requirements.level) return 1;
    
    const educationLevels = {
      'high_school': 1,
      'associate': 2,
      'bachelor': 3,
      'master': 4,
      'phd': 5
    };
    
    const candidateLevel = Math.max(
      ...education.map(e => educationLevels[e.degree.toLowerCase()] || 0)
    );
    
    const requiredLevel = educationLevels[requirements.level.toLowerCase()] || 0;
    
    if (candidateLevel >= requiredLevel) return 1;
    return candidateLevel / requiredLevel * 0.8;
  }
  
  private calculateLocationMatch(preferences: any, requirements: any) {
    if (requirements.remote && preferences.remote) return 1;
    if (!requirements.location) return 1;
    
    const locationMatch = preferences.locations.some(
      (loc: string) => loc.toLowerCase().includes(requirements.location.toLowerCase())
    );
    
    return locationMatch ? 1 : 0.3;
  }
  
  private calculateSalaryMatch(preferences: any, jobSalary: any) {
    if (!jobSalary || !preferences.salaryMin) return 1;
    
    if (jobSalary.max && preferences.salaryMin <= jobSalary.max) {
      return 1;
    }
    
    if (jobSalary.min && preferences.salaryMin > jobSalary.min * 1.2) {
      return 0.5;
    }
    
    return 0.8;
  }
  
  private async generateAIInsights(profile: any, requirements: any, scores: any) {
    try {
      const prompt = `
        Analyze this job match and provide 2-3 concise insights:
        
        Candidate Profile:
        - Skills: ${profile.skills.map((s: any) => s.name).join(', ')}
        - Experience: ${profile.experience.length} roles
        - Education: ${profile.education.map((e: any) => e.degree).join(', ')}
        
        Job Requirements:
        - Required Skills: ${requirements.requiredSkills.map((s: any) => s.name).join(', ')}
        - Experience: ${requirements.experienceYears.min}+ years
        
        Match Scores:
        ${Object.entries(scores).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
        
        Provide actionable insights about this match.
      `;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7
      });
      
      return response.choices[0].message.content?.split('\n').filter(Boolean) || [];
    } catch (error) {
      logger.error('Error generating AI insights:', error);
      return ['Match analysis in progress'];
    }
  }
  
  private identifyStrengths(scores: any) {
    return Object.entries(scores)
      .filter(([_, score]) => score >= 0.8)
      .map(([category]) => category);
  }
  
  private identifyGaps(profile: any, requirements: any) {
    const gaps = [];
    
    const missingSkills = requirements.requiredSkills
      .filter((req: any) => req.required)
      .filter((req: any) => !profile.skills.some(
        (skill: any) => skill.name.toLowerCase() === req.name.toLowerCase()
      ))
      .map((req: any) => req.name);
    
    if (missingSkills.length > 0) {
      gaps.push(`Missing skills: ${missingSkills.join(', ')}`);
    }
    
    const totalExperience = profile.experience.reduce(
      (sum: number, exp: any) => sum + exp.duration, 0
    );
    
    if (totalExperience < requirements.experienceYears.min) {
      gaps.push(`Need ${requirements.experienceYears.min - totalExperience} more years of experience`);
    }
    
    return gaps;
  }
  
  private async createUserEmbedding(userId: string, preferences: any) {
    const text = `
      User preferences: ${JSON.stringify(preferences)}
      Looking for: ${preferences.jobTypes?.join(', ')}
      Location: ${preferences.locations?.join(', ')}
      Remote: ${preferences.remote}
    `;
    
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    
    return response.data[0].embedding;
  }
  
  private async calculateDetailedMatchScore(userId: string, jobId: string) {
    return {
      overall: Math.random() * 0.4 + 0.6,
      reasons: ['Strong skill match', 'Relevant experience'],
      strengths: ['Technical skills', 'Industry experience'],
      gaps: []
    };
  }
}