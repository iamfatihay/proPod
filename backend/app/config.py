from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    ENV: str = "dev"  # dev, prod
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int
    DATABASE_URL: str
    
    # Email settings for production
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), '..', '.env')

settings = Settings()
print("DEBUG SETTINGS:", settings.model_dump())
