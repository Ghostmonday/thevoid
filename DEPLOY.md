# The Void - Production Deployment Guide

## Quick Deploy Options

### Option 1: Railway (Recommended)
1. Push code to GitHub
2. Connect repo to Railway
3. Add PostgreSQL plugin
4. Set environment variables:
   - `DATABASE_URL` = PostgreSQL connection string from Railway
   - `NODE_ENV` = production
5. Deploy

### Option 2: Render
1. Push code to GitHub
2. Create new Web Service on Render
3. Connect GitHub repo
4. Build Command: `npm install && npx prisma generate && npm run build`
5. Start Command: `node dist/index.js`
6. Add PostgreSQL database
7. Set `DATABASE_URL` environment variable

### Option 3: Heroku
1. Install Heroku CLI
2. `heroku create your-void-api`
3. `heroku addons:create heroku-postgresql`
4. `git push heroku main`
5. Set `NODE_ENV=production`

## Docker Deployment

### Local Production Test
```bash
# Set password
export POSTGRES_PASSWORD=secure_password

# Start
docker-compose -f docker-compose.prod.yml up --build

# Stop
docker-compose -f docker-compose.prod.yml down
```

### Production Server
```bash
# Clone repo
git clone https://github.com/Ghostmonday/FatedFortress.git
cd FatedFortress

# Set environment
cp packages/simple-api/.env.example .env
# Edit .env with production values

# Start with Docker
docker-compose -f docker-compose.prod.yml up -d
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| NODE_ENV | Yes | Set to "production" |
| PORT | No | Server port (default: 3000) |

## Database Migration

For existing data, run migrations:
```bash
npx prisma migrate deploy
```

For new deployments, the database will be created automatically from the Prisma schema.

## Verification

After deployment, verify:
```bash
curl https://your-domain.com/health
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```
