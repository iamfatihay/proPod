export const buildRtcSessionHistoryRoute = (sessionId) => {
    if (!sessionId) {
        return "/(main)/rtc-sessions";
    }

    return {
        pathname: "/(main)/rtc-sessions",
        params: { focusSessionId: String(sessionId) },
    };
};

export const buildRtcSessionHistoryNotificationAction = (sessionId) => ({
    type: "navigate",
    screen: "rtc-sessions",
    params: sessionId ? { focusSessionId: String(sessionId) } : {},
});

export const buildRtcSessionRecoveryRoute = (session) => ({
    pathname: "/(main)/create",
    params: {
        mode: "full-create",
        recordingMode: "multi",
        rtcMediaMode: session?.media_mode === "audio" ? "audio" : "video",
        prefillTitle: session?.title || session?.room_name || "",
        prefillDescription: session?.description || "",
        prefillCategory: session?.category || "General",
        prefillIsPublic: String(Boolean(session?.is_public)),
        sourceSessionId: session?.id ? String(session.id) : undefined,
    },
});