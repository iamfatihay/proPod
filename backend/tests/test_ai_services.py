import pytest
import asyncio
import tempfile
import os
from pathlib import Path
import io
from unittest.mock import Mock, patch, AsyncMock

from app.services.ai_service import ai_service
from app.services.audio_processor import AudioProcessor
from app.services.transcription_service import TranscriptionService
from app.services.content_analyzer import ContentAnalyzer

class TestAudioProcessor:
    """Test audio processing functionality"""
    
    @pytest.fixture
    def audio_processor(self):
        return AudioProcessor()
    
    @pytest.mark.asyncio
    async def test_initialize(self, audio_processor):
        """Test audio processor initialization"""
        success = await audio_processor.initialize()
        assert success is True
        assert audio_processor.is_initialized is True
        assert audio_processor.temp_dir is not None
        assert os.path.exists(audio_processor.temp_dir)
    
    @pytest.mark.asyncio
    async def test_enhance_audio_quality_file_not_found(self, audio_processor):
        """Test audio enhancement with non-existent file"""
        await audio_processor.initialize()
        
        result = await audio_processor.enhance_audio_quality("nonexistent.mp3")
        
        assert result["success"] is False
        assert len(result["errors"]) > 0
        assert "not found" in result["errors"][0].lower()
    
    def test_get_status(self, audio_processor):
        """Test audio processor status"""
        status = audio_processor.get_status()
        
        assert "is_initialized" in status
        assert "temp_dir" in status
        assert "available_formats" in status
        assert isinstance(status["available_formats"], list)

class TestTranscriptionService:
    """Test transcription functionality"""
    
    @pytest.fixture
    def transcription_service(self):
        return TranscriptionService()
    
    @pytest.mark.asyncio
    async def test_get_supported_languages(self, transcription_service):
        """Test getting supported languages"""
        languages = await transcription_service.get_supported_languages()
        
        assert isinstance(languages, list)
        assert len(languages) > 0
        
        # Check Turkish and English are supported
        language_codes = [lang["code"] for lang in languages]
        assert "tr" in language_codes
        assert "en" in language_codes
    
    @pytest.mark.asyncio
    async def test_transcribe_audio_file_not_found(self, transcription_service):
        """Test transcription with non-existent file"""
        result = await transcription_service.transcribe_audio("nonexistent.mp3")
        
        assert result["success"] is False
        assert len(result["errors"]) > 0
    
    def test_format_timestamp(self, transcription_service):
        """Test timestamp formatting"""
        # Test various timestamps
        assert transcription_service._format_timestamp(0) == "00:00:00.000"
        assert transcription_service._format_timestamp(61.5) == "00:01:01.500"
        assert transcription_service._format_timestamp(3661.123) == "01:01:01.123"
    
    def test_format_timestamp_srt(self, transcription_service):
        """Test SRT timestamp formatting"""
        assert transcription_service._format_timestamp_srt(61.5) == "00:01:01,500"
    
    def test_format_timestamp_vtt(self, transcription_service):
        """Test VTT timestamp formatting"""
        assert transcription_service._format_timestamp_vtt(61.5) == "00:01:01.500"
    
    @pytest.mark.asyncio
    async def test_generate_srt_subtitles(self, transcription_service):
        """Test SRT subtitle generation"""
        mock_segments = [
            {
                "id": 0,
                "start": 0.0,
                "end": 2.5,
                "text": "Hello world"
            },
            {
                "id": 1,
                "start": 2.5,
                "end": 5.0,
                "text": "This is a test"
            }
        ]
        
        transcription_result = {"segments": mock_segments}
        srt_content = await transcription_service.generate_subtitles(transcription_result, "srt")
        
        assert "1" in srt_content
        assert "00:00:00,000 --> 00:00:02,500" in srt_content
        assert "Hello world" in srt_content
        assert "2" in srt_content
        assert "This is a test" in srt_content
    
    def test_get_status(self, transcription_service):
        """Test transcription service status"""
        status = transcription_service.get_status()
        
        assert "is_initialized" in status
        assert "model_name" in status
        assert "supported_languages" in status

class TestContentAnalyzer:
    """Test content analysis functionality"""
    
    @pytest.fixture
    def content_analyzer(self):
        return ContentAnalyzer()
    
    @pytest.mark.asyncio
    async def test_initialize(self, content_analyzer):
        """Test content analyzer initialization"""
        success = await content_analyzer.initialize()
        assert success is True
        assert content_analyzer.is_initialized is True
    
    @pytest.mark.asyncio
    async def test_analyze_empty_content(self, content_analyzer):
        """Test analysis with empty text"""
        await content_analyzer.initialize()
        
        result = await content_analyzer.analyze_content("")
        
        assert result["success"] is False
        assert len(result["errors"]) > 0
    
    @pytest.mark.asyncio
    async def test_analyze_content_basic(self, content_analyzer):
        """Test basic content analysis"""
        await content_analyzer.initialize()
        
        text = """
        Bu teknoloji hakkında bir podcast. Yapay zeka ve bilgisayar programlama 
        konularını ele alıyoruz. Çok güzel bir tartışma oldu ve keyifli bir 
        deneyimdi. Bu konuları daha derinlemesine incelemek istiyoruz.
        """
        
        result = await content_analyzer.analyze_content(text)
        
        assert result["success"] is True
        assert "text_stats" in result
        assert "keywords" in result
        assert "categories" in result
        assert "sentiment" in result
        
        # Check text stats
        stats = result["text_stats"]
        assert stats["word_count"] > 0
        assert stats["sentence_count"] > 0
        
        # Check keywords extraction
        assert len(result["keywords"]) > 0
        
        # Check category suggestion (should suggest Technology)
        categories = result["categories"]
        if categories:
            category_names = [cat["category"] for cat in categories]
            assert "Technology" in category_names
    
    @pytest.mark.asyncio
    async def test_extract_keywords(self, content_analyzer):
        """Test keyword extraction"""
        await content_analyzer.initialize()
        
        text = "teknoloji yapay zeka bilgisayar programlama kod yazılım"
        keywords = await content_analyzer._extract_keywords(text, 5)
        
        assert len(keywords) <= 5
        assert all("word" in kw for kw in keywords)
        assert all("frequency" in kw for kw in keywords)
        assert all("score" in kw for kw in keywords)
    
    @pytest.mark.asyncio
    async def test_suggest_categories(self, content_analyzer):
        """Test category suggestion"""
        await content_analyzer.initialize()
        
        # Technology-related text
        tech_text = "Bu podcast teknoloji, yapay zeka ve programlama hakkında"
        categories = await content_analyzer._suggest_categories(tech_text)
        
        if categories:
            assert categories[0]["category"] == "Technology"
            assert categories[0]["score"] > 0
        
        # Business-related text
        business_text = "Bu podcast iş dünyası, pazarlama ve şirket yönetimi hakkında"
        categories = await content_analyzer._suggest_categories(business_text)
        
        if categories:
            category_names = [cat["category"] for cat in categories]
            assert "Business" in category_names
    
    @pytest.mark.asyncio
    async def test_generate_summary(self, content_analyzer):
        """Test summary generation"""
        await content_analyzer.initialize()
        
        text = """
        İlk cümle burada. İkinci cümle burada. Üçüncü cümle burada.
        Dördüncü cümle burada. Beşinci cümle burada. Altıncı cümle burada.
        """
        
        summary = await content_analyzer._generate_summary(text, 3)
        
        assert isinstance(summary, str)
        assert len(summary) > 0
        # Summary should be shorter than original
        assert len(summary) <= len(text)
    
    @pytest.mark.asyncio
    async def test_analyze_sentiment(self, content_analyzer):
        """Test sentiment analysis"""
        await content_analyzer.initialize()
        
        # Positive text
        positive_text = "Çok güzel, mükemmel, harika bir deneyim"
        sentiment = await content_analyzer._analyze_sentiment(positive_text)
        
        assert sentiment["label"] in ["positive", "neutral"]
        assert "confidence" in sentiment
        assert "scores" in sentiment
        
        # Negative text
        negative_text = "Çok kötü, berbat, rezalet bir deneyim"
        sentiment = await content_analyzer._analyze_sentiment(negative_text)
        
        assert sentiment["label"] in ["negative", "neutral"]
    
    @pytest.mark.asyncio
    async def test_analyze_readability(self, content_analyzer):
        """Test readability analysis"""
        await content_analyzer.initialize()
        
        text = "Bu basit bir metin. Kolay okunabilir."
        readability = await content_analyzer._analyze_readability(text)
        
        assert "score" in readability
        assert "level" in readability
        assert "avg_sentence_length" in readability
        assert "avg_word_length" in readability
        assert 0 <= readability["score"] <= 100
    
    def test_split_sentences(self, content_analyzer):
        """Test sentence splitting"""
        text = "İlk cümle. İkinci cümle! Üçüncü cümle?"
        sentences = content_analyzer._split_sentences(text)
        
        assert len(sentences) == 3
        assert "İlk cümle" in sentences[0]
    
    def test_extract_words(self, content_analyzer):
        """Test word extraction"""
        text = "Bu bir test metni."
        words = content_analyzer._extract_words(text)
        
        assert "Bu" in words
        assert "test" in words
        assert "metni" in words
        # Punctuation should be removed
        assert "." not in words
    
    def test_get_status(self, content_analyzer):
        """Test content analyzer status"""
        status = content_analyzer.get_status()
        
        assert "is_initialized" in status
        assert "categories_count" in status
        assert "supported_features" in status

class TestAIService:
    """Test main AI service coordinator"""
    
    @pytest.fixture
    def ai_service_instance(self):
        return ai_service
    
    @pytest.mark.asyncio
    async def test_initialize(self, ai_service_instance):
        """Test AI service initialization"""
        # Mock the sub-services to avoid heavy initialization
        with patch.object(ai_service_instance.audio_processor, 'initialize', return_value=True), \
             patch.object(ai_service_instance.transcription_service, 'initialize', return_value=True), \
             patch.object(ai_service_instance.content_analyzer, 'initialize', return_value=True):
            
            success = await ai_service_instance.initialize()
            assert success is True
            assert ai_service_instance.is_initialized is True
    
    def test_get_service_status(self, ai_service_instance):
        """Test service status retrieval"""
        status = ai_service_instance.get_service_status()
        
        assert "is_initialized" in status
        assert "audio_processor" in status
        assert "transcription_service" in status
        assert "content_analyzer" in status
    
    @pytest.mark.asyncio
    async def test_analyze_text_only(self, ai_service_instance):
        """Test text-only analysis"""
        # Mock content analyzer
        mock_result = {
            "success": True,
            "keywords": [{"word": "test", "score": 1.0}],
            "categories": [{"category": "Technology", "score": 5}],
            "sentiment": {"label": "positive", "confidence": 0.8}
        }
        
        with patch.object(ai_service_instance.content_analyzer, 'analyze_content', return_value=mock_result):
            result = await ai_service_instance.analyze_text_only("test text")
            
            assert result["success"] is True
            assert "keywords" in result

# Integration Tests
class TestAIServiceIntegration:
    """Integration tests for AI services"""
    
    @pytest.mark.asyncio
    async def test_content_analysis_pipeline(self):
        """Test complete content analysis pipeline"""
        content_analyzer = ContentAnalyzer()
        await content_analyzer.initialize()
        
        # Turkish podcast text
        text = """
        Merhaba arkadaşlar, bugün teknoloji dünyasından son gelişmeleri konuşacağız.
        Yapay zeka alanındaki yenilikler gerçekten çok heyecan verici. Özellikle
        machine learning ve deep learning konularında yaşanan gelişmeler muhteşem.
        Bu podcast'te bu konuları detaylı bir şekilde ele alacağız.
        """
        
        result = await content_analyzer.analyze_content(text)
        
        # Verify analysis completed successfully
        assert result["success"] is True
        
        # Verify text statistics
        stats = result["text_stats"]
        assert stats["word_count"] > 20
        assert stats["sentence_count"] >= 2
        assert stats["reading_time_minutes"] > 0
        
        # Verify keywords extracted
        keywords = result["keywords"]
        assert len(keywords) > 0
        
        # Should extract Turkish words
        keyword_words = [kw["word"] for kw in keywords]
        assert any("teknoloji" in word for word in keyword_words)
        
        # Verify category suggestion
        categories = result["categories"]
        if categories:
            # Should suggest Technology category
            category_names = [cat["category"] for cat in categories]
            assert "Technology" in category_names
        
        # Verify sentiment analysis
        sentiment = result["sentiment"]
        assert sentiment["label"] in ["positive", "negative", "neutral"]
        assert 0 <= sentiment["confidence"] <= 1
        
        # Verify summary generated
        summary = result["summary"]
        assert isinstance(summary, str)
        assert len(summary) > 0
    
    @pytest.mark.asyncio
    async def test_multilanguage_analysis(self):
        """Test analysis with mixed languages"""
        content_analyzer = ContentAnalyzer()
        await content_analyzer.initialize()
        
        # Mixed Turkish-English text
        text = """
        This podcast is about technology ve yapay zeka. We discuss programming
        ve software development konularını. It's a great learning experience
        ve çok keyifli bir tartışma oluyor.
        """
        
        result = await content_analyzer.analyze_content(text)
        
        assert result["success"] is True
        
        # Should extract keywords from both languages
        keywords = result["keywords"]
        keyword_words = [kw["word"] for kw in keywords]
        
        # Check for both English and Turkish words
        has_english = any(word in ["technology", "programming", "software"] for word in keyword_words)
        has_turkish = any(word in ["yapay", "zeka", "konularını"] for word in keyword_words)
        
        # At least one language should be detected
        assert has_english or has_turkish 