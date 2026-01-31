"""
Unit tests for AI services (TranscriptionService, ContentAnalyzer, AIService).

Tests cover:
- Transcription with OpenAI Whisper
- Content analysis with GPT-4
- Full AI processing pipeline
- Error handling
- Status tracking
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock

from app.services.transcription_service import (
    TranscriptionService,
    TranscriptionResult,
    TranscriptionProvider,
    TranscriptionError,
    AudioValidationError
)
from app.services.content_analyzer import (
    ContentAnalyzer,
    AnalysisResult,
    SentimentType
)
from app.services.ai_service import (
    AIService,
    ProcessingOptions,
    ProcessingStage,
    ProcessingResult
)


# Mock audio file path for testing
MOCK_AUDIO_PATH = "/tmp/test_audio.mp3"


class TestTranscriptionService:
    """Test cases for TranscriptionService."""
    
    @pytest.fixture
    def transcription_service(self):
        """Create TranscriptionService instance."""
        return TranscriptionService()
    
    def test_validate_audio_file_not_found(self, transcription_service):
        """Test validation fails for non-existent file."""
        with pytest.raises(AudioValidationError, match="not found"):
            transcription_service.validate_audio_file("/nonexistent/file.mp3")
    
    def test_validate_audio_file_unsupported_format(self, transcription_service, tmp_path):
        """Test validation fails for unsupported format."""
        # Create temp file with unsupported extension
        test_file = tmp_path / "test.txt"
        test_file.write_text("test")
        
        with pytest.raises(AudioValidationError, match="Unsupported format"):
            transcription_service.validate_audio_file(str(test_file))
    
    @patch("app.services.transcription_service.settings")
    @patch("app.services.transcription_service.TranscriptionService.SUPPORTED_FORMATS", {'.mp3'})
    def test_validate_audio_file_too_large(self, mock_settings, transcription_service, tmp_path):
        """Test validation fails for oversized file."""
        # Set max size to 1MB
        transcription_service.MAX_FILE_SIZE_MB = 1
        
        # Create 2MB file
        test_file = tmp_path / "test.mp3"
        test_file.write_bytes(b"0" * (2 * 1024 * 1024))
        
        with pytest.raises(AudioValidationError, match="too large"):
            transcription_service.validate_audio_file(str(test_file))
    
    @pytest.mark.asyncio
    @patch("app.services.transcription_service.AsyncOpenAI")
    async def test_transcribe_with_openai_success(self, mock_openai_class, transcription_service, tmp_path):
        """Test successful OpenAI transcription."""
        # Create mock audio file
        test_file = tmp_path / "test.mp3"
        test_file.write_bytes(b"mock audio data")
        
        # Mock OpenAI response
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.text = "This is a test transcription."
        mock_response.language = "en"
        
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_response)
        transcription_service.openai_client = mock_client
        
        # Mock audio duration
        with patch.object(transcription_service, 'get_audio_duration', return_value=120.0):
            result = await transcription_service.transcribe_with_openai(str(test_file))
        
        # Assertions
        assert isinstance(result, TranscriptionResult)
        assert result.text == "This is a test transcription."
        assert result.language == "en"
        assert result.provider == TranscriptionProvider.OPENAI  # Actual OpenAI API
        assert result.word_count == 5  # Correct count
        assert result.duration == 120.0
    
    @pytest.mark.asyncio
    async def test_transcribe_with_openai_no_client(self, transcription_service):
        """Test OpenAI transcription fails without client."""
        transcription_service.openai_client = None
        
        with pytest.raises(TranscriptionError, match="not initialized"):
            await transcription_service.transcribe_with_openai("/tmp/test.mp3")
    
    @pytest.mark.asyncio
    @patch("app.services.transcription_service.httpx.AsyncClient")
    async def test_transcribe_with_assemblyai_success(self, mock_httpx, transcription_service, tmp_path):
        """Test successful AssemblyAI transcription."""
        # Create mock audio file
        test_file = tmp_path / "test.mp3"
        test_file.write_bytes(b"mock audio data")
        
        # Mock AssemblyAI responses
        mock_client_instance = AsyncMock()
        
        # Upload response
        mock_upload_response = Mock()
        mock_upload_response.json.return_value = {"upload_url": "https://example.com/audio"}
        mock_upload_response.raise_for_status = Mock()
        
        # Transcript request response
        mock_transcript_response = Mock()
        mock_transcript_response.json.return_value = {"id": "transcript_123"}
        mock_transcript_response.raise_for_status = Mock()
        
        # Status response (completed)
        mock_status_response = Mock()
        mock_status_response.json.return_value = {
            "status": "completed",
            "text": "This is a test transcription.",
            "language_code": "en",
            "confidence": 0.95,
            "audio_duration": 120
        }
        mock_status_response.raise_for_status = Mock()
        
        # Setup mock client
        mock_client_instance.post = AsyncMock(side_effect=[mock_upload_response, mock_transcript_response])
        mock_client_instance.get = AsyncMock(return_value=mock_status_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock()
        
        mock_httpx.return_value = mock_client_instance
        
        transcription_service.assemblyai_api_key = "test_key"
        
        # Mock audio duration
        with patch.object(transcription_service, 'get_audio_duration', return_value=120.0):
            result = await transcription_service.transcribe_with_assemblyai(str(test_file))
        
        # Assertions
        assert isinstance(result, TranscriptionResult)
        assert result.text == "This is a test transcription."
        assert result.language == "en"
        assert result.provider == TranscriptionProvider.ASSEMBLYAI
        assert result.confidence == 0.95


class TestContentAnalyzer:
    """Test cases for ContentAnalyzer."""
    
    @pytest.fixture
    def content_analyzer(self):
        """Create ContentAnalyzer instance."""
        return ContentAnalyzer()
    
    @pytest.mark.asyncio
    @patch("app.services.content_analyzer.AsyncOpenAI")
    async def test_extract_keywords_success(self, mock_openai_class, content_analyzer):
        """Test successful keyword extraction."""
        # Mock OpenAI response
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content='["AI", "technology", "future", "innovation"]'))]
        
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        content_analyzer.openai_client = mock_client
        
        text = "This podcast discusses AI technology and innovation for the future."
        keywords = await content_analyzer.extract_keywords(text, count=4)
        
        # Assertions
        assert len(keywords) == 4
        assert "AI" in keywords
        assert "technology" in keywords
    
    @pytest.mark.asyncio
    @patch("app.services.content_analyzer.AsyncOpenAI")
    async def test_generate_summary_success(self, mock_openai_class, content_analyzer):
        """Test successful summary generation."""
        # Mock OpenAI response
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content="This podcast explores AI innovations."))]
        
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        content_analyzer.openai_client = mock_client
        
        text = "Long podcast text about AI and technology..."
        summary = await content_analyzer.generate_summary(text, length="short")
        
        # Assertions
        assert summary == "This podcast explores AI innovations."
        assert len(summary) > 0
    
    @pytest.mark.asyncio
    @patch("app.services.content_analyzer.AsyncOpenAI")
    async def test_detect_sentiment_success(self, mock_openai_class, content_analyzer):
        """Test successful sentiment detection."""
        # Mock OpenAI response
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content="positive"))]
        
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        content_analyzer.openai_client = mock_client
        
        text = "This is an amazing and inspiring podcast!"
        sentiment = await content_analyzer.detect_sentiment(text)
        
        # Assertions
        assert sentiment == SentimentType.POSITIVE
    
    @pytest.mark.asyncio
    @patch("app.services.content_analyzer.AsyncOpenAI")
    async def test_suggest_categories_success(self, mock_openai_class, content_analyzer):
        """Test successful category suggestion."""
        # Mock OpenAI response
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content='["Technology", "Education"]'))]
        
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        content_analyzer.openai_client = mock_client
        
        text = "Educational content about technology..."
        keywords = ["technology", "education", "learning"]
        categories = await content_analyzer.suggest_categories(text, keywords)
        
        # Assertions
        assert len(categories) > 0
        assert "Technology" in categories
    
    @pytest.mark.asyncio
    @patch("app.services.content_analyzer.AsyncOpenAI")
    async def test_analyze_content_full(self, mock_openai_class, content_analyzer):
        """Test full content analysis."""
        # Mock OpenAI client with all responses
        mock_client = AsyncMock()
        
        # Mock responses for each analysis step
        keyword_response = Mock(choices=[Mock(message=Mock(content='["AI", "tech"]'))])
        summary_response = Mock(choices=[Mock(message=Mock(content="Tech podcast"))])
        sentiment_response = Mock(choices=[Mock(message=Mock(content="positive"))])
        category_response = Mock(choices=[Mock(message=Mock(content='["Technology"]'))])
        quality_response = Mock(choices=[Mock(message=Mock(content="8.5"))])
        
        mock_client.chat.completions.create = AsyncMock(
            side_effect=[keyword_response, summary_response, sentiment_response, category_response, quality_response]
        )
        content_analyzer.openai_client = mock_client
        
        text = "A podcast about AI technology and its future impact..."
        result = await content_analyzer.analyze_content(text)
        
        # Assertions
        assert isinstance(result, AnalysisResult)
        assert len(result.keywords) > 0
        assert result.summary == "Tech podcast"
        assert result.sentiment == SentimentType.POSITIVE
        assert len(result.categories) > 0
        assert 0 <= result.quality_score <= 10


class TestAIService:
    """Test cases for AIService coordinator."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance."""
        return AIService()
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        db = Mock()
        return db
    
    @pytest.mark.asyncio
    async def test_process_podcast_full_success(self, ai_service, mock_db, tmp_path):
        """Test successful full podcast processing."""
        # Create mock audio file
        test_file = tmp_path / "test.mp3"
        test_file.write_bytes(b"mock audio data")
        
        # Mock database objects
        mock_podcast = Mock(id=1, ai_data=None)
        mock_ai_data = Mock(
            processing_status="pending",
            transcription_text=None,
            keywords=None,
            summary=None
        )
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_podcast
        mock_db.add = Mock()
        mock_db.commit = Mock()
        mock_db.refresh = Mock(side_effect=lambda obj: setattr(mock_podcast, 'ai_data', mock_ai_data))
        
        # Mock transcription result
        mock_transcription = TranscriptionResult(
            text="Test transcription",
            language="en",
            confidence=0.95,
            duration=120.0,
            provider=TranscriptionProvider.OPENAI,
            word_count=2,
            metadata={}
        )
        
        # Mock analysis result
        mock_analysis = AnalysisResult(
            keywords=["test", "podcast"],
            summary="Test summary",
            sentiment=SentimentType.POSITIVE,
            categories=["Technology"],
            quality_score=8.5,
            metadata={}
        )
        
        # Patch services
        with patch.object(ai_service.transcription_service, 'transcribe_audio', return_value=mock_transcription):
            with patch.object(ai_service.content_analyzer, 'analyze_content', return_value=mock_analysis):
                result = await ai_service.process_podcast_full(
                    podcast_id=1,
                    audio_path=str(test_file),
                    db=mock_db,
                    options=ProcessingOptions()
                )
        
        # Assertions
        assert isinstance(result, ProcessingResult)
        assert result.status == ProcessingStage.COMPLETED
        assert result.transcription is not None
        assert result.analysis is not None
        assert result.error is None
    
    @pytest.mark.asyncio
    async def test_get_processing_status(self, ai_service, mock_db):
        """Test getting processing status."""
        # Mock database objects
        mock_ai_data = Mock(
            processing_status="completed",
            transcription_text="Test text",
            summary="Test summary",
            quality_score=8.5,
            processing_date=None,
            transcription_language="en"
        )
        mock_podcast = Mock(id=1, ai_data=mock_ai_data)
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_podcast
        
        status = await ai_service.get_processing_status(
            podcast_id=1,
            db=mock_db
        )
        
        # Assertions
        assert status["podcast_id"] == 1
        assert status["status"] == "completed"
        assert status["has_transcription"] is True
        assert status["has_analysis"] is True
        assert status["quality_score"] == 8.5
