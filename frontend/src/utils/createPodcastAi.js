import Logger from "./logger";

export const maybeStartAiProcessingForPodcast = async ({
    enabled,
    podcastId,
    processAudio,
    logger = Logger,
}) => {
    if (!enabled || !podcastId) {
        return false;
    }

    try {
        await processAudio(podcastId);
        return true;
    } catch (error) {
        logger.error("AI auto-start after save failed:", error);
        return false;
    }
};

export const resolveAiEnabledForSave = ({
    isAIEnabled,
    draft,
}) => isAIEnabled || Boolean(draft?.metadata?.ai_enabled);