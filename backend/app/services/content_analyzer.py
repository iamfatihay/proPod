"""
Content Analysis Service using OpenAI GPT-4.

This module analyzes podcast transcriptions to extract:
- Keywords
- Summaries  
- Sentiment
- Categories
- Quality scores
"""

import logging
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

from openai import AsyncOpenAI, OpenAIError

from app.config import settings
from app.services.local_analyzer_service import get_local_analyzer_service


logger = logging.getLogger(__name__)


class SentimentType(str, Enum):
    """Sentiment classification types."""
    
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    MIXED = "mixed"


@dataclass
class AnalysisResult:
    """
    Result of content analysis.
    
    Attributes:
        keywords: List of extracted keywords
        summary: Content summary (3-5 sentences)
        sentiment: Detected sentiment
        categories: Suggested categories
        quality_score: Quality score (0-10)
        metadata: Additional analysis data
    """
    
    keywords: List[str]
    summary: str
    sentiment: SentimentType
    categories: List[str]
    quality_score: float
    metadata: Dict[str, Any]


class ContentAnalysisError(Exception):
    """Base exception for content analysis errors."""
    pass


class ContentAnalyzer:
    """
    Service for analyzing podcast content using GPT-4.
    
    Provides intelligent content analysis including keyword extraction,
    summarization, sentiment analysis, and quality scoring.
    
    Example:
        analyzer = ContentAnalyzer()
        result = await analyzer.analyze_content(transcription)
        print(f"Summary: {result.summary}")
        print(f"Keywords: {', '.join(result.keywords)}")
    """
    
    # Predefined podcast categories
    PREDEFINED_CATEGORIES = [
        "Technology", "Business", "Education", "Science", 
        "Health & Fitness", "News & Politics", "Comedy",
        "True Crime", "History", "Arts", "Sports",
        "Music", "Society & Culture", "Religion & Spirituality",
        "Government", "Entertainment", "Gaming", "Fashion & Beauty",
        "Finance", "Self-Improvement", "Travel", "Food"
    ]
    
    def __init__(self):
        """Initialize content analyzer with OpenAI client."""
        self.openai_client: Optional[AsyncOpenAI] = None
        
        # Initialize OpenAI client if API key is available
        if settings.OPENAI_API_KEY:
            self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info("OpenAI GPT-4 client initialized for content analysis")
        else:
            logger.warning("OpenAI API key not configured for content analysis")
    
    def _sanitize_text(self, text: str, max_length: int = 50000) -> str:
        """
        Sanitize input text for AI processing.
        
        Args:
            text: Input text to sanitize
            max_length: Maximum allowed length (~8000 words)
            
        Returns:
            Sanitized text safe for AI processing
        """
        if not text:
            return ""
        
        # Length validation
        if len(text) > max_length:
            logger.warning(f"Text truncated from {len(text)} to {max_length} chars")
            text = text[:max_length]
        
        # Remove null bytes and non-printable control characters
        # Keep printable chars and whitespace (spaces, tabs, newlines)
        text = ''.join(
            char for char in text 
            if char.isprintable() or char.isspace()
        )
        
        return text.strip()
    
    async def extract_keywords(
        self,
        text: str,
        count: int = 10
    ) -> List[str]:
        """
        Extract relevant keywords from text using GPT-4.
        
        Args:
            text: Input text
            count: Number of keywords to extract
            
        Returns:
            List of keywords
            
        Raises:
            ContentAnalysisError: If OpenAI client not initialized
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
        # Sanitize input
        text = self._sanitize_text(text, max_length=30000)
        if not text:
            logger.warning("Empty text after sanitization")
            return []
        
        try:
            prompt = f"""
            Extract the {count} most important keywords from this podcast transcription.
            Focus on main topics, concepts, and themes.
            Return only a JSON array of keywords, nothing else.
            
            Transcription:
            {text[:3000]}  # Limit to save tokens
            """
            
            response = await self.openai_client.chat.completions.create(
                model=settings.AI_ANALYSIS_MODEL,
                messages=[
                    {"role": "system", "content": "You are a keyword extraction expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=200
            )
            
            # Parse JSON response
            content = response.choices[0].message.content.strip()
            keywords = json.loads(content)
            
            logger.info(f"Extracted {len(keywords)} keywords")
            return keywords[:count]
            
        except json.JSONDecodeError as e:
            # Fallback: split by commas
            logger.warning(f"Failed to parse JSON ({e}), using fallback keyword extraction")
            # Ensure 'content' is defined before using it
            content = response.choices[0].message.content.strip() if response else ""
            if content:
                return [k.strip() for k in content.split(",")[:count]]
            return []
        except OpenAIError as e:
            logger.error(f"OpenAI API error during keyword extraction: {e}")
            raise ContentAnalysisError(f"Keyword extraction failed: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error in keyword extraction: {e}")
            raise ContentAnalysisError(f"Keyword extraction failed: {e}") from e
    
    async def generate_summary(
        self,
        text: str,
        length: str = "medium"
    ) -> str:
        """
        Generate content summary using GPT-4.
        
        Args:
            text: Input text
            length: Summary length ('short', 'medium', 'long')
            
        Returns:
            Summary text
            
        Raises:
            ContentAnalysisError: If OpenAI client not initialized or API error
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
        # Sanitize input
        text = self._sanitize_text(text, max_length=40000)
        if not text:
            logger.warning("Empty text after sanitization")
            raise ContentAnalysisError("Cannot generate summary from empty text")
        
        # Define length constraints
        length_map = {
            "short": "2-3 sentences",
            "medium": "3-5 sentences",
            "long": "5-7 sentences"
        }
        
        length_constraint = length_map.get(length, "3-5 sentences")
        
        try:
            prompt = f"""
            Summarize this podcast transcription in {length_constraint}.
            Make it engaging and highlight the main points.
            
            Transcription:
            {text[:4000]}  # Limit to save tokens
            """
            
            response = await self.openai_client.chat.completions.create(
                model=settings.AI_ANALYSIS_MODEL,
                messages=[
                    {"role": "system", "content": "You are a podcast content summarizer."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=300
            )
            
            summary = response.choices[0].message.content.strip()
            logger.info(f"Generated {length} summary ({len(summary)} chars)")
            
            return summary
            
        except OpenAIError as e:
            logger.error(f"OpenAI API error during summary generation: {e}")
            raise ContentAnalysisError(f"Summary generation failed: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error in summary generation: {e}")
            raise ContentAnalysisError(f"Summary generation failed: {e}") from e
    
    async def detect_sentiment(self, text: str) -> SentimentType:
        """
        Detect sentiment of content using GPT-4.
        
        Args:
            text: Input text
            
        Returns:
            SentimentType
            
        Raises:
            ContentAnalysisError: If OpenAI client not initialized or API error
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
        # Sanitize input
        text = self._sanitize_text(text, max_length=20000)
        if not text:
            logger.warning("Empty text after sanitization, returning neutral sentiment")
            return SentimentType.NEUTRAL
        
        try:
            prompt = f"""
            Analyze the overall sentiment of this podcast transcription.
            Respond with ONLY ONE WORD: positive, negative, neutral, or mixed.
            
            Transcription:
            {text[:2000]}  # Limit to save tokens
            """
            
            response = await self.openai_client.chat.completions.create(
                model=settings.AI_ANALYSIS_MODEL,
                messages=[
                    {"role": "system", "content": "You are a sentiment analysis expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=10
            )
            
            sentiment_str = response.choices[0].message.content.strip().lower()
            
            # Map to enum
            sentiment_map = {
                "positive": SentimentType.POSITIVE,
                "negative": SentimentType.NEGATIVE,
                "neutral": SentimentType.NEUTRAL,
                "mixed": SentimentType.MIXED
            }
            
            sentiment = sentiment_map.get(sentiment_str, SentimentType.NEUTRAL)
            logger.info(f"Detected sentiment: {sentiment.value}")
            
            return sentiment
            
        except OpenAIError as e:
            logger.error(f"OpenAI API error during sentiment detection: {e}")
            raise ContentAnalysisError(f"Sentiment detection failed: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error in sentiment detection: {e}")
            raise ContentAnalysisError(f"Sentiment detection failed: {e}") from e
    
    async def suggest_categories(
        self,
        text: str,
        keywords: List[str]
    ) -> List[str]:
        """
        Suggest relevant categories using GPT-4.
        
        Args:
            text: Input text
            keywords: Extracted keywords for context
            
        Returns:
            List of suggested categories
            
        Raises:
            ContentAnalysisError: If OpenAI client not initialized or API error
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
        # Sanitize input
        text = self._sanitize_text(text, max_length=20000)
        if not text:
            logger.warning("Empty text after sanitization, using default category")
            return ["Technology"]
        
        try:
            categories_str = ", ".join(self.PREDEFINED_CATEGORIES)
            keywords_str = ", ".join(keywords[:10])  # Limit keywords
            
            prompt = f"""
            Suggest 1-3 most relevant categories for this podcast from the list below.
            Return ONLY a JSON array of category names, nothing else.
            
            Available categories:
            {categories_str}
            
            Keywords: {keywords_str}
            
            Transcription excerpt:
            {text[:2000]}
            """
            
            response = await self.openai_client.chat.completions.create(
                model=settings.AI_ANALYSIS_MODEL,
                messages=[
                    {"role": "system", "content": "You are a podcast categorization expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=100
            )
            
            # Parse JSON response
            content = response.choices[0].message.content.strip()
            categories = json.loads(content)
            
            # Validate categories
            valid_categories = [
                cat for cat in categories 
                if cat in self.PREDEFINED_CATEGORIES
            ]
            
            logger.info(f"Suggested {len(valid_categories)} categories")
            return valid_categories[:3] if valid_categories else ["Technology"]
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse categories JSON ({e})")
            return ["Technology"]  # Default fallback
        except OpenAIError as e:
            logger.error(f"OpenAI API error during category suggestion: {e}")
            raise ContentAnalysisError(f"Category suggestion failed: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error in category suggestion: {e}")
            raise ContentAnalysisError(f"Category suggestion failed: {e}") from e
    
    async def calculate_quality_score(
        self,
        text: str,
        metadata: Dict[str, Any]
    ) -> float:
        """
        Calculate content quality score (0-10).
        
        Uses GPT-4 to evaluate:
        - Content clarity
        - Information value
        - Audio quality (from metadata)
        - Engagement level
        
        Args:
            text: Transcription text
            metadata: Additional metadata (duration, word_count, confidence, etc.)
            
        Returns:
            Quality score (0-10)
        """
        if not self.openai_client:
            # Fallback to basic scoring
            return self._calculate_basic_quality_score(text, metadata)
        
        try:
            word_count = metadata.get("word_count", 0)
            duration = metadata.get("duration", 0)
            confidence = metadata.get("confidence", 0.0)
            
            prompt = f"""
            Rate the quality of this podcast transcription on a scale of 0-10.
            Consider: clarity, information value, engagement, structure.
            
            Metadata:
            - Word count: {word_count}
            - Duration: {duration}s
            - Transcription confidence: {confidence:.2f}
            
            Transcription excerpt:
            {text[:3000]}
            
            Respond with ONLY a number between 0-10.
            """
            
            response = await self.openai_client.chat.completions.create(
                model=settings.AI_ANALYSIS_MODEL,
                messages=[
                    {"role": "system", "content": "You are a content quality evaluator."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=10
            )
            
            score_str = response.choices[0].message.content.strip()
            
            # Parse score
            try:
                score = float(score_str)
                # Clamp to 0-10 range
                score = max(0.0, min(10.0, score))
            except ValueError:
                logger.warning(f"Failed to parse quality score: {score_str}")
                score = self._calculate_basic_quality_score(text, metadata)
            
            logger.info(f"Calculated quality score: {score:.1f}/10")
            return score
            
        except Exception as e:
            logger.error(f"Quality score calculation failed: {e}")
            return self._calculate_basic_quality_score(text, metadata)
    
    def _calculate_basic_quality_score(
        self,
        text: str,
        metadata: Dict[str, Any]
    ) -> float:
        """
        Fallback quality scoring without AI.
        
        Args:
            text: Transcription text
            metadata: Metadata dict
            
        Returns:
            Quality score (0-10)
        """
        score = 5.0  # Base score
        
        # Word count factor
        word_count = metadata.get("word_count", 0)
        if word_count > 500:
            score += 1.0
        if word_count > 1000:
            score += 1.0
        
        # Confidence factor
        confidence = metadata.get("confidence", 0.0)
        score += confidence * 2.0
        
        # Duration factor
        duration = metadata.get("duration", 0)
        if duration > 300:  # > 5 minutes
            score += 1.0
        
        # Clamp to 0-10
        return max(0.0, min(10.0, score))
    
    async def analyze_content(
        self,
        text: str,
        options: Optional[Dict[str, Any]] = None,
        user_is_premium: bool = False
    ) -> AnalysisResult:
        """
        Perform comprehensive content analysis.
        
        Provider Selection Logic:
        - AI_PROVIDER="local": Always use local analyzer (FREE, basic quality)
        - AI_PROVIDER="openai": Always use GPT-4 (PAID, best quality)
        - AI_PROVIDER="hybrid": 
            - Premium users → GPT-4 (best quality)
            - Free users → Local analyzer (basic quality)
        
        Args:
            text: Transcription text
            options: Analysis options (keyword_count, summary_length, etc.)
            user_is_premium: Whether user has premium subscription
            
        Returns:
            AnalysisResult with all analysis data
        """
        options = options or {}
        keyword_count = options.get("keyword_count", 10)
        summary_length = options.get("summary_length", "medium")
        
        # Determine which provider to use
        ai_provider = settings.AI_PROVIDER
        
        # LOCAL mode: Always use local analyzer (development default)
        if ai_provider == "local":
            logger.info("🆓 Using LOCAL analyzer (FREE, basic features)")
            return await self._analyze_with_local(text, options)
        
        # OPENAI mode: Always use GPT-4
        elif ai_provider == "openai":
            logger.info("💰 Using GPT-4 analyzer (PAID, best quality)")
            if not self.openai_client:
                raise ContentAnalysisError("OpenAI API key not configured")
            return await self._analyze_with_openai(text, options)
        
        # HYBRID mode: Choose based on user subscription
        elif ai_provider == "hybrid":
            if user_is_premium:
                logger.info("⭐ Premium user → Using GPT-4 (best quality)")
                if self.openai_client:
                    try:
                        return await self._analyze_with_openai(text, options)
                    except ContentAnalysisError as e:
                        logger.warning(f"GPT-4 failed, falling back to local: {e}")
                        return await self._analyze_with_local(text, options)
                else:
                    logger.warning("OpenAI not configured, using local analyzer")
                    return await self._analyze_with_local(text, options)
            else:
                logger.info("🆓 Free user → Using LOCAL analyzer")
                return await self._analyze_with_local(text, options)
        
        # Fallback: try local first (free)
        logger.warning(f"Unknown AI_PROVIDER '{ai_provider}', using local analyzer")
        return await self._analyze_with_local(text, options)
    
    async def _analyze_with_openai(
        self,
        text: str,
        options: Dict[str, Any]
    ) -> AnalysisResult:
        """Analyze content using OpenAI GPT-4 (PAID, best quality)."""
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
        keyword_count = options.get("keyword_count", 10)
        summary_length = options.get("summary_length", "medium")
        
        try:
            logger.info("Starting GPT-4 content analysis")
            
            # Extract keywords
            keywords = await self.extract_keywords(text, keyword_count)
            
            # Generate summary
            summary = await self.generate_summary(text, summary_length)
            
            # Detect sentiment
            sentiment = await self.detect_sentiment(text)
            
            # Suggest categories
            categories = await self.suggest_categories(text, keywords)
            
            # Calculate quality score
            metadata = {
                "word_count": len(text.split()),
                "confidence": options.get("confidence", 0.95),
                "duration": options.get("duration", 0)
            }
            quality_score = await self.calculate_quality_score(text, metadata)
            
            result = AnalysisResult(
                keywords=keywords,
                summary=summary,
                sentiment=sentiment,
                categories=categories,
                quality_score=quality_score,
                metadata={
                    "text_length": len(text),
                    "word_count": metadata["word_count"],
                    "analysis_model": settings.AI_ANALYSIS_MODEL,
                    "provider_type": "openai_gpt4"
                }
            )
            
            logger.info(
                f"GPT-4 analysis completed: {len(keywords)} keywords, "
                f"score: {quality_score:.1f}/10"
            )
            
            return result
            
        except Exception as e:
            error_msg = f"GPT-4 analysis failed: {str(e)}"
            logger.error(error_msg)
            raise ContentAnalysisError(error_msg) from e
    
    async def _analyze_with_local(
        self,
        text: str,
        options: Dict[str, Any]
    ) -> AnalysisResult:
        """Analyze content using local analyzer (FREE, basic quality)."""
        try:
            local_service = get_local_analyzer_service()
            
            # Call local analyzer
            result = await local_service.analyze_content(
                text=text,
                title=options.get("title", ""),
                language=options.get("language", "en")
            )
            
            # Convert to AnalysisResult format
            return AnalysisResult(
                keywords=result["keywords"],
                summary=result["summary"],
                sentiment=SentimentType(result["sentiment"]),
                categories=result["categories"],
                quality_score=result["quality_score"],
                metadata=result["metadata"]
            )
            
        except Exception as e:
            error_msg = f"Local analysis failed: {str(e)}"
            logger.error(error_msg)
            raise ContentAnalysisError(error_msg) from e


# Singleton instance
_content_analyzer: Optional[ContentAnalyzer] = None


def get_content_analyzer() -> ContentAnalyzer:
    """
    Get singleton content analyzer instance.
    
    Returns:
        ContentAnalyzer instance
    """
    global _content_analyzer
    if _content_analyzer is None:
        _content_analyzer = ContentAnalyzer()
    return _content_analyzer
