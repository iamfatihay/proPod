"""
Local Content Analysis Service.

This module provides FREE content analysis using open-source models.
No API keys or costs required - runs entirely on your machine.

Note: For production quality, OpenAI GPT-4 is recommended for premium users.
"""

import logging
from typing import List, Dict, Any, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class LocalAnalyzerService:
    """
    Local content analyzer using simple heuristics and free models.
    
    For development/free tier:
    - Keyword extraction: TF-IDF or simple word frequency
    - Summary: First few sentences
    - Sentiment: Simple rule-based
    - Categories: Keyword matching
    - Quality: Basic heuristics
    
    Advantages:
    - 100% FREE
    - No API costs
    - Fast processing
    
    Limitations:
    - Lower quality than GPT-4
    - Basic summarization
    - Simple keyword extraction
    
    For production/premium users, use OpenAI GPT-4 for better results.
    """
    
    def __init__(self):
        """Initialize local analyzer."""
        logger.info("🆓 Local Analyzer initialized (FREE, basic features)")
    
    async def analyze_content(
        self,
        text: str,
        title: str = "",
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Analyze content using local/free methods.
        
        Args:
            text: Transcription text to analyze
            title: Optional podcast title
            language: Language code
        
        Returns:
            Dict with analysis results:
            {
                "keywords": ["keyword1", "keyword2", ...],
                "summary": "Brief summary...",
                "sentiment": "positive",
                "categories": ["Technology"],
                "quality_score": 7.5,
                "metadata": {...}
            }
        """
        logger.info(f"🔍 Analyzing content ({len(text)} chars)")
        
        # Extract keywords (simple frequency-based)
        keywords = self._extract_keywords(text)
        
        # Generate summary (first 3 sentences)
        summary = self._generate_summary(text)
        
        # Detect sentiment (rule-based)
        sentiment = self._detect_sentiment(text)
        
        # Suggest categories (keyword matching)
        categories = self._suggest_categories(text, title)
        
        # Calculate quality score
        quality_score = self._calculate_quality(text, keywords)
        
        return {
            "keywords": keywords,
            "summary": summary,
            "sentiment": sentiment,
            "categories": categories,
            "quality_score": quality_score,
            "metadata": {
                "analyzer": "local_free",
                "word_count": len(text.split()),
                "character_count": len(text),
                "note": "Using free local analysis. For better quality, upgrade to premium."
            }
        }
    
    def _extract_keywords(self, text: str, max_keywords: int = 10) -> List[str]:
        """
        Extract keywords using simple frequency analysis.
        
        TODO: Can be enhanced with TF-IDF or KeyBERT (still free).
        """
        # Simple approach: find most common words (excluding common words)
        stop_words = {
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 
            'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'that',
            'this', 'it', 'from', 'be', 'are', 'was', 'were', 'been',
            've', 's', 't', 're', 'll', 'd', 'm'
        }
        
        words = text.lower().split()
        word_freq = {}
        
        for word in words:
            # Clean word
            word = ''.join(c for c in word if c.isalnum())
            
            # Skip if too short, is number, or is stop word
            if len(word) < 4 or word.isnumeric() or word in stop_words:
                continue
            
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # Get top words
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        keywords = [word for word, freq in sorted_words[:max_keywords]]
        
        logger.info(f"✅ Extracted {len(keywords)} keywords")
        return keywords
    
    def _generate_summary(self, text: str, max_sentences: int = 3) -> str:
        """
        Generate summary by taking first few sentences.
        
        TODO: Can be enhanced with extractive summarization (still free).
        """
        # Split into sentences (simple approach)
        sentences = []
        current = ""
        
        for char in text:
            current += char
            if char in '.!?' and len(current.strip()) > 20:
                sentences.append(current.strip())
                current = ""
                if len(sentences) >= max_sentences:
                    break
        
        summary = " ".join(sentences[:max_sentences])
        
        if not summary:
            # Fallback: take first 200 characters
            summary = text[:200] + "..."
        
        logger.info(f"✅ Generated summary ({len(summary)} chars)")
        return summary
    
    def _detect_sentiment(self, text: str) -> str:
        """
        Detect sentiment using simple rule-based approach.
        
        TODO: Can be enhanced with transformers sentiment model (still free).
        """
        text_lower = text.lower()
        
        # Simple positive/negative word counting
        positive_words = [
            'good', 'great', 'excellent', 'amazing', 'wonderful', 'best',
            'love', 'enjoy', 'happy', 'fantastic', 'awesome', 'perfect'
        ]
        negative_words = [
            'bad', 'terrible', 'worst', 'awful', 'hate', 'poor',
            'disappointing', 'wrong', 'problem', 'issue', 'difficult'
        ]
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count + 2:
            return "positive"
        elif negative_count > positive_count + 2:
            return "negative"
        elif positive_count > 0 and negative_count > 0:
            return "mixed"
        else:
            return "neutral"
    
    def _suggest_categories(self, text: str, title: str = "") -> List[str]:
        """
        Suggest categories based on keyword matching.
        """
        text_lower = (text + " " + title).lower()
        
        category_keywords = {
            "Technology": ['tech', 'software', 'computer', 'ai', 'programming', 'code', 'app', 'digital'],
            "Business": ['business', 'startup', 'company', 'market', 'sales', 'entrepreneur', 'revenue'],
            "Education": ['education', 'learning', 'teach', 'study', 'school', 'university', 'course'],
            "Science": ['science', 'research', 'study', 'experiment', 'data', 'analysis', 'theory'],
            "Health & Fitness": ['health', 'fitness', 'exercise', 'nutrition', 'wellness', 'medical'],
            "News & Politics": ['news', 'politics', 'government', 'election', 'policy', 'president'],
            "Comedy": ['comedy', 'funny', 'joke', 'humor', 'laugh', 'entertainment'],
            "History": ['history', 'historical', 'past', 'ancient', 'war', 'civilization'],
            "Arts": ['art', 'music', 'film', 'movie', 'creative', 'design', 'culture'],
            "Sports": ['sport', 'game', 'team', 'player', 'football', 'basketball', 'soccer']
        }
        
        matched_categories = []
        
        for category, keywords in category_keywords.items():
            matches = sum(1 for keyword in keywords if keyword in text_lower)
            if matches >= 2:  # At least 2 keyword matches
                matched_categories.append(category)
        
        # Default to General if no matches
        if not matched_categories:
            matched_categories = ["General"]
        
        logger.info(f"✅ Suggested categories: {matched_categories}")
        return matched_categories[:3]  # Max 3 categories
    
    def _calculate_quality(self, text: str, keywords: List[str]) -> float:
        """
        Calculate basic quality score (0-10).
        
        Factors:
        - Text length
        - Keyword diversity
        - Sentence structure
        """
        word_count = len(text.split())
        
        # Base score from word count
        if word_count < 100:
            length_score = 3.0
        elif word_count < 500:
            length_score = 5.0
        elif word_count < 2000:
            length_score = 7.0
        else:
            length_score = 8.0
        
        # Keyword diversity bonus
        keyword_score = min(len(keywords) * 0.2, 2.0)
        
        # Final score
        quality = min(length_score + keyword_score, 10.0)
        
        logger.info(f"✅ Quality score: {quality:.1f}/10")
        return round(quality, 1)


# Singleton instance
_local_analyzer_service: Optional[LocalAnalyzerService] = None


def get_local_analyzer_service() -> LocalAnalyzerService:
    """Get or create singleton LocalAnalyzerService instance."""
    global _local_analyzer_service
    
    if _local_analyzer_service is None:
        _local_analyzer_service = LocalAnalyzerService()
    
    return _local_analyzer_service
