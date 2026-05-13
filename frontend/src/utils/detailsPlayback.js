import { buildPodcastAudioTrack } from "./audioTracks";

export const buildDetailsQueueTrack = (podcast, options = {}) => {
    return buildPodcastAudioTrack(podcast, options);
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