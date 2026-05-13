const UNKNOWN_ARTIST = "Unknown Artist";

export const buildDetailsQueueTrack = (podcast, options = {}) => {
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

export const buildPodcastPlaybackQueue = (
    currentPodcast,
    relatedPodcasts = [],
    options = {}
) => {
    const currentTrack = buildDetailsQueueTrack(currentPodcast, options);

    if (!currentTrack) {
        return [];
    }

    const relatedTracks = relatedPodcasts
        .filter((podcast) => podcast?.audio_url)
        .map((podcast) => buildDetailsQueueTrack(podcast))
        .filter(Boolean);

    return [currentTrack, ...relatedTracks];
};

export const buildRelatedPlaybackQueue = (
    selectedPodcast,
    relatedPodcasts = []
) => {
    const selectedTrack = buildDetailsQueueTrack(selectedPodcast);

    if (!selectedTrack) {
        return [];
    }

    const remainingTracks = relatedPodcasts
        .filter(
            (podcast) => podcast?.audio_url && podcast.id !== selectedPodcast.id
        )
        .map((podcast) => buildDetailsQueueTrack(podcast))
        .filter(Boolean);

    return [selectedTrack, ...remainingTracks];
};