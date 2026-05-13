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
});