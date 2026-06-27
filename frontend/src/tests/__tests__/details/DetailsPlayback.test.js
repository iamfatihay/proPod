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
            isVideo: false,
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

    // ── Video podcast queue support ──────────────────────────────────────────

    it("includes video podcasts in the playback queue", () => {
        const videoPodcast = {
            id: 10,
            media_type: "video",
            video_url: "https://cdn.example.com/ep.mp4",
            audio_url: null,
            title: "Video Episode",
            owner: { id: 7, name: "VideoHost" },
            duration: 60,
            thumbnail_url: "https://cdn.example.com/thumb.jpg",
            category: "Tech",
            description: "Video desc",
        };
        const queue = buildPodcastPlaybackQueue(currentPodcast, [videoPodcast]);
        expect(queue).toHaveLength(2);
        expect(queue[1].id).toBe(10);
        expect(queue[1].uri).toBe("https://cdn.example.com/ep.mp4");
        expect(queue[1].isVideo).toBe(true);
    });

    it("excludes related podcasts with no media URL from the queue", () => {
        const broken = {
            id: 11,
            audio_url: null,
            video_url: null,
            media_type: "audio",
            title: "Broken Episode",
            owner: { id: 8, name: "Host" },
        };
        const queue = buildPodcastPlaybackQueue(currentPodcast, [broken]);
        expect(queue).toHaveLength(1);
        expect(queue[0].id).toBe(7);
    });

    it("builds a related queue starting from a video podcast", () => {
        const videoPodcast = {
            id: 20,
            media_type: "video",
            video_url: "https://cdn.example.com/video.mp4",
            audio_url: null,
            title: "Video Start",
            owner: { id: 9, name: "Director" },
            duration: 90,
            thumbnail_url: null,
            category: "Film",
            description: "Video start desc",
        };
        const queue = buildRelatedPlaybackQueue(videoPodcast, [videoPodcast, ...relatedPodcasts]);
        expect(queue[0].id).toBe(20);
        expect(queue[0].isVideo).toBe(true);
        // selected appears exactly once (no duplicate in remaining tracks)
        expect(queue.filter((t) => t.id === 20)).toHaveLength(1);
        // related audio podcasts follow
        expect(queue.length).toBeGreaterThan(1);
    });
});