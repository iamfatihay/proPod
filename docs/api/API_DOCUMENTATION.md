# ProPod API Documentation

## Overview

The ProPod API provides comprehensive endpoints for podcast management, user interactions, and content discovery. All endpoints use JSON for request/response bodies and JWT tokens for authentication.

## Base URL

```
http://YOUR_BACKEND_IP:8000
```

> **Important:** Replace `YOUR_BACKEND_IP` with your actual backend server address:
> - Local development: `localhost` or `127.0.0.1`
> - LAN testing (mobile): Your computer's local IP (e.g., `192.168.1.100`)
> - Production: Your production domain or IP

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Admin Access and Database Inspection

- SQLAdmin UI is available at `/admin` when the backend is running.
- Login requires a normal user email/password backed by an account with `admin` or `super_admin` role.
- Use the SQLAdmin UI for application records and model-level inspection.
- Use pgAdmin, DBeaver, or `psql` for raw PostgreSQL schema access, ad-hoc SQL, and broader database administration.

## Error Responses

All endpoints return consistent error responses:

```json
{
    "detail": "Error message description"
}
```

Common HTTP status codes:

-   `200` - Success
-   `201` - Created
-   `400` - Bad Request
-   `401` - Unauthorized
-   `403` - Forbidden
-   `404` - Not Found
-   `422` - Validation Error

---

## Podcast Management

### Upload Audio File

**POST** `/podcasts/upload`

Upload a podcast audio file and get its public URL.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**

```
file: [audio file] (required) - Audio file (mp3, m4a, wav, aac, ogg)
```

**Response:** `200 OK`

```json
{
    "audio_url": "/media/audio/podcast_123_1642248000000.mp3",
    "file_size": 5242880,
    "content_type": "audio/mpeg",
    "filename": "podcast_123_1642248000000.mp3"
}
```

### Create Podcast

**POST** `/podcasts/create`

Create a new podcast episode.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
    "title": "My Awesome Podcast",
    "description": "This is a great podcast about technology",
    "category": "Tech",
    "is_public": true,
    "duration": 1800
}
```

**Response:** `201 Created`

```json
{
    "id": 1,
    "title": "My Awesome Podcast",
    "description": "This is a great podcast about technology",
    "category": "Tech",
    "is_public": true,
    "audio_url": null,
    "thumbnail_url": null,
    "duration": 0,
    "ai_enhanced": false,
    "play_count": 0,
    "like_count": 0,
    "bookmark_count": 0,
    "created_at": "2026-01-31T10:30:00Z",
    "updated_at": "2026-01-31T10:30:00Z",
    "owner_id": 123,
    "owner": {
        "id": 123,
        "name": "John Doe",
        "email": "john@example.com"
    }
}
```

### Get Podcast

**GET** `/podcasts/{podcast_id}`

Retrieve a specific podcast by ID. Increments play count.

**Response:** `200 OK`

```json
{
    "id": 1,
    "title": "My Awesome Podcast",
    "description": "This is a great podcast about technology",
    "category": "Tech",
    "is_public": true,
    "audio_url": "https://example.com/audio.mp3",
    "thumbnail_url": "https://example.com/thumb.jpg",
    "duration": 1800,
    "ai_enhanced": false,
    "play_count": 142,
    "like_count": 23,
    "bookmark_count": 8,
    "created_at": "2026-01-31T10:30:00Z",
    "updated_at": "2026-01-31T10:30:00Z",
    "owner_id": 123,
    "owner": {
        "id": 123,
        "name": "John Doe",
        "email": "john@example.com"
    }
}
```

### Search Podcasts

**GET** `/podcasts/search`

Search podcasts by title and description.

**Query Parameters:**

-   `query` (string, required) - Search query (minimum 1 character)
-   `category` (string, optional) - Filter by category
-   `skip` (int, default: 0) - Number of podcasts to skip
-   `limit` (int, default: 20, max: 100) - Number of podcasts to return

**Example Request:**

```
GET /podcasts/search?query=technology&category=Tech&limit=10
```

**Response:** `200 OK`

```json
{
    "podcasts": [
        {
            "id": 1,
            "title": "AI Technology Trends",
            "description": "Latest trends in artificial intelligence",
            "category": "Tech",
            "duration": 1800,
            "owner": {
                "id": 123,
                "name": "John Doe"
            }
        }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0,
    "has_more": false
}
```

### List Podcasts

**GET** `/podcasts`

Get podcasts with filtering and pagination.

**Query Parameters:**

-   `skip` (int, default: 0) - Number of podcasts to skip
-   `limit` (int, default: 20, max: 100) - Number of podcasts to return
-   `category` (string, optional) - Filter by category
-   `search` (string, optional) - Search in title and description
-   `owner_id` (int, optional) - Filter by owner ID

**Example Request:**

```
GET /podcasts?limit=10&category=Tech&search=AI
```

**Response:** `200 OK`

```json
{
    "podcasts": [
        {
            "id": 1,
            "title": "AI in 2024",
            "description": "Latest trends in artificial intelligence",
            "category": "Tech",
            "owner": {
                "id": 123,
                "name": "John Doe"
            }
        }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0,
    "has_more": false
}
```

### Update Podcast

**PUT** `/podcasts/{podcast_id}`

Update a podcast (owner only).

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
    "title": "Updated Podcast Title",
    "description": "Updated description",
    "category": "Business",
    "is_public": false
}
```

**Response:** `200 OK` - Returns updated podcast object

### Delete Podcast

**DELETE** `/podcasts/{podcast_id}`

Delete a podcast (owner only).

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
    "message": "Podcast deleted successfully"
}
```

### Process Podcast with AI

**POST** `/podcasts/{podcast_id}/process-ai`

Process a podcast with AI services (transcription, content analysis, audio enhancement).

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
    "enhance_audio": true,
    "transcribe": true,
    "analyze_content": true,
    "language": "auto"
}
```

**Response:** `200 OK`

```json
{
    "success": true,
    "processing_time": 45.2,
    "transcription": {
        "success": true,
        "text": "This is the transcribed text...",
        "language": "en",
        "language_probability": 0.95,
        "duration": 1800.5,
        "processing_time": 30.1,
        "model_used": "whisper-1"
    },
    "analysis": {
        "success": true,
        "text_stats": {
            "word_count": 250,
            "character_count": 1200
        },
        "keywords": [
            { "word": "technology", "score": 0.8 },
            { "word": "innovation", "score": 0.7 }
        ],
        "summary": "This podcast discusses technology trends...",
        "sentiment": {
            "positive": 0.6,
            "neutral": 0.3,
            "negative": 0.1
        }
    },
    "audio_enhancement": {
        "success": true,
        "stats": {
            "noise_reduction": 0.3,
            "volume_normalization": true
        }
    }
}
```

---

## Podcast Interactions

### Like Podcast

**POST** `/podcasts/{podcast_id}/like`

Like a podcast.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `201 Created`

```json
{
    "id": 1,
    "user_id": 123,
    "podcast_id": 456,
    "created_at": "2026-01-31T10:30:00Z"
}
```

### Unlike Podcast

**DELETE** `/podcasts/{podcast_id}/like`

Remove like from a podcast.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
    "message": "Podcast unliked successfully"
}
```

### Bookmark Podcast

**POST** `/podcasts/{podcast_id}/bookmark`

Bookmark a podcast.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `201 Created`

```json
{
    "id": 1,
    "user_id": 123,
    "podcast_id": 456,
    "created_at": "2026-01-31T10:30:00Z"
}
```

### Remove Bookmark

**DELETE** `/podcasts/{podcast_id}/bookmark`

Remove bookmark from a podcast.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
    "message": "Bookmark removed successfully"
}
```

### Get User Interactions

**GET** `/podcasts/{podcast_id}/interactions`

Get user's interactions with a specific podcast.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
    "is_liked": true,
    "is_bookmarked": false,
    "listening_history": {
        "id": 1,
        "user_id": 123,
        "podcast_id": 456,
        "position": 1200,
        "completed": false,
        "listen_time": 1200,
        "created_at": "2026-01-31T10:30:00Z",
        "updated_at": "2026-01-31T10:35:00Z"
    }
}
```

---

## Listening History

### Update Listening History

**POST** `/podcasts/{podcast_id}/history`

Update listening progress for a podcast.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
    "position": 1800,
    "listen_time": 1800,
    "completed": true
}
```

**Response:** `201 Created`

```json
{
    "id": 1,
    "user_id": 123,
    "podcast_id": 456,
    "position": 1800,
    "completed": true,
    "listen_time": 1800,
    "created_at": "2026-01-31T10:30:00Z",
    "updated_at": "2026-01-31T10:35:00Z"
}
```

---

## Comments

### Create Comment

**POST** `/podcasts/{podcast_id}/comments`

Create a comment on a podcast.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
    "podcast_id": 456,
    "content": "Great episode! Really enjoyed the discussion about AI.",
    "timestamp": 1200
}
```

**Response:** `201 Created`

```json
{
    "id": 1,
    "user_id": 123,
    "podcast_id": 456,
    "content": "Great episode! Really enjoyed the discussion about AI.",
    "timestamp": 1200,
    "is_active": true,
    "created_at": "2026-01-31T10:30:00Z",
    "updated_at": "2026-01-31T10:30:00Z",
    "user": {
        "id": 123,
        "name": "John Doe",
        "email": "john@example.com"
    }
}
```

### Get Podcast Comments

**GET** `/podcasts/{podcast_id}/comments`

Get comments for a podcast.

**Query Parameters:**

-   `skip` (int, default: 0) - Number of comments to skip
-   `limit` (int, default: 50, max: 100) - Number of comments to return

**Response:** `200 OK`

```json
[
    {
        "id": 1,
        "user_id": 123,
        "podcast_id": 456,
        "content": "Great episode!",
        "timestamp": 1200,
        "is_active": true,
        "created_at": "2026-01-31T10:30:00Z",
        "user": {
            "id": 123,
            "name": "John Doe"
        }
    }
]
```

### Update Comment

**PUT** `/podcasts/comments/{comment_id}`

Update a comment (owner only).

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
    "content": "Updated comment content",
    "timestamp": 1500
}
```

**Response:** `200 OK` - Returns updated comment object

### Delete Comment

**DELETE** `/podcasts/comments/{comment_id}`

Delete a comment (owner only).

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
    "message": "Comment deleted successfully"
}
```

---

## Discovery & Analytics

### Get Trending Podcasts

**GET** `/podcasts/discover/trending`

Get trending podcasts based on recent activity.

**Query Parameters:**

-   `limit` (int, default: 10, max: 50) - Number of podcasts to return
-   `days` (int, default: 7, max: 30) - Days to consider for trending

**Example Request:**

```
GET /podcasts/discover/trending?limit=5&days=7
```

**Response:** `200 OK`

```json
[
    {
        "id": 1,
        "title": "Trending Podcast",
        "description": "This podcast is trending",
        "category": "Tech",
        "play_count": 1500,
        "like_count": 200,
        "bookmark_count": 75,
        "owner": {
            "id": 123,
            "name": "John Doe"
        }
    }
]
```

### Get Recommended Podcasts

**GET** `/podcasts/discover/recommended`

Get personalized podcast recommendations.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

-   `limit` (int, default: 10, max: 50) - Number of recommendations

**Response:** `200 OK` - Returns array of podcast objects

### Get Related Podcasts

**GET** `/podcasts/discover/related/{podcast_id}`

Get podcasts related to a specific podcast.

**Query Parameters:**

-   `limit` (int, default: 10, max: 20) - Number of related podcasts

**Response:** `200 OK` - Returns array of podcast objects

### Get Podcast Analytics

**GET** `/podcasts/{podcast_id}/analytics`

Get analytics for a podcast (owner only).

**Headers:**

```
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
    "total_plays": 1500,
    "total_likes": 200,
    "total_bookmarks": 75,
    "total_comments": 45,
    "average_listen_time": 1320.5,
    "completion_rate": 68.5,
    "top_listeners": [
        {
            "id": 789,
            "name": "Top Listener",
            "email": "listener@example.com"
        }
    ]
}
```

---

## User Collections

### Get Liked Podcasts

**GET** `/podcasts/my/likes`

Get user's liked podcasts.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

-   `skip` (int, default: 0) - Number of podcasts to skip
-   `limit` (int, default: 20, max: 100) - Number of podcasts to return

**Response:** `200 OK` - Returns array of podcast objects

### Get Bookmarked Podcasts

**GET** `/podcasts/my/bookmarks`

Get user's bookmarked podcasts.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

-   `skip` (int, default: 0) - Number of podcasts to skip
-   `limit` (int, default: 20, max: 100) - Number of podcasts to return

**Response:** `200 OK` - Returns array of podcast objects

### Get Listening History

**GET** `/podcasts/my/history`

Get user's listening history.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

-   `skip` (int, default: 0) - Number of entries to skip
-   `limit` (int, default: 20, max: 100) - Number of entries to return

**Response:** `200 OK`

```json
[
    {
        "id": 1,
        "user_id": 123,
        "podcast_id": 456,
        "position": 1800,
        "completed": true,
        "listen_time": 1800,
        "created_at": "2026-01-31T10:30:00Z",
        "updated_at": "2026-01-31T10:35:00Z",
        "podcast": {
            "id": 456,
            "title": "Listened Podcast",
            "description": "A podcast I listened to",
            "owner": {
                "id": 789,
                "name": "Podcast Creator"
            }
        }
    }
]
```

### Get My Created Podcasts

**GET** `/podcasts/my/created`

Get user's created podcasts.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

-   `skip` (int, default: 0) - Number of podcasts to skip
-   `limit` (int, default: 20, max: 100) - Number of podcasts to return

**Response:** `200 OK`

```json
{
    "podcasts": [
        {
            "id": 1,
            "title": "My Podcast",
            "description": "A podcast I created",
            "is_public": true,
            "play_count": 150,
            "like_count": 20,
            "bookmark_count": 5
        }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0,
    "has_more": false
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

-   **General endpoints**: 100 requests per minute per user
-   **Search endpoints**: 30 requests per minute per user
-   **Upload endpoints**: 10 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

---

## WebSocket Events (Future)

For real-time features like live comments and listening parties:

```javascript
// Connect to WebSocket
const ws = new WebSocket("ws://YOUR_BACKEND_IP:8000/ws");

// Listen for real-time comments
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "new_comment") {
        // Handle new comment
    }
};
```

---

## SDK Integration Examples

### JavaScript/React Native

```javascript
import apiService from "./services/api/apiService";

// Like a podcast
try {
    await apiService.likePodcast(podcastId);
    console.log("Podcast liked successfully");
} catch (error) {
    console.error("Failed to like podcast:", error.detail);
}

// Get trending podcasts
const trending = await apiService.getTrendingPodcasts({ limit: 10 });
```

### Error Handling Best Practices

```javascript
try {
    const result = await apiService.createComment(podcastId, {
        content: "Great episode!",
        timestamp: 1200,
    });
} catch (error) {
    if (error.status === 401) {
        // Redirect to login
        router.push("/login");
    } else if (error.status === 422) {
        // Handle validation errors
        const validationErrors = error.response.data.detail;
        showValidationErrors(validationErrors);
    } else {
        // Generic error handling
        showToast("Something went wrong. Please try again.", "error");
    }
}
```

---

This documentation covers all major endpoints for podcast interactions, discovery, and analytics. For questions or support, contact the development team.
