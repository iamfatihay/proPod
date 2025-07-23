import os
import asyncio
import logging
import re
import string
from typing import Optional, Dict, Any, List, Tuple
from collections import Counter
import math

logger = logging.getLogger(__name__)

class ContentAnalyzer:
    """
    Content analysis service for podcast transcriptions.
    Provides category suggestions, keyword extraction, summaries, and sentiment analysis.
    """
    
    def __init__(self):
        self.is_initialized = False
        self.stop_words = self._get_stop_words()
        self.categories = self._get_predefined_categories()
        self.category_keywords = self._get_category_keywords()
        
    async def initialize(self) -> bool:
        """Initialize content analyzer"""
        try:
            logger.info("Content analyzer initialized successfully")
            self.is_initialized = True
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize content analyzer: {e}")
            return False
    
    async def analyze_content(
        self, 
        text: str, 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform complete content analysis on text
        
        Args:
            text: Input text to analyze
            options: Analysis options
            
        Returns:
            Dictionary with analysis results
        """
        if not self.is_initialized:
            await self.initialize()
            
        # Default options
        default_options = {
            "extract_keywords": True,
            "suggest_categories": True,
            "generate_summary": True,
            "analyze_sentiment": True,
            "keyword_count": 10,
            "summary_sentences": 3
        }
        
        if options:
            default_options.update(options)
        options = default_options
        
        results = {
            "success": False,
            "text_stats": {},
            "keywords": [],
            "categories": [],
            "summary": "",
            "sentiment": {},
            "topics": [],
            "readability": {},
            "errors": []
        }
        
        try:
            if not text or not text.strip():
                raise ValueError("Text is empty or invalid")
            
            logger.info(f"Starting content analysis for text length: {len(text)}")
            
            # Basic text statistics
            results["text_stats"] = await self._calculate_text_stats(text)
            
            # Keyword extraction
            if options["extract_keywords"]:
                results["keywords"] = await self._extract_keywords(
                    text, 
                    options["keyword_count"]
                )
            
            # Category suggestion
            if options["suggest_categories"]:
                results["categories"] = await self._suggest_categories(text)
            
            # Summary generation
            if options["generate_summary"]:
                results["summary"] = await self._generate_summary(
                    text, 
                    options["summary_sentences"]
                )
            
            # Sentiment analysis
            if options["analyze_sentiment"]:
                results["sentiment"] = await self._analyze_sentiment(text)
            
            # Topic modeling (simple)
            results["topics"] = await self._extract_topics(text)
            
            # Readability analysis
            results["readability"] = await self._analyze_readability(text)
            
            results["success"] = True
            logger.info("Content analysis completed successfully")
            
        except Exception as e:
            logger.error(f"Content analysis failed: {e}")
            results["errors"].append(str(e))
            
        return results
    
    async def _calculate_text_stats(self, text: str) -> Dict[str, Any]:
        """Calculate basic text statistics"""
        sentences = self._split_sentences(text)
        words = self._extract_words(text)
        
        # Character stats
        char_count = len(text)
        char_count_no_spaces = len(text.replace(' ', ''))
        
        # Word stats
        word_count = len(words)
        unique_words = len(set(word.lower() for word in words))
        avg_word_length = sum(len(word) for word in words) / max(word_count, 1)
        
        # Sentence stats
        sentence_count = len(sentences)
        avg_sentence_length = word_count / max(sentence_count, 1)
        
        # Reading time estimation (average 200 WPM)
        reading_time_minutes = word_count / 200
        
        return {
            "character_count": char_count,
            "character_count_no_spaces": char_count_no_spaces,
            "word_count": word_count,
            "unique_words": unique_words,
            "sentence_count": sentence_count,
            "paragraph_count": len([p for p in text.split('\n\n') if p.strip()]),
            "avg_word_length": round(avg_word_length, 2),
            "avg_sentence_length": round(avg_sentence_length, 2),
            "lexical_diversity": round(unique_words / max(word_count, 1), 4),
            "reading_time_minutes": round(reading_time_minutes, 1)
        }
    
    async def _extract_keywords(self, text: str, count: int) -> List[Dict[str, Any]]:
        """Extract keywords using TF-IDF-like scoring"""
        words = self._extract_words(text.lower())
        
        # Filter out stop words and short words
        filtered_words = [
            word for word in words 
            if word not in self.stop_words and len(word) > 2
        ]
        
        if not filtered_words:
            return []
        
        # Calculate word frequencies
        word_freq = Counter(filtered_words)
        total_words = len(filtered_words)
        
        # Calculate TF-IDF-like scores
        keywords_with_scores = []
        for word, freq in word_freq.most_common():
            tf = freq / total_words
            # Simple IDF approximation (real IDF would need document corpus)
            idf = math.log(total_words / freq)
            score = tf * idf
            
            keywords_with_scores.append({
                "word": word,
                "frequency": freq,
                "tf_score": round(tf, 6),
                "score": round(score, 6)
            })
        
        # Sort by score and return top keywords
        keywords_with_scores.sort(key=lambda x: x["score"], reverse=True)
        return keywords_with_scores[:count]
    
    async def _suggest_categories(self, text: str) -> List[Dict[str, Any]]:
        """Suggest categories based on keyword matching"""
        text_lower = text.lower()
        words = set(self._extract_words(text_lower))
        
        category_scores = {}
        
        for category, keywords in self.category_keywords.items():
            score = 0
            matched_keywords = []
            
            for keyword in keywords:
                if keyword in text_lower:
                    # Exact phrase match gets higher score
                    score += 2
                    matched_keywords.append(keyword)
                elif keyword in words:
                    # Word match gets normal score
                    score += 1
                    matched_keywords.append(keyword)
            
            if score > 0:
                category_scores[category] = {
                    "category": category,
                    "score": score,
                    "confidence": min(score / 10, 1.0),  # Normalize to 0-1
                    "matched_keywords": matched_keywords
                }
        
        # Sort by score and return top categories
        suggested_categories = list(category_scores.values())
        suggested_categories.sort(key=lambda x: x["score"], reverse=True)
        
        return suggested_categories[:5]  # Return top 5 categories
    
    async def _generate_summary(self, text: str, sentence_count: int) -> str:
        """Generate extractive summary by selecting top sentences"""
        sentences = self._split_sentences(text)
        
        if len(sentences) <= sentence_count:
            return text.strip()
        
        # Score sentences based on keyword density
        keywords = await self._extract_keywords(text, 20)
        keyword_set = {kw["word"] for kw in keywords}
        
        sentence_scores = []
        for i, sentence in enumerate(sentences):
            sentence_words = set(self._extract_words(sentence.lower()))
            keyword_overlap = len(sentence_words.intersection(keyword_set))
            word_count = len(sentence_words)
            
            # Score based on keyword density and position (earlier = better)
            score = keyword_overlap / max(word_count, 1)
            position_bonus = 1.0 / (i + 1)  # Earlier sentences get bonus
            final_score = score + (position_bonus * 0.1)
            
            sentence_scores.append((sentence, final_score))
        
        # Select top sentences
        sentence_scores.sort(key=lambda x: x[1], reverse=True)
        top_sentences = [sent[0] for sent in sentence_scores[:sentence_count]]
        
        # Reorder sentences by original position
        summary_sentences = []
        for sentence in sentences:
            if sentence in top_sentences:
                summary_sentences.append(sentence)
        
        return " ".join(summary_sentences).strip()
    
    async def _analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Simple rule-based sentiment analysis"""
        # Define sentiment word lists (simplified)
        positive_words = {
            'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
            'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied', 'awesome',
            'brilliant', 'perfect', 'beautiful', 'incredible', 'outstanding'
        }
        
        negative_words = {
            'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry',
            'sad', 'disappointed', 'frustrated', 'annoying', 'wrong', 'problem',
            'issue', 'difficult', 'hard', 'impossible', 'fail', 'failure'
        }
        
        words = self._extract_words(text.lower())
        
        positive_count = sum(1 for word in words if word in positive_words)
        negative_count = sum(1 for word in words if word in negative_words)
        neutral_count = len(words) - positive_count - negative_count
        
        total_sentiment_words = positive_count + negative_count
        
        if total_sentiment_words == 0:
            sentiment_label = "neutral"
            confidence = 0.5
        else:
            sentiment_ratio = (positive_count - negative_count) / total_sentiment_words
            
            if sentiment_ratio > 0.1:
                sentiment_label = "positive"
                confidence = min(0.5 + sentiment_ratio, 1.0)
            elif sentiment_ratio < -0.1:
                sentiment_label = "negative"
                confidence = min(0.5 + abs(sentiment_ratio), 1.0)
            else:
                sentiment_label = "neutral"
                confidence = 0.5
        
        return {
            "label": sentiment_label,
            "confidence": round(confidence, 3),
            "scores": {
                "positive": round(positive_count / max(len(words), 1), 4),
                "negative": round(negative_count / max(len(words), 1), 4),
                "neutral": round(neutral_count / max(len(words), 1), 4)
            },
            "word_counts": {
                "positive": positive_count,
                "negative": negative_count,
                "neutral": neutral_count
            }
        }
    
    async def _extract_topics(self, text: str) -> List[Dict[str, Any]]:
        """Simple topic extraction based on keyword clustering"""
        keywords = await self._extract_keywords(text, 15)
        
        if not keywords:
            return []
        
        # Group keywords into topics (simplified approach)
        # In a real implementation, you'd use more sophisticated clustering
        topics = []
        
        # Technology topic
        tech_words = [kw for kw in keywords if any(tech in kw["word"] for tech in 
                     ['tech', 'digital', 'computer', 'software', 'app', 'web', 'data'])]
        if tech_words:
            topics.append({
                "topic": "Technology",
                "keywords": [kw["word"] for kw in tech_words[:5]],
                "relevance": sum(kw["score"] for kw in tech_words) / len(tech_words)
            })
        
        # Business topic
        business_words = [kw for kw in keywords if any(biz in kw["word"] for biz in 
                         ['business', 'market', 'company', 'money', 'profit', 'sales'])]
        if business_words:
            topics.append({
                "topic": "Business",
                "keywords": [kw["word"] for kw in business_words[:5]],
                "relevance": sum(kw["score"] for kw in business_words) / len(business_words)
            })
        
        # If no specific topics found, create a general topic
        if not topics:
            top_keywords = keywords[:5]
            topics.append({
                "topic": "General",
                "keywords": [kw["word"] for kw in top_keywords],
                "relevance": sum(kw["score"] for kw in top_keywords) / len(top_keywords)
            })
        
        return topics
    
    async def _analyze_readability(self, text: str) -> Dict[str, Any]:
        """Simple readability analysis"""
        sentences = self._split_sentences(text)
        words = self._extract_words(text)
        
        if not sentences or not words:
            return {"score": 0, "level": "unknown"}
        
        avg_sentence_length = len(words) / len(sentences)
        avg_word_length = sum(len(word) for word in words) / len(words)
        
        # Simple readability score (0-100, higher = easier)
        # Based on simplified Flesch formula
        score = 206.835 - (1.015 * avg_sentence_length) - (84.6 * (avg_word_length / 100))
        score = max(0, min(100, score))
        
        # Determine reading level
        if score >= 90:
            level = "very_easy"
        elif score >= 80:
            level = "easy"
        elif score >= 70:
            level = "fairly_easy"
        elif score >= 60:
            level = "standard"
        elif score >= 50:
            level = "fairly_difficult"
        elif score >= 30:
            level = "difficult"
        else:
            level = "very_difficult"
        
        return {
            "score": round(score, 1),
            "level": level,
            "avg_sentence_length": round(avg_sentence_length, 1),
            "avg_word_length": round(avg_word_length, 2)
        }
    
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Simple sentence splitting
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _extract_words(self, text: str) -> List[str]:
        """Extract words from text"""
        # Remove punctuation and split
        translator = str.maketrans('', '', string.punctuation)
        text = text.translate(translator)
        words = text.split()
        return [word for word in words if word.strip()]
    
    def _get_stop_words(self) -> set:
        """Get stop words for Turkish and English"""
        stop_words = {
            # English stop words
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i',
            'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
            
            # Turkish stop words
            'bir', 'bu', 'şu', 've', 'veya', 'ya', 'da', 'de', 'den', 'dan', 'ile',
            'için', 'gibi', 'kadar', 'daha', 'en', 'çok', 'az', 'var', 'yok', 'olan',
            'oldu', 'olur', 'olarak', 'ben', 'sen', 'o', 'biz', 'siz', 'onlar'
        }
        return stop_words
    
    def _get_predefined_categories(self) -> List[str]:
        """Get predefined podcast categories"""
        return [
            "Technology", "Business", "Science", "Health", "Education", "Entertainment",
            "News", "Sports", "Music", "Arts", "History", "Politics", "Travel",
            "Food", "Lifestyle", "Self-Help", "Comedy", "True Crime", "Documentary"
        ]
    
    def _get_category_keywords(self) -> Dict[str, List[str]]:
        """Get keywords for each category"""
        return {
            "Technology": [
                "teknoloji", "bilgisayar", "yazılım", "uygulama", "internet", "dijital",
                "ai", "yapay zeka", "robot", "veri", "algorithm", "programming", "code"
            ],
            "Business": [
                "iş", "şirket", "pazarlama", "satış", "para", "ekonomi", "girişim",
                "startup", "yatırım", "finans", "business", "marketing", "profit"
            ],
            "Science": [
                "bilim", "araştırma", "deney", "fizik", "kimya", "biyoloji", "matematik",
                "science", "research", "study", "discovery", "theory"
            ],
            "Health": [
                "sağlık", "doktor", "hastalık", "tedavi", "tıp", "egzersiz", "beslenme",
                "health", "medical", "fitness", "nutrition", "wellness"
            ],
            "Education": [
                "eğitim", "öğrenme", "ders", "öğretmen", "okul", "üniversite", "kurs",
                "education", "learning", "teaching", "student", "knowledge"
            ],
            "Entertainment": [
                "eğlence", "film", "dizi", "oyun", "müzik", "sanat", "kültür",
                "entertainment", "movie", "game", "show", "fun"
            ],
            "Sports": [
                "spor", "futbol", "basketbol", "voleybol", "tenis", "yüzme", "koşu",
                "sports", "football", "basketball", "tennis", "running", "fitness"
            ],
            "News": [
                "haber", "gündem", "politika", "dünya", "ülke", "olay", "gelişme",
                "news", "politics", "world", "current", "events", "breaking"
            ]
        }
    
    def get_status(self) -> Dict[str, Any]:
        """Get content analyzer status"""
        return {
            "is_initialized": self.is_initialized,
            "categories_count": len(self.categories),
            "stop_words_count": len(self.stop_words),
            "supported_features": [
                "keyword_extraction", "category_suggestion", "summary_generation",
                "sentiment_analysis", "topic_modeling", "readability_analysis"
            ]
        } 