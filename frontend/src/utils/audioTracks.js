const UNKNOWN_ARTIST = "Unknown Artist";

const isVideoPodcast = (podcast) =>
    podcast?.media_type === "video" && Boolean(podcast?.video_url);

const resolveMediaUrl = (podcast) =>
    isVideoPodcast(podcast) ? podcast.video_url : podcast?.audio_url;

export const buildPodcastAudioTrack = (podcast, options = {}) => {
    const mediaUrl = options.uriOverride || resolveMediaUrl(podcast);
    if (!mediaUrl) {
        return null;
    }

    return {
        id: podcast.id,
        uri: mediaUrl,
        title: podcast.title,
        artist: podcast.owner?.name || UNKNOWN_ARTIST,
        duration: (podcast.duration || 0) * 1000,
        artwork: podcast.thumbnail_url,
        category: podcast.category,
        description: podcast.description,
        ownerId: podcast.owner?.id ?? podcast.owner_id,
        isVideo: isVideoPodcast(podcast),
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
            video_url: item.video_url,
            media_type: item.media_type,
            title: item.title,
            duration: item.duration,
            thumbnail_url: item.thumbnail_url,
            category: item.category,
            description: item.description,
            owner_id: item.owner_id,
            owner: {
                id: item.owner_id,
                name: item.owner_name,
            },
        },
        options
    );
};