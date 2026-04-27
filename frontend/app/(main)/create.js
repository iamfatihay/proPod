import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    SafeAreaView,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Platform,
    Linking,
    ActivityIndicator,
    BackHandler,
    Alert,
    Share,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import RecordingControls from "../../src/components/recording/RecordingControls";
import HmsRoom from "../../src/components/rtc/HmsRoom";
import AudioService from "../../src/services/audio";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";
import Logger from "../../src/utils/logger";
import PermissionModal from "../../src/components/PermissionModal";
import ConfirmationModal from "../../src/components/ConfirmationModal";
import { COLORS } from "../../src/constants/theme";
import protectionService from "../../src/services/recording/protectionService";
import useNotificationStore from "../../src/context/useNotificationStore";
import backgroundService from "../../src/services/recording/backgroundService";

const Create = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { showToast } = useToast();

    // Mode: 'quick-record', 'full-create', 'resume-draft', or 'save-draft'
    const mode = params.mode || "full-create";

    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedUri, setRecordedUri] = useState(null);
    const [recordedDuration, setRecordedDuration] = useState(0); // Store duration in seconds
    const [isAIEnabled, setIsAIEnabled] = useState(false);
    const [audioInitialized, setAudioInitialized] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [recordingMode, setRecordingMode] = useState("solo");
    const [rtcMediaMode, setRtcMediaMode] = useState("video");
    const [rtcSession, setRtcSession] = useState(null);
    const [rtcSessionState, setRtcSessionState] = useState("idle");
    const [rtcSessionSummary, setRtcSessionSummary] = useState(null);
    const [rtcLoading, setRtcLoading] = useState(false);
    const [rtcError, setRtcError] = useState(null);
    const [userDisplayName, setUserDisplayName] = useState("Host");
    const [rtcStatusMessage, setRtcStatusMessage] = useState(null);
    const [rtcProcessingNotifId, setRtcProcessingNotifId] = useState(null);
    const [rtcLobbyAudioMuted, setRtcLobbyAudioMuted] = useState(false);
    const [rtcLobbyVideoMuted, setRtcLobbyVideoMuted] = useState(false);

    // Podcast metadata
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("General");
    const [isPublic, setIsPublic] = useState(false);

    // Update draft metadata when title/description changes (only if draft loaded or recording active)
    useEffect(() => {
        // Only update metadata if we have a loaded draft or active recording session
        // Prevents overwriting draft metadata with empty values on initial mount
        if ((draftLoaded || isRecording || recordedUri) && (title || description)) {
            protectionService.updateMetadata({
                title: title || 'Untitled Recording',
                description,
                category,
                is_public: isPublic
            });
        }
    }, [title, description, category, isPublic, draftLoaded, isRecording, recordedUri]);

    // UI state
    const [isUploading, setIsUploading] = useState(false);
    const [currentStep, setCurrentStep] = useState(
        mode === "quick-record" ? "recording" : "setup"
    );

    // Modal state
    const [permissionModalVisible, setPermissionModalVisible] = useState(false);
    const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);

    useEffect(() => {
        let isMounted = true;

        apiService.getUserProfile()
            .then((profile) => {
                if (isMounted && profile?.name) {
                    setUserDisplayName(profile.name);
                }
            })
            .catch(() => {
                // Non-blocking: keep default display name
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Reset state when screen comes into focus (but not for draft modes)
    useFocusEffect(
        useCallback(() => {
            // Initialize audio for all modes
            if (!audioInitialized) {
                initializeAudio();
            }
            
            // Don't reset if we're loading a draft
            if (mode === 'resume-draft' || mode === 'save-draft') {
                if (!draftLoaded) {
                    loadDraftData();
                }
                return;
            }

            // CRITICAL: Check if there's an active recording session before resetting
            // This prevents state desync when user navigates back during recording
            const checkActiveSession = async () => {
                try {
                    // Check for active recording in AudioService
                    const recordingStatus = AudioService.getRecordingStatus();
                    const hasActiveRecording = recordingStatus.isRecording || recordingStatus.activeMode === 'recording';
                    
                    // Check for existing draft (protection service may have segments)
                    const existingDraft = await protectionService.getDraft();
                    
                    if (hasActiveRecording || existingDraft) {
                        // Sync local state with active session instead of resetting
                        if (existingDraft) {
                            setRecordedDuration(existingDraft.total_duration || 0);
                            setTitle(existingDraft.metadata?.title || '');
                            setDescription(existingDraft.metadata?.description || '');
                            setCategory(existingDraft.metadata?.category || 'General');
                            setIsPublic(existingDraft.metadata?.is_public || false);
                        }
                        
                        setIsRecording(hasActiveRecording);
                        setCurrentStep('recording');
                        
                        // Don't reset - we're restoring an active session
                        return;
                    }
                } catch (error) {
                    Logger.error('Failed to check active session:', error);
                }
                
                // Only reset if no active session exists
                setIsRecording(false);
                setRecordedUri(null);
                setRecordedDuration(0);
                setIsAIEnabled(false);
                setTitle("");
                setDescription("");
                setCategory("General");
                setIsPublic(false);
                setIsUploading(false);
                setCurrentStep(mode === "quick-record" ? "recording" : "setup");
                setPermissionModalVisible(false);
                setDiscardConfirmVisible(false);
                setDraftLoaded(false);
                setRecordingMode("solo");
                setRtcMediaMode("video");
                setRtcSession(null);
                setRtcSessionState("idle");
                setRtcSessionSummary(null);
                setRtcLoading(false);
                setRtcError(null);
                setRtcStatusMessage(null);
                setRtcProcessingNotifId(null);
                setRtcLobbyAudioMuted(false);
                setRtcLobbyVideoMuted(false);
            };
            
            checkActiveSession();

            // Initialize audio
            initializeAudio();

            // Auto-start quick-record mode (just show recording UI, don't start services yet)
            // Services will start when user presses the actual record button
            // This prevents premature notifications

            // Cleanup when screen loses focus or unmounts
            return () => {
                // Only stop auto-backup timer, NOT recording
                // Recording should continue in background
                protectionService.stopAutoBackup();
                
                // DON'T stop recording here - it should continue in background
                // User can stop it manually or it will stop on app unmount
            };
        }, [mode, draftLoaded])
    );

    const loadDraftData = async () => {
        try {
            const draft = await protectionService.getDraft();
            if (!draft) {
                showToast('Draft not found', 'error');
                router.back();
                return;
            }

            // Load metadata
            setTitle(draft.metadata?.title || 'Recovered Recording');
            setDescription(draft.metadata?.description || '');
            setCategory(draft.metadata?.category || 'General');
            setIsPublic(draft.metadata?.is_public || false);
            setRecordingMode("solo");
            setRtcMediaMode("video");
            setRtcSession(null);
            setRtcSessionState("idle");
            setRtcSessionSummary(null);
            setRtcStatusMessage(null);
            
            // Load recording data
            setRecordedDuration(draft.total_duration || 0);
            
            // Validate segments exist for both modes
            if (!draft.segments || draft.segments.length === 0) {
                throw new Error('No segments found in draft');
            }
            
            // For resume mode, go to recording screen (but don't auto-start)
            if (mode === 'resume-draft') {
                // Use first segment for preview
                setRecordedUri(draft.segments[0].uri);
                setCurrentStep('recording');
                // Don't auto-start - let user press record button to continue
                // This gives them time to prepare and see the existing duration
            }
            // For save mode, use first segment and go to review screen
            else if (mode === 'save-draft') {
                // Use first segment for preview
                setRecordedUri(draft.segments[0].uri);
                setCurrentStep('review');
            }

            setDraftLoaded(true);
            showToast(`Draft loaded: ${draft.segments?.length || 0} segments`, 'success');
        } catch (error) {
            Logger.error('Failed to load draft:', error);
            showToast('Failed to load draft', 'error');
            router.back();
        }
    };

    const initializeAudio = async () => {
        try {
            const initialized = await AudioService.initialize();
            setAudioInitialized(initialized);

            if (!initialized) {
                setPermissionModalVisible(true);
            }
        } catch (error) {
            Logger.error("Audio initialization failed:", error);
            showToast("Failed to initialize audio. Please try again.", "error");
        }
    };

    const handleRecordingStart = async () => {
        try {
            // Only start new protection if not continuing from draft
            if (mode !== 'resume-draft' || !draftLoaded) {
                // Start protection service for new recording
                await protectionService.startProtection({
                    title: title || 'New Recording',
                    category
                });
            } else {
                // Continue mode - resume existing draft protection
                // Just restart auto-backup, don't create new draft
                protectionService.startAutoBackup();
            }

            // Start professional notification service (iOS & Android)
            // Check if notification is already active to prevent duplicates
            if (!backgroundService.isActive()) {
                await backgroundService.startRecording(title || 'New Recording');
            }

            setIsRecording(true);
            setCurrentStep("recording");
            showToast("Recording started", "success");
        } catch (error) {
            Logger.error("Recording start failed:", error);
            showToast(
                "Recording could not be started because safety protection failed. No audio was recorded.",
                "error"
            );
            // Ensure recording state is not set if protection fails
            setIsRecording(false);
        }
    };

    const handleRecordingStop = async (uri) => {
        setIsRecording(false);

        if (uri) {
            // Get recording duration from AudioService (before try block so it's accessible in catch)
            const status = AudioService.getRecordingStatus();
            const duration = status.duration || 0;
            
            try {
                // Save segment to protection service
                const segment = await protectionService.saveSegment(uri, duration);

                setRecordedUri(segment.uri); // Use permanent URI
                setRecordedDuration(duration);
                setCurrentStep("review");

                // Stop background notification
                await backgroundService.stopRecording();

                if (mode === "quick-record") {
                    const timestamp = new Date().toLocaleString();
                    setTitle(`Quick Recording - ${timestamp}`);
                }

                showToast("Recording saved safely", "success");
            } catch (error) {
                Logger.error("Recording save failed:", error);
                showToast("Recording completed but protection failed", "error");
                // Still proceed with URI - at least we have the recording
                setRecordedUri(uri);
                setRecordedDuration(duration); // Now accessible from outer scope
                setCurrentStep("review");
            }
        } else {
            Logger.error("Recording stopped but URI is null");
            showToast("Recording failed - no file was saved", "error");
            await backgroundService.stopRecording();
        }
    };

    const handleRecordingPause = () => {
        showToast("Recording paused", "success");
    };

    const handleRecordingResume = () => {
        showToast("Recording resumed", "success");
    };

    const handleAIToggle = (enabled) => {
        setIsAIEnabled(enabled);
        showToast(
            enabled ? "AI assistance enabled" : "AI assistance disabled",
            "success"
        );
    };

    const handleSaveRecording = async () => {
        if (recordingMode === "multi") {
            showToast("Live sessions are not saved yet.", "info");
            return;
        }

        if (!recordedUri) {
            showToast("No recording to save", "error");
            return;
        }

        // Prevent double submission
        if (isUploading) {
            return;
        }

        try {
            setIsUploading(true);

            // Validate title
            if (!title || title.trim() === "") {
                showToast("Please enter a podcast title", "error");
                setIsUploading(false);
                return;
            }

            // Get all segments from draft (for continue mode with multiple segments)
            const draft = await protectionService.getDraft();
            const segments = draft?.segments || [];
            
            if (segments.length === 0) {
                showToast("No valid recording found", "error");
                setIsUploading(false);
                return;
            }

            // Show appropriate loading message
            const loadingMessage = segments.length > 1 
                ? `Merging ${segments.length} segments...` 
                : "Uploading audio...";
            showToast(loadingMessage, "info");

            const filename = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.m4a`;
            const totalDuration = draft?.total_duration || recordedDuration;

            const podcastData = {
                title: title.trim(),
                description: description.trim() || "",
                category,
                is_public: isPublic,
                duration: totalDuration,
            };

            let uploadRes;

            // Use merge-upload for multiple segments, regular upload for single
            if (segments.length > 1) {
                const segmentFiles = segments.map((segment, idx) => ({
                    uri: segment.uri,
                    type: "audio/mp4",
                    name: `segment_${idx}.m4a`,
                }));

                uploadRes = await apiService.mergeAndUploadAudio(segmentFiles);
                showToast("Segments merged successfully", "success");
            } else {
                const uploadData = {
                    uri: segments[0].uri,
                    type: "audio/mp4",
                    name: filename,
                };

                uploadRes = await apiService.uploadAudio(uploadData);
            }

            // Create podcast with uploaded audio URL
            const finalPodcastData = {
                ...podcastData,
                audio_url: uploadRes.audio_url, // Add audio URL from upload response
            };

            const createdPodcast = await apiService.createPodcast(
                finalPodcastData
            );

            // Clear draft after successful save
            await protectionService.clearDraft();

            showToast("Podcast saved successfully!", "success");

            // Navigate to library and reset create page state
            // Use replace to prevent going back to review screen
            if (mode === "quick-record") {
                router.replace({
                    pathname: "/(main)/home",
                    params: { refresh: Date.now().toString() }
                });
            } else {
                router.replace({
                    pathname: "/(main)/library",
                    params: { refresh: Date.now().toString() }
                });
            }
        } catch (error) {
            Logger.error("Save failed:", error);
            const errorMessage =
                error.response?.data?.detail ||
                error.message ||
                "Failed to save podcast. Please try again.";
            showToast(errorMessage, "error");

            // Check if it's an auth error
            if (error.status === 401) {
                // Session expired - logout will be handled by apiService
                // User will be redirected to login automatically
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleDiscard = () => {
        setDiscardConfirmVisible(true);
    };

    const confirmDiscard = async () => {
        setDiscardConfirmVisible(false);
        
        // Clear draft when discarding
        await protectionService.clearDraft();
        await backgroundService.stopRecording();
        
        if (recordedUri) {
            await AudioService.deleteAudioFile(recordedUri);
        }

        setRtcSession(null);
        setRtcSessionState("idle");
        setRtcSessionSummary(null);
        setRtcStatusMessage(null);
        setRtcProcessingNotifId(null);
        setRtcLobbyAudioMuted(false);
        setRtcLobbyVideoMuted(false);

        router.back();
    };

    const startRtcSession = async () => {
        if (!title || title.trim() === "") {
            showToast("Please enter a podcast title", "error");
            return;
        }

        try {
            setRtcLoading(true);
            setRtcError(null);
            Logger.info("[RTC] Starting live session from create screen", {
                recordingMode,
                rtcMediaMode,
                title: title.trim(),
                category,
                isPublic,
            });

            const baseName = (title || "podcast-session")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            const roomName = `${baseName || "podcast-session"}-${Date.now()}`;

            const room = await apiService.createRtcRoom({
                name: roomName,
                description: description?.trim() || undefined,
                title: title.trim(),
                category,
                is_public: isPublic,
                media_mode: rtcMediaMode,
            });

            Logger.info("[RTC] Room created", {
                roomId: room?.id,
                roomName: room?.name,
                sessionId: room?.session_id,
            });

            const tokenResponse = await apiService.createRtcToken({
                room_id: room.id,
                role: "host",
            });

            Logger.info("[RTC] Token created", {
                roomId: room?.id,
                hasToken: Boolean(tokenResponse?.token),
                tokenLength: tokenResponse?.token?.length || 0,
            });

            setRtcSession({
                roomId: room.id,
                roomName: room.name,
                token: tokenResponse.token,
                sessionId: room.session_id,
                inviteCode: room.invite_code,
                shareUrl: room.invite_code
                    ? `${apiService.baseURL.replace(/\/$/, "")}/share/live/${room.invite_code}`
                    : null,
            });
            setRtcSessionSummary({
                id: room.session_id,
                room_id: room.id,
                room_name: room.name,
                title: title.trim(),
                category,
                media_mode: rtcMediaMode,
                status: "created",
                is_live: false,
                invite_code: room.invite_code,
            });
            setRtcSessionState("lobby");
            setRtcStatusMessage("Invite guests, then go live when you're ready.");
            setCurrentStep("recording");
            Logger.info("[RTC] UI transitioned to recording step", {
                roomId: room?.id,
                sessionId: room?.session_id,
            });
        } catch (error) {
            Logger.error("RTC session start failed:", error);
            setRtcError(error?.message || "Failed to start live session");
            showToast("Failed to start live session", "error");
        } finally {
            setRtcLoading(false);
        }
    };

    const fetchRtcSessionStatus = useCallback(async () => {
        if (!rtcSession?.sessionId) {
            return null;
        }

        try {
            Logger.debug("[RTC] Polling session status", {
                sessionId: rtcSession.sessionId,
                roomId: rtcSession.roomId,
            });

            const session = await apiService.getRtcSession(rtcSession.sessionId);
            setRtcSessionSummary((prev) => ({
                ...prev,
                ...session,
            }));

            Logger.debug("[RTC] Session status received", {
                sessionId: rtcSession.sessionId,
                status: session?.status,
                hasRecordingUrl: Boolean(session?.recording_url),
                podcastId: session?.podcast_id,
            });

            if (session.recording_url) {
                setRtcStatusMessage("Recording ready. Adding to library.");
            }

            return session;
        } catch (error) {
            Logger.error("RTC session fetch failed:", error);
            return null;
        }
    }, [rtcSession?.sessionId]);

    const handleShareRtcInvite = useCallback(async () => {
        if (!rtcSession?.shareUrl) {
            showToast("Invite link is not ready yet", "error");
            return;
        }

        try {
            const shareText = [
                `Join my live podcast: ${title || "Live Session"}`,
                description?.trim() || null,
                rtcSession.shareUrl,
                rtcSession.inviteCode ? `Invite code: ${rtcSession.inviteCode}` : null,
            ]
                .filter(Boolean)
                .join("\n\n");

            await Share.share({
                message: shareText,
                url: rtcSession.shareUrl,
            });
        } catch (error) {
            Logger.error("RTC share failed:", error);
            showToast("Could not open the share sheet", "error");
        }
    }, [description, rtcSession?.inviteCode, rtcSession?.shareUrl, showToast, title]);

    const handleGoLive = useCallback(() => {
        if (!rtcSession?.token) {
            showToast("Live session is not ready yet", "error");
            return;
        }

        setRtcError(null);
        setRtcStatusMessage("Joining room...");
        setRtcSessionState("joining");
    }, [rtcSession?.token, showToast]);

    useEffect(() => {
        if (recordingMode !== "multi") {
            return;
        }

        if (rtcSessionState !== "ended") {
            return;
        }

        let isMounted = true;
        let attempts = 0;
        let timeoutId;

        const getNextPollDelay = (attemptNumber) => {
            if (attemptNumber < 6) {
                return 5000;
            }

            if (attemptNumber < 18) {
                return 10000;
            }

            if (attemptNumber < 34) {
                return 15000;
            }

            return null;
        };

        const pollStatus = async () => {
            attempts += 1;
            const session = await fetchRtcSessionStatus();

            if (!isMounted) {
                return;
            }

            if (session?.recording_url || session?.podcast_id) {
                setRtcSessionState("ready");
                setRtcStatusMessage("Recording ready");
                // Upgrade the processing notification to "ready"
                if (rtcProcessingNotifId) {
                    useNotificationStore.getState().updateNotification(rtcProcessingNotifId, {
                        type: "rtc_ready",
                        title: "Podcast Ready! 🎙️",
                        message: `"${title || "Your session"}" is ready to listen. Tap to open.`,
                        action: {
                            type: "navigate",
                            screen: "details",
                            params: { id: session.podcast_id },
                        },
                    });
                }
                return;
            }

            const nextDelay = getNextPollDelay(attempts);
            if (nextDelay) {
                timeoutId = setTimeout(pollStatus, nextDelay);
            } else {
                setRtcStatusMessage("Recording still processing. Check back in a few minutes.");
            }
        };

        pollStatus();

        return () => {
            isMounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [fetchRtcSessionStatus, recordingMode, rtcProcessingNotifId, rtcSessionState, title]);

    // Intercept Android back button while recording is processing
    useEffect(() => {
        if (
            recordingMode !== "multi" ||
            rtcSessionState !== "ended" ||
            rtcSessionSummary?.podcast_id
        ) {
            return;
        }

        const backAction = () => {
            Alert.alert(
                "Recording is Processing",
                "Your recording is still being processed. A notification will appear in the Notifications tab when it's ready.\n\nLeave anyway?",
                [
                    { text: "Stay", style: "cancel" },
                    { text: "Leave", style: "destructive", onPress: () => router.back() },
                ]
            );
            return true; // prevent default back action
        };

        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, [recordingMode, rtcSessionState, rtcSessionSummary?.podcast_id]);

    const renderSetupStep = () => (
        <ScrollView className="flex-1 px-6 pt-6">
            <Text className="text-2xl font-bold text-text-primary mb-6">
                Create New Podcast
            </Text>

            <View className="space-y-4">
                <View>
                    <Text className="text-text-primary font-semibold mb-2">
                        Title
                    </Text>
                    <TextInput
                        className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border"
                        placeholder="Enter podcast title"
                        placeholderTextColor="#888"
                        value={title}
                        onChangeText={setTitle}
                        maxLength={100}
                    />
                </View>

                <View>
                    <Text className="text-text-primary font-semibold mb-2">
                        Description
                    </Text>
                    <TextInput
                        className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border"
                        placeholder="Describe your podcast"
                        placeholderTextColor="#888"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                        maxLength={500}
                        textAlignVertical="top"
                    />
                </View>

                <View>
                    <Text className="text-text-primary font-semibold mb-2">
                        Category
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                        {[
                            "General",
                            "Tech",
                            "Business",
                            "Education",
                            "Entertainment",
                            "Health",
                        ].map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setCategory(cat)}
                                className={`px-4 py-2 rounded-full border ${
                                    category === cat
                                        ? "bg-primary border-primary"
                                        : "bg-panel border-border"
                                }`}
                            >
                                <Text
                                    className={`${
                                        category === cat
                                            ? "text-white"
                                            : "text-text-secondary"
                                    }`}
                                >
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View className="flex-row items-center justify-between py-4">
                    <Text className="text-text-primary font-semibold">
                        Make Public
                    </Text>
                    <TouchableOpacity
                        onPress={() => setIsPublic(!isPublic)}
                        className={`w-12 h-6 rounded-full ${
                            isPublic ? "bg-primary" : "bg-border"
                        }`}
                    >
                        <View
                            className={`w-5 h-5 bg-white rounded-full m-0.5 ${
                                isPublic ? "ml-auto" : ""
                            }`}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {mode === "full-create" && (
                <View className="space-y-4">
                    <View>
                        <Text className="text-text-primary font-semibold mb-2">
                            Recording Mode
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            {[
                                { key: "solo", label: "Solo recording" },
                                { key: "multi", label: "Multi-host live" },
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.key}
                                    onPress={() => setRecordingMode(option.key)}
                                    className={`px-4 py-2 rounded-full border ${
                                        recordingMode === option.key
                                            ? "bg-primary border-primary"
                                            : "bg-panel border-border"
                                    }`}
                                >
                                    <Text
                                        className={`${
                                            recordingMode === option.key
                                                ? "text-white"
                                                : "text-text-secondary"
                                        }`}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {recordingMode === "multi" && (
                        <View>
                            <Text className="text-text-primary font-semibold mb-2">
                                Session Format
                            </Text>
                            <View className="flex-row flex-wrap gap-2">
                                {[
                                    { key: "audio", label: "Audio only" },
                                    { key: "video", label: "Audio + video" },
                                ].map((option) => (
                                    <TouchableOpacity
                                        key={option.key}
                                        onPress={() => setRtcMediaMode(option.key)}
                                        className={`px-4 py-2 rounded-full border ${
                                            rtcMediaMode === option.key
                                                ? "bg-primary border-primary"
                                                : "bg-panel border-border"
                                        }`}
                                    >
                                        <Text
                                            className={`${
                                                rtcMediaMode === option.key
                                                    ? "text-white"
                                                    : "text-text-secondary"
                                            }`}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            )}

            <TouchableOpacity
                onPress={() =>
                    recordingMode === "multi"
                        ? startRtcSession()
                        : setCurrentStep("recording")
                }
                className="bg-primary py-4 rounded-lg mt-8 mb-6"
                disabled={!title.trim() || rtcLoading}
            >
                <Text className="text-white text-center font-semibold text-lg">
                    {recordingMode === "multi"
                        ? rtcLoading
                            ? "Preparing lobby..."
                            : "Continue to Live Setup"
                        : "Start Recording"}
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderRecordingStep = () => {
        if (recordingMode === "multi") {
            if (rtcSessionState === "lobby") {
                return (
                    <ScrollView className="flex-1 px-6 pt-6">
                        <Text className="text-2xl font-bold text-text-primary text-center mb-3">
                            Ready Check
                        </Text>
                        <Text className="text-text-secondary text-center mb-6 leading-6">
                            Invite your guests, choose your initial mic and camera state, then go live when everyone is ready.
                        </Text>

                        <View className="bg-panel rounded-2xl p-4 mb-4 border border-border">
                            <Text className="text-text-primary font-semibold mb-3">
                                Session Info
                            </Text>
                            <Text className="text-text-secondary mb-1">
                                Title: {title || "Live Session"}
                            </Text>
                            <Text className="text-text-secondary mb-1">
                                Format: {rtcMediaMode === "video" ? "Video" : "Audio"}
                            </Text>
                            <Text className="text-text-secondary mb-1">
                                Room: {rtcSession?.roomName || "Preparing..."}
                            </Text>
                            {rtcSession?.inviteCode && (
                                <Text className="text-text-secondary">
                                    Invite code: {rtcSession.inviteCode}
                                </Text>
                            )}
                        </View>

                        <View className="bg-card rounded-2xl p-4 mb-4 border border-border">
                            <Text className="text-text-primary font-semibold mb-3">
                                Join Defaults
                            </Text>

                            <TouchableOpacity
                                onPress={() => setRtcLobbyAudioMuted((prev) => !prev)}
                                className="flex-row items-center justify-between py-3 border-b border-border"
                            >
                                <View className="flex-row items-center">
                                    <Ionicons
                                        name={rtcLobbyAudioMuted ? "mic-off" : "mic"}
                                        size={20}
                                        color={rtcLobbyAudioMuted ? COLORS.error : COLORS.text.primary}
                                    />
                                    <Text className="text-text-primary ml-3 font-medium">
                                        Start with microphone {rtcLobbyAudioMuted ? "off" : "on"}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={COLORS.text.muted} />
                            </TouchableOpacity>

                            {rtcMediaMode === "video" && (
                                <TouchableOpacity
                                    onPress={() => setRtcLobbyVideoMuted((prev) => !prev)}
                                    className="flex-row items-center justify-between py-3"
                                >
                                    <View className="flex-row items-center">
                                        <Ionicons
                                            name={rtcLobbyVideoMuted ? "videocam-off" : "videocam"}
                                            size={20}
                                            color={rtcLobbyVideoMuted ? COLORS.error : COLORS.text.primary}
                                        />
                                        <Text className="text-text-primary ml-3 font-medium">
                                            Start with camera {rtcLobbyVideoMuted ? "off" : "on"}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={COLORS.text.muted} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View className="bg-success/10 rounded-2xl p-4 mb-6 border border-success/20">
                            <Text className="text-success font-semibold mb-2">
                                Invite Guests
                            </Text>
                            <Text className="text-text-secondary leading-6">
                                Share the invite link now. The room is prepared, but your live session will not begin until you tap Go Live.
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleShareRtcInvite}
                            className="border border-border py-4 rounded-lg mb-3"
                        >
                            <Text className="text-text-primary text-center font-semibold text-base">
                                Share Invite Link
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleGoLive}
                            className="bg-primary py-4 rounded-lg mb-3"
                        >
                            <Text className="text-white text-center font-semibold text-base">
                                Go Live Now
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleDiscard}
                            className="border border-error py-4 rounded-lg mb-8"
                        >
                            <Text className="text-error text-center font-semibold">
                                Cancel Session
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                );
            }

            return (
                <View className="flex-1 px-6">
                    <Text className="text-2xl font-bold text-text-primary text-center mt-6 mb-4">
                        {title || "Live Session"}
                    </Text>

                    {rtcError && (
                        <View className="mb-4 p-3 rounded-lg bg-error/20">
                            <Text className="text-error text-center">
                                {rtcError}
                            </Text>
                        </View>
                    )}

                    <Text className="text-text-secondary text-center mb-3">
                        Status: {rtcSessionState === "live" ? "Live" : "Joining"}
                    </Text>

                    {rtcStatusMessage && (
                        <View className="mb-4 px-3 py-2 rounded-lg bg-success/15">
                            <Text className="text-success text-center">
                                {rtcStatusMessage}
                            </Text>
                        </View>
                    )}

                    {rtcSession ? (
                        <HmsRoom
                            token={rtcSession.token}
                            roomName={rtcSession.roomName}
                            userName={userDisplayName}
                            enableVideo={rtcMediaMode === "video"}
                            startAudioMuted={rtcLobbyAudioMuted}
                            startVideoMuted={rtcLobbyVideoMuted}
                            onJoin={() => {
                                setRtcSessionState("live");
                                setRtcStatusMessage("You're live.");
                                if (rtcSession?.sessionId) {
                                    apiService.startRtcSession(rtcSession.sessionId).catch((error) => {
                                        Logger.error("Failed to mark RTC session live:", error);
                                    });
                                }
                            }}
                            onError={(errorMsg) => {
                                Logger.error("HMS Room error:", errorMsg);
                                setRtcError(errorMsg);
                                showToast(errorMsg, "error");
                            }}
                            onLeave={(summary) => {
                                if (rtcSession?.sessionId) {
                                    apiService.endRtcSession(rtcSession.sessionId).catch((error) => {
                                        Logger.error("Failed to mark RTC session ended:", error);
                                    });
                                }
                                Logger.info("[RTC] HmsRoom onLeave received", {
                                    summary,
                                    sessionId: rtcSession?.sessionId,
                                    roomId: rtcSession?.roomId,
                                });
                                setRtcSessionState("ended");
                                setRtcSessionSummary((prev) => ({
                                    ...prev,
                                    ...summary,
                                }));
                                setCurrentStep("review");
                                // Dispatch a persistent "processing" notification
                                // so the user can safely navigate away and return
                                const notif = useNotificationStore.getState().addNotification({
                                    type: "rtc_processing",
                                    title: "Recording Processing",
                                    message: `"${title || "Your session"}" is being processed. We'll notify you when it's ready.`,
                                    action: { type: "navigate", screen: "library" },
                                });
                                setRtcProcessingNotifId(notif.id);
                            }}
                        />
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color={COLORS.primary} size="large" />
                            <Text className="text-text-secondary mt-4">
                                Preparing live session...
                            </Text>
                        </View>
                    )}

                    <View className="mt-4 p-3 rounded-lg bg-success/15">
                        <Text className="text-success text-center">
                            Recording will be processed server-side. Session status is automatically checked after completion.
                        </Text>
                    </View>
                </View>
            );
        }

        return (
            <View className="flex-1 justify-center px-6">
                <Text className="text-2xl font-bold text-text-primary text-center mb-8">
                    {mode === "quick-record"
                        ? "Quick Record"
                        : title || "Recording"}
                </Text>

                <RecordingControls
                    onRecordingStart={handleRecordingStart}
                    onRecordingStop={handleRecordingStop}
                    onRecordingPause={handleRecordingPause}
                    onRecordingResume={handleRecordingResume}
                    onAIAssistToggle={handleAIToggle}
                    isAIEnabled={isAIEnabled}
                    isRecording={isRecording}
                    initialDuration={recordedDuration} // Pass existing duration for continue mode
                    disabled={!audioInitialized}
                />

                {!audioInitialized && (
                    <View className="mt-8 p-4 bg-warning/20 rounded-lg">
                        <Text className="text-warning text-center">
                            Audio permissions required to start recording
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    const renderReviewStep = () => {
        if (recordingMode === "multi") {
            const durationSeconds =
                rtcSessionSummary?.duration_seconds ||
                rtcSessionSummary?.durationSeconds ||
                0;
            const minutes = Math.floor(durationSeconds / 60);
            const seconds = durationSeconds % 60;
            const isReady = Boolean(rtcSessionSummary?.podcast_id);
            const isProcessing = !isReady && rtcSessionState === "ended";

            return (
                <ScrollView className="flex-1 px-6 pt-6">
                    <Text className="text-2xl font-bold text-text-primary mb-6">
                        Session Summary
                    </Text>

                    <View className="bg-panel rounded-lg p-4 mb-4">
                        <Text className="text-text-primary font-semibold mb-2">
                            Live Session Details
                        </Text>
                        <Text className="text-text-secondary">
                            Room: {rtcSession?.roomName || "Live session"}
                        </Text>
                        <Text className="text-text-secondary">
                            Duration: {minutes.toString().padStart(2, "0")}:{seconds
                                .toString()
                                .padStart(2, "0")}
                        </Text>
                        <Text className="text-text-secondary">
                            Format: {rtcMediaMode === "video" ? "Video" : "Audio"}
                        </Text>
                        <Text className="text-text-secondary">
                            Participants: {rtcSessionSummary?.participantCount || 1}
                        </Text>
                    </View>

                    {isReady ? (
                        <View
                            className="rounded-lg p-4 mb-6 flex-row items-center"
                            style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
                        >
                            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                            <Text className="text-success font-semibold ml-3 flex-1">
                                Podcast is ready!
                            </Text>
                        </View>
                    ) : (
                        <View
                            className="rounded-lg p-4 mb-6"
                            style={{ backgroundColor: "rgba(245,158,11,0.15)" }}
                        >
                            <View className="flex-row items-center justify-center mb-2">
                                <ActivityIndicator size="small" color={COLORS.warning} />
                                <Text className="text-warning font-semibold ml-2">
                                    Processing recording...
                                </Text>
                            </View>
                            <Text className="text-text-secondary text-center text-sm">
                                This usually takes 1–3 minutes. You'll get a notification when it's done — you can safely go home and wait.
                            </Text>
                        </View>
                    )}

                    <View className="space-y-3 mb-6">
                        {isReady ? (
                            <TouchableOpacity
                                onPress={() =>
                                    router.replace({
                                        pathname: "/(main)/details",
                                        params: { id: rtcSessionSummary.podcast_id },
                                    })
                                }
                                className="bg-primary py-4 mb-3 rounded-lg"
                            >
                                <Text className="text-white text-center font-semibold text-base">
                                    Open Podcast
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity
                                    onPress={() => router.replace("/(main)/home")}
                                    className="bg-primary py-4 mb-3 rounded-lg"
                                >
                                    <Text className="text-white text-center font-semibold text-base">
                                        Go to Home
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={fetchRtcSessionStatus}
                                    className="border border-border py-3 mb-3 rounded-lg"
                                >
                                    <Text className="text-text-secondary text-center text-sm">
                                        Check Status Manually
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}

                        <TouchableOpacity
                            onPress={handleDiscard}
                            className="border border-error py-4 rounded-lg"
                        >
                            <Text className="text-error text-center font-semibold">
                                Discard Session
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            );
        }

        return (
            <ScrollView className="flex-1 px-6 pt-6">
                <Text className="text-2xl font-bold text-text-primary mb-6">
                    Review Recording
                </Text>

            {/* Recording Info */}
            <View className="bg-panel rounded-lg p-4 mb-6">
                <Text className="text-text-primary font-semibold mb-2">
                    Recording Details
                </Text>
                <Text className="text-text-secondary">
                    Duration:{" "}
                    {(() => {
                        const mins = Math.floor(recordedDuration / 60);
                        const secs = recordedDuration % 60;
                        return `${mins.toString().padStart(2, "0")}:${secs
                            .toString()
                            .padStart(2, "0")}`;
                    })()}
                </Text>
                <Text className="text-text-secondary">
                    Format:{" "}
                    {Platform.OS === "ios" ? "M4A (iOS)" : "M4A (Android)"}
                </Text>
                {isAIEnabled && (
                    <Text className="text-text-secondary">
                        🤖 AI Enhancement: Ready for processing
                    </Text>
                )}
            </View>

            {/* Metadata (for full create mode) */}
            {mode === "full-create" && (
                <View className="space-y-4 mb-6">
                    <View>
                        <Text className="text-text-primary font-semibold mb-2">
                            Title
                        </Text>
                        <Text className="text-text-secondary">{title}</Text>
                    </View>

                    {description && (
                        <View>
                            <Text className="text-text-primary font-semibold mb-2">
                                Description
                            </Text>
                            <Text className="text-text-secondary">
                                {description}
                            </Text>
                        </View>
                    )}

                    <View>
                        <Text className="text-text-primary font-semibold mb-2">
                            Category
                        </Text>
                        <Text className="text-text-secondary">{category}</Text>
                    </View>
                </View>
            )}

            {/* Action Buttons */}
            <View className="space-y-4 mb-6">
                <TouchableOpacity
                    onPress={handleSaveRecording}
                    className="bg-primary py-4 mb-4 rounded-lg"
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <View className="flex-row items-center justify-center">
                            <ActivityIndicator color="white" className="mr-2" />
                            <Text className="text-white font-semibold">
                                Saving...
                            </Text>
                        </View>
                    ) : (
                        <Text className="text-white text-center font-semibold">
                            Save Podcast
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleDiscard}
                    className="border border-error py-4 rounded-lg"
                    disabled={isUploading}
                >
                    <Text className="text-error text-center font-semibold">
                        Discard Recording
                    </Text>
                </TouchableOpacity>
            </View>
            </ScrollView>
        );
    };

    return (
        <SafeAreaView
            className="flex-1 bg-background"
            style={{ paddingTop: insets.top }}
        >
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
                </TouchableOpacity>

                <Text className="text-text-primary font-semibold">
                    {mode === "quick-record"
                        ? "Quick Record"
                        : "Create Podcast"}
                </Text>

                <View style={{ width: 24 }} />
            </View>

            {/* Content */}
            {currentStep === "setup" && renderSetupStep()}
            {currentStep === "recording" && renderRecordingStep()}
            {currentStep === "review" && renderReviewStep()}

            {/* Permission Modal */}
            <PermissionModal
                visible={permissionModalVisible}
                onClose={() => {
                    setPermissionModalVisible(false);
                    router.back();
                }}
                onOpenSettings={() => {
                    setPermissionModalVisible(false);
                    Linking.openSettings();
                }}
                title="Microphone Permission Required"
                message="Please grant microphone permissions to record podcasts."
                icon="mic"
            />

            {/* Discard Confirmation Modal */}
            <ConfirmationModal
                visible={discardConfirmVisible}
                onClose={() => setDiscardConfirmVisible(false)}
                onConfirm={confirmDiscard}
                title="Discard Recording"
                message="Are you sure you want to discard this recording? This action cannot be undone."
                confirmText="Discard"
                cancelText="Cancel"
                destructive={true}
                icon="trash"
            />
        </SafeAreaView>
    );
};

export default Create;
