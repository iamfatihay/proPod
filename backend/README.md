# ProPod Backend

FastAPI-based backend service. See the main README.md in the project root for complete documentation.

## Quick Start

```bash
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.init_db
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Environment Variables

Create `.env` file:

```env
DATABASE_URL=sqlite:///./app.db
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

## Alembic Migrations

```bash
# Create migration
alembic revision --autogenerate -m "Migration description"

# Apply migration
alembic upgrade head
```

## Schema vs Model Control

```bash
# Check users
python -c "from app.database import SessionLocal; from app.models import User; db = SessionLocal(); users = db.query(User).all(); print(f'Total users: {len(users)}'); [print(f'User {u.id}: {u.email}, updated_at: {u.updated_at}') for u in users]; db.close()"
```

For detailed information, see the main README.md file.
