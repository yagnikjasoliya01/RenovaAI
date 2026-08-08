# 🏠 RenovaAI

AI-powered home renovation cost estimator with realistic visualization.

## Features

- 📸 Upload house photos & annotate regions
- 💰 Instant cost estimates (material + labor)
- 🤖 AI-generated renovation previews
- 📊 Professional PDF reports
- 💬 AI chat assistant

## Tech Stack

**Frontend:** React + TypeScript + Vite + TailwindCSS  
**Backend:** FastAPI + PostgreSQL + SQLAlchemy  
**AI:** Gemini AI + OpenAI (fallback)  
**Auth:** Supabase

## Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Create .env
cp .env.example .env
# Edit .env with your API keys

# Create database
python -c "from app.database import engine; from app.models import Base; Base.metadata.create_all(engine)"

# Run
uvicorn app.main:app --reload
```

### 2. Frontend Setup

```bash
cd frontend
npm install

# Create .env
cp .env.example .env
# Edit .env with your keys

# Run
npm run dev
```

## Supabase Setup (Required)

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create project
2. Wait for database to initialize

### 2. Setup Storage Bucket
1. Go to **Storage** → Create bucket → Name: `renovaai-images`
2. Make it **PUBLIC**
3. Set policies:
   - INSERT: Authenticated users
   - SELECT: Public (anyone can view)

### 3. Get API Keys
- **Project URL**: Settings → API → Project URL
- **Anon Key**: Settings → API → anon public key
- **Service Key**: Settings → API → service_role key (secret!)
- **JWT Secret**: Settings → Auth → JWT Secret

## Environment Variables

### Backend `.env`
```env
# Supabase (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# AI Keys (at least one required)
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# Database
DATABASE_URL=postgresql://user:pass@localhost/renovaai

# Environment
ENVIRONMENT=development  # or production
```

### Frontend `.env`
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Usage

1. **Sign up** → Create account
2. **Upload** → Upload house photo
3. **Annotate** → Draw regions (walls, windows, etc.)
4. **Measure** → Set reference scale
5. **Materials** → Select & apply materials
6. **Generate** → Click "Generate renovated image"
7. **Report** → Chat → "Generate cost report"
8. **View** → Header → "Reports" → View all reports

## API Keys

- **Supabase:** [supabase.com](https://supabase.com) (free)
- **Gemini:** [ai.google.dev](https://ai.google.dev) (free 60 req/min)
- **OpenAI:** [platform.openai.com](https://platform.openai.com) (optional)

## License

MIT

---

**Need help?** See [QUICKSTART.md](QUICKSTART.md) for detailed setup.
