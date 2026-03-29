# Deployment Guide — RapidAPI Data Bundle

## Option A: Railway (Recommended — $5/mo)

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Deploy
```bash
cd ~/openclaw-experiments/products/rapidapi-bundle
railway init    # creates new project
railway up      # deploys
```

### 3. Set Environment Variables
In Railway dashboard:
```
PORT=3000
NODE_ENV=production
RAPIDAPI_PROXY_SECRET=<set-after-creating-rapidapi-listing>
```

### 4. Get Public URL
Railway provides a public URL automatically: `https://your-app.up.railway.app`

### 5. Create RapidAPI Listings
See `docs/RAPIDAPI-LISTINGS.md` for each API's listing specs.

---

## Option B: Render (Free Tier Available)

### 1. Push to GitHub
```bash
cd ~/openclaw-experiments/products/rapidapi-bundle
git init && git add -A && git commit -m "Initial commit"
gh repo create datapipe-apis --private --source=.
git push -u origin main
```

### 2. Connect to Render
- Go to render.com → New Web Service
- Connect GitHub repo
- Build command: `npm install`
- Start command: `node src/server.js`
- Free tier: 750 hours/mo (enough for always-on)

---

## Option C: Any VPS ($4-6/mo)

```bash
# On VPS (Hetzner CX22, DigitalOcean Basic, etc.)
git clone <repo-url>
cd rapidapi-bundle
npm install --production
PORT=3000 NODE_ENV=production node src/server.js

# Or use pm2:
npm install -g pm2
pm2 start src/server.js --name datapipe-apis
pm2 save
pm2 startup
```

### Caddy reverse proxy (auto-SSL):
```
api.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

## After Deployment

1. Verify: `curl https://your-url/health`
2. Test an API: `curl https://your-url/api/tech-stack/detect?url=github.com`
3. Create RapidAPI provider account
4. Create API listings (see docs/RAPIDAPI-LISTINGS.md)
5. Set RAPIDAPI_PROXY_SECRET
6. Wait for subscribers 💰
