import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
import datetime
from ..config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Email sending service with multiple providers"""
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
    
    def send_password_reset_email(self, to_email: str, reset_token: str) -> bool:
        """Send password reset email"""
        subject = "Password Reset - Volo"
        
        # Create reset link (in production, this should be your frontend URL)
        reset_link = f"http://localhost:3000/reset-password?token={reset_token}"
        
        # Email body
        body = f"""
        Hello,
        
        You requested a password reset for your Volo account.
        
        Click the link below to reset your password:
        {reset_link}
        
        This link will expire in 1 hour.
        
        If you didn't request this reset, please ignore this email.
        
        Best regards,
        Volo Team
        """
        
        return self._send_email(to_email, subject, body)
    
    def _send_email(self, to_email: str, subject: str, body: str) -> bool:
        """Internal method to send email based on environment"""
        
        if settings.ENV == "prod":
            return self._send_smtp_email(to_email, subject, body)
        else:
            return self._send_dev_email(to_email, subject, body)
    
    def _send_smtp_email(self, to_email: str, subject: str, body: str) -> bool:
        """Send email via SMTP (production)"""
        try:
            if not all([self.smtp_host, self.smtp_username, self.smtp_password, self.from_email]):
                logger.error("SMTP configuration is incomplete")
                return False
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def _send_dev_email(self, to_email: str, subject: str, body: str) -> bool:
        """Send email in development mode (console + file)"""
        try:
            # Log to console
            print("=" * 50)
            print("📧 EMAIL SENT (DEVELOPMENT MODE)")
            print("=" * 50)
            print(f"To: {to_email}")
            print(f"Subject: {subject}")
            print("-" * 30)
            print(body)
            print("=" * 50)
            
            # Also save to file for testing
            with open("dev_emails.log", "a", encoding="utf-8") as f:
                f.write(f"\n{'='*50}\n")
                f.write(f"Timestamp: {datetime.datetime.now()}\n")
                f.write(f"To: {to_email}\n")
                f.write(f"Subject: {subject}\n")
                f.write(f"Body:\n{body}\n")
                f.write(f"{'='*50}\n")
            
            logger.info(f"Development email logged for {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to log development email: {str(e)}")
            return False


# Singleton instance
email_service = EmailService() 