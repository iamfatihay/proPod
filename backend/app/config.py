"""Application configuration settings."""
from pydantic_settings import BaseSettings
from pydantic import ConfigDict, Field, field_validator
import os
from typing import Literal


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment
    ENV: Literal["dev", "prod"] = Field(default="dev", description="Application environment")
    
    @field_validator('ENV')
    @classmethod
    def validate_env(cls, v):
        """Ensure ENV is either 'dev' or 'prod'."""
        if v not in ["dev", "prod"]:
            raise ValueError(f"ENV must be 'dev' or 'prod', got '{v}'")
        return v
    
    # Security
    SECRET_KEY: str = Field(..., description="Secret key for JWT token generation")
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="Access token expiration in minutes")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, description="Refresh token expiration in days")
    
    # Database
    DATABASE_URL: str = Field(..., description="Database connection URL")

    # Email settings (required for production)
    SMTP_HOST: str = Field(default="", description="SMTP server host")
    SMTP_PORT: int = Field(default=587, description="SMTP server port")
    SMTP_USERNAME: str = Field(default="", description="SMTP username")
    SMTP_PASSWORD: str = Field(default="", description="SMTP password")
    FROM_EMAIL: str = Field(default="", description="From email address")

    # API Configuration
    BASE_URL: str = Field(
        default="http://localhost:8000",
        description="Base URL for the API (used for generating links)"
    )

    model_config = ConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), '..', '.env'),
        case_sensitive=True,
        extra='ignore'
    )


# Global settings instance
settings = Settings()

# Debug output only in development
if settings.ENV == "dev":
    print(f"🚀 Running in {settings.ENV} mode")
    print(f"📊 Database: {settings.DATABASE_URL.split('://')[0]}")
    print(f"🌐 Base URL: {settings.BASE_URL}")
