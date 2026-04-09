"""Admin panel configuration using SQLAdmin."""
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
from . import models
from .database import engine
from .auth import verify_token
import os


class AdminAuth(AuthenticationBackend):
    """
    Authentication backend for admin panel.
    Only users with ADMIN or SUPER_ADMIN role can access.
    """
    
    async def login(self, request: Request) -> bool:
        """Handle login form submission."""
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
        
        # Use your existing auth logic
        from .crud import get_user_by_email, pwd_context
        from .database import SessionLocal
        
        db = SessionLocal()
        try:
            user = get_user_by_email(db, username)
            if not user or not pwd_context.verify(password, user.hashed_password):
                return False
            
            # Check if user has admin privileges
            if user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
                return False
            
            # Store user info in session
            request.session.update({
                "user_id": user.id,
                "user_email": user.email,
                "user_role": user.role.value
            })
            return True
        finally:
            db.close()
    
    async def logout(self, request: Request) -> bool:
        """Handle logout."""
        request.session.clear()
        return True
    
    async def authenticate(self, request: Request) -> bool:
        """Check if user is authenticated."""
        user_id = request.session.get("user_id")
        user_role = request.session.get("user_role")
        
        if not user_id or not user_role:
            return False
        
        # Verify admin role
        return user_role in ["admin", "super_admin"]


# ==================== Model Views ====================

class UserAdmin(ModelView, model=models.User):
    """Admin view for User model."""
    
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"
    
    # Columns to display in list view
    column_list = [models.User.id, models.User.email, models.User.name, 
                   models.User.role, models.User.is_active, models.User.created_at]
    
    # Searchable columns
    column_searchable_list = [models.User.email, models.User.name]
    
    # Default sorting
    column_default_sort = ("created_at", True)  # True = descending
    
    # Form configuration
    form_excluded_columns = [models.User.hashed_password, models.User.reset_token, 
                             models.User.reset_token_expires]
    
    # Pagination
    page_size = 50
    page_size_options = [25, 50, 100, 200]
    
    # Read-only fields
    form_widget_args = {
        "created_at": {"readonly": True},
        "updated_at": {"readonly": True},
    }
    
    def can_delete(self) -> bool:
        """Only super admins can delete users."""
        # This would need to check the current user's role
        return True  # Simplified for now


class PodcastAdmin(ModelView, model=models.Podcast):
    """Admin view for Podcast model."""
    
    name = "Podcast"
    name_plural = "Podcasts"
    icon = "fa-solid fa-podcast"
    
    # Columns to display in list view
    column_list = [models.Podcast.id, models.Podcast.title, models.Podcast.category,
                   models.Podcast.owner_id, models.Podcast.is_public, 
                   models.Podcast.ai_enhanced, models.Podcast.is_deleted, 
                   models.Podcast.created_at]
    
    # Searchable columns
    column_searchable_list = [models.Podcast.title, models.Podcast.description]
    
    # Default sorting
    column_default_sort = ("created_at", True)
    
    # Pagination
    page_size = 50
    page_size_options = [25, 50, 100, 200]
    
    # Relationships to display
    column_details_exclude_list = [models.Podcast.description]


class PodcastStatsAdmin(ModelView, model=models.PodcastStats):
    """Admin view for Podcast Statistics."""
    
    name = "Podcast Stats"
    name_plural = "Podcast Statistics"
    icon = "fa-solid fa-chart-line"
    
    # Columns to display
    column_list = [models.PodcastStats.id, models.PodcastStats.podcast_id,
                   models.PodcastStats.play_count, models.PodcastStats.like_count,
                   models.PodcastStats.bookmark_count, models.PodcastStats.comment_count]
    
    # Sortable columns
    column_sortable_list = [models.PodcastStats.play_count, models.PodcastStats.like_count,
                           models.PodcastStats.bookmark_count]
    
    # Default sorting (most played)
    column_default_sort = ("play_count", True)
    
    # Pagination
    page_size = 50
    
    def can_create(self) -> bool:
        """Stats are auto-created, don't allow manual creation."""
        return False
    
    def can_delete(self) -> bool:
        """Don't allow deleting stats directly."""
        return False


class PodcastAIDataAdmin(ModelView, model=models.PodcastAIData):
    """Admin view for Podcast AI Data."""
    
    name = "Podcast AI Data"
    name_plural = "Podcast AI Processing"
    icon = "fa-solid fa-robot"
    
    # Columns to display
    column_list = [models.PodcastAIData.id, models.PodcastAIData.podcast_id,
                   models.PodcastAIData.processing_status, 
                   models.PodcastAIData.transcription_language,
                   models.PodcastAIData.quality_score, 
                   models.PodcastAIData.processing_date]
    
    # Searchable columns
    column_searchable_list = [models.PodcastAIData.summary]
    
    # Default sorting
    column_default_sort = ("processing_date", True)
    
    # Pagination
    page_size = 50


class PodcastLikeAdmin(ModelView, model=models.PodcastLike):
    """Admin view for Podcast Likes."""
    
    name = "Podcast Like"
    name_plural = "Podcast Likes"
    icon = "fa-solid fa-heart"
    
    column_list = [models.PodcastLike.id, models.PodcastLike.user_id,
                   models.PodcastLike.podcast_id, models.PodcastLike.created_at]
    
    column_default_sort = ("created_at", True)
    page_size = 100
    
    def can_create(self) -> bool:
        """Likes are created via API, not manually."""
        return False


class PodcastBookmarkAdmin(ModelView, model=models.PodcastBookmark):
    """Admin view for Podcast Bookmarks."""
    
    name = "Podcast Bookmark"
    name_plural = "Podcast Bookmarks"
    icon = "fa-solid fa-bookmark"
    
    column_list = [models.PodcastBookmark.id, models.PodcastBookmark.user_id,
                   models.PodcastBookmark.podcast_id, models.PodcastBookmark.created_at]
    
    column_default_sort = ("created_at", True)
    page_size = 100
    
    def can_create(self) -> bool:
        """Bookmarks are created via API, not manually."""
        return False


class ListeningHistoryAdmin(ModelView, model=models.ListeningHistory):
    """Admin view for Listening History."""
    
    name = "Listening History"
    name_plural = "Listening History"
    icon = "fa-solid fa-history"
    
    column_list = [models.ListeningHistory.id, models.ListeningHistory.user_id,
                   models.ListeningHistory.podcast_id, models.ListeningHistory.position,
                   models.ListeningHistory.completed, models.ListeningHistory.listen_time]
    
    column_default_sort = ("updated_at", True)
    page_size = 100
    
    def can_create(self) -> bool:
        """History is created via API, not manually."""
        return False


class PodcastCommentAdmin(ModelView, model=models.PodcastComment):
    """Admin view for Podcast Comments."""
    
    name = "Podcast Comment"
    name_plural = "Podcast Comments"
    icon = "fa-solid fa-comment"
    
    column_list = [models.PodcastComment.id, models.PodcastComment.user_id,
                   models.PodcastComment.podcast_id, models.PodcastComment.content,
                   models.PodcastComment.is_active, models.PodcastComment.created_at]
    
    column_searchable_list = [models.PodcastComment.content]
    column_default_sort = ("created_at", True)
    page_size = 100


class NotificationAdmin(ModelView, model=models.Notification):
    """Admin view for in-app notifications."""

    name = "Notification"
    name_plural = "Notifications"
    icon = "fa-solid fa-bell"

    column_list = [
        models.Notification.id,
        models.Notification.user_id,
        models.Notification.actor_id,
        models.Notification.podcast_id,
        models.Notification.type,
        models.Notification.title,
        models.Notification.read,
        models.Notification.created_at,
    ]

    column_searchable_list = [
        models.Notification.title,
        models.Notification.message,
    ]

    column_default_sort = ("created_at", True)
    page_size = 100

    def can_create(self) -> bool:
        return False


def setup_admin(app):
    """
    Setup admin panel for the FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    # Secret key for session management (use environment variable in production!)
    secret_key = os.getenv("ADMIN_SECRET_KEY", "your-secret-key-change-in-production")
    
    # Create admin instance with authentication
    admin = Admin(
        app=app,
        engine=engine,
        title="proPod Admin Panel",
        logo_url="/static/logo.png",  # Optional: add your logo
        authentication_backend=AdminAuth(secret_key=secret_key)
    )
    
    # Register model views
    admin.add_view(UserAdmin)
    admin.add_view(PodcastAdmin)
    admin.add_view(PodcastStatsAdmin)
    admin.add_view(PodcastAIDataAdmin)
    admin.add_view(PodcastLikeAdmin)
    admin.add_view(PodcastBookmarkAdmin)
    admin.add_view(ListeningHistoryAdmin)
    admin.add_view(PodcastCommentAdmin)
    admin.add_view(NotificationAdmin)
    
    return admin
