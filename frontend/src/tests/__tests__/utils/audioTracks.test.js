import {
    buildContinueListeningAudioTrack,
    buildPodcastAudioTrack,
} from "../../../utils/audioTracks";

describe("audioTracks helpers", () => {
    it("builds a standard podcast track with shared metadata", () => {
        expect(
            buildPodcastAudioTrack({
                id: 17,
                audio_url: "https://cdn.example.com/podcast.mp3",
                title: "Shared Queue Episode",
                duration: 88,
                thumbnail_url: "https://cdn.example.com/podcast.jpg",
                category: "Technology",
                description: "Shared helper coverage",
                owner: {
                    id: 91,
                    name: "ProPod Studio",
                },
            })
        ).toEqual({
            id: 17,
            uri: "https://cdn.example.com/podcast.mp3",
            title: "Shared Queue Episode",
            artist: "ProPod Studio",
            duration: 88000,
            artwork: "https://cdn.example.com/podcast.jpg",
            category: "Technology",
            description: "Shared helper coverage",
            ownerId: 91,
            isVideo: false,
        });
    });

    it("adapts continue-listening payloads through the shared track builder", () => {
        expect(
            buildContinueListeningAudioTrack({
                podcast_id: 23,
                audio_url: "https://cdn.example.com/resume.mp3",
                title: "Resume Episode",
                duration: 145,
                thumbnail_url: "https://cdn.example.com/resume.jpg",
                category: "Business",
                description: "Resume helper coverage",
                owner_id: 44,
                owner_name: "Remote Host",
                position: 37,
            })
        ).toEqual({
            id: 23,
            uri: "https://cdn.example.com/resume.mp3",
            title: "Resume Episode",
            artist: "Remote Host",
            duration: 145000,
            artwork: "https://cdn.example.com/resume.jpg",
            category: "Business",
            description: "Resume helper coverage",
            ownerId: 44,
            isVideo: false,
        });
    });

    it("returns null when continue-listening items are missing audio", () => {
        expect(
            buildContinueListeningAudioTrack({
                podcast_id: 23,
                title: "Resume Episode",
            })
        ).toBeNull();
    });

    it("falls back to the shared unknown artist label when owner_name is missing", () => {
        expect(
            buildContinueListeningAudioTrack({
                podcast_id: 24,
                audio_url: "https://cdn.example.com/resume-2.mp3",
                title: "Resume Episode Without Owner Name",
                duration: 60,
                owner_id: 45,
            })
        ).toEqual(
            expect.objectContaining({
                id: 24,
                artist: "Unknown Artist",
                ownerId: 45,
            })
        );
    });

    // ── Video podcast support ────────────────────────────────────────────────

    it("uses video_url for video podcasts and sets isVideo: true", () => {
        const track = buildPodcastAudioTrack({
            id: 42,
            media_type: "video",
            video_url: "https://cdn.example.com/podcast.mp4",
            audio_url: null,
            title: "Video Episode",
            duration: 120,
            thumbnail_url: "https://cdn.example.com/thumb.jpg",
            category: "Tech",
            description: "Video desc",
            owner: { id: 1, name: "Creator" },
        });
        expect(track.uri).toBe("https://cdn.example.com/podcast.mp4");
        expect(track.isVideo).toBe(true);
    });

    it("prefers uriOverride over video_url for video podcasts", () => {
        const track = buildPodcastAudioTrack(
            {
                id: 42,
                media_type: "video",
                video_url: "https://cdn.example.com/podcast.mp4",
                owner: { id: 1, name: "Creator" },
            },
            { uriOverride: "file:///local/video.mp4" }
        );
        expect(track.uri).toBe("file:///local/video.mp4");
        expect(track.isVideo).toBe(true);
    });

    it("returns null for video podcast missing video_url", () => {
        expect(
            buildPodcastAudioTrack({
                id: 43,
                media_type: "video",
                video_url: null,
                audio_url: null,
            })
        ).toBeNull();
    });

    it("treats podcast with video_url but no media_type as audio (uses audio_url)", () => {
        const track = buildPodcastAudioTrack({
            id: 44,
            audio_url: "https://cdn.example.com/audio.mp3",
            video_url: "https://cdn.example.com/video.mp4",
            // no media_type
            owner: { id: 1, name: "Host" },
        });
        expect(track.uri).toBe("https://cdn.example.com/audio.mp3");
        expect(track.isVideo).toBe(false);
    });

    it("builds a video continue-listening track with video_url", () => {
        const track = buildContinueListeningAudioTrack({
            podcast_id: 55,
            media_type: "video",
            video_url: "https://cdn.example.com/video.mp4",
            audio_url: null,
            title: "Video Resume",
            duration: 80,
            owner_id: 2,
            owner_name: "Host",
        });
        expect(track).not.toBeNull();
        expect(track.uri).toBe("https://cdn.example.com/video.mp4");
        expect(track.isVideo).toBe(true);
        expect(track.id).toBe(55);
    });

    it("returns null for continue-listening video item missing video_url", () => {
        expect(
            buildContinueListeningAudioTrack({
                podcast_id: 56,
                media_type: "video",
                video_url: null,
                audio_url: null,
                title: "Broken Video",
            })
        ).toBeNull();
    });
});