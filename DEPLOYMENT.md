# Deployment Guide

This document provides instructions for deploying the Note Management Application in different environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 16.0.0 or higher
- npm 7.0.0 or higher
- SQLite 3.x (included with better-sqlite3)
- Git (for cloning the repository)

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd note-management-app
```

### 2. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env  # or your preferred editor
```

### 4. Database Setup

```bash
# Initialize database and run migrations
npm run db:init
npm run db:migrate
```

### 5. Validate Configuration

```bash
npm run validate:config
```

## Development Deployment

### Quick Start

```bash
# Complete development setup
npm run setup:dev

# Start development server
npm run dev

# Start frontend development server (in another terminal)
cd frontend
npm run dev
```

### Development Scripts

```bash
# Start backend with debug logging
npm run dev:debug

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch tests
npm run test:watch
```

### Development URLs

- Backend API: http://localhost:3000
- Frontend: http://localhost:5173
- Health Check: http://localhost:3000/health

## Production Deployment

### 1. Environment Setup

```bash
# Set production environment
export NODE_ENV=production

# Update .env file with production values
nano .env
```

**Important Production Environment Variables:**

```bash
NODE_ENV=production
JWT_SECRET=your-secure-32-character-secret-key
DATABASE_PATH=/var/lib/note-app/notes.db
LOG_LEVEL=warn
LOG_ENABLE_FILE=true
CORS_ORIGIN=https://yourdomain.com
```

### 2. Build Application

```bash
# Build frontend
npm run build

# Validate configuration
npm run validate:config
```

### 3. Database Setup

```bash
# Initialize production database
npm run db:init
npm run db:migrate
```

### 4. Start Production Server

```bash
# Start with production configuration
npm run start:prod

# Or with PM2 (recommended)
npm install -g pm2
pm2 start src/server.js --name "note-app" --env production
```

### 5. Process Management with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor application
pm2 monit

# View logs
pm2 logs note-app

# Restart application
pm2 restart note-app

# Stop application
pm2 stop note-app
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'note-management-app',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/
COPY database/ ./database/

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/notes.db
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./frontend/dist:/usr/share/nginx/html
    depends_on:
      - app
    restart: unless-stopped
```

### 3. Build and Run

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `your-secure-secret-key` |
| `DATABASE_PATH` | SQLite database path | `./database/notes.db` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `LOG_LEVEL` | `info` | Logging level |
| `CORS_ORIGIN` | `*` | CORS allowed origins |

See `.env.example` for complete list.

## Health Checks

### Health Check Endpoint

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "database": "connected",
  "uptime": 123.456
}
```

### Monitoring

- **Application Logs**: Check logs for errors and warnings
- **Database**: Ensure SQLite database file is accessible
- **Memory Usage**: Monitor Node.js memory consumption
- **Response Times**: Monitor API response times

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### 2. Database Permission Issues

```bash
# Check database file permissions
ls -la database/notes.db

# Fix permissions
chmod 644 database/notes.db
chown app:app database/notes.db
```

#### 3. JWT Secret Issues

```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 4. Memory Issues

```bash
# Check memory usage
ps aux | grep node

# Monitor with PM2
pm2 monit
```

### Log Analysis

```bash
# View application logs
tail -f logs/app.log

# View error logs only
grep "ERROR" logs/app.log

# View PM2 logs
pm2 logs note-app --lines 100
```

### Performance Tuning

1. **Database Optimization**
   - Enable WAL mode (default)
   - Regular VACUUM operations
   - Monitor query performance

2. **Node.js Optimization**
   - Use cluster mode with PM2
   - Monitor memory leaks
   - Optimize garbage collection

3. **Network Optimization**
   - Enable gzip compression
   - Use CDN for static assets
   - Implement caching headers

## Security Considerations

### Production Security Checklist

- [ ] Strong JWT secret (32+ characters)
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Database file permissions secured
- [ ] Log files protected
- [ ] Environment variables secured

### SSL/TLS Setup

Use a reverse proxy like Nginx or Apache to handle SSL termination:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Backup and Recovery

### Database Backup

```bash
# Create backup
cp database/notes.db database/notes.db.backup.$(date +%Y%m%d_%H%M%S)

# Automated backup script
#!/bin/bash
BACKUP_DIR="/var/backups/note-app"
mkdir -p $BACKUP_DIR
cp database/notes.db "$BACKUP_DIR/notes.db.$(date +%Y%m%d_%H%M%S)"
find $BACKUP_DIR -name "notes.db.*" -mtime +7 -delete
```

### Recovery

```bash
# Stop application
pm2 stop note-app

# Restore database
cp database/notes.db.backup.20240101_120000 database/notes.db

# Start application
pm2 start note-app
```

## Support

For issues and questions:

1. Check the logs for error messages
2. Verify environment configuration
3. Test health check endpoint
4. Review this deployment guide
5. Check application documentation

---

**Note**: This deployment guide assumes a Linux/Unix environment. Windows deployment may require different commands and paths.