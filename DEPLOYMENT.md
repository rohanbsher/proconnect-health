# ProConnect Health - Production Deployment

## Steve Jobs Philosophy
"Real artists ship." - We're shipping TODAY.

## Current Status ✅
- Backend with SQLite database working
- Frontend with instant nurse/hospital signup
- Real matching algorithm functional
- End-to-end flow tested locally

## Backend Deployment (Railway)

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Deploy Backend
```bash
cd backend
railway login
railway init
# Choose "Empty Service"
railway up
```

### Step 3: Set Environment Variables in Railway Dashboard
```env
NODE_ENV=production
DATABASE_URL=/data/proconnect.db
FRONTEND_URL=https://proconnect-health.vercel.app
PORT=5001
```

### Step 4: Get Your API URL
```bash
railway domain
# Save this URL for frontend configuration
```

## Frontend Deployment (Vercel)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy Frontend
```bash
cd frontend
vercel
# Follow prompts, accept defaults
```

### Step 3: Set Environment Variable in Vercel Dashboard
```env
NEXT_PUBLIC_API_URL=https://your-railway-api.railway.app
```

### Step 4: Redeploy with Production Build
```bash
vercel --prod
```

## Post-Deployment Testing

### Test These Immediately:
1. **Health Check**: `https://your-api.railway.app/api/health`
2. **Nurse Registration**: Sign up as a nurse
3. **Hospital Registration**: Post a hospital need
4. **Matching**: Verify matches appear
5. **Stats**: Check `https://your-api.railway.app/api/stats`

## The Stanford Hospital Launch Plan

### Monday Morning (7am)
1. **Print Materials**:
   - QR codes linking to: https://proconnect-health.vercel.app/nurses
   - Simple flyer: "Get hired in 48 hours. Scan to sign up."

2. **Stanford Hospital Parking Lot**:
   - Station at shift change (7am)
   - Approach nurses directly
   - "30 seconds to sign up, 48 hours to get hired"
   - Target: 10 ICU nurses

### Monday Afternoon (2pm)
1. **Email Mary Haddad** (Stanford CNO):
```
Subject: I have 10 ICU nurses ready to interview

Mary,

I noticed Stanford has 12 open ICU positions that have been 
unfilled for 60+ days.

I have 10 verified ICU nurses ready to interview. 
They're local and can start immediately.

First hire is free. No fees unless they stay 90 days.

Can I send you their profiles today?

Best,
[Your name]
P.S. This takes 5 minutes of your time, not 5 months.
```

### Tuesday - Follow Up
1. Call Stanford HR directly
2. Send nurse profiles via platform
3. Coordinate interviews

### Friday - Close First Hire
1. Track interview progress
2. Document success
3. Get testimonial

## Emergency Procedures

### If Site Goes Down:
```bash
# Check Railway status
railway logs

# Restart service
railway restart

# Check Vercel
vercel logs
```

### Database Backup:
```bash
# Download database from Railway
railway run cp proconnect.db backup.db
railway run sqlite3 backup.db ".dump" > backup.sql
```

## Critical URLs

### Production:
- Frontend: `https://proconnect-health.vercel.app`
- Backend API: `https://proconnect-api.railway.app`
- Health Check: `https://proconnect-api.railway.app/api/health`
- Stats: `https://proconnect-api.railway.app/api/stats`

### Landing Pages:
- For Nurses: `https://proconnect-health.vercel.app/nurses`
- For Hospitals: `https://proconnect-health.vercel.app/hospitals`

## Next Features to Build (After First Hire)

### Priority 1: Email Notifications
- SendGrid integration
- Notify hospitals when nurses sign up
- Notify nurses when hospitals post needs

### Priority 2: SMS Alerts
- Twilio integration
- Text nurses about urgent openings
- Text hospitals about new matches

### Priority 3: Admin Dashboard
- `/admin` route with basic auth
- See all nurses and hospitals
- Manual matching override
- Export contacts for outreach

## Cost Analysis

### Current (MVP):
- Vercel: $0 (Free tier)
- Railway: $5/month (Starter)
- Domain: $12/year
- **Total**: ~$6/month

### After 100 Hospitals:
- Vercel: $20/month (Pro)
- Railway: $20/month (Pro)
- SendGrid: $15/month
- Twilio: $20/month
- **Total**: ~$75/month

### Revenue at 100 Hospitals:
- 100 hospitals × $99/month = $9,900/month
- **Profit**: ~$9,825/month

## Remember the Mission

We're not building a recruitment platform.
We're ending the nursing shortage.
One hospital at a time.
Starting with Stanford.

"Stay hungry. Stay foolish."
- Steve Jobs