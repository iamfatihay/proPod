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
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import RecordingControls from "../../src/components/recording/RecordingControls";
import AudioService from "../../src/services/audio";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";
import Logger from "../../src/utils/logger";
import PermissionModal from "../../src/components/PermissionModal";
import ConfirmationModal from "../../src/components/ConfirmationModal";
import { COLORS } from "../../src/constants/theme";
import protectionService from "../../src/services/recording/protectionService";
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
    const [autoStartRecording, setAutoStartRecording] = useState(false);

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
            
            // Load recording data
            setRecordedDuration(draft.total_duration || 0);
            
            // For resume mode, go to recording screen (but don't auto-start)
            if (mode === 'resume-draft') {
                // Use first segment for preview
                if (draft.segments && draft.segments.length > 0) {
                    setRecordedUri(draft.segments[0].uri);
                }
                setCurrentStep('recording');
                // Don't auto-start - let user press record button to continue
                // This gives them time to prepare and see the existing duration
            }
            // For save mode, use first segment and go to review screen
            else if (mode === 'save-draft') {
                // Use first segment for preview
                if (draft.segments && draft.segments.length > 0) {
                    setRecordedUri(draft.segments[0].uri);
                    setCurrentStep('review');
                } else {
                    throw new Error('No segments found in draft');
                }
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

    // Auto-start recording when continuing from draft
    useEffect(() => {
        if (autoStartRecording && audioInitialized && currentStep === 'recording' && !isRecording) {
            setAutoStartRecording(false); // Reset flag
            handleRecordingStart();
        }
    }, [autoStartRecording, audioInitialized, currentStep, isRecording]);

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
            await backgroundService.startRecording(title || 'New Recording');

            setIsRecording(true);
            setCurrentStep("recording");
            showToast("Recording started", "success");
        } catch (error) {
            Logger.error("Recording start failed:", error);
            showToast("Failed to start recording protection", "error");
        }
    };

    const handleRecordingStop = async (uri) => {
        setIsRecording(false);

        if (uri) {
            try {
                // Get recording duration from AudioService
                const status = AudioService.getRecordingStatus();
                const duration = status.duration || 0;

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
                setRecordedDuration(status?.duration || 0);
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
        router.back();
    };

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

            <TouchableOpacity
                onPress={() => setCurrentStep("recording")}
                className="bg-primary py-4 rounded-lg mt-8 mb-6"
                disabled={!title.trim()}
            >
                <Text className="text-white text-center font-semibold text-lg">
                    Start Recording
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderRecordingStep = () => (
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

    const renderReviewStep = () => (
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
