/**
 * Formats a timestamp or ISO date string as a human-readable relative time.
 *
 * Accepts either:
 *   - a Unix millisecond timestamp (number)
 *   - an ISO date string (string)
 *
 * @param {number|string} value - Timestamp (ms) or ISO date string
 * @returns {string} e.g. "Just now", "5m ago", "3h ago", "2d ago", or localeDateString
 */
export const formatTimeAgo = (value) => {
    if (!value) return "Recently";

    const timestamp = typeof value === "number" ? value : new Date(value).getTime();
    if (isNaN(timestamp)) return "Recently";

    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
};
