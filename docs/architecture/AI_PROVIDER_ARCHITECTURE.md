# AI Provider Architecture - Flexible & Cost-Effective

## 🎯 Overview

proPod supports **FLEXIBLE AI provider switching** - easily toggle between FREE local models and PAID OpenAI API. Perfect for:
- **Development**: Use FREE local Whisper (no costs)
- **Production**: Offer premium users OpenAI quality
- **Hybrid**: Free tier with local, premium tier with OpenAI

## 💰 Cost Comparison

| Provider | Transcription | Analysis | Cost per 10min Podcast | Quality |
|----------|--------------|----------|----------------------|---------|
| **Local Whisper** | FREE (CPU/GPU) | FREE (heuristics) | $0 | Good |
| **OpenAI API** | $0.06/10min | $0.02/analysis | ~$0.08 | Excellent |
| **Hybrid** | User-dependent | User-dependent | $0 (free) / $0.08 (premium) | Flexible |

## 🔧 Configuration

### Environment Variables (.env)

```bash
# AI Provider Selection
AI_PROVIDER=local  # Options: local, openai, hybrid

# OpenAI Configuration (only needed if AI_PROVIDER=openai or hybrid)
OPENAI_API_KEY=sk-your-key-here

# Local Whisper Configuration (used when AI_PROVIDER=local or hybrid)
WHISPER_MODEL_SIZE=base  # Options: tiny, base, small, medium, large
WHISPER_DEVICE=cpu       # Options: cpu, cuda, mps

# OpenAI Model Names (for openai/hybrid mode)
AI_TRANSCRIPTION_MODEL=whisper-1
AI_ANALYSIS_MODEL=gpt-4-turbo
```

### Provider Modes Explained

#### 1. LOCAL Mode (Development Default - FREE)
```bash
AI_PROVIDER=local
```

**How it works:**
- ✅ Uses local Whisper model for transcription (FREE)
- ✅ Uses simple heuristics for content analysis (FREE)
- ✅ No API keys required
- ✅ No costs, ever
- ⚠️ Slower processing (especially on CPU)
- ⚠️ Basic analysis quality

**When to use:**
- Development and testing
- Personal/hobby projects with $0 budget
- Privacy-sensitive use cases (audio never leaves server)

#### 2. OPENAI Mode (Best Quality - PAID)
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**How it works:**
- ✅ Uses OpenAI Whisper API for transcription (PAID)
- ✅ Uses GPT-4 for content analysis (PAID)
- ✅ Fast processing
- ✅ Excellent quality
- ⚠️ Requires API key
- ⚠️ Costs ~$0.08 per 10-minute podcast

**When to use:**
- Production with budget
- When quality is critical
- Commercial products charging users

#### 3. HYBRID Mode (Freemium Model - FLEXIBLE)
```bash
AI_PROVIDER=hybrid
OPENAI_API_KEY=sk-...  # Optional but recommended
```

**How it works:**
- Free users → Local Whisper + basic analysis (FREE)
- Premium users → OpenAI API (PAID, best quality)
- Automatic fallback if OpenAI fails
- User-level feature control

**When to use:**
- SaaS products with free + premium tiers
- Gradual rollout strategy
- Cost optimization with quality options

## 🔀 Switching Providers

### Method 1: Environment Variable (Recommended)
```bash
# In .env file
AI_PROVIDER=local   # Change this
```
Restart backend:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Method 2: Runtime Configuration (Future)
Admin panel can change `settings.AI_PROVIDER` dynamically:
```python
# Future admin endpoint
@router.post("/admin/ai-provider")
async def update_ai_provider(provider: str):
    settings.AI_PROVIDER = provider
    return {"provider": provider}
```

## 👤 Premium User System

### Database Schema
```sql
-- Already added to User model
ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT FALSE;
```

### How Premium Status Works

**In Code:**
```python
# AI services automatically check user premium status
user = await get_current_user(token)
result = await transcription_service.transcribe_audio(
    file_path="audio.mp3",
    user_is_premium=user.is_premium  # ⭐ This determines provider in hybrid mode
)
```

**Provider Selection Logic (Hybrid Mode):**
```python
if settings.AI_PROVIDER == "hybrid":
    if user.is_premium:
        # Use OpenAI API (best quality, costs money)
        return await transcribe_with_openai(...)
    else:
        # Use local Whisper (free, basic quality)
        return await transcribe_with_local_whisper(...)
```

### Upgrading Users to Premium

**Manual (Database):**
```python
# In admin panel or script
user = db.query(User).filter(User.email == "fatih@example.com").first()
user.is_premium = True
db.commit()
```

**Automatic (Payment Integration - Future):**
```python
@router.post("/payment/success")
async def payment_success(user_id: int, subscription_id: str):
    user = db.query(User).get(user_id)
    user.is_premium = True
    user.stripe_subscription_id = subscription_id
    db.commit()
```

## 📊 Implementation Examples

### Example 1: Development (FREE)
```bash
# .env
AI_PROVIDER=local
WHISPER_MODEL_SIZE=base
WHISPER_DEVICE=cpu
```
**Result:** All users get FREE processing, no API costs

### Example 2: Production with OpenAI (PAID)
```bash
# .env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxx
AI_ANALYSIS_MODEL=gpt-4-turbo
```
**Result:** All users get OpenAI quality, you pay ~$0.08 per podcast

### Example 3: Freemium SaaS (HYBRID)
```bash
# .env
AI_PROVIDER=hybrid
OPENAI_API_KEY=sk-proj-xxxxx
WHISPER_MODEL_SIZE=base
```

**Database:**
```sql
-- Free users
UPDATE users SET is_premium = FALSE WHERE email = 'free@user.com';

-- Premium users ($9.99/month subscription)
UPDATE users SET is_premium = TRUE WHERE email = 'premium@user.com';
```

**Result:**
- Free users: Local processing (you pay $0)
- Premium users: OpenAI quality (you pay ~$0.08, they pay $9.99/month)

## 🚀 Migration Path

### Phase 1: Development (Current)
```bash
AI_PROVIDER=local  # FREE
```
- Build features
- Test everything
- No API costs

### Phase 2: Limited Beta
```bash
AI_PROVIDER=openai  # PAID
```
- 10-50 test users
- Budget: $50-100/month
- Validate quality

### Phase 3: Freemium Launch
```bash
AI_PROVIDER=hybrid  # FLEXIBLE
```
- Free users: Local processing
- Premium users ($9.99/mo): OpenAI quality
- Scale sustainably

### Phase 4: Full Production
```bash
AI_PROVIDER=hybrid
```
- Optimize costs based on usage
- A/B test quality differences
- Implement usage limits

## 🛠️ Technical Details

### Service Layer
All AI services support provider switching:

**TranscriptionService:**
```python
async def transcribe_audio(
    file_path: str,
    user_is_premium: bool = False
) -> TranscriptionResult:
    # Automatically routes to correct provider
    pass
```

**ContentAnalyzer:**
```python
async def analyze_content(
    text: str,
    user_is_premium: bool = False
) -> AnalysisResult:
    # Automatically routes to correct provider
    pass
```

### Logging
Services log which provider is used:
```
🆓 Using LOCAL Whisper (FREE, no API costs)
💰 Using OpenAI API (PAID)
⭐ Premium user → Using OpenAI API (best quality)
🆓 Free user → Using LOCAL Whisper
```

## 📦 Dependencies

Already in `requirements.txt`:
```
# OpenAI API (for openai/hybrid mode)
openai>=1.54.0

# Local Whisper (for local/hybrid mode)
openai-whisper>=20231117
torch>=2.0.0

# Audio processing (both modes)
librosa>=0.10.0
pydub>=0.25.0
ffmpeg-python>=0.2.0
```

## 🔒 Security Best Practices

1. **Never commit API keys**
   ```bash
   # .env (in .gitignore)
   OPENAI_API_KEY=sk-...
   ```

2. **Use environment variables**
   ```python
   # ✅ Good
   api_key = settings.OPENAI_API_KEY
   
   # ❌ Bad
   api_key = "sk-hardcoded-key"
   ```

3. **Validate API keys on startup**
   ```python
   if settings.AI_PROVIDER in ["openai", "hybrid"]:
       if not settings.OPENAI_API_KEY:
           logger.warning("⚠️  OpenAI API key not set!")
   ```

## 🎬 Quick Start

### For Development (FREE):
```bash
cd backend
echo "AI_PROVIDER=local" >> .env
echo "WHISPER_MODEL_SIZE=base" >> .env
python -m pytest tests/test_ai_services.py
```

### For Production (PAID):
```bash
cd backend
echo "AI_PROVIDER=openai" >> .env
echo "OPENAI_API_KEY=sk-your-key" >> .env
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### For Freemium (HYBRID):
```bash
cd backend
echo "AI_PROVIDER=hybrid" >> .env
echo "OPENAI_API_KEY=sk-your-key" >> .env
echo "WHISPER_MODEL_SIZE=base" >> .env

# Set some users as premium
python -c "
from app.database import SessionLocal
from app.models import User
db = SessionLocal()
user = db.query(User).filter_by(email='premium@user.com').first()
if user:
    user.is_premium = True
    db.commit()
    print(f'✅ {user.email} is now premium!')
"
```

## 📈 Cost Estimation

### Local Mode (FREE)
- **Cost per podcast**: $0
- **Total monthly cost**: $0
- **Infrastructure**: Server CPU/GPU time only

### OpenAI Mode (PAID)
- **Cost per 10-min podcast**: ~$0.08
- **100 podcasts/month**: ~$8
- **1,000 podcasts/month**: ~$80
- **10,000 podcasts/month**: ~$800

### Hybrid Mode (FREEMIUM)
Assuming 80% free users, 20% premium:
- **1,000 total users**
  - 800 free: $0
  - 200 premium × $0.08: $16/month cost
  - 200 premium × $9.99: $1,998/month revenue
  - **Profit**: $1,982/month

## 🤝 Contributing

When adding new AI features:
1. Support all three provider modes (local, openai, hybrid)
2. Add `user_is_premium` parameter for hybrid routing
3. Log which provider is used
4. Handle graceful fallbacks

## 📝 License

MIT License - See LICENSE file for details

---

**Questions?** Open an issue or contact the development team.
