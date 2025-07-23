from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import tempfile
import os
import aiofiles
from pathlib import Path

from .. import schemas, crud, models, auth
from ..database import SessionLocal
from ..services.ai_service import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/status")
async def get_ai_status():
    """Get AI services status"""
    try:
        status = ai_service.get_service_status()
        return JSONResponse(content=status)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI status: {str(e)}"
        )

@router.post("/initialize")
async def initialize_ai_services(
    current_user: models.User = Depends(auth.get_current_user)
):
    """Initialize AI services (admin only for now)"""
    try:
        success = await ai_service.initialize()
        if success:
            return {"message": "AI services initialized successfully", "success": True}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize AI services"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI initialization failed: {str(e)}"
        )

@router.post("/process-audio")
async def process_audio(
    file: UploadFile = File(...),
    enhance_audio: bool = Form(True),
    transcribe: bool = Form(True),
    analyze_content: bool = Form(True),
    language: Optional[str] = Form("auto"),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Process uploaded audio file with AI enhancement
    """
    try:
        # Validate file type
        allowed_types = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/m4a", "audio/ogg"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file.content_type}"
            )
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            # Save uploaded file
            content = await file.read()
            await aiofiles.open(temp_file.name, 'wb').write(content)
            temp_path = temp_file.name
        
        try:
            # Prepare processing options
            options = {
                "enhance_audio": enhance_audio,
                "transcribe": transcribe,
                "analyze_content": analyze_content,
                "audio_options": {
                    "noise_reduction": True,
                    "normalize": True,
                    "compress": True,
                    "quality": "high"
                },
                "transcription_options": {
                    "language": language if language != "auto" else None,
                    "include_timestamps": True,
                    "include_word_timestamps": False
                },
                "analysis_options": {
                    "extract_keywords": True,
                    "suggest_categories": True,
                    "generate_summary": True,
                    "analyze_sentiment": True
                }
            }
            
            # Process audio
            results = await ai_service.process_podcast_audio(temp_path, options)
            
            # Clean up temporary file
            os.unlink(temp_path)
            
            # Remove file paths from response for security
            if "processed_file" in results:
                del results["processed_file"]
            if "original_file" in results:
                del results["original_file"]
            
            return JSONResponse(content=results)
            
        except Exception as e:
            # Clean up on error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise e
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio processing failed: {str(e)}"
        )

@router.post("/enhance-audio")
async def enhance_audio_only(
    file: UploadFile = File(...),
    noise_reduction: bool = Form(True),
    normalize: bool = Form(True),
    compress: bool = Form(True),
    target_format: str = Form("mp3"),
    quality: str = Form("high"),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Enhance audio quality only (no transcription)
    """
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            content = await file.read()
            await aiofiles.open(temp_file.name, 'wb').write(content)
            temp_path = temp_file.name
        
        try:
            options = {
                "noise_reduction": noise_reduction,
                "normalize": normalize,
                "compress": compress,
                "target_format": target_format,
                "quality": quality
            }
            
            results = await ai_service.enhance_audio_only(temp_path, options)
            
            # Clean up
            os.unlink(temp_path)
            
            # Remove file paths
            if "output_file" in results:
                del results["output_file"]
            
            return JSONResponse(content=results)
            
        except Exception as e:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise e
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio enhancement failed: {str(e)}"
        )

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form("auto"),
    include_timestamps: bool = Form(True),
    include_word_timestamps: bool = Form(False),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Transcribe audio to text
    """
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            content = await file.read()
            await aiofiles.open(temp_file.name, 'wb').write(content)
            temp_path = temp_file.name
        
        try:
            options = {
                "language": language if language != "auto" else None,
                "include_timestamps": include_timestamps,
                "include_word_timestamps": include_word_timestamps
            }
            
            results = await ai_service.transcribe_only(temp_path, options)
            
            # Clean up
            os.unlink(temp_path)
            
            return JSONResponse(content=results)
            
        except Exception as e:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise e
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )

@router.post("/analyze-text")
async def analyze_text_content(
    text: str = Form(...),
    extract_keywords: bool = Form(True),
    suggest_categories: bool = Form(True),
    generate_summary: bool = Form(True),
    analyze_sentiment: bool = Form(True),
    keyword_count: int = Form(10),
    summary_sentences: int = Form(3),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Analyze text content for keywords, categories, etc.
    """
    try:
        if not text or not text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text cannot be empty"
            )
        
        options = {
            "extract_keywords": extract_keywords,
            "suggest_categories": suggest_categories,
            "generate_summary": generate_summary,
            "analyze_sentiment": analyze_sentiment,
            "keyword_count": keyword_count,
            "summary_sentences": summary_sentences
        }
        
        results = await ai_service.analyze_text_only(text, options)
        
        return JSONResponse(content=results)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text analysis failed: {str(e)}"
        )

@router.get("/supported-languages")
async def get_supported_languages():
    """Get list of supported languages for transcription"""
    try:
        if not ai_service.is_initialized:
            await ai_service.initialize()
        
        languages = await ai_service.transcription_service.get_supported_languages()
        return JSONResponse(content={"languages": languages})
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get supported languages: {str(e)}"
        )

@router.post("/detect-language")
async def detect_audio_language(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Detect language of audio file
    """
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            content = await file.read()
            await aiofiles.open(temp_file.name, 'wb').write(content)
            temp_path = temp_file.name
        
        try:
            if not ai_service.is_initialized:
                await ai_service.initialize()
            
            results = await ai_service.transcription_service.detect_language(temp_path)
            
            # Clean up
            os.unlink(temp_path)
            
            return JSONResponse(content=results)
            
        except Exception as e:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise e
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Language detection failed: {str(e)}"
        )

@router.post("/generate-subtitles")
async def generate_subtitles(
    transcription_data: dict,
    format_type: str = Form("srt"),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Generate subtitle file from transcription data
    """
    try:
        if not ai_service.is_initialized:
            await ai_service.initialize()
        
        subtitle_content = await ai_service.transcription_service.generate_subtitles(
            transcription_data, 
            format_type
        )
        
        return JSONResponse(content={
            "success": True,
            "format": format_type,
            "content": subtitle_content
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Subtitle generation failed: {str(e)}"
        ) 