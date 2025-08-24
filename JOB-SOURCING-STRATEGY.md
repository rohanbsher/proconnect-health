# ProConnect Health - Job Sourcing Strategy

## Executive Summary
We need to source 350,000+ nursing jobs to solve the healthcare staffing crisis. This document outlines our 5-method approach to acquire verified healthcare job postings at scale.

## Current System Status ✅

### What's Working
- **Frontend**: Live at http://localhost:3007
  - Healthcare-focused UI with nursing filters
  - Real-time search and filtering
  - Mobile-responsive design
  - "For Hospitals" portal link

- **Backend**: Live at http://localhost:5001
  - `/api/health` - System health check
  - `/api/jobs` - Returns 8 verified nursing jobs
  - `/api/stats` - Platform statistics
  - `/api/hospitals/register` - NEW hospital onboarding
  - `/api/hospitals/:id/jobs/import` - NEW bulk job import

- **Hospital Portal**: Live at http://localhost:3007/hospitals
  - 3-step onboarding form
  - Captures facility details
  - Identifies urgent needs
  - Automatic verification queue

## Job Sourcing Methods - Detailed Implementation

### Method 1: Direct Hospital Partnerships (PRIMARY - 60% of jobs)

**Current Implementation:**
- ✅ Hospital onboarding portal built
- ✅ Registration API endpoint ready
- ✅ Multi-step form with validation

**Next Steps:**
1. **Week 1: Outreach Campaign**
   ```
   Target List:
   - Cedar Sinai Medical Center (886 beds)
   - UCLA Medical Center (757 beds)
   - Stanford Health Care (613 beds)
   - UCSF Medical Center (796 beds)
   - Kaiser Permanente (35 hospitals in CA)
   ```

2. **Week 2: Pilot Program**
   - Offer first 3 months free
   - Dedicated success manager
   - White-glove onboarding
   - Custom API integration if needed

3. **Technical Integration:**
   ```javascript
   // Hospital can POST jobs directly
   POST /api/hospitals/{hospitalId}/jobs
   {
     "title": "ICU Nurse",
     "department": "Critical Care",
     "urgentNeed": true,
     "salary": "$95,000-$120,000",
     "requirements": ["CA RN License", "CCRN"]
   }
   ```

**Revenue Model:**
- $500-1,000 per successful hire
- Volume discounts for 20+ hires/month
- Enterprise contracts for health systems

### Method 2: ATS Integration (25% of jobs)

**Target Platforms:**
1. **Workday Healthcare**
   - Used by 200+ hospitals
   - API available with partnership
   
2. **iCIMS Healthcare**
   - 500+ healthcare clients
   - REST API available

3. **Greenhouse Healthcare**
   - Modern API
   - Webhook support

**Implementation Plan:**
```javascript
// ATS Sync Service
class ATSConnector {
  async syncJobs(atsType, credentials) {
    switch(atsType) {
      case 'workday':
        return this.syncWorkday(credentials);
      case 'icims':
        return this.syncICIMS(credentials);
      case 'greenhouse':
        return this.syncGreenhouse(credentials);
    }
  }
  
  async syncWorkday(credentials) {
    // OAuth2 authentication
    // Fetch jobs via REST API
    // Transform to our schema
    // Verify hospital
    // Import to database
  }
}
```

**Technical Requirements:**
- OAuth2 implementation
- Webhook listeners
- Data transformation pipeline
- Duplicate detection
- Rate limiting

### Method 3: Healthcare Job Aggregators (10% of jobs)

**Partnership Targets:**
1. **Health eCareers**
   - 500,000+ healthcare jobs
   - API partnership available

2. **HospitalCareers.com**
   - Direct hospital postings
   - RSS feeds available

3. **NurseRecruiter.com**
   - Nursing-specific
   - Data sharing agreement possible

**Integration Approach:**
```javascript
// Aggregator sync
const aggregatorSync = async () => {
  const partners = [
    { name: 'HealtheCareers', endpoint: 'https://api.healthe...' },
    { name: 'HospitalCareers', type: 'rss', feed: 'https://...' }
  ];
  
  for (const partner of partners) {
    const jobs = await fetchPartnerJobs(partner);
    const verified = await verifyJobs(jobs);
    await importJobs(verified);
  }
};
```

### Method 4: State Nursing Board Partnerships (3% of jobs)

**Priority States:**
1. California Board of Registered Nursing
2. Texas Board of Nursing
3. Florida Board of Nursing
4. New York State Board of Nursing

**Benefits:**
- Official verification
- License validation
- Regulatory compliance
- Trust signal for nurses

**Implementation:**
- Contact state boards for partnership
- Offer free job posting service
- Integrate license verification API
- Co-marketing opportunities

### Method 5: Ethical Web Scraping (2% of jobs - Last Resort)

**Legal Compliance:**
```javascript
// Ethical scraping service
class EthicalScraper {
  constructor() {
    this.respectRobotsTxt = true;
    this.rateLimit = 1; // request per second
    this.userAgent = 'ProConnectHealth-Bot (healthcare-jobs@proconnect.health)';
  }
  
  async scrapeHospitalCareers(hospitalUrl) {
    // Check robots.txt
    if (!await this.canScrape(hospitalUrl)) return [];
    
    // Add delay
    await this.delay(1000);
    
    // Scrape with Puppeteer
    const jobs = await this.extractJobs(hospitalUrl);
    
    // Manual verification required
    return { jobs, requiresVerification: true };
  }
}
```

**Target Sites:**
- Public hospital career pages only
- With explicit permission
- Following all legal guidelines

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- [x] Build hospital portal
- [x] Create registration API
- [x] Set up job import endpoints
- [ ] Create hospital admin dashboard
- [ ] Build verification workflow

### Phase 2: Direct Partnerships (Weeks 3-4)
- [ ] Contact top 10 California hospitals
- [ ] Onboard first 3 pilot hospitals
- [ ] Import first 100 verified jobs
- [ ] Test end-to-end hiring flow

### Phase 3: Scale Infrastructure (Weeks 5-6)
- [ ] Build ATS connectors
- [ ] Set up data pipeline
- [ ] Implement deduplication
- [ ] Create monitoring dashboard

### Phase 4: Rapid Expansion (Weeks 7-12)
- [ ] 50 hospital partnerships
- [ ] 3 ATS integrations live
- [ ] 5,000+ verified jobs
- [ ] Expand to 3 states

## Key Metrics

### Success Indicators
- **Week 4**: 100 verified jobs
- **Week 8**: 1,000 verified jobs
- **Week 12**: 5,000 verified jobs
- **Month 6**: 25,000 verified jobs

### Quality Metrics
- 100% verification rate
- <1% duplicate rate
- <24hr posting lag
- 90% fill rate

## Database Schema for Job Sourcing

```sql
-- Job sources tracking
CREATE TABLE job_sources (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(50), -- 'direct', 'ats', 'aggregator', 'board', 'scrape'
  source_name VARCHAR(255),
  hospital_id INTEGER,
  api_endpoint VARCHAR(500),
  credentials JSONB,
  last_sync TIMESTAMP,
  jobs_imported INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true
);

-- Import logs
CREATE TABLE import_logs (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES job_sources(id),
  import_date TIMESTAMP DEFAULT NOW(),
  jobs_fetched INTEGER,
  jobs_imported INTEGER,
  jobs_updated INTEGER,
  jobs_rejected INTEGER,
  error_log TEXT
);

-- Verification queue
CREATE TABLE verification_queue (
  id SERIAL PRIMARY KEY,
  job_id INTEGER,
  source_id INTEGER,
  verification_status VARCHAR(50), -- 'pending', 'verified', 'rejected'
  verified_by VARCHAR(255),
  verified_at TIMESTAMP,
  rejection_reason TEXT
);
```

## API Endpoints for Job Management

```javascript
// Hospital job management
POST   /api/hospitals/register          // Onboard new hospital
POST   /api/hospitals/:id/jobs          // Post single job
POST   /api/hospitals/:id/jobs/bulk     // Bulk import jobs
GET    /api/hospitals/:id/jobs          // List hospital's jobs
PUT    /api/hospitals/:id/jobs/:jobId   // Update job
DELETE /api/hospitals/:id/jobs/:jobId   // Remove job

// Admin endpoints
GET    /api/admin/sources               // List all job sources
POST   /api/admin/sources/sync          // Trigger manual sync
GET    /api/admin/verification-queue    // Jobs pending verification
POST   /api/admin/verify/:jobId         // Manually verify job
GET    /api/admin/import-logs           // View import history
```

## Competitive Advantages

1. **Direct Hospital Relationships**
   - No middleman fees
   - Real-time job updates
   - Exclusive postings

2. **100% Verification**
   - Every job manually verified
   - Direct hospital partnerships
   - No ghost jobs guarantee

3. **Speed to Market**
   - 24-hour onboarding
   - Instant job posting
   - Real-time updates

4. **Cost Efficiency**
   - $750 vs $4,700 industry average
   - No pay-per-click waste
   - Performance-based pricing

## Next Immediate Actions

1. **Test Hospital Portal**
   - Open http://localhost:3007/hospitals
   - Complete registration flow
   - Verify API receives data

2. **Create First Partnership**
   - Call Cedar Sinai HR department
   - Offer pilot program
   - Schedule demo

3. **Build Import Pipeline**
   - Create job validation service
   - Set up deduplication logic
   - Build monitoring dashboard

## Conclusion

Our multi-channel job sourcing strategy will help us rapidly scale to 25,000+ verified healthcare jobs within 6 months. The combination of direct partnerships (primary), ATS integrations (scale), and aggregator partnerships (coverage) ensures comprehensive market coverage while maintaining our 100% verification promise.

**The system is ready. Time to execute.**