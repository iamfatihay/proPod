import { useState, useEffect, useCallback } from "react";
import AudioService from "../services/audio";

const useAudioRecording = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [recordingUri, setRecordingUri] = useState(null);
    const [error, setError] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize audio service
    useEffect(() => {
        const initializeAudio = async () => {
            try {
                const success = await AudioService.initialize();
                setIsInitialized(success);
                if (!success) {
                    setError("Failed to initialize audio service");
                }
            } catch (err) {
                setError(err.message);
                setIsInitialized(false);
            }
        };

        initializeAudio();
    }, []);

    // Duration timer
    useEffect(() => {
        let interval;
        if (isRecording && !isPaused) {
            interval = setInterval(() => {
                setDuration((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording, isPaused]);

    const startRecording = useCallback(async (options = {}) => {
        try {
            setError(null);
            const success = await AudioService.startRecording(options);
            if (success) {
                setIsRecording(true);
                setIsPaused(false);
                setDuration(0);
                setRecordingUri(null);
            }
            return success;
        } catch (err) {
            setError(err.message);
            return false;
        }
    }, []);

    const stopRecording = useCallback(async () => {
        try {
            setError(null);
            const uri = await AudioService.stopRecording();
            setIsRecording(false);
            setIsPaused(false);
            setRecordingUri(uri);
            return uri;
        } catch (err) {
            setError(err.message);
            setIsRecording(false);
            setIsPaused(false);
            return null;
        }
    }, []);

    const pauseRecording = useCallback(async () => {
        try {
            setError(null);
            const success = await AudioService.pauseRecording();
            if (success) {
                setIsPaused(true);
            }
            return success;
        } catch (err) {
            setError(err.message);
            return false;
        }
    }, []);

    const resumeRecording = useCallback(async () => {
        try {
            setError(null);
            const success = await AudioService.resumeRecording();
            if (success) {
                setIsPaused(false);
            }
            return success;
        } catch (err) {
            setError(err.message);
            return false;
        }
    }, []);

    const resetRecording = useCallback(() => {
        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);
        setRecordingUri(null);
        setError(null);
    }, []);

    const getRecordingStatus = useCallback(() => {
        return AudioService.getRecordingStatus();
    }, []);

    return {
        // State
        isRecording,
        isPaused,
        duration,
        recordingUri,
        error,
        isInitialized,

        // Actions
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        resetRecording,
        getRecordingStatus,
    };
};

export default useAudioRecording;
