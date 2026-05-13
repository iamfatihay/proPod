const UNKNOWN_ARTIST = "Unknown Artist";

export const buildPodcastAudioTrack = (podcast, options = {}) => {
    if (!podcast?.audio_url && !options.uriOverride) {
        return null;
    }

    return {
        id: podcast.id,
        uri: options.uriOverride || podcast.audio_url,
        title: podcast.title,
        artist: podcast.owner?.name || UNKNOWN_ARTIST,
        duration: (podcast.duration || 0) * 1000,
        artwork: podcast.thumbnail_url,
        category: podcast.category,
        description: podcast.description,
        ownerId: podcast.owner?.id ?? podcast.owner_id,
    };
};