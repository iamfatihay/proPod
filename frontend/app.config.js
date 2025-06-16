import "dotenv/config";

export default {
    expo: {
        // ...diğer ayarlar...
        extra: {
            apiBaseUrl: process.env.API_BASE_URL,
        },
    },
};
