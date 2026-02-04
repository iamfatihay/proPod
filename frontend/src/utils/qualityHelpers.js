/**
 * Quality Score Utilities
 * 
 * Helper functions for displaying and formatting quality scores
 * from AI analysis results.
 */

/**
 * Generate quality info message based on score
 * @param {number} qualityScore - Score from 0 to 1
 * @returns {string} Formatted quality message with tips
 */
export const getQualityMessage = (qualityScore) => {
    const baseMessage = `Quality depends on:

🎤 Audio Quality
• Clear speech, no background noise
• Good microphone quality

🗣️ Speech Clarity
• Clear pronunciation
• Moderate speaking pace

📝 Content Length
• Longer content = better analysis
• More context for keywords

`;

    if (!qualityScore && qualityScore !== 0) {
        return baseMessage + '💡 Quality information will appear after AI processing.';
    }

    const scorePercent = (qualityScore * 100).toFixed(0);

    if (qualityScore < 0.6) {
        return baseMessage + `⚠️ Low quality (${scorePercent}/100). Try:
• Better microphone
• Quiet environment
• Clear pronunciation`;
    }

    if (qualityScore >= 0.6 && qualityScore < 0.8) {
        return baseMessage + `✅ Good quality (${scorePercent}/100)! For better results:
• Use external microphone
• Reduce background noise`;
    }

    return baseMessage + `🌟 Excellent quality (${scorePercent}/100)!`;
};

/**
 * Get quality score as percentage string
 * @param {number} qualityScore - Score from 0 to 1
 * @returns {string} Percentage string (e.g., "75%")
 */
export const getQualityPercentage = (qualityScore) => {
    if (!qualityScore && qualityScore !== 0) return 'N/A';
    return `${(qualityScore * 100).toFixed(0)}%`;
};

/**
 * Get quality color based on score
 * @param {number} qualityScore - Score from 0 to 1
 * @returns {string} Hex color code
 */
export const getQualityColor = (qualityScore) => {
    if (!qualityScore && qualityScore !== 0) return '#6B7280'; // gray
    if (qualityScore < 0.6) return '#EF4444'; // red
    if (qualityScore < 0.8) return '#F59E0B'; // yellow/orange
    return '#10B981'; // green
};
