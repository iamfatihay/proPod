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

export const buildContinueListeningAudioTrack = (item, options = {}) => {
    if (!item) {
        return null;
    }

    return buildPodcastAudioTrack(
        {
            id: item.podcast_id,
            audio_url: item.audio_url,
            title: item.title,
            duration: item.duration,
            thumbnail_url: item.thumbnail_url,
            category: item.category,
            description: item.description,
            owner_id: item.owner_id,
            owner:
                item.owner_name || item.owner_id
                    ? {
                          id: item.owner_id,
                          name: item.owner_name,
                      }
                    : undefined,
        },
        options
    );
};