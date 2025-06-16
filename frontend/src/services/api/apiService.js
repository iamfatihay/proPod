import Constants from "expo-constants";

const API_BASE_URL = Constants.expoConfig.extra.apiBaseUrl;

class ApiService {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = null;
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                "Content-Type": "application/json",
                ...(this.token && { Authorization: `Bearer ${this.token}` }),
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("API request failed:", error);
            throw error;
        }
    }

    // Auth methods
    async login(email, password) {
        return this.request("/users/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
    }

    async register(email, password) {
        return this.request("/users/register", {
            method: "POST",
            body: JSON.stringify({ email, password }),
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

        return this.request("/podcasts/upload", {
            method: "POST",
            headers: {}, // Remove Content-Type to let browser set boundary
            body: formData,
        });
    }
}

export default new ApiService();
