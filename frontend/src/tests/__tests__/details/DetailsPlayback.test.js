import {
    buildDetailsQueueTrack,
    buildPodcastPlaybackQueue,
    buildRelatedPlaybackQueue,
} from "../../../utils/detailsPlayback";

const currentPodcast = {
    id: 7,
    audio_url: "https://cdn.example.com/current.mp3",
    title: "Current Episode",
    owner: {
        id: 42,
        name: "ProPod Studio",
    },
    duration: 123,
    thumbnail_url: "https://cdn.example.com/current.jpg",
    category: "Technology",
    description: "Current description",
};

const relatedPodcasts = [
    {
        id: 8,
        audio_url: "https://cdn.example.com/related-1.mp3",
        title: "Related One",
        owner_id: 99,
        owner: {
            name: "Guest Host",
        },
        duration: 77,
        thumbnail_url: "https://cdn.example.com/related-1.jpg",
        category: "Business",
        description: "Related description",
    },
    {
        id: 9,
        audio_url: "https://cdn.example.com/related-2.mp3",
        title: "Related Two",
        owner: {
            id: 55,
            name: "Remote Crew",
        },
        duration: 64,
        thumbnail_url: "https://cdn.example.com/related-2.jpg",
        category: "News",
        description: "Second related description",
    },
];

describe("detailsPlayback queue builders", () => {
    it("builds a queue track with uri overrides and complete metadata", () => {
        expect(
            buildDetailsQueueTrack(currentPodcast, {
                uriOverride: "file:///downloads/current.mp3",
            })
        ).toEqual({
            id: 7,
            uri: "file:///downloads/current.mp3",
            title: "Current Episode",
            artist: "ProPod Studio",
            duration: 123000,
            artwork: "https://cdn.example.com/current.jpg",
            category: "Technology",
            description: "Current description",
            ownerId: 42,
        });
    });

    it("keeps full metadata for related episodes in the main playback queue", () => {
        const queue = buildPodcastPlaybackQueue(currentPodcast, relatedPodcasts, {
            uriOverride: "file:///downloads/current.mp3",
        });

        expect(queue).toHaveLength(3);
        expect(queue[0].uri).toBe("file:///downloads/current.mp3");
        expect(queue[1]).toMatchObject({
            id: 8,
            uri: "https://cdn.example.com/related-1.mp3",
            ownerId: 99,
            category: "Business",
            description: "Related description",
            duration: 77000,
        });
        expect(queue[2]).toMatchObject({
            id: 9,
            ownerId: 55,
            category: "News",
            description: "Second related description",
            duration: 64000,
        });
    });

    it("starts related playback with the tapped episode and preserves follow-on metadata", () => {
        const queue = buildRelatedPlaybackQueue(relatedPodcasts[1], relatedPodcasts);

        expect(queue.map((track) => track.id)).toEqual([9, 8]);
        expect(queue[0]).toMatchObject({
            ownerId: 55,
            category: "News",
            description: "Second related description",
        });
        expect(queue[1]).toMatchObject({
            ownerId: 99,
            category: "Business",
            description: "Related description",
        });
    });
});