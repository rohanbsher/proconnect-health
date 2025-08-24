# 🚀 ProConnect AI - Step-by-Step Deployment Guide

## Pre-Deployment Checklist
- [ ] Node.js 18+ installed
- [ ] Railway account created (https://railway.app)
- [ ] Vercel account created (https://vercel.com)
- [ ] Code working locally

## 📦 Step 1: Test Locally First

```bash
# Terminal 1 - Start Backend
cd proconnect-ai/backend
npm install
npm run dev

# Terminal 2 - Start Frontend  
cd proconnect-ai/frontend
npm install
npm run dev

# Terminal 3 - Test Connection
./test-deployment.sh
```

✅ **Success Indicators:**
- Backend: http://localhost:5000/api/health returns JSON
- Frontend: http://localhost:3000 shows "✅ Backend connected successfully!"

---

## 🚂 Step 2: Deploy Backend to Railway

### Option A: Using Railway CLI (Recommended)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Navigate to backend
cd proconnect-ai/backend

# 3. Login to Railway
railway login

# 4. Create new project
railway init

# 5. Deploy
railway up

# 6. Generate public URL
railway domain
```

### Option B: Using Railway Dashboard

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo" OR "Empty Project"
3. If empty project, use CLI: `railway link [project-id]`
4. Deploy with: `railway up`

### Configure Environment Variables in Railway

Go to Railway Dashboard → Your Project → Variables tab:

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-app.vercel.app
```

### Get Your Backend URL

1. Railway Dashboard → Settings → Networking
2. Click "Generate Domain" 
3. Copy URL (e.g., `https://proconnect-backend-production.up.railway.app`)

**SAVE THIS URL!** You need it for Vercel.

### Test Backend

```bash
curl https://your-backend.up.railway.app/api/health
```

---

## ▲ Step 3: Deploy Frontend to Vercel

### Option A: Using Vercel CLI (Recommended)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Navigate to frontend
cd proconnect-ai/frontend

# 3. Deploy
vercel

# Answer prompts:
# ? Set up and deploy? Yes
# ? Which scope? (select your account)
# ? Link to existing project? No
# ? Project name? proconnect-ai
# ? Directory? ./
# ? Override settings? No
```

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import Git Repository or "Deploy without Git"
3. Root Directory: `proconnect-ai/frontend`
4. Framework Preset: Next.js (auto-detected)

### Add Environment Variable (CRITICAL!)

**In Vercel Dashboard:**
1. Go to Settings → Environment Variables
2. Add:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://your-backend.up.railway.app
   ```
   (Use your actual Railway URL from Step 2)

3. Click "Save"

### Redeploy with Environment Variable

```bash
vercel --prod
```

Or in Dashboard: Deployments → Redeploy

### Get Your Frontend URL

Your app: `https://proconnect-ai.vercel.app`

---

## 🔄 Step 4: Update Backend CORS

Go back to Railway Dashboard:

1. Variables tab
2. Update `FRONTEND_URL`:
   ```
   FRONTEND_URL=https://proconnect-ai.vercel.app
   ```
3. Railway auto-redeploys

---

## ✅ Step 5: Test Everything

```bash
# Test with our script
./test-deployment.sh https://your-backend.up.railway.app https://proconnect-ai.vercel.app

# Or manually test
curl https://your-backend.up.railway.app/api/health
curl https://your-backend.up.railway.app/api/jobs
```

Visit your frontend: https://proconnect-ai.vercel.app

**Success Indicators:**
- ✅ "Backend connected successfully!" message
- ✅ Two job listings displayed
- ✅ No console errors

---

## 🐛 Troubleshooting

### "Backend not connected" Error

1. **Check Vercel Environment Variable:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
   ```
   - No trailing slash!
   - Must start with NEXT_PUBLIC_
   - Redeploy after adding

2. **Check Railway Logs:**
   ```bash
   railway logs
   ```

3. **Test Backend Directly:**
   ```bash
   curl https://your-backend.up.railway.app/api/health
   ```

### CORS Errors

1. **Check Railway Environment:**
   ```
   FRONTEND_URL=https://proconnect-ai.vercel.app
   ```

2. **Railway Logs for CORS:**
   ```bash
   railway logs | grep CORS
   ```

### Build Failures

**Backend:**
```bash
cd backend
npm run build  # Test locally first
```

**Frontend:**
```bash
cd frontend
rm -rf .next
npm run build  # Test locally first
```

---

## 📝 Quick Reference

### Railway Commands
```bash
railway login          # Login
railway init          # Create project
railway up            # Deploy
railway logs          # View logs
railway domain        # Get/Set domain
railway variables     # List env vars
```

### Vercel Commands
```bash
vercel               # Deploy preview
vercel --prod        # Deploy production
vercel env pull      # Get env vars
vercel logs          # View logs
vercel domains       # Manage domains
```

### Test URLs
- Backend Health: `https://[your-backend].up.railway.app/api/health`
- Backend Jobs: `https://[your-backend].up.railway.app/api/jobs`
- Frontend: `https://[your-project].vercel.app`

---

## 🎯 Final Checklist

- [ ] Backend deployed to Railway
- [ ] Backend URL generated and accessible
- [ ] Frontend deployed to Vercel
- [ ] NEXT_PUBLIC_API_URL set in Vercel
- [ ] FRONTEND_URL set in Railway
- [ ] Frontend shows "Backend connected"
- [ ] Jobs display on frontend
- [ ] No CORS errors in console

---

## 🚀 You're Live!

Once everything checks out, your MVP is deployed and working! 

Next steps:
1. Add PostgreSQL database (Railway)
2. Replace mock data with real jobs
3. Add authentication
4. Launch marketing campaign!

Need help? Check logs:
- Railway: `railway logs`
- Vercel: `vercel logs`