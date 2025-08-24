import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { JobMatchingEngine } from './services/JobMatchingEngine';
import { SkillExtractor } from './services/SkillExtractor';
import { ProfileAnalyzer } from './services/ProfileAnalyzer';
import { ConnectionRecommender } from './services/ConnectionRecommender';
import { ContentModerator } from './services/ContentModerator';
import { initializeVectorStore } from './lib/vectorStore';
import { initializeQueues } from './lib/queues';
import { logger } from './lib/logger';

const app = express();
const server = createServer(app);
const PORT = process.env.AI_ENGINE_PORT || 5001;

app.use(cors());
app.use(express.json());

let jobMatchingEngine: JobMatchingEngine;
let skillExtractor: SkillExtractor;
let profileAnalyzer: ProfileAnalyzer;
let connectionRecommender: ConnectionRecommender;
let contentModerator: ContentModerator;

async function initializeServices() {
  try {
    logger.info('Initializing AI Engine services...');
    
    await initializeVectorStore();
    await initializeQueues();
    
    jobMatchingEngine = new JobMatchingEngine();
    skillExtractor = new SkillExtractor();
    profileAnalyzer = new ProfileAnalyzer();
    connectionRecommender = new ConnectionRecommender();
    contentModerator = new ContentModerator();
    
    await Promise.all([
      jobMatchingEngine.initialize(),
      skillExtractor.initialize(),
      profileAnalyzer.initialize(),
      connectionRecommender.initialize(),
      contentModerator.initialize()
    ]);
    
    logger.info('AI Engine services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize AI services:', error);
    process.exit(1);
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/match-jobs', async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    const matches = await jobMatchingEngine.findMatches(userId, preferences);
    res.json({ success: true, matches });
  } catch (error) {
    logger.error('Job matching error:', error);
    res.status(500).json({ success: false, error: 'Failed to match jobs' });
  }
});

app.post('/extract-skills', async (req, res) => {
  try {
    const { text, type } = req.body;
    const skills = await skillExtractor.extract(text, type);
    res.json({ success: true, skills });
  } catch (error) {
    logger.error('Skill extraction error:', error);
    res.status(500).json({ success: false, error: 'Failed to extract skills' });
  }
});

app.post('/analyze-profile', async (req, res) => {
  try {
    const { profileData } = req.body;
    const analysis = await profileAnalyzer.analyze(profileData);
    res.json({ success: true, analysis });
  } catch (error) {
    logger.error('Profile analysis error:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze profile' });
  }
});

app.post('/recommend-connections', async (req, res) => {
  try {
    const { userId, limit = 10 } = req.body;
    const recommendations = await connectionRecommender.recommend(userId, limit);
    res.json({ success: true, recommendations });
  } catch (error) {
    logger.error('Connection recommendation error:', error);
    res.status(500).json({ success: false, error: 'Failed to recommend connections' });
  }
});

app.post('/moderate-content', async (req, res) => {
  try {
    const { content, type } = req.body;
    const result = await contentModerator.moderate(content, type);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Content moderation error:', error);
    res.status(500).json({ success: false, error: 'Failed to moderate content' });
  }
});

app.post('/calculate-match-score', async (req, res) => {
  try {
    const { candidateProfile, jobRequirements } = req.body;
    const score = await jobMatchingEngine.calculateMatchScore(candidateProfile, jobRequirements);
    res.json({ success: true, score });
  } catch (error) {
    logger.error('Match score calculation error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate match score' });
  }
});

async function start() {
  await initializeServices();
  
  server.listen(PORT, () => {
    logger.info(`AI Engine running on port ${PORT}`);
  });
}

start().catch(error => {
  logger.error('Failed to start AI Engine:', error);
  process.exit(1);
});