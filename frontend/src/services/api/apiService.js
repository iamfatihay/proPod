/**
 * API Service
 *
 * Centralized service for making HTTP requests to the backend API.
 * Handles authentication, token refresh, error handling, request timeouts,
 * and automatic retry logic for mobile network issues.
 *
 * @module apiService
 */

import Constants from "expo-constants";
import { getToken, saveToken, deleteToken } from "../auth/tokenStorage";
import { Platform } from "react-native";
import Logger from "../../utils/logger";
import { retryWithBackoff } from "../../utils/networkUtils";

// API Configuration
// Auto-detect API URL based on environment
const getApiBaseUrl = () => {
    // 1. Check for explicit environment variable (production)
    const envUrl = Constants.expoConfig?.extra?.apiBaseUrl;
    if (envUrl) {
        return envUrl;
    }

    // 2. Auto-detect from Expo's debugger host (development)
    const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
    if (debuggerHost) {
        return `http://${debuggerHost}:8000`;
    }

    // 3. Fallback to localhost (shouldn't happen in normal dev)
    return "http://localhost:8000";
};

const API_BASE_URL = getApiBaseUrl();

// Network timeout configuration (iOS can handle longer timeouts)
const NETWORK_TIMEOUT = Platform.OS === "ios" ? 30000 : 25000;

// Retry configuration for mobile
// Network check disabled to avoid external dependency
// The retry logic itself will handle network errors through error detection
// To enable network checks, provide a health check URL to isNetworkAvailable()
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    checkNetwork: false, // Disabled - no default external dependency
};

/**
 * ApiService Class
 *
 * Main service class for API communication
 */
class ApiService {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = null;
        this.onSessionExpired = null; // Callback for handling session expiration
    }

    /**
     * Set authentication token for API requests
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * Clear authentication token
     */
    clearToken() {
        this.token = null;
    }

    /**
     * Set callback for session expiration events
     */
    setSessionExpiredHandler(callback) {
        this.onSessionExpired = callback;
    }

    /**
     * Normalize podcast audio URLs - convert relative paths to absolute URLs
     * @param {Object} podcast - Podcast object
     * @returns {Object} Podcast with normalized audio URL
     */
    normalizePodcast(podcast) {
        if (!podcast) return podcast;

        if (podcast.audio_url && !podcast.audio_url.startsWith("http")) {
            podcast.audio_url = `${this.baseURL}${podcast.audio_url}`;
        }
        if (podcast.video_url && !podcast.video_url.startsWith("http")) {
            podcast.video_url = `${this.baseURL}${podcast.video_url}`;
        }
        if (podcast.thumbnail_url && !podcast.thumbnail_url.startsWith("http")) {
            podcast.thumbnail_url = `${this.baseURL}${podcast.thumbnail_url}`;
        }

        return podcast;
    }

    /**
     * Normalize array of podcasts
     * @param {Array} podcasts - Array of podcast objects
     * @returns {Array} Podcasts with normalized audio URLs
     */
    normalizePodcasts(podcasts) {
        if (!Array.isArray(podcasts)) return podcasts;
        return podcasts.map((p) => this.normalizePodcast(p));
    }

    /**
     * Make an HTTP request to the API
     *
     * @param {string} endpoint - API endpoint path
     * @param {Object} options - Fetch options (method, headers, body, etc.)
     * @param {boolean} retry - Whether to retry on 401 with token refresh
     * @returns {Promise<Object>} Response data
     * @throws {Error} Network or HTTP errors
     */
    async request(endpoint, options = {}, retry = true) {
        const url = `${this.baseURL}${endpoint}`;
        
        // Use in-memory token if set, otherwise read from SecureStore
        const accessToken = this.token || await getToken("accessToken");
        const refreshToken = await getToken("refreshToken");
        
        // Build headers - don't set Content-Type for FormData (it sets its own with boundary)
        const headers = {
            "User-Agent":
                Platform.OS === "ios"
                    ? "ProPodApp/iOS"
                    : "ProPodApp/Android",
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            ...options.headers,
        };

        // Only add Content-Type if not FormData
        const isFormData = options.body instanceof FormData;
        if (!isFormData) {
            headers["Content-Type"] = "application/json";
        }

        const config = {
            headers,
            timeout: NETWORK_TIMEOUT,
            ...options,
        };

        // Create AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);
        config.signal = controller.signal;

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            // Handle token expiration and refresh (but not if already retrying)
            // CRITICAL: Skip retry for FormData requests - FormData body is consumed after first request
            // and cannot be reused. Caller must handle 401 and recreate FormData for retry.
            const isFormDataBody = options.body instanceof FormData;
            if (response.status === 401 && retry && refreshToken && !options._isRetry && !isFormDataBody) {
                const refreshController = new AbortController();
                const refreshTimeoutId = setTimeout(
                    () => refreshController.abort(),
                    NETWORK_TIMEOUT
                );

                const refreshRes = await fetch(
                    `${this.baseURL}/users/refresh-token`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "User-Agent":
                                Platform.OS === "ios"
                                    ? "ProPodApp/iOS"
                                    : "ProPodApp/Android",
                        },
                        body: JSON.stringify({ refresh_token: refreshToken }),
                        timeout: NETWORK_TIMEOUT,
                        signal: refreshController.signal,
                    }
                );
                clearTimeout(refreshTimeoutId);

                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    await saveToken("accessToken", refreshData.access_token);
                    this.setToken(refreshData.access_token); // Update in-memory token
                    
                    // Retry original request with new token by making a fresh request call
                    // This ensures the new token from this.token is read at the start of request()
                    const retryOptions = { ...options, _isRetry: true };
                    // Remove Authorization header if present, so request() reads from this.token
                    if (retryOptions.headers && retryOptions.headers.Authorization) {
                        delete retryOptions.headers.Authorization;
                    }
                    
                    return this.request(endpoint, retryOptions, false);
                } else {
                    Logger.error('â Token refresh failed - refresh token expired');
                    // Refresh token expired, logout user
                    // If refresh token is also expired, handle session expiration
                    await deleteToken("accessToken");
                    await deleteToken("refreshToken");
                    this.clearToken();

                    // Trigger session expired callback (will redirect to login)
                    if (this.onSessionExpired) {
                        this.onSessionExpired();
                    }

                    throw new Error("Session expired. Please login again.");
                }
            }
            
            // Log warning if 401 occurred with FormData (token refresh retry was skipped)
            if (response.status === 401 && isFormDataBody) {
                Logger.warn('â ï¸ Token expired during FormData upload - automatic retry skipped. Caller must handle 401 and recreate FormData.');
            }

            if (!response.ok) {
                let error = new Error(
                    `HTTP error! status: ${response.status} ${options.method || "GET"} ${endpoint}`
                );
                error.status = response.status;
                error.endpoint = endpoint;

                // Try to parse error details from response
                try {
                    const data = await response.json();
                    if (data && data.detail) {
                        error.detail = data.detail;
                    }
                    error.response = { data };
                } catch (e) {
                    // Fallback to raw text if JSON parsing fails
                    try {
                        const rawText = await response.text();
                        if (rawText && rawText.length > 0) {
                            error.detail = rawText;
                            error.response = { data: { detail: rawText } };
                        }
                    } catch (_) {
                        Logger.warn("Could not parse error response body");
                    }
                }
                throw error;
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            // Provide user-friendly error messages
            if (error.name === "AbortError") {
                throw new Error(
                    "Request timeout. Please check your internet connection and try again."
                );
            } else if (error.message === "Network request failed") {
                throw new Error(
                    "Network error. Please check your internet connection."
                );
            } else if (
                error.message.includes("ENOTFOUND") ||
                error.message.includes("ECONNREFUSED")
            ) {
                throw new Error(
                    "Cannot connect to server. Please try again later."
                );
            }

            // 4xx responses are caller-handled contracts (e.g. 404 ai-data
            // when a podcast has no AI data yet) — log at warn level so the
            // console isn't drowned in red for expected cases. Reserve error
            // for 5xx and transport failures.
            if (error.status && error.status >= 400 && error.status < 500) {
                Logger.warn("API request failed:", error.message);
            } else {
                Logger.error("API request failed:", error);
            }
            throw error;
        }
    }
    /**
     * Make an HTTP request with automatic retry for network failures
     *
     * @param {string} endpoint - API endpoint path
     * @param {Object} options - Fetch options
     * @param {boolean} withRetry - Enable retry logic for network errors
     * @param {boolean} withTokenRefresh - Enable token refresh on 401 errors (default: true)
     * @returns {Promise<Object>} Response data
     * @throws {Error} Network or HTTP errors
     */
    async requestWithRetry(endpoint, options = {}, withRetry = true, withTokenRefresh = true) {
        if (!withRetry) {
            return this.request(endpoint, options, withTokenRefresh);
        }

        return retryWithBackoff(
            () => this.request(endpoint, options, withTokenRefresh),
            RETRY_CONFIG
        );
    }

    // ==================== Authentication Methods ====================

    /**
     * Login user with email and password
     *
     * @param {string} email - User's email address
     * @param {string} password - User's password
     * @returns {Promise<Object>} User data and tokens
     * @throws {Error} If login fails
     */
    async login(email, password) {
        try {
            const data = await this.request("/users/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });
            await saveToken("accessToken", data.access_token);
            await saveToken("refreshToken", data.refresh_token);
            return data;
        } catch (error) {
            Logger.error("LOGIN API ERROR:", error);
            throw error;
        }
    }

    /**
     * Register new user
     *
     * @param {string} name - User's display name
     * @param {string} email - User's email address
     * @param {string} password - User's password
     * @returns {Promise<Object>} User data and tokens
     * @throws {Error} If registration fails
     */
    async register(name, email, password) {
        const data = await this.request("/users/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
        });
        await saveToken("accessToken", data.access_token);
        await saveToken("refreshToken", data.refresh_token);
        return data;
    }

    /**
     * Login or register user with Google OAuth
     *
     * @param {Object} userData - Google user data
     * @param {string} userData.email - User's email
     * @param {string} userData.name - User's name
     * @param {string} userData.photo_url - User's profile photo URL
     * @returns {Promise<Object>} User data and tokens
     * @throws {Error} If login fails
     */
    async getMe() {
        try {
            const data = await this.request("/users/me", {
                method: "GET",
            });
            return data;
        } catch (error) {
            Logger.error("GET ME API ERROR:", error);
            throw error;
        }
    }

    async googleLogin({ google_access_token }) {
        const data = await this.request("/users/google-login", {
            method: "POST",
            body: JSON.stringify({
                google_access_token,
                provider: "google",
            }),
        });
        await saveToken("accessToken", data.access_token);
        await saveToken("refreshToken", data.refresh_token);
        return data;
    }

    /**
     * Refresh access token using refresh token
     *
     * @param {string} refresh_token - Refresh token
     * @returns {Promise<Object>} New access token
     * @throws {Error} If refresh fails
     */
    async refreshToken(refresh_token) {
        const data = await this.request("/users/refresh-token", {
            method: "POST",
            body: JSON.stringify({ refresh_token }),
        });
        await saveToken("accessToken", data.access_token);
        return data;
    }

    // ==================== User Profile Methods ====================

    /**
     * Get current user profile
     *
     * @returns {Promise<Object>} User profile data
     * @throws {Error} If request fails
     */
    async getUserProfile() {
        return this.request("/users/me");
    }

    /**
     * Get a public creator's profile (non-sensitive stats, no auth required).
     *
     * @param {number} userId - The creator's user ID
     * @returns {Promise<Object>} PublicUserProfile â id, name, photo_url, created_at,
     *                           podcast_count, total_plays, total_likes, total_followers
     * @throws {Error} If user not found or request fails
     */
    async getPublicUserProfile(userId) {
        return this.request(`/users/${userId}/profile`);
    }

    /**
     * Get a creator's public podcasts with pagination.
     *
     * @param {number} userId - The creator's user ID
     * @param {Object} [params] - Optional pagination params
     * @param {number} [params.skip=0] - Offset
     * @param {number} [params.limit=20] - Page size (max 100)
     * @returns {Promise<Object>} { podcasts: Podcast[], total: number }
     * @throws {Error} If user not found or request fails
     */
    async getPublicUserPodcasts(userId, { skip = 0, limit = 20 } = {}) {
        return this.request(
            `/users/${userId}/podcasts?skip=${skip}&limit=${limit}`
        );
    }

    /**
     * Follow a creator.
     *
     * @param {number} userId - ID of the creator to follow
     * @returns {Promise<Object>} { detail: "Now following" }
     * @throws {Error} If already following (400) or user not found (404)
     */
    async followCreator(userId) {
        return this.request(`/users/${userId}/follow`, { method: "POST" });
    }

    /**
     * Unfollow a creator.
     *
     * @param {number} userId - ID of the creator to unfollow
     * @returns {Promise<Object>} { detail: "Unfollowed" }
     * @throws {Error} If not following (404)
     */
    async unfollowCreator(userId) {
        return this.request(`/users/${userId}/follow`, { method: "DELETE" });
    }

    /**
     * Get the list of creators the current user is following.
     *
     * @param {Object} [params] - Pagination
     * @param {number} [params.skip=0]
     * @param {number} [params.limit=50]
     * @returns {Promise<{ following: FollowedCreatorItem[], total: number }>}
     */
    async getFollowingList({ skip = 0, limit = 50 } = {}) {
        return this.request(`/users/me/following?skip=${skip}&limit=${limit}`);
    }

    /**
     * Get the personalized "Following" feed â public podcasts from creators
     * the current user follows, ordered newest-first.
     *
     * @param {Object} params
     * @param {number} [params.skip=0]  - Pagination offset
     * @param {number} [params.limit=20] - Max results per page
     * @returns {Promise<{podcasts: Array, total: number, has_more: boolean}>}
     */
    async getFollowingFeed({ skip = 0, limit = 20 } = {}) {
        return this.request(`/podcasts/following-feed?skip=${skip}&limit=${limit}`);
    }

    /**
     * Update user profile
     *
     * @param {Object} profileData - Profile data to update
     * @param {string} profileData.name - User's display name
     * @returns {Promise<Object>} Updated user data
     * @throws {Error} If update fails
     */
    async updateProfile({ name }) {
        const data = await this.request("/users/me", {
            method: "PUT",
            body: JSON.stringify({ name }),
        });
        return data;
    }

    /**
     * Change user password
     *
     * @param {string} old_password - Current password
     * @param {string} new_password - New password
     * @returns {Promise<Object>} Success message
     * @throws {Error} If password change fails
     */
    async changePassword(old_password, new_password) {
        return this.request("/users/change-password", {
            method: "POST",
            body: JSON.stringify({ old_password, new_password }),
        });
    }

    /**
     * Delete user account (soft delete)
     *
     * @returns {Promise<Object>} Success message
     * @throws {Error} If deletion fails
     */
    async deleteAccount() {
        return this.request("/users/delete", {
            method: "POST",
        });
    }

    /**
     * Request password reset
     *
     * @param {string} email - User's email address
     * @returns {Promise<Object>} Success message
     * @throws {Error} If request fails
     */
    async forgotPassword(email) {
        return this.request("/users/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    }

    /**
     * Reset password with token
     *
     * @param {string} token - Reset token
     * @param {string} new_password - New password
     * @returns {Promise<Object>} Success message
     * @throws {Error} If reset fails
     */
    async resetPassword(token, new_password) {
        return this.request("/users/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, new_password }),
        });
    }

    // ==================== Podcast CRUD Methods ====================

    /**
     * Create a new podcast
     *
     * @param {Object} podcastData - Podcast creation data
     * @param {string} podcastData.title - Podcast title
     * @param {string} podcastData.description - Podcast description
     * @param {string} podcastData.category - Podcast category
     * @param {boolean} podcastData.is_public - Whether podcast is public
     * @param {number} podcastData.duration - Duration in seconds
     * @returns {Promise<Object>} Created podcast data
     * @throws {Error} If creation fails
     */
    async createPodcast(podcastData) {
        return this.request("/podcasts/create", {
            method: "POST",
            body: JSON.stringify(podcastData),
        });
    }

    // ==================== RTC Methods ====================

    /**
     * Create a 100ms room
     *
     * @param {Object} roomData - Room creation payload
     * @returns {Promise<Object>} Room details
     */
    async createRtcRoom(roomData) {
        return this.request("/rtc/rooms", {
            method: "POST",
            body: JSON.stringify(roomData),
        });
    }

    /**
     * Create a 100ms auth token
     *
     * @param {Object} tokenData - Token request payload
     * @returns {Promise<Object>} Token response
     */
    async createRtcToken(tokenData) {
        return this.request("/rtc/token", {
            method: "POST",
            body: JSON.stringify(tokenData),
        });
    }

    /**
     * Get a single RTC session by ID
     *
     * @param {number} sessionId - RTC session ID
     * @returns {Promise<Object>} RTC session data
     */
    async getRtcSession(sessionId) {
        return this.request(`/rtc/sessions/${sessionId}`);
    }

    /**
     * Mark an RTC session as live
     *
     * @param {number} sessionId - RTC session ID
     * @returns {Promise<Object>} RTC session data
     */
    async startRtcSession(sessionId) {
        return this.request(`/rtc/sessions/${sessionId}/start`, {
            method: "POST",
        });
    }

    /**
     * Mark an RTC session as ended
     *
     * @param {number} sessionId - RTC session ID
     * @returns {Promise<Object>} RTC session data
     */
    async endRtcSession(sessionId) {
        return this.request(`/rtc/sessions/${sessionId}/end`, {
            method: "POST",
        });
    }

    /**
     * Get preview data for a live invite code
     *
     * @param {string} inviteCode - Shared invite code
     * @returns {Promise<Object>} Live session preview data
     */
    async getRtcInviteSession(inviteCode) {
        return this.request(`/rtc/invite/${inviteCode}`);
    }

    /**
     * Join an RTC session through its invite code
     *
     * @param {Object} joinData - Invite join payload
     * @returns {Promise<Object>} Token plus room metadata
     */
    async joinRtcByInvite(joinData) {
        return this.request("/rtc/join-by-invite", {
            method: "POST",
            body: JSON.stringify(joinData),
        });
    }

    /**
     * List RTC sessions for the current user
     *
     * @param {Object} params - Query params
     * @returns {Promise<Array>} RTC session list
     */
    async listRtcSessions(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.room_id) queryParams.append("room_id", params.room_id);
        if (params.limit !== undefined) queryParams.append("limit", params.limit);

        const queryString = queryParams.toString();
        const endpoint = queryString ? `/rtc/sessions?${queryString}` : "/rtc/sessions";
        return this.request(endpoint);
    }

    /**
     * Get a specific podcast by ID
     *
     * @param {number} podcastId - Podcast ID
     * @returns {Promise<Object>} Podcast data with normalized URL
     * @throws {Error} If request fails
     */
    async getPodcast(podcastId) {
        const podcast = await this.request(`/podcasts/${podcastId}`);
        return this.normalizePodcast(podcast);
    }

    /**
     * Get list of podcasts with optional filtering
     *
     * @param {Object} params - Query parameters
     * @param {number} params.skip - Number of items to skip
     * @param {number} params.limit - Number of items to return
     * @param {string} params.category - Filter by category
     * @param {string} params.search - Search query
     * @param {number} params.owner_id - Filter by owner ID
     * @returns {Promise<Array>} List of podcasts
     * @throws {Error} If request fails
     */
    async getPodcasts(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);
        if (params.category) queryParams.append("category", params.category);
        if (params.search) queryParams.append("search", params.search);
        if (params.owner_id) queryParams.append("owner_id", params.owner_id);

        const queryString = queryParams.toString();
        // Trailing slash avoids FastAPI's 307 redirect (mount is /podcasts/).
        const endpoint = queryString ? `/podcasts/?${queryString}` : "/podcasts/";

        const response = await this.request(endpoint);

        // Backend returns { podcasts: [], total, limit, offset, has_more }
        return response?.podcasts || [];
    }

    /**
     * Update podcast information
     *
     * @param {number} podcastId - Podcast ID
     * @param {Object} updateData - Fields to update
     * @returns {Promise<Object>} Updated podcast data
     * @throws {Error} If update fails
     */
    async updatePodcast(podcastId, updateData) {
        return this.request(`/podcasts/${podcastId}`, {
            method: "PUT",
            body: JSON.stringify(updateData),
        });
    }

    /**
     * Delete a podcast
     *
     * @param {number} podcastId - Podcast ID
     * @returns {Promise<Object>} Success message
     * @throws {Error} If deletion fails
     */
    async deletePodcast(podcastId) {
        return this.request(`/podcasts/${podcastId}`, {
            method: "DELETE",
        });
    }

    /**
     * Upload audio file for podcast
     *
     * NOTE: FormData requests do NOT support automatic token refresh retry.
     * If token expires during upload (401), caller must catch error and retry manually.
     * This is because FormData body is consumed and cannot be reused.
     *
     * @param {Object} audioFile - Audio file data
     * @param {string} audioFile.uri - File URI
     * @param {string} audioFile.type - File MIME type
     * @param {string} audioFile.name - File name
     * @param {number} audioFile.size - File size in bytes (optional)
     * @returns {Promise<Object>} Upload response with audio URL
     * @throws {Error} If upload fails, file too large, or token expired (401)
     */
    async uploadAudio(audioFile) {
        // Check file size before upload (mobile friendly: max 50MB)
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        if (audioFile.size && audioFile.size > MAX_FILE_SIZE) {
            throw new Error(
                `File too large. Maximum size is ${
                    MAX_FILE_SIZE / (1024 * 1024)
                }MB. Your file is ${(audioFile.size / (1024 * 1024)).toFixed(
                    2
                )}MB.`
            );
        } else if (typeof audioFile.size === "undefined") {
            Logger.warn(
                "Audio file size is not available. Unable to check file size before upload. Large files may be rejected by the server."
            );
        }

        const formData = new FormData();
        formData.append("file", {
            uri: audioFile.uri,
            type: audioFile.type,
            name: audioFile.name,
        });

        // IMPORTANT: Don't set Content-Type or headers for FormData
        // The system will set Content-Type automatically with the correct boundary
        // Don't pass headers at all - let request() handle Authorization automatically
        return this.requestWithRetry(
            "/podcasts/upload",
            {
                method: "POST",
                body: formData,
                // headers intentionally omitted - request() will add Authorization automatically
            },
            true
        );
    }

    async mergeAndUploadAudio(audioFiles) {
        /**
         * Merge multiple audio segments and upload as single file
         * Used for draft recovery with multiple recording sessions
         * 
         * NOTE: FormData requests do NOT support automatic token refresh retry.
         * If token expires during upload (401), caller must catch error and retry manually.
         * This is because FormData body is consumed and cannot be reused.
         * 
         * @param {Array} audioFiles - Array of {uri, type, name} objects
         * @returns {Promise<Object>} Upload response with audio_url
         * @throws {Error} If upload fails or token expired (401)
         */
        const formData = new FormData();
        
        // Append all audio files
        audioFiles.forEach((file) => {
            formData.append("files", {
                uri: file.uri,
                type: file.type,
                name: file.name,
            });
        });

        return this.requestWithRetry(
            "/podcasts/merge-upload",
            {
                method: "POST",
                body: formData,
            },
            true
        );
    }

    // Podcast Interaction methods
    async likePodcast(podcastId) {
        return this.request(`/podcasts/${podcastId}/like`, {
            method: "POST",
        });
    }

    async unlikePodcast(podcastId) {
        return this.request(`/podcasts/${podcastId}/like`, {
            method: "DELETE",
        });
    }

    async addBookmark(podcastId) {
        return this.request(`/podcasts/${podcastId}/bookmark`, {
            method: "POST",
        });
    }

    async removeBookmark(podcastId) {
        return this.request(`/podcasts/${podcastId}/bookmark`, {
            method: "DELETE",
        });
    }

    async getPodcastInteractions(podcastId) {
        return this.request(`/podcasts/${podcastId}/interactions`);
    }

    async getPodcastAIData(podcastId) {
        return this.request(`/podcasts/${podcastId}/ai-data`);
    }

    // Listening History methods
    async updateListeningHistory(podcastId, historyData) {
        return this.request(`/podcasts/${podcastId}/history`, {
            method: "POST",
            body: JSON.stringify(historyData),
        });
    }

    async getListeningHistory(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);

        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `/podcasts/my/history?${queryString}`
            : "/podcasts/my/history";

        return this.request(endpoint);
    }

    async deleteListeningHistory(podcastId) {
        return this.request(`/podcasts/${podcastId}/history`, {
            method: "DELETE",
        });
    }

    async getContinueListening(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);

        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `/podcasts/my/continue-listening?${queryString}`
            : "/podcasts/my/continue-listening";

        return this.request(endpoint);
    }

    // Comment methods
    async createComment(podcastId, commentData) {
        return this.request(`/podcasts/${podcastId}/comments`, {
            method: "POST",
            body: JSON.stringify({
                podcast_id: podcastId,
                ...commentData,
            }),
        });
    }

    async getPodcastComments(podcastId, params = {}) {
        const queryParams = new URLSearchParams();

        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);

        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `/podcasts/${podcastId}/comments?${queryString}`
            : `/podcasts/${podcastId}/comments`;

        return this.request(endpoint);
    }

    async updateComment(commentId, updateData) {
        return this.request(`/podcasts/comments/${commentId}`, {
            method: "PUT",
            body: JSON.stringify(updateData),
        });
    }

    async deleteComment(commentId) {
        return this.request(`/podcasts/comments/${commentId}`, {
            method: "DELETE",
        });
    }

    // Discovery methods
    async getTrendingPodcasts(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);
        if (params.days !== undefined) queryParams.append("days", params.days);

        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `/podcasts/discover/trending?${queryString}`
            : "/podcasts/discover/trending";

        return this.request(endpoint);
    }

    async getRecommendedPodcasts(limit = 10) {
        return this.request(`/podcasts/discover/recommended?limit=${limit}`);
    }

    async getRelatedPodcasts(podcastId, limit = 10) {
        return this.request(
            `/podcasts/discover/related/${podcastId}?limit=${limit}`
        );
    }

    /**
     * Search podcasts via the backend search endpoint (SQL ILIKE on title/description).
     *
     * Replaces client-side SemanticSearchService.searchPodcasts() for the
     * "All Content" search mode. The backend filters by title and description
     * using ILIKE, which is far more scalable than fetching 100 podcasts
     * and filtering in JS.
     *
     * @param {string} query - Non-empty search string
     * @param {Object} params - Optional query parameters
     * @param {string} [params.category] - Restrict results to a category
     * @param {number} [params.skip=0] - Pagination offset
     * @param {number} [params.limit=20] - Max results (1-100)
     * @returns {Promise<Array>} Array of matching podcast objects
     */
    async searchPodcasts(query, params = {}) {
        const q = (query || "").trim();
        if (!q) return [];
        const queryParams = new URLSearchParams({ query: q });
        if (params.category) queryParams.append("category", params.category);
        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);

        const response = await this.request(
            `/podcasts/search?${queryParams.toString()}`
        );
        // Backend returns { podcasts: [], total, limit, offset, has_more }
        const podcasts = response?.podcasts || [];
        return podcasts.map((p) => this.normalizePodcast(p));
    }


    /**
     * Search creators/users by name.
     *
     * Hits GET /users/search?q=<query>&limit=<n>&skip=<n>.
     * Returns an array of PublicUserProfile objects including podcast_count,
     * total_followers, total_plays, and is_following (if authenticated).
     *
     * @param {string} query - Non-empty search string
     * @param {Object} params - Optional pagination params
     * @param {number} [params.skip=0] - Pagination offset
     * @param {number} [params.limit=20] - Max results (1-50)
     * @returns {Promise<Array>} Array of matching user profile objects
     */
    async searchUsers(query, params = {}) {
        const q = (query || "").trim();
        if (!q) return [];
        const queryParams = new URLSearchParams({ q });
        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined) queryParams.append("limit", params.limit);
        if (params.sort_by) queryParams.append("sort_by", params.sort_by);
        return this.request(`/users/search?${queryParams.toString()}`);
    }

    /**
     * Fetch all podcast categories with their podcast counts from the backend.
     *
     * Used by the Home screen to replace the static CATEGORIES constant.
     * Returns categories sorted by podcast count (descending).
     *
     * @returns {Promise<Array<{category: string, podcast_count: number}>>}
     */
    async getDiscoverCategories() {
        return this.request("/podcasts/discover/categories");
    }

    // User's Personal Collections
    async getLikedPodcasts(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);

        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `/podcasts/my/likes?${queryString}`
            : "/podcasts/my/likes";

        return this.request(endpoint);
    }

    async getBookmarkedPodcasts(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);

        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `/podcasts/my/bookmarks?${queryString}`
            : "/podcasts/my/bookmarks";

        return this.request(endpoint);
    }

    async getMyPodcasts(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined)
            queryParams.append("limit", params.limit);

        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `/podcasts/my/created?${queryString}`
            : "/podcasts/my/created";

        return this.request(endpoint);
    }

    async getCreatorCommentInbox({ podcastLimit = 8, commentsPerPodcast = 10 } = {}) {
        const podcastsResponse = await this.getMyPodcasts({ limit: podcastLimit });
        const podcasts = this.normalizePodcasts(podcastsResponse?.podcasts || podcastsResponse || []);

        if (!podcasts.length) {
            return [];
        }

        const commentResults = await Promise.allSettled(
            podcasts.map(async (podcast) => {
                const comments = await this.getPodcastComments(podcast.id, {
                    limit: commentsPerPodcast,
                });

                return (comments || [])
                    .filter((comment) => comment.user_id !== podcast.owner_id)
                    .map((comment) => ({
                        id: `comment_${comment.id}`,
                        commentId: comment.id,
                        podcastId: podcast.id,
                        podcastTitle: podcast.title,
                        podcastThumbnailUrl: podcast.thumbnail_url || null,
                        podcastOwnerId: podcast.owner_id,
                        authorName: comment.user?.name || "Listener",
                        authorPhotoUrl: comment.user?.photo_url || null,
                        content: comment.content,
                        timestampSeconds: comment.timestamp || 0,
                        createdAt: comment.created_at,
                        updatedAt: comment.updated_at,
                    }));
            })
        );

        // Log any rejected podcast comment fetches so partial-inbox failures are visible
        commentResults.forEach((result, idx) => {
            if (result.status === "rejected") {
                const podcast = podcasts[idx];
                Logger.warn(
                    `getCreatorCommentInbox: failed to fetch comments for podcast ` +
                    `"${podcast?.title}" (id=${podcast?.id}):`,
                    result.reason?.message || result.reason
                );
            }
        });

        return commentResults
            .filter((result) => result.status === "fulfilled")
            .flatMap((result) => result.value)
            .sort((left, right) => {
                const leftTime = new Date(left.createdAt).getTime();
                const rightTime = new Date(right.createdAt).getTime();
                return rightTime - leftTime;
            });
    }

    // Analytics methods (for podcast owners)
    async getPodcastAnalytics(podcastId) {
        return this.request(`/podcasts/${podcastId}/analytics`);
    }

    /**
     * Get the creator analytics dashboard.
     * @param {number} days - Look-back window for recent engagement (default 30)
     * @returns {{ total_podcasts, total_plays, total_likes, total_bookmarks,
     *             total_comments, average_completion_rate, top_podcasts,
     *             recent_likes, recent_bookmarks, recent_comments,
     *             category_distribution, days }}
     */
    async getCreatorDashboard(days = 30) {
        return this.request(`/analytics/dashboard?days=${days}`);
    }

    /**
     * Get daily play counts for the creator's podcasts.
     * @param {number} days - Look-back window (7–365, default 30)
     * @returns {{ data: Array<{date: string, plays: number}>, days: number }}
     */
    async getPlaysOverTime(days = 30) {
        return this.request(`/analytics/plays-over-time?days=${days}`);
    }

    // AI Processing methods
    async getAIStatus() {
        return this.request("/ai/status");
    }

    async initializeAI() {
        return this.request("/ai/initialize", { method: "POST" });
    }

    async processAudioWithAI(formData) {
        return this.request("/ai/process-audio", {
            method: "POST",
            body: formData,
            headers: {}, // Remove Content-Type to let browser set multipart boundary
        });
    }

    async processAudio(podcastId) {
        return this.request(`/ai/process-podcast/${podcastId}`, {
            method: "POST",
        });
    }

    async enhanceAudioOnly(formData) {
        return this.request("/ai/enhance-audio", {
            method: "POST",
            body: formData,
            headers: {},
        });
    }

    async transcribeAudio(formData) {
        return this.request("/ai/transcribe", {
            method: "POST",
            body: formData,
            headers: {},
        });
    }

    async analyzeTextContent(text, options = {}) {
        const formData = new FormData();
        formData.append("text", text);
        formData.append("extract_keywords", options.extractKeywords ?? true);
        formData.append(
            "suggest_categories",
            options.suggestCategories ?? true
        );
        formData.append("generate_summary", options.generateSummary ?? true);
        formData.append("analyze_sentiment", options.analyzeSentiment ?? true);
        formData.append("keyword_count", options.keywordCount ?? 10);
        formData.append("summary_sentences", options.summarySentences ?? 3);

        return this.request("/ai/analyze-text", {
            method: "POST",
            body: formData,
            headers: {},
        });
    }

    async getSupportedLanguages() {
        return this.request("/ai/supported-languages");
    }

    async detectAudioLanguage(formData) {
        return this.request("/ai/detect-language", {
            method: "POST",
            body: formData,
            headers: {},
        });
    }

    async generateSubtitles(transcriptionData, format = "srt") {
        return this.request("/ai/generate-subtitles", {
            method: "POST",
            body: JSON.stringify({
                transcription_data: transcriptionData,
                format_type: format,
            }),
        });
    }

    // Podcast AI Processing
    async processPodcastWithAI(podcastId, audioFilePath, options = {}) {
        const requestData = {
            audio_file_path: audioFilePath,
            enhance_audio: options.enhanceAudio ?? true,
            transcribe: options.transcribe ?? true,
            analyze_content: options.analyzeContent ?? true,
            language: options.language ?? "auto",
        };

        return this.request(`/podcasts/${podcastId}/process-ai`, {
            method: "POST",
            body: JSON.stringify(requestData),
        });
    }

    // âââ Playlist Methods ââââââââââââââââââââââââââââââââââââââââââââââââââââ

    /** Fetch the current user's playlists. */
    async getMyPlaylists(params = {}) {
        // Use conditional appending (consistent with rest of apiService) to
        // avoid serialising `undefined`/`null` values as literal URL params.
        const queryParams = new URLSearchParams();
        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined) queryParams.append("limit", params.limit);
        const query = queryParams.toString();
        return this.request(`/playlists/my${query ? `?${query}` : ""}`);
    }

    /** Fetch all public playlists (no auth required). */
    async getPublicPlaylists(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined) queryParams.append("limit", params.limit);
        const query = queryParams.toString();
        return this.request(`/playlists/public${query ? `?${query}` : ""}`);
    }


    /** Fetch a single playlist by ID (includes items). */
    async getPlaylist(playlistId) {
        return this.request(`/playlists/${playlistId}`);
    }

    /**
     * Create a new playlist.
     * @param {{ name: string, description?: string, is_public?: boolean }} data
     */
    async createPlaylist(data) {
        return this.request("/playlists/", {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    /**
     * Update an existing playlist.
     * @param {number} playlistId
     * @param {{ name?: string, description?: string, is_public?: boolean }} data
     */
    async updatePlaylist(playlistId, data) {
        return this.request(`/playlists/${playlistId}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
    }

    /** Delete a playlist by ID. */
    async deletePlaylist(playlistId) {
        return this.request(`/playlists/${playlistId}`, { method: "DELETE" });
    }

    /**
     * Add a podcast to a playlist.
     * @param {number} playlistId
     * @param {number} podcastId
     */
    async addToPlaylist(playlistId, podcastId) {
        return this.request(`/playlists/${playlistId}/items`, {
            method: "POST",
            body: JSON.stringify({ podcast_id: podcastId }),
        });
    }

    /**
     * Remove a podcast from a playlist.
     * @param {number} playlistId
     * @param {number} podcastId
     */
    async removeFromPlaylist(playlistId, podcastId) {
        return this.request(`/playlists/${playlistId}/items/${podcastId}`, {
            method: "DELETE",
        });
    }

    // âââ End Playlist Methods âââââââââââââââââââââââââââââââââââââââââââââââââ

    // Logout function
    async logout() {
        await deleteToken("accessToken");
        await deleteToken("refreshToken");
    }

    // Upload profile photo
    async uploadProfilePhoto(imageAsset) {
        try {
            // Create FormData for multipart/form-data upload
            const formData = new FormData();

            // Prepare file object for upload
            const fileExtension = imageAsset.uri.split(".").pop() || "jpg";
            const fileName = `profile_photo.${fileExtension}`;

            // Determine correct MIME type based on file extension
            let mimeType = "image/jpeg"; // Default
            const ext = fileExtension.toLowerCase();
            if (ext === "png") mimeType = "image/png";
            else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
            else if (ext === "webp") mimeType = "image/webp";

            // Create file blob for upload
            const fileBlob = {
                uri:
                    Platform.OS === "ios"
                        ? imageAsset.uri.replace("file://", "")
                        : imageAsset.uri,
                type: mimeType,
                name: fileName,
            };

            formData.append("file", fileBlob);

            // Upload with multipart/form-data
            const accessToken = await getToken("accessToken");
            const url = `${this.baseURL}/users/me/photo`;

            const config = {
                method: "POST",
                body: formData,
                headers: {
                    Accept: "application/json",
                    ...(accessToken && {
                        Authorization: `Bearer ${accessToken}`,
                    }),
                    // Don't set Content-Type, let the browser set it with boundary
                },
            };

            const response = await fetch(url, config);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.detail || `HTTP error! status: ${response.status}`
                );
            }

            const data = await response.json();
            return data; // Returns updated user object with new photo_url
        } catch (error) {
            Logger.error("Profile photo upload failed:", error);
            throw error;
        }
    }

    /**
     * Get podcasts the user started but hasn't finished listening to.
     *
     * Maps to GET /podcasts/my/continue-listening.
     * Returns an array of ContinueListeningItem objects, each containing
     * podcast metadata plus the user's playback progress (position, progress_percent).
     *
     * @param {Object} params - Query parameters
     * @param {number} [params.skip=0] - Number of entries to skip
     * @param {number} [params.limit=10] - Number of entries to return (max 50)
     * @returns {Promise<Array>} List of in-progress podcasts with progress info
     * @throws {Error} If request fails
     */
    async getContinueListening(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.skip !== undefined) queryParams.append("skip", params.skip);
        if (params.limit !== undefined) queryParams.append("limit", params.limit);
        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `/podcasts/my/continue-listening?${queryString}`
            : "/podcasts/my/continue-listening";
        return this.request(endpoint);
    }

    // âââ Notifications ââââââââââââââââââââââââââââââââââââââââââââââââââââ

    /**
     * Fetch in-app notifications for the authenticated user.
     *
     * Maps to GET /notifications/
     *
     * @param {Object} params
     * @param {number} [params.skip=0]
     * @param {number} [params.limit=30]
     * @returns {Promise<{notifications, total, unread_count, limit, offset, has_more}>}
     */
    async getNotifications({ skip = 0, limit = 30 } = {}) {
        const q = new URLSearchParams({ skip, limit }).toString();
        return this.request(`/notifications/?${q}`);
    }

    /**
     * Mark a single notification as read.
     * Maps to PATCH /notifications/{id}/read
     *
     * @param {number} notificationId
     * @returns {Promise<Object>} Updated notification
     */
    async markNotificationRead(notificationId) {
        return this.request(`/notifications/${notificationId}/read`, {
            method: "PATCH",
        });
    }

    /**
     * Mark all notifications as read for the current user.
     * Maps to POST /notifications/mark-all-read
     *
     * @returns {Promise<{message: string}>}
     */
    async markAllNotificationsRead() {
        return this.request("/notifications/mark-all-read", {
            method: "POST",
        });
    }

    // âââ Direct Messages ââââââââââââââââââââââââââââââââââââââââââââââââââ

    /**
     * Fetch the DM inbox for the authenticated user.
     * Returns one thread entry per conversation partner, newest-thread first.
     *
     * Maps to GET /messages/inbox
     *
     * @returns {Promise<{threads: Array, total: number}>}
     */
    async getDMInbox() {
        return this.request("/messages/inbox");
    }

    /**
     * Fetch the conversation with a specific partner (newest messages first).
     * Also marks all unread messages from that partner as read.
     *
     * Maps to GET /messages/{partner_id}
     *
     * @param {number} partnerId - User ID of the conversation partner
     * @param {Object} [params]
     * @param {number} [params.skip=0]
     * @param {number} [params.limit=50]
     * @returns {Promise<{messages: Array, total: number, has_more: boolean}>}
     */
    async getConversation(partnerId, { skip = 0, limit = 50 } = {}) {
        const q = new URLSearchParams({ skip, limit }).toString();
        return this.request(`/messages/${partnerId}?${q}`);
    }

    /**
     * Send a direct message to another user.
     *
     * Maps to POST /messages/
     *
     * @param {number} recipientId - ID of the target user
     * @param {string} body - Message text (1â2 000 characters)
     * @returns {Promise<Object>} Created message
     */
    async sendDirectMessage(recipientId, body) {
        return this.request("/messages/", {
            method: "POST",
            body: JSON.stringify({ recipient_id: recipientId, body }),
        });
    }

    // âââ Push Notification Device Tokens âââââââââââââââââââââââââââââââââââââ

    /**
     * Register an Expo push token with the backend.
     * Idempotent â safe to call on every app launch after login.
     *
     * Maps to POST /users/me/device-token
     *
     * @param {string} token - Expo push token string
     * @param {string} [platform='unknown'] - 'ios' | 'android' | 'unknown'
     * @returns {Promise<{id: number, token: string, platform: string}>}
     */
    async registerDeviceToken(token, platform = "unknown") {
        return this.request("/users/me/device-token", {
            method: "POST",
            body: JSON.stringify({ token, platform }),
        });
    }

    /**
     * Remove a push token from the backend (e.g. on logout).
     *
     * Maps to DELETE /users/me/device-token
     *
     * @param {string} token - Expo push token to remove
     * @returns {Promise<{message: string}>}
     */
    async removeDeviceToken(token) {
        return this.request("/users/me/device-token", {
            method: "DELETE",
            body: JSON.stringify({ token, platform: "unknown" }),
        });
    }
}

export default new ApiService();
