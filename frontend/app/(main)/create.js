import React, { useState, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import RecordingControls from "../../src/components/recording/RecordingControls";
import AudioService from "../../src/services/audio";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";
import Logger from "../../src/utils/logger";
import PermissionModal from "../../src/components/PermissionModal";
import ConfirmationModal from "../../src/components/ConfirmationModal";

const Create = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { showToast } = useToast();

    // Mode: 'quick-record' or 'full-create'
    const mode = params.mode || "full-create";

    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedUri, setRecordedUri] = useState(null);
    const [recordedDuration, setRecordedDuration] = useState(0); // Store duration in seconds
    const [isAIEnabled, setIsAIEnabled] = useState(false);
    const [audioInitialized, setAudioInitialized] = useState(false);

    // Podcast metadata
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("General");
    const [isPublic, setIsPublic] = useState(false);

    // UI state
    const [isUploading, setIsUploading] = useState(false);
    const [currentStep, setCurrentStep] = useState(
        mode === "quick-record" ? "recording" : "setup"
    );

    // Modal state
    const [permissionModalVisible, setPermissionModalVisible] = useState(false);
    const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);

    useEffect(() => {
        initializeAudio();

        // Auto-start recording for quick-record mode
        if (mode === "quick-record") {
            setTimeout(() => {
                handleRecordingStart();
            }, 500);
        }
    }, []);

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

    const handleRecordingStart = () => {
        setIsRecording(true);
        setCurrentStep("recording");
        showToast("Recording started", "success");
    };

    const handleRecordingStop = async (uri) => {
        setIsRecording(false);

        if (uri) {
            // Get recording duration from AudioService before stopping
            const status = AudioService.getRecordingStatus();
            const duration = status.duration || 0; // Duration in seconds

            setRecordedUri(uri);
            setRecordedDuration(duration);
            setCurrentStep("review");

            if (mode === "quick-record") {
                // For quick record, auto-save with timestamp
                const timestamp = new Date().toLocaleString();
                setTitle(`Quick Recording - ${timestamp}`);
            }

            showToast("Recording completed", "success");
        } else {
            // URI is null - recording may have failed
            Logger.error("Recording stopped but URI is null");
            showToast(
                "Recording failed - no file was saved. Please try again.",
                "error"
            );
            // Stay on recording step so user can try again
            // Don't change currentStep
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

        try {
            setIsUploading(true);

            // Validate title
            if (!title || title.trim() === "") {
                showToast("Please enter a podcast title", "error");
                setIsUploading(false);
                return;
            }

            // Prepare filename from title
            const filename = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.${
                Platform.OS === "ios" ? "m4a" : "m4a"
            }`;

            // Prepare metadata - use backend field names (snake_case)
            const podcastData = {
                title: title.trim(),
                description: description.trim() || "",
                category,
                is_public: isPublic, // Backend expects snake_case
                duration: recordedDuration, // Duration in seconds
                // audio_url will be added after upload
            };

            Logger.log("📤 Uploading audio file:", {
                uri: recordedUri,
                filename,
                duration: recordedDuration,
            });

            // Upload audio file - recording is already saved at recordedUri
            const uploadData = {
                uri: recordedUri, // Use the URI from stopRecording directly
                type: Platform.OS === "ios" ? "audio/mp4" : "audio/mp4", // Android also uses m4a
                name: filename,
            };

            const uploadRes = await apiService.uploadAudio(uploadData);

            Logger.log("✅ Audio uploaded, creating podcast:", {
                audio_url: uploadRes.audio_url,
                podcastData,
            });

            // Create podcast with uploaded audio URL
            const finalPodcastData = {
                ...podcastData,
                audio_url: uploadRes.audio_url, // Add audio URL from upload response
            };

            Logger.log("📝 Creating podcast with data:", finalPodcastData);

            const createdPodcast = await apiService.createPodcast(
                finalPodcastData
            );

            Logger.log("✅ Podcast created successfully:", createdPodcast);

            showToast("Podcast saved successfully!", "success");

            // Navigate back or to podcast list
            if (mode === "quick-record") {
                router.back();
            } else {
                router.push("/(main)/library");
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
                Logger.warn("Authentication error - session may have expired");
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
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
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
