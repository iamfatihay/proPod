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
import { retryWithBackoff, isNetworkError } from "../../utils/networkUtils";

// API Configuration
const API_BASE_URL =
    Constants.expoConfig?.extra?.apiBaseUrl || "http://192.168.178.27:8000";
Logger.log("🌐 API Base URL:", API_BASE_URL);

// Network timeout configuration (iOS can handle longer timeouts)
const NETWORK_TIMEOUT = Platform.OS === "ios" ? 30000 : 25000;

// Retry configuration for mobile
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    checkNetwork: false  // Don't check network to avoid extra requests
};

/**
 * ApiService Class
 * 
 * Main service class for API communication
 */
class ApiService {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    /**
     * Normalize podcast audio URLs - convert relative paths to absolute URLs
     * @param {Object} podcast - Podcast object
     * @returns {Object} Podcast with normalized audio URL
     */
    normalizePodcast(podcast) {
        if (!podcast) return podcast;
        
        if (podcast.audio_url && !podcast.audio_url.startsWith('http')) {
            podcast.audio_url = `${this.baseURL}${podcast.audio_url}`;
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
        return podcasts.map(p => this.normalizePodcast(p));
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
        const accessToken = await getToken("accessToken");
        const refreshToken = await getToken("refreshToken");

        const config = {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": Platform.OS === "ios" ? "ProPodApp/iOS" : "ProPodApp/Android",
                ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
                ...options.headers,
            },
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

            // Handle token expiration and refresh
            if (response.status === 401 && retry && refreshToken) {
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
                            "User-Agent": Platform.OS === "ios" ? "ProPodApp/iOS" : "ProPodApp/Android",
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
                    // Retry original request with new token
                    return this.request(endpoint, options, false);
                } else {
                    // Refresh token expired, logout user
                    await deleteToken("accessToken");
                    await deleteToken("refreshToken");
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                let error = new Error(`HTTP error! status: ${response.status}`);
                error.status = response.status;
                
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

            Logger.error("API request failed:", error);
            throw error;
        }
    }
    /**
     * Make an HTTP request with automatic retry for network failures
     * 
     * @param {string} endpoint - API endpoint path
     * @param {Object} options - Fetch options
     * @param {boolean} withRetry - Enable retry logic for network errors
     * @returns {Promise<Object>} Response data
     * @throws {Error} Network or HTTP errors
     */
    async requestWithRetry(endpoint, options = {}, withRetry = true) {
        if (!withRetry) {
            return this.request(endpoint, options);
        }
        
        return retryWithBackoff(
            () => this.request(endpoint, options),
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
    async googleLogin({ email, name, photo_url }) {
        const data = await this.request("/users/google-login", {
            method: "POST",
            body: JSON.stringify({
                email,
                name,
                provider: "google",
                photo_url,
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
        const endpoint = queryString ? `/podcasts?${queryString}` : "/podcasts";

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
     * @param {Object} audioFile - Audio file data
     * @param {string} audioFile.uri - File URI
     * @param {string} audioFile.type - File MIME type
     * @param {string} audioFile.name - File name
     * @returns {Promise<Object>} Upload response with audio URL
     * @throws {Error} If upload fails
     */
    async uploadAudio(audioFile) {
        const formData = new FormData();
        formData.append("file", {
            uri: audioFile.uri,
            type: audioFile.type,
            name: audioFile.name,
        });

        const accessToken = await getToken("accessToken");
        return this.request("/podcasts/upload", {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data",
                ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            },
            body: formData,
        });
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

    // Analytics methods (for podcast owners)
    async getPodcastAnalytics(podcastId) {
        return this.request(`/podcasts/${podcastId}/analytics`);
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

            Logger.log("📸 Uploading photo:", {
                uri: fileBlob.uri,
                type: fileBlob.type,
                name: fileBlob.name,
            });

            formData.append("file", fileBlob);

            // Upload with multipart/form-data
            const accessToken = await getToken("accessToken");
            const url = `${this.baseURL}/users/me/photo`;

            Logger.log("🌐 Upload URL:", url);
            Logger.log("🔑 Has token:", !!accessToken);

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

            Logger.log("🚀 Sending request...");
            const response = await fetch(url, config);
            Logger.log("📥 Response status:", response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.detail || `HTTP error! status: ${response.status}`
                );
            }

            const data = await response.json();
            Logger.log("✅ Upload success! User data:", data);
            Logger.log("🖼️ New photo URL:", data.photo_url);
            return data; // Returns updated user object with new photo_url
        } catch (error) {
            Logger.error("Profile photo upload failed:", error);
            throw error;
        }
    }
}

export default new ApiService();
