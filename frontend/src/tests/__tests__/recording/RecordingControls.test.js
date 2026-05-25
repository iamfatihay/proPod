import { getLiveRecordingDuration } from "../../../components/recording/RecordingControls";

describe("getLiveRecordingDuration", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-05-25T12:00:05Z"));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("uses status.duration when the recorder exposes live seconds", () => {
        expect(
            getLiveRecordingDuration(
                {
                    isRecording: true,
                    duration: 5,
                },
                0
            )
        ).toBe(5);
    });

    it("falls back to startTime when duration is unavailable", () => {
        expect(
            getLiveRecordingDuration(
                {
                    isRecording: true,
                    duration: 0,
                    startTime: new Date("2026-05-25T12:00:00Z").getTime(),
                },
                3
            )
        ).toBe(8);
    });

    it("returns the initial duration when recording is not active", () => {
        expect(
            getLiveRecordingDuration(
                {
                    isRecording: false,
                    duration: 12,
                },
                4
            )
        ).toBe(4);
    });
});