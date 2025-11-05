import Constants from "expo-constants";

/**
 * Converts relative URLs to absolute URLs by prepending the API base URL
 * @param {string} url - The URL to convert (can be relative or absolute)
 * @returns {string} - The absolute URL
 */
export const toAbsoluteUrl = (url) => {
    if (!url) return "";

    // If already absolute URL, return as is
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }

    // Get API base URL from config
    const API_BASE_URL =
        Constants.expoConfig?.extra?.apiBaseUrl || "http://192.168.178.27:8000";

    // Ensure no double slashes
    const baseUrl = API_BASE_URL.endsWith("/")
        ? API_BASE_URL.slice(0, -1)
        : API_BASE_URL;
    const path = url.startsWith("/") ? url : `/${url}`;

    return `${baseUrl}${path}`;
};

/**
 * Normalizes a podcast object by converting relative URLs to absolute
 * @param {Object} podcast - The podcast object
 * @returns {Object} - The normalized podcast object
 */
export const normalizePodcast = (podcast) => {
    if (!podcast) return null;

    return {
        ...podcast,
        audio_url: toAbsoluteUrl(podcast.audio_url),
        thumbnail_url: toAbsoluteUrl(podcast.thumbnail_url),
        owner: podcast.owner
            ? {
                  ...podcast.owner,
                  photo_url: toAbsoluteUrl(podcast.owner.photo_url),
              }
            : null,
    };
};

/**
 * Normalizes an array of podcasts
 * @param {Array} podcasts - Array of podcast objects
 * @returns {Array} - Array of normalized podcast objects
 */
export const normalizePodcasts = (podcasts) => {
    if (!Array.isArray(podcasts)) return [];
    return podcasts.map(normalizePodcast);
};
