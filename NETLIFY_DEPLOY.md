# Note Management App - Netlify Deployment

Bu proje, Jira benzeri arayüze sahip bir SaaS not yönetim uygulamasıdır ve Netlify'a deploy edilmek için hazırlanmıştır.

## 🚀 Hızlı Başlangıç

### 1. Repository'yi Netlify'a Bağlama

1. [Netlify Dashboard](https://app.netlify.com)'a gidin
2. "Add new site" > "Import an existing project" seçin
3. GitHub repository'nizi seçin
4. Aşağıdaki build ayarlarını yapın:

```
Build command: npm run build
Publish directory: frontend/dist
Functions directory: netlify/functions
Node version: 20.11.1 (otomatik detect edilecek)
```

**Not:** Proje Node.js 20+ gerektirir. Netlify otomatik olarak `.nvmrc` dosyasından veya `netlify.toml`'dan version'ı algılayacaktır.

### 2. Environment Variables

Netlify Dashboard > Site settings > Environment variables bölümünde aşağıdaki değişkenleri ekleyin:

**Gerekli Variables:**
```
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-here-must-be-at-least-32-characters-long
DATABASE_PATH=/tmp/notes.db
NETLIFY=true
```

**Site URL'leri (deploy sonrası güncelleyin):**
```
APP_BASE_URL=https://your-site-name.netlify.app
FRONTEND_URL=https://your-site-name.netlify.app
```

**Opsiyonel (Email için):**
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

### 3. Manual Deploy (CLI ile)

```bash
# Netlify CLI'yı yükleyin (global)
npm install -g netlify-cli

# Login olun
netlify login

# Project'e bağlanın
netlify link

# Build ve deploy
npm run build
netlify deploy --prod
```

## 📁 Proje Yapısı

```
noteApp/
├── frontend/                 # React frontend
│   ├── dist/                # Build output (publish directory)
│   ├── public/_redirects    # Netlify redirects
│   └── src/
├── netlify/
│   └── functions/
│       └── api.js           # Serverless function
├── src/                     # Backend Express app
└── netlify.toml            # Netlify config
```

## 🔧 Özellikler

### Backend (Serverless)
- **Express API** Netlify Functions olarak çalışır
- **SQLite Database** her request'te /tmp'de initialize edilir
- **JWT Authentication** stateless authentication
- **Automatic CORS** frontend-backend communication için
- **Rate Limiting** serverless environment için optimize edilmiş

### Frontend
- **React + Vite** build
- **SPA routing** ile Netlify redirects
- **Environment-based** API URLs
- **Production optimized** build

### Database
- **SQLite** /tmp dizininde (serverless)
- **Auto-initialization** her cold start'ta
- **Schema management** otomatik migration

## 🔒 Güvenlik

- Helmet.js security headers
- CORS yapılandırması
- Rate limiting (serverless optimized)
- JWT token validation
- Input validation (Joi)
- Environment variable validation

## 📊 Monitoring

- Winston logging (console only for serverless)
- Error handling middleware
- Request logging
- Health check endpoint: `/api/health`

## 🔄 API Endpoints

Base URL: `https://your-site.netlify.app/api`

- `GET /health` - Health check
- `POST /auth/login` - Login
- `POST /auth/register` - Register
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout
- `GET /notes` - Get notes
- `POST /notes` - Create note
- `PUT /notes/:id` - Update note
- `DELETE /notes/:id` - Delete note
- `GET /groups` - Get groups
- `POST /groups` - Create group

## 🛠️ Development

**Requirements:**
- Node.js 20+
- npm 10+

```bash
# Local development
npm run dev                 # Start Express server
cd frontend && npm run dev  # Start Vite dev server

# Netlify development
npm run netlify:dev        # Start Netlify dev environment

# Build
npm run build              # Build for production

# Test
npm run test               # Run tests
```

## 🚨 Önemli Notlar

### Database Persistence
- Netlify'da SQLite database /tmp dizininde çalışır
- Her cold start'ta database yeniden initialize edilir
- **Persistent data için external database (PostgreSQL, MongoDB) önerilir**
- Development için local SQLite kullanılır

### Cold Start
- İlk request biraz yavaş olabilir (cold start)
- Database initialization dahil ~2-3 saniye
- Sonraki requestler hızlı olacak

### Limits
- Netlify Functions: 10 saniye timeout
- Database: Memory limiti (~1GB)
- Request size: 6MB limit

## 🐛 Troubleshooting

### Common Issues

**1. Node version error:**
- Netlify desteklenen Node versiyonlarını kontrol edin
- `.nvmrc` dosyası doğru mu?
- `netlify.toml`'da NODE_VERSION doğru mu?
- Minimum Node.js 20+ gerekli

**2. API calls başarısız:**
- Environment variables kontrol edin
- JWT_SECRET doğru set edilmiş mi?
- CORS settings kontrol edin

**3. Database errors:**
- /tmp write permissions kontrol edin
- Cold start timeout'u kontrol edin

**4. Build fails:**
- Dependencies güncel mi kontrol edin
- Frontend build errors kontrol edin
- Node version compatibility kontrol edin

### Debug

```bash
# Netlify function logs
netlify functions:logs

# Local debug
DEBUG=* npm run dev

# Build debug
npm run build:frontend -- --debug
```

## 📈 Production Checklist

- [ ] Environment variables set edildi
- [ ] JWT_SECRET güçlü ve güvenli
- [ ] Site URL'leri güncellendi
- [ ] Email configuration (opsiyonel)
- [ ] Custom domain (opsiyonel)
- [ ] HTTPS force enabled
- [ ] Security headers aktif

## 🔗 Faydalı Linkler

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Netlify Redirects](https://docs.netlify.com/routing/redirects/)
- [Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [Build Settings](https://docs.netlify.com/configure-builds/overview/)
