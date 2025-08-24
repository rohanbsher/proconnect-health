// Skill extraction service placeholder for MVP
import { logger } from '../lib/logger';

export class SkillExtractor {
  async initialize(): Promise<void> {
    logger.info('SkillExtractor initialized (placeholder for MVP)');
  }
  
  async extract(text: string, type: string): Promise<string[]> {
    // Placeholder - return mock skills for now
    const mockSkills = ['JavaScript', 'React', 'Node.js', 'TypeScript'];
    logger.debug(`Extracting skills from ${type} text`);
    return mockSkills;
  }
}