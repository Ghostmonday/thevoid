# The Void API - Deployment Guide

## Quick Deploy Options

### Option 1: Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add postgresql

# Deploy
railway up
```

### Option 2: Render
1. Connect GitHub repo to Render
2. Create Web Service (Node)
3. Add PostgreSQL add-on
4. Set environment variables:
   - `DATABASE_URL`: From PostgreSQL connection string
   - `NODE_ENV`: production

### Option 3: Heroku
```bash
heroku create void-api
heroku addons:add heroku-postgresql
git push heroku main
```

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `PORT` | Server port (default 3000) | `3000` |
| `NODE_ENV` | Environment | `production` |

## Files Ready for Deployment

- `Dockerfile.prod` - Multi-stage production Dockerfile
- `docker-compose.prod.yml` - Production compose with PostgreSQL

## Verify Deployment

```bash
# Health check
curl https://your-domain.com/health

# Should return: {"status":"ok"}
```

## Post-Deployment

1. Set custom domain (void.fatedfortress.com)
2. Configure SSL (automatic on Railway/Render)
3. Test API endpoints
4. Monitor logs for errors
