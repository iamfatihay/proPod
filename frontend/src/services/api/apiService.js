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

    // Generic request method with SecureStore token management
    async request(endpoint, options = {}, retry = true) {
        const url = `${this.baseURL}${endpoint}`;
        let accessToken = await getToken("accessToken");
        let refreshToken = await getToken("refreshToken");

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
                try {
                    const data = await response.json();
                    if (data && data.detail) {
                        error.detail = data.detail;
                    }
                    error.response = { data };
                } catch (e) {
                    // Just log the error, don't throw it
                    console.warn("Could not parse error response as JSON");
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

    // Update profile
    async updateProfile({ name }) {
        const data = await this.request("/users/me", {
            method: "PUT",
            body: JSON.stringify({ name }),
        });
        return data;
    }

    // Change password
    async changePassword(old_password, new_password) {
        return this.request("/users/change-password", {
            method: "POST",
            body: JSON.stringify({ old_password, new_password }),
        });
    }

    // Delete account (soft delete)
    async deleteAccount() {
        return this.request("/users/delete", {
            method: "POST",
        });
    }

    // Podcast methods
    async createPodcast(podcastData) {
        return this.request("/podcasts/create", {
            method: "POST",
            body: JSON.stringify(podcastData),
        });
    }

    async getPodcasts() {
        return this.request("/podcasts");
    }

    async uploadAudio(audioFile) {
        const formData = new FormData();

        // Cross-platform file handling
        if (Platform.OS === "ios") {
            formData.append("audio", {
                uri: audioFile.uri,
                type: audioFile.type || "audio/mp4",
                name: audioFile.name || "audio.m4a",
            });
        } else {
            // Android
            formData.append("audio", {
                uri: audioFile.uri,
                type: audioFile.type || "audio/mpeg",
                name: audioFile.name || "audio.mp3",
            });
        }

        // Get the token from SecureStore
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

    // Logout function
    async logout() {
        await deleteToken("accessToken");
        await deleteToken("refreshToken");
    }

    /**
     * Forgot Password
     * @param {string} email
     * @returns {Promise}
     */
    async forgotPassword(email) {
        return this.request("/users/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    }

    /**
     * Reset Password
     * @param {string} token
     * @param {string} new_password
     * @returns {Promise}
     */
    async resetPassword(token, new_password) {
        return this.request("/users/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, new_password }),
        });
    }
}

export default new ApiService();
