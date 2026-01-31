# 🚀 proPod Development Workflow

## Git Branching Strategy

### Branch Naming Convention
```
feature/    - New features
bugfix/     - Bug fixes
hotfix/     - Urgent production fixes
refactor/   - Code refactoring
docs/       - Documentation updates
test/       - Test additions/improvements
```

### Main Branches
- `master` - Production-ready code
- `develop` - Integration branch for features (we'll create this)
- `feature/*` - Individual features

---

## Feature Development Process

### 1. Start New Feature
```bash
# Update master
git checkout master
git pull origin master

# Create feature branch
git checkout -b feature/feature-name

# Work on feature...
git add .
git commit -m "feat: descriptive message"

# Push to remote
git push origin feature/feature-name
```

### 2. Commit Message Convention (Conventional Commits)
```
feat:     New feature
fix:      Bug fix
docs:     Documentation
style:    Formatting, missing semicolons, etc
refactor: Code restructuring
test:     Adding tests
chore:    Maintenance tasks
perf:     Performance improvements
```

**Examples:**
```
feat(ai): add transcription service integration
fix(studio): resolve waveform rendering issue
docs(api): update endpoint documentation
refactor(crud): simplify podcast query logic
test(auth): add user authentication tests
```

### 3. Pull Request Process
```
1. Create PR on GitHub
2. Add description:
   - What changed?
   - Why?
   - Testing done
   - Screenshots (if UI)
3. Request review (self-review for now)
4. Merge when approved
5. Delete feature branch
```

---

## Code Quality Standards

### Python (Backend)
```python
# ✅ Good - Clean, typed, documented
from typing import Optional, List
from sqlalchemy.orm import Session

async def get_podcasts(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None
) -> List[Podcast]:
    """
    Fetch podcasts with pagination and filtering.
    
    Args:
        db: Database session
        skip: Records to skip for pagination
        limit: Maximum records to return
        category: Optional category filter
        
    Returns:
        List of podcast objects
    """
    query = db.query(Podcast)
    
    if category:
        query = query.filter(Podcast.category == category)
    
    return query.offset(skip).limit(limit).all()


# ❌ Bad - No types, no docs, unclear
def get_podcasts(db, skip, limit, cat):
    q = db.query(Podcast)
    if cat:
        q = q.filter(Podcast.category == cat)
    return q.offset(skip).limit(limit).all()
```

### JavaScript/React Native (Frontend)
```javascript
// ✅ Good - Clean, documented, DRY
/**
 * AudioPlayer component for podcast playback
 * @param {Object} props - Component props
 * @param {string} props.audioUrl - URL of audio file
 * @param {Function} props.onPlaybackUpdate - Callback for playback updates
 */
const AudioPlayer = ({ audioUrl, onPlaybackUpdate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  
  const handlePlay = useCallback(async () => {
    try {
      await sound.playAsync();
      setIsPlaying(true);
    } catch (error) {
      console.error('Playback error:', error);
    }
  }, [sound]);
  
  return (
    <View style={styles.container}>
      <PlayButton onPress={handlePlay} />
      <ProgressBar position={position} />
    </View>
  );
};

// ❌ Bad - Unclear, no error handling
const AudioPlayer = (props) => {
  const [p, setP] = useState(false);
  return <View><Button onPress={() => sound.playAsync()} /></View>;
};
```

---

## Project Structure Best Practices

### Backend Architecture
```
backend/
├── app/
│   ├── core/           # Core functionality
│   │   ├── config.py   # Configuration
│   │   ├── security.py # Auth, encryption
│   │   └── exceptions.py # Custom exceptions
│   ├── models/         # Database models (organized)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── podcast.py
│   │   └── analytics.py
│   ├── schemas/        # Pydantic schemas (organized)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── podcast.py
│   │   └── ai.py
│   ├── services/       # Business logic
│   │   ├── __init__.py
│   │   ├── ai_service.py
│   │   ├── transcription_service.py
│   │   └── analytics_service.py
│   ├── routers/        # API endpoints
│   │   ├── __init__.py
│   │   ├── users.py
│   │   ├── podcasts.py
│   │   └── ai.py
│   └── utils/          # Helper functions
│       ├── __init__.py
│       ├── validators.py
│       └── formatters.py
```

### Frontend Architecture
```
frontend/
├── app/
│   ├── (auth)/         # Auth screens
│   ├── (main)/         # Main app screens
│   └── (studio)/       # Studio mode (NEW)
├── src/
│   ├── components/     # Reusable components
│   │   ├── common/     # Buttons, inputs, etc
│   │   ├── podcast/    # Podcast-specific
│   │   └── studio/     # Studio components
│   ├── hooks/          # Custom hooks
│   │   ├── useAudio.js
│   │   ├── useTranscription.js
│   │   └── useAnalytics.js
│   ├── services/       # API services
│   │   ├── api.js      # Base API
│   │   ├── podcastService.js
│   │   └── aiService.js
│   ├── utils/          # Utilities
│   │   ├── constants.js
│   │   ├── validators.js
│   │   └── formatters.js
│   └── context/        # React Context
│       ├── AuthContext.js
│       └── StudioContext.js
```

---

## Testing Standards

### Backend Tests
```python
# tests/test_transcription_service.py
import pytest
from app.services.transcription_service import TranscriptionService

class TestTranscriptionService:
    """Test suite for transcription service"""
    
    @pytest.fixture
    def service(self):
        """Create service instance for tests"""
        return TranscriptionService()
    
    @pytest.mark.asyncio
    async def test_transcribe_audio_success(self, service):
        """Test successful audio transcription"""
        # Arrange
        audio_path = "tests/fixtures/sample.mp3"
        
        # Act
        result = await service.transcribe(audio_path)
        
        # Assert
        assert result.success is True
        assert len(result.text) > 0
        assert result.language is not None
    
    @pytest.mark.asyncio
    async def test_transcribe_invalid_file(self, service):
        """Test transcription with invalid file"""
        # Arrange
        audio_path = "invalid.mp3"
        
        # Act & Assert
        with pytest.raises(FileNotFoundError):
            await service.transcribe(audio_path)
```

### Frontend Tests
```javascript
// src/components/__tests__/AudioPlayer.test.js
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AudioPlayer from '../AudioPlayer';

describe('AudioPlayer', () => {
  it('should play audio when play button is pressed', async () => {
    // Arrange
    const onPlaybackUpdate = jest.fn();
    const { getByTestId } = render(
      <AudioPlayer 
        audioUrl="http://example.com/audio.mp3"
        onPlaybackUpdate={onPlaybackUpdate}
      />
    );
    
    // Act
    fireEvent.press(getByTestId('play-button'));
    
    // Assert
    await waitFor(() => {
      expect(onPlaybackUpdate).toHaveBeenCalled();
    });
  });
});
```

---

## Code Review Checklist

### Before Creating PR
- [ ] Code follows naming conventions
- [ ] All functions have docstrings/comments
- [ ] No commented-out code
- [ ] No console.logs in production code
- [ ] Error handling implemented
- [ ] Tests written and passing
- [ ] No hardcoded values (use env vars)
- [ ] DRY principle followed
- [ ] Performance considered
- [ ] Security reviewed

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation

## Testing
How was this tested?

## Screenshots (if UI)
Add screenshots here

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

---

## Environment Management

### .env.example (Always keep updated)
```bash
# Database
DATABASE_URL=sqlite:///./app.db

# API Keys (never commit real keys!)
OPENAI_API_KEY=your_key_here
ASSEMBLYAI_API_KEY=your_key_here

# Feature Flags
ENABLE_AI_TRANSCRIPTION=true
ENABLE_AUDIO_ENHANCEMENT=false
```

### Secrets Management
```bash
# Development
cp .env.example .env
# Edit .env with real values

# Production
# Use environment variables, never commit secrets
```

---

## Documentation Standards

### API Documentation
```python
@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    language: str = Query("auto", description="Language code or 'auto'"),
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe audio file to text using AI.
    
    This endpoint processes audio files and returns:
    - Full transcription text
    - Detected language
    - Confidence scores
    - Timestamps
    
    **Supported formats:** mp3, wav, m4a, ogg
    **Max file size:** 100MB
    **Processing time:** ~30 seconds for 10min audio
    
    Args:
        audio_file: Audio file to transcribe
        language: Language code (en, tr, es, etc.) or "auto" for detection
        current_user: Authenticated user
        
    Returns:
        TranscriptionResponse with text and metadata
        
    Raises:
        HTTPException 400: Invalid file format
        HTTPException 413: File too large
        HTTPException 500: Transcription failed
        
    Example:
        ```bash
        curl -X POST "http://api.example.com/ai/transcribe" \
             -H "Authorization: Bearer YOUR_TOKEN" \
             -F "audio_file=@podcast.mp3" \
             -F "language=auto"
        ```
    """
    # Implementation...
```

---

## Performance Guidelines

### Database Queries
```python
# ✅ Good - Eager loading, indexed
podcasts = db.query(Podcast).options(
    joinedload(Podcast.owner),
    joinedload(Podcast.stats)
).filter(
    Podcast.is_deleted == False
).order_by(
    desc(Podcast.created_at)
).limit(20).all()

# ❌ Bad - N+1 queries
podcasts = db.query(Podcast).all()
for podcast in podcasts:
    owner = podcast.owner  # Extra query!
    stats = podcast.stats  # Extra query!
```

### React Native Performance
```javascript
// ✅ Good - Memoized, optimized
const PodcastList = memo(({ podcasts }) => {
  return (
    <FlatList
      data={podcasts}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <PodcastCard podcast={item} />}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
});

// ❌ Bad - Renders everything
const PodcastList = ({ podcasts }) => {
  return (
    <ScrollView>
      {podcasts.map(p => <PodcastCard key={p.id} podcast={p} />)}
    </ScrollView>
  );
};
```

---

## Continuous Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.12
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run tests
        run: |
          cd backend
          pytest tests/
      - name: Lint
        run: |
          cd backend
          flake8 app/

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Node
        uses: actions/setup-node@v2
        with:
          node-version: 18
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      - name: Run tests
        run: |
          cd frontend
          npm test
      - name: Lint
        run: |
          cd frontend
          npm run lint
```

---

**Ready to start first feature branch?** 🚀
Let's create `feature/ai-transcription` and begin!
