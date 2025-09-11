import AudioService from "./AudioService";
import AudioRecorder from "./AudioRecorder";

// Create a singleton instance and expose a unified API that includes
// both playback/control methods and recorder file helpers
const audioServiceInstance = new AudioService();

const UnifiedAudio = {
    // Initialization / playback via AudioService
    initialize: (...args) => audioServiceInstance.initialize(...args),
    loadAudio: (...args) => audioServiceInstance.loadAudio(...args),
    play: (...args) => audioServiceInstance.play(...args),
    pausePlayback: (...args) => audioServiceInstance.pausePlayback(...args),
    stopPlayback: (...args) => audioServiceInstance.stopPlayback(...args),
    getPlaybackStatus: () => audioServiceInstance.getPlaybackStatus(),
    getStatus: () => audioServiceInstance.getStatus(),
    formatTime: (ms) => audioServiceInstance.formatTime(ms),
    cleanup: () => audioServiceInstance.cleanup(),

    // Recording via AudioRecorder (real implementation)
    startRecording: (...args) => AudioRecorder.startRecording(...args),
    stopRecording: (...args) => AudioRecorder.stopRecording(...args),
    pauseRecording: (...args) => AudioRecorder.pauseRecording(...args),
    resumeRecording: (...args) => AudioRecorder.resumeRecording(...args),
    getRecordingStatus: () => AudioRecorder.getRecordingStatus(),

    // Recorder file helpers
    saveRecording: (filename) => AudioRecorder.saveRecording(filename),
    deleteAudioFile: (uri) => AudioRecorder.deleteRecording(uri),
};

export default UnifiedAudio;
export * from "./AudioRecorder";
export * from "./AudioPlayer";
export * from "./AudioPermissions";
