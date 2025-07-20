import Constants from "expo-constants";
import { getToken, saveToken, deleteToken } from "../auth/tokenStorage";

// This line is used to get the API base URL from app.config.js (extra.apiBaseUrl).
const API_BASE_URL = Constants.expoConfig.extra.apiBaseUrl;

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
                ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);

            // If access token is expired and 401 is returned, try to refresh
            if (response.status === 401 && retry && refreshToken) {
                // Get a new access token using the refresh token
                const refreshRes = await fetch(
                    `${this.baseURL}/users/refresh-token`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ refresh_token: refreshToken }),
                    }
                );
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
                    // JSON parse edilemezse, error.detail eklenmez
                }
                throw error;
            }

            return await response.json();
        } catch (error) {
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
        formData.append("audio", audioFile);

        // Get the token from SecureStore
        const accessToken = await getToken("accessToken");
        return this.request("/podcasts/upload", {
            method: "POST",
            headers: {
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
