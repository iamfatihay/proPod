"""Web player and podcast sharing endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app import models, crud
from app.auth import get_current_user_optional
from app.database import get_db
from app.config import settings


router = APIRouter(prefix="/share", tags=["Sharing"])


@router.get("/podcast/{podcast_id}", response_class=HTMLResponse)
async def share_podcast_web(
    podcast_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
):
    """Web player for shared podcasts with Open Graph meta tags."""
    podcast = crud.get_podcast(db, podcast_id)
    
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found",
        )
    
    # Check access permission
    if not podcast.is_public:
        if not current_user or podcast.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This podcast is private",
            )
    
    # Get owner info
    owner = db.query(models.User).filter(models.User.id == podcast.owner_id).first()
    owner_name = owner.name if owner else "Unknown"
    
    # Construct full audio URL
    audio_url = podcast.audio_url
    if not audio_url.startswith("http"):
        base_url = settings.BASE_URL or str(request.base_url).rstrip("/")
        audio_url = f"{base_url}{audio_url}"
    
    # Build web player HTML
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{podcast.title} - Volo</title>
        
        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="music.song">
        <meta property="og:url" content="{request.url}">
        <meta property="og:title" content="{podcast.title}">
        <meta property="og:description" content="{podcast.description or 'Listen to this podcast on Volo'}">
        <meta property="og:image" content="{podcast.cover_image_url or f'{settings.BASE_URL}/static/og-image.png'}">
        <meta property="og:audio" content="{audio_url}">
        
        <!-- Twitter -->
        <meta name="twitter:card" content="player">
        <meta name="twitter:url" content="{request.url}">
        <meta name="twitter:title" content="{podcast.title}">
        <meta name="twitter:description" content="{podcast.description or 'Listen to this podcast on Volo'}">
        <meta name="twitter:image" content="{podcast.cover_image_url or f'{settings.BASE_URL}/static/og-image.png'}">
        <meta name="twitter:player" content="{request.url}">
        <meta name="twitter:player:width" content="480">
        <meta name="twitter:player:height" content="240">
        
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .player-container {{
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 600px;
                width: 100%;
                padding: 40px;
            }}
            .cover-image {{
                width: 100%;
                aspect-ratio: 1;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                margin-bottom: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 48px;
            }}
            h1 {{
                font-size: 24px;
                margin-bottom: 8px;
                color: #1a202c;
            }}
            .metadata {{
                color: #718096;
                margin-bottom: 24px;
                font-size: 14px;
            }}
            .metadata span {{
                margin-right: 16px;
            }}
            audio {{
                width: 100%;
                margin-bottom: 24px;
                border-radius: 8px;
            }}
            .cta {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 32px;
                border-radius: 12px;
                text-align: center;
                text-decoration: none;
                display: block;
                font-weight: 600;
                margin-bottom: 16px;
                transition: transform 0.2s;
            }}
            .cta:hover {{
                transform: translateY(-2px);
            }}
            .description {{
                color: #4a5568;
                line-height: 1.6;
                margin-bottom: 24px;
            }}
        </style>
    </head>
    <body>
        <div class="player-container">
            <div class="cover-image">🎙️</div>
            <h1>{podcast.title}</h1>
            <div class="metadata">
                <span>👤 {owner_name}</span>
                <span>📁 {podcast.category}</span>
                <span>⏱️ {podcast.duration // 60} min</span>
            </div>
            <audio controls preload="metadata" src="{audio_url}">
                Your browser does not support the audio element.
            </audio>
            {f'<p class="description">{podcast.description}</p>' if podcast.description else ''}
            <a href="#" class="cta" onclick="alert('Deep linking coming soon! Install Volo app to listen.'); return false;">
                🎧 Open in Volo App
            </a>
            <a href="#" class="cta" style="background: #4a5568;" onclick="alert('App download page coming soon!'); return false;">
                📱 Download Volo
            </a>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)


@router.get("/live/{invite_code}", response_class=HTMLResponse)
async def share_live_session_web(
    invite_code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Web page for joining live session (redirects to app)."""
    session = db.query(models.RTCSession).filter(
        models.RTCSession.invite_code == invite_code
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    # Get owner info
    owner = db.query(models.User).filter(models.User.id == session.owner_id).first()
    owner_name = owner.name if owner else "Unknown"
    
    status_text = "🔴 LIVE NOW" if session.is_live else "📝 Scheduled"
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Join {session.title} - Volo Live</title>
        
        <!-- Open Graph -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="{request.url}">
        <meta property="og:title" content="{session.title} - Live on Volo">
        <meta property="og:description" content="Join this live podcast session">
        
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #1a202c;
                color: white;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .container {{
                text-align: center;
                max-width: 500px;
            }}
            .status {{
                display: inline-block;
                background: #ef4444;
                padding: 8px 16px;
                border-radius: 20px;
                margin-bottom: 24px;
                animation: pulse 2s infinite;
            }}
            @keyframes pulse {{
                0%, 100% {{ opacity: 1; }}
                50% {{ opacity: 0.7; }}
            }}
            h1 {{
                font-size: 32px;
                margin-bottom: 16px;
            }}
            .metadata {{
                color: #a0aec0;
                margin-bottom: 32px;
            }}
            .cta {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px 40px;
                border-radius: 12px;
                text-decoration: none;
                display: inline-block;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
            }}
        </style>
        
        <!-- TODO: Enable deep link redirect when volo:// scheme handling is implemented -->
    </head>
    <body>
        <div class="container">
            <div class="status">{status_text}</div>
            <h1>{session.title}</h1>
            <div class="metadata">
                <p>Hosted by {owner_name}</p>
                <p>{session.participant_count} speakers • {session.viewer_count} viewers</p>
            </div>
            <a href="#" class="cta" onclick="alert('Live session joining coming soon!'); return false;">
                🎙️ Join Live Session
            </a>
            <p style="color: #a0aec0; margin-top: 24px;">
                Don't have Volo? <span style="color: #667eea; cursor: pointer;" onclick="alert('App download page coming soon!');">Download now</span>
            </p>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)
