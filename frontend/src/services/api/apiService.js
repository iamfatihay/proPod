import Constants from "expo-constants";
import { getToken, saveToken, deleteToken } from "../auth/tokenStorage";
import { Platform } from "react-native";

// This line is used to get the API base URL from app.config.js (extra.apiBaseUrl).
const API_BASE_URL = Constants.expoConfig.extra.apiBaseUrl;

// Network timeout configuration
const NETWORK_TIMEOUT = Platform.OS === "ios" ? 30000 : 25000; // iOS can handle longer timeouts

class ApiService {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    async request(endpoint, options = {}, retry = true) {
        const url = `${this.baseURL}${endpoint}`;
        const accessToken = await getToken("accessToken");
        const refreshToken = await getToken("refreshToken");

        const config = {
            headers: {
                "Content-Type": "application/json",
                // Add user agent for better compatibility
                "User-Agent":
                    Platform.OS === "ios" ? "VoloApp/iOS" : "VoloApp/Android",
                ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
                ...options.headers,
            },
            // Add timeout for network requests
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

            // If access token is expired and 401 is returned, try to refresh
            if (response.status === 401 && retry && refreshToken) {
                // Get a new access token using the refresh token
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
                                    ? "VoloApp/iOS"
                                    : "VoloApp/Android",
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
                    // accessToken updated, retry the request (retry=false to avoid infinite loop)
                    return this.request(endpoint, options, false);
                } else {
                    // If refresh token is also expired, logout
                    await deleteToken("accessToken");
                    await deleteToken("refreshToken");
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                let error = new Error(`HTTP error! status: ${response.status}`);
                error.status = response.status;
                // Prefer JSON details if available
                try {
                    const data = await response.json();
                    if (data && data.detail) {
                        error.detail = data.detail;
                    }
                    error.response = { data };
                } catch (e) {
                    // Fallback: capture raw text body to surface backend errors without JSON
                    try {
                        const rawText = await response.text();
                        if (rawText && rawText.length > 0) {
                            error.detail = rawText;
                            error.response = { data: { detail: rawText } };
                        }
                    } catch (_) {
                        console.warn("Could not parse error response body");
                    }
                }
                throw error;
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            // Handle different error types with better messages
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

            console.error("API request failed:", error);
            throw error;
        }
    }

    // Auth methods
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
            console.error("LOGIN API ERROR:", error);
            throw error;
        }
    }

    async register(name, email, password) {
        const data = await this.request("/users/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
        });
        await saveToken("accessToken", data.access_token);
        await saveToken("refreshToken", data.refresh_token);
        return data;
    }

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

    async refreshToken(refresh_token) {
        const data = await this.request("/users/refresh-token", {
            method: "POST",
            body: JSON.stringify({ refresh_token }),
        });
        await saveToken("accessToken", data.access_token);
        return data;
    }

    // User Profile methods
    async getUserProfile() {
        return this.request("/users/me");
    }

    async updateProfile({ name }) {
        const data = await this.request("/users/me", {
            method: "PUT",
            body: JSON.stringify({ name }),
        });
        return data;
    }

    async changePassword(old_password, new_password) {
        return this.request("/users/change-password", {
            method: "POST",
            body: JSON.stringify({ old_password, new_password }),
        });
    }

    async deleteAccount() {
        return this.request("/users/delete", {
            method: "POST",
        });
    }

    async forgotPassword(email) {
        return this.request("/users/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    }

    async resetPassword(token, new_password) {
        return this.request("/users/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, new_password }),
        });
    }

    // Podcast CRUD methods
    async createPodcast(podcastData) {
        return this.request("/podcasts/create", {
            method: "POST",
            body: JSON.stringify(podcastData),
        });
    }

    async getPodcast(podcastId) {
        return this.request(`/podcasts/${podcastId}`);
    }

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

        return this.request(endpoint);
    }

    async updatePodcast(podcastId, updateData) {
        return this.request(`/podcasts/${podcastId}`, {
            method: "PUT",
            body: JSON.stringify(updateData),
        });
    }

    async deletePodcast(podcastId) {
        return this.request(`/podcasts/${podcastId}`, {
            method: "DELETE",
        });
    }

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
}

export default new ApiService();
