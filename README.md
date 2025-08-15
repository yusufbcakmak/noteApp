# Note Management App

A SaaS note management application with Jira-like interface, built with React and Express.js.

## 🚀 Features

- **Task Management** - Create, edit, and organize notes with status tracking
- **Group Organization** - Organize notes into custom groups
- **Priority System** - Set priorities for your tasks
- **Due Dates** - Track deadlines and reminders
- **Authentication** - Secure user management with JWT
- **Responsive UI** - Works on desktop and mobile

## 🛠️ Tech Stack

**Frontend:**
- React 19
- Vite
- React Router
- Axios
- Lucide Icons

**Backend:**
- Node.js 20+
- Express.js
- SQLite (better-sqlite3)
- JWT Authentication
- Winston Logging

**Deployment:**
- Netlify (Serverless Functions + Static Hosting)
- SQLite Database (runtime initialization)

## 📋 Prerequisites

- Node.js 20+ 
- npm 10+

## 🏃‍♂️ Quick Start

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yusufbcakmak/noteApp.git
   cd noteApp
   ```

2. **Install dependencies:**
   ```bash
   npm run setup
   ```

3. **Start development servers:**
   ```bash
   # Terminal 1 - Backend
   npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Docs: http://localhost:3000/api-docs

### Production Deployment (Netlify)

See [NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md) for detailed deployment instructions.

**Quick Deploy:**
1. Connect repository to Netlify
2. Set build settings:
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
   - Functions directory: `netlify/functions`
3. Add environment variables (see deployment guide)

## 📁 Project Structure

```
noteApp/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── styles/         # CSS styles
│   ├── dist/               # Build output
│   └── public/             # Static assets
├── src/                     # Express backend
│   ├── controllers/        # Request handlers
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── middleware/        # Custom middleware
│   ├── services/          # Business logic
│   └── config/            # Configuration
├── netlify/
│   └── functions/         # Serverless functions
├── database/              # SQLite database (local)
├── tests/                 # Test files
└── scripts/               # Utility scripts
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start backend server
npm run dev:debug        # Start with debug logging

# Frontend
cd frontend && npm run dev    # Start frontend dev server

# Building
npm run build           # Build for production
npm run build:frontend  # Build frontend only

# Database
npm run db:init         # Initialize database
npm run db:migrate      # Run migrations
npm run db:migrate:rollback  # Rollback migrations

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Deployment
npm run netlify:dev     # Netlify dev environment
npm run netlify:deploy  # Deploy to Netlify
```

## 🔒 Environment Variables

Create `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./database/notes.db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-must-be-at-least-32-characters-long
JWT_EXPIRES_IN=15m

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

For production deployment, see [NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md).

## 📊 API Documentation

When running in development mode, API documentation is available at:
- Swagger UI: http://localhost:3000/api-docs
- OpenAPI Spec: http://localhost:3000/api/openapi.json

### Main Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/notes` - Get user's notes
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create new group

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (development)
npm run test:watch
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Issues

If you encounter any issues, please check:
1. Node.js version (20+ required)
2. Environment variables are set correctly
3. Database permissions
4. Check [NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md) for deployment issues

For bug reports, please open an issue with:
- Environment details (OS, Node version)
- Steps to reproduce
- Expected vs actual behavior
- Error logs