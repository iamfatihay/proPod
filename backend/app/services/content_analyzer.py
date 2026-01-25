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
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
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
            
        except json.JSONDecodeError:
            # Fallback: split by commas
            logger.warning("Failed to parse JSON, using fallback keyword extraction")
            return [k.strip() for k in content.split(",")[:count]]
        except Exception as e:
            logger.error(f"Keyword extraction failed: {e}")
            return []
    
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
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
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
            
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return "Summary generation failed."
    
    async def detect_sentiment(self, text: str) -> SentimentType:
        """
        Detect sentiment of content using GPT-4.
        
        Args:
            text: Input text
            
        Returns:
            SentimentType
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
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
            
        except Exception as e:
            logger.error(f"Sentiment detection failed: {e}")
            return SentimentType.NEUTRAL
    
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
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
        try:
            categories_str = ", ".join(self.PREDEFINED_CATEGORIES)
            keywords_str = ", ".join(keywords)
            
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
            return valid_categories[:3]
            
        except json.JSONDecodeError:
            logger.warning("Failed to parse categories JSON")
            return ["Technology"]  # Default fallback
        except Exception as e:
            logger.error(f"Category suggestion failed: {e}")
            return []
    
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
        options: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult:
        """
        Perform comprehensive content analysis.
        
        Args:
            text: Transcription text
            options: Analysis options (keyword_count, summary_length, etc.)
            
        Returns:
            AnalysisResult with all analysis data
        """
        if not self.openai_client:
            raise ContentAnalysisError("OpenAI client not initialized")
        
        options = options or {}
        keyword_count = options.get("keyword_count", 10)
        summary_length = options.get("summary_length", "medium")
        
        try:
            logger.info("Starting comprehensive content analysis")
            
            # Extract keywords (most important first)
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
                    "analysis_model": settings.AI_ANALYSIS_MODEL
                }
            )
            
            logger.info(
                f"Content analysis completed: {len(keywords)} keywords, "
                f"score: {quality_score:.1f}/10"
            )
            
            return result
            
        except Exception as e:
            error_msg = f"Content analysis failed: {str(e)}"
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
