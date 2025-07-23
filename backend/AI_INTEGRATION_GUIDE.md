# Volo AI Integration Guide

## Overview

Volo podcast app now includes comprehensive AI-powered features that enhance the podcast creation and management experience. This integration provides automatic audio enhancement, speech-to-text transcription, and intelligent content analysis.

## Features

### 🎵 Audio Enhancement

-   **Noise Reduction**: Automatically removes background noise and audio artifacts
-   **Audio Normalization**: Balances audio levels for consistent listening experience
-   **Dynamic Range Compression**: Optimizes audio dynamics for better playback
-   **Echo Reduction**: Minimizes echo and reverberation effects
-   **Quality Scoring**: Provides audio quality metrics and recommendations

### 🗣️ Speech Recognition & Transcription

-   **Multi-language Support**: Supports 12+ languages including Turkish and English
-   **Automatic Language Detection**: Identifies the primary language automatically
-   **Timestamp Generation**: Provides word and sentence-level timestamps
-   **High Accuracy**: 95%+ accuracy for clear recordings
-   **Subtitle Generation**: Creates SRT, VTT, and TXT subtitle formats

### 🧠 Content Analysis

-   **Keyword Extraction**: Identifies important terms and topics using TF-IDF algorithms
-   **Category Suggestion**: Automatically suggests podcast categories based on content
-   **Summary Generation**: Creates concise summaries of podcast content
-   **Sentiment Analysis**: Analyzes emotional tone and sentiment
-   **Readability Assessment**: Evaluates content complexity and reading level
-   **Topic Modeling**: Extracts main themes and discussion points

## Backend Architecture

### Core Services

#### 1. AI Service Coordinator (`ai_service.py`)

```python
from app.services.ai_service import ai_service

# Process complete podcast with all AI features
results = await ai_service.process_podcast_audio(
    audio_file_path="path/to/audio.mp3",
    options={
        "enhance_audio": True,
        "transcribe": True,
        "analyze_content": True,
        "language": "auto"
    }
)
```

#### 2. Audio Processor (`audio_processor.py`)

-   Handles audio quality enhancement
-   Supports multiple audio formats (MP3, WAV, M4A, OGG)
-   Provides detailed processing statistics

#### 3. Transcription Service (`transcription_service.py`)

-   OpenAI Whisper integration
-   GPU acceleration support
-   Configurable model sizes (tiny, base, small, medium, large)

#### 4. Content Analyzer (`content_analyzer.py`)

-   Rule-based and statistical analysis
-   Turkish and English language support
-   Customizable analysis parameters

### API Endpoints

#### AI Processing Endpoints

```
GET    /ai/status                    # Get AI services status
POST   /ai/initialize               # Initialize AI services
POST   /ai/process-audio            # Full AI processing pipeline
POST   /ai/enhance-audio            # Audio enhancement only
POST   /ai/transcribe              # Transcription only
POST   /ai/analyze-text            # Text analysis only
GET    /ai/supported-languages     # Get supported languages
POST   /ai/detect-language         # Detect audio language
POST   /ai/generate-subtitles      # Generate subtitle files
```

#### Podcast AI Integration

```
POST   /podcasts/{id}/process-ai   # Process podcast with AI
```

### Database Schema

New AI-related fields in the `podcasts` table:

```sql
-- Transcription results
transcription_text           TEXT
transcription_language       VARCHAR
transcription_confidence     VARCHAR     -- JSON string

-- Content analysis results
ai_keywords                  TEXT        -- JSON string
ai_summary                   TEXT
ai_sentiment                 VARCHAR     -- positive/negative/neutral
ai_categories                TEXT        -- JSON string

-- Processing metadata
ai_processing_status         VARCHAR     -- pending/processing/completed/failed
ai_processing_date           TIMESTAMP
ai_quality_score            VARCHAR     -- JSON string
```

## Frontend Integration

### Components

#### 1. AIProcessingResults

Displays comprehensive AI analysis results with interactive features:

```jsx
import AIProcessingResults from "../components/AIProcessingResults";

<AIProcessingResults
    results={aiResults}
    onApplyCategory={(category) => setCategory(category)}
    onApplySummary={(summary) => setDescription(summary)}
/>;
```

#### 2. AIProcessingProgress

Shows real-time processing progress with animations:

```jsx
import AIProcessingProgress from "../components/AIProcessingProgress";

<AIProcessingProgress
    isVisible={isProcessing}
    currentStep="transcribing"
    progress={75}
    processingTime={45}
/>;
```

### API Service Integration

Enhanced `apiService.js` with AI endpoints:

```javascript
import apiService from "../services/api/apiService";

// Process audio with AI
const results = await apiService.processAudioWithAI(formData);

// Get AI service status
const status = await apiService.getAIStatus();

// Analyze text content
const analysis = await apiService.analyzeTextContent("Podcast content text", {
    extractKeywords: true,
    suggestCategories: true,
    generateSummary: true,
});
```

## Setup & Installation

### Backend Dependencies

Add to `requirements.txt`:

```
# AI and Audio Processing
librosa>=0.10.0
pydub>=0.25.0
speech-recognition>=3.10.0
openai-whisper>=20231117
openai>=1.0.0
numpy>=1.24.0
scipy>=1.11.0
ffmpeg-python>=0.2.0
python-multipart>=0.0.6

# Testing
pytest>=7.4.0
pytest-asyncio>=0.21.0
aiofiles>=23.2.1
```

### Environment Setup

1. **Install FFmpeg** (required for audio processing):

    ```bash
    # Windows (with chocolatey)
    choco install ffmpeg

    # macOS
    brew install ffmpeg

    # Ubuntu/Debian
    sudo apt update && sudo apt install ffmpeg
    ```

2. **GPU Support** (optional, for faster processing):

    ```bash
    # CUDA-enabled PyTorch (if you have NVIDIA GPU)
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    ```

3. **Database Migration**:
    ```bash
    cd backend
    python create_migration.py
    ```

### Testing

Run AI service tests:

```bash
cd backend
pytest tests/test_ai_services.py -v
```

## Usage Examples

### Complete Podcast Processing

```python
# Backend example
results = await ai_service.process_podcast_audio(
    "recording.mp3",
    {
        "enhance_audio": True,
        "transcribe": True,
        "analyze_content": True,
        "audio_options": {
            "noise_reduction": True,
            "normalize": True,
            "quality": "high"
        },
        "transcription_options": {
            "language": "tr",  # Turkish
            "include_timestamps": True
        },
        "analysis_options": {
            "keyword_count": 15,
            "summary_sentences": 3
        }
    }
)
```

### Frontend Usage

```jsx
// In Create.js
const handleAIProcessing = async () => {
    setIsProcessing(true);
    setProcessingStep("uploading");

    try {
        const formData = new FormData();
        formData.append("file", audioBlob);
        formData.append("enhance_audio", isAIEnabled);
        formData.append("transcribe", true);
        formData.append("analyze_content", true);

        const results = await apiService.processAudioWithAI(formData);

        if (results.success) {
            setAIResults(results);
            setProcessingStep("completed");

            // Auto-apply suggestions
            if (results.analysis?.categories?.[0]) {
                setCategory(results.analysis.categories[0].category);
            }
        }
    } catch (error) {
        console.error("AI processing failed:", error);
        showToast("AI processing failed", "error");
    } finally {
        setIsProcessing(false);
    }
};
```

## Performance Considerations

### Backend Optimization

-   **Model Caching**: Whisper models are loaded once and reused
-   **Async Processing**: All AI operations are asynchronous
-   **Memory Management**: Temporary files are automatically cleaned up
-   **GPU Acceleration**: Automatically uses CUDA if available

### Processing Times

-   **Audio Enhancement**: ~5-15 seconds per minute of audio
-   **Transcription**: ~10-30 seconds per minute of audio
-   **Content Analysis**: ~1-5 seconds per 1000 words
-   **Total Pipeline**: ~20-50 seconds for a 5-minute podcast

### Recommended Hardware

-   **CPU**: 4+ cores recommended
-   **RAM**: 8GB+ (16GB+ for large models)
-   **GPU**: NVIDIA GPU with 4GB+ VRAM (optional)
-   **Storage**: SSD recommended for temporary file processing

## Monitoring & Debugging

### Logging

AI services provide detailed logging:

```python
import logging
logging.basicConfig(level=logging.INFO)

# Logs include:
# - Processing start/end times
# - Model loading status
# - Error details and stack traces
# - Performance metrics
```

### Health Checks

```bash
# Check AI service status
curl http://localhost:8000/ai/status

# Test AI initialization
curl -X POST http://localhost:8000/ai/initialize
```

### Common Issues

1. **FFmpeg Not Found**

    ```
    Error: FFmpeg not found
    Solution: Install FFmpeg and ensure it's in PATH
    ```

2. **Out of Memory**

    ```
    Error: CUDA out of memory
    Solution: Use smaller Whisper model or process on CPU
    ```

3. **Slow Processing**
    ```
    Issue: Transcription taking too long
    Solution: Use GPU acceleration or smaller model
    ```

## Future Enhancements

### Planned Features

-   [ ] Real-time audio processing during recording
-   [ ] Multiple speaker identification and diarization
-   [ ] Automatic chapter detection and generation
-   [ ] Advanced noise profile analysis
-   [ ] Custom AI model training for domain-specific content
-   [ ] Batch processing for multiple podcasts
-   [ ] Integration with external AI services (OpenAI GPT, Google Cloud)

### API Extensions

-   [ ] WebSocket support for real-time processing updates
-   [ ] Webhook notifications for completed processing
-   [ ] Rate limiting and quota management
-   [ ] Custom model configuration endpoints

## Security & Privacy

-   **Data Processing**: All AI processing happens on your servers
-   **File Cleanup**: Temporary files are automatically deleted
-   **No External APIs**: Core AI features work offline
-   **User Data**: No audio or text data is sent to third parties
-   **Encryption**: Sensitive data is encrypted at rest and in transit

## Troubleshooting

### Backend Issues

```bash
# Check AI service logs
tail -f backend/logs/ai_service.log

# Test individual components
python -c "from app.services.ai_service import ai_service; print(ai_service.get_service_status())"

# Verify dependencies
pip list | grep -E "(librosa|whisper|torch)"
```

### Frontend Issues

```javascript
// Check API connectivity
const status = await apiService.getAIStatus();
console.log("AI Status:", status);

// Test file upload
const formData = new FormData();
formData.append("file", testAudioFile);
const result = await apiService.processAudioWithAI(formData);
```

## Support

For technical support or questions about AI integration:

1. Check the logs for detailed error messages
2. Verify all dependencies are installed correctly
3. Test with smaller audio files first
4. Review the API documentation for correct endpoint usage

---

_This guide covers the complete AI integration for Volo podcast app. The system is designed to be scalable, efficient, and user-friendly while providing powerful AI capabilities for podcast creators._
