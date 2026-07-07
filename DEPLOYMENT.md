# Deployment Guide

## Prerequisites

- Docker ≥ 24 with Compose v2
- A `.env` file (copy `.env.example`, fill in real values)
- Cloudinary account (free tier works)

---

## Local Development

```bash
# 1. Copy and fill env file
cp .env.example .env

# 2. Start all services (MongoDB + backend + frontend with hot-reload)
docker compose up --build

# 3. Access
#   Frontend:  http://localhost:3000
#   Backend:   http://localhost:5000/api/v1/health
#   MongoDB:   mongodb://localhost:27017
```

To run only the database and develop locally outside Docker:

```bash
docker compose up mongo -d
cd backend && npm install && npm run dev   # Terminal 1
cd frontend && npm install && npm run dev  # Terminal 2
```

---

## Production Deployment

### On a Single Server (VPS / Droplet)

```bash
# 1. Clone the repo
git clone <your-repo-url> /opt/ecommerce
cd /opt/ecommerce

# 2. Create production .env (never commit this)
cp .env.example .env
# Edit .env with production values:
#   NODE_ENV=production
#   JWT_SECRET=<openssl rand -base64 48>
#   MONGO_URI=<your Atlas URI or local>
#   CLOUDINARY_*=<your keys>
#   CLIENT_ORIGIN=https://your-domain.com
#   NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1
#   NEXT_PUBLIC_SITE_URL=https://your-domain.com

# 3. Build and start production images
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Verify health
curl http://localhost:5000/api/v1/health
```

### Rolling Update (zero-downtime)

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
```

---

## Nginx Reverse Proxy (recommended)

Place behind Nginx so both services share port 80/443:

```nginx
# /etc/nginx/sites-available/ecommerce
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    # Backend
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }
}
```

Get SSL with certbot:

```bash
certbot --nginx -d your-domain.com -d api.your-domain.com
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Dev only | MongoDB root user |
| `MONGO_INITDB_ROOT_PASSWORD` | Dev only | MongoDB root password |
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | Backend port (default `5000`) |
| `MONGO_URI` | Yes | Full MongoDB connection string |
| `JWT_SECRET` | Yes | ≥32 char random string |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `7d`) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `CLIENT_ORIGIN` | Yes | Frontend URL (exact, for CORS) |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL |
| `NEXT_PUBLIC_SITE_URL` | Yes | Frontend public URL |

---

## CI/CD

GitHub Actions runs on every push/PR to `main` or `develop`:

1. **Backend** — TypeScript type-check + security audit
2. **Frontend** — TypeScript type-check + ESLint + security audit
3. **Docker** — Production image builds for both services (validates Dockerfiles)

To enable deployment, uncomment the `deploy` job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and add the required GitHub Secrets:
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

---

## Creating the First Admin User

After the first run, seed an admin via the backend REPL or `mongosh`:

```js
// mongosh ecommerce
db.users.updateOne(
  { email: "admin@your-domain.com" },
  { $set: { role: "admin" } }
)
```

Then log in at `/login` with that account to access `/admin`.
