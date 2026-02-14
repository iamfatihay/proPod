/**
 * Recording Protection Service
 * Provides 2-layer protection for podcast recordings:
 * - Layer 1: Immediate FileSystem permanent storage
 * - Layer 2: AsyncStorage metadata backup for draft recovery
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../../utils/logger';
import apiService from '../api/apiService';

const DRAFT_KEY = 'active_podcast_draft';
const SEGMENT_DIR = `${FileSystem.documentDirectory}podcast_segments/`;

class RecordingProtectionService {
    constructor() {
        this.currentDraftId = null;
    }

    /**
     * Initialize draft protection for new recording session
     */
    async startProtection(metadata = {}) {
        try {
            this.currentDraftId = Date.now();
            
            await FileSystem.makeDirectoryAsync(SEGMENT_DIR, { intermediates: true });
            
            const draft = {
                id: this.currentDraftId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {
                    title: metadata.title || 'Untitled Recording',
                    category: metadata.category || 'General',
                    ...metadata
                },
                segments: [],
                total_duration: 0
            };

            await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            
            return this.currentDraftId;
        } catch (error) {
            Logger.error('❌ Protection start failed:', error);
            throw error;
        }
    }

    /**
     * Layer 1: Save segment immediately to FileSystem
     */
    async saveSegment(segmentUri, duration) {
        // Load current draft ID if not set (e.g., after app restart/continue mode)
        if (!this.currentDraftId) {
            const draft = await this.getDraft();
            if (draft) {
                this.currentDraftId = draft.id;
            } else {
                throw new Error('No active draft found. Call startProtection() first.');
            }
        }

        try {
            const timestamp = Date.now();
            const fileName = `segment_${timestamp}.m4a`;
            const permanentPath = `${SEGMENT_DIR}${fileName}`;

            await FileSystem.copyAsync({
                from: segmentUri,
                to: permanentPath
            });

            const segmentData = {
                uri: permanentPath,
                duration,
                timestamp,
                size: await this.getFileSize(permanentPath)
            };

            await this.updateDraftSegments(segmentData);
            return segmentData;
        } catch (error) {
            Logger.error('❌ Segment save failed:', error);
            throw error;
        }
    }

    /**
     * Layer 2: Update AsyncStorage metadata
     */
    async updateDraftSegments(segmentData) {
        try {
            const draft = await this.getDraft();
            if (!draft) {
                throw new Error('No active draft found');
            }

            draft.segments.push(segmentData);
            draft.total_duration += segmentData.duration;
            draft.updated_at = new Date().toISOString();

            await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (error) {
            Logger.error('❌ Draft update failed:', error);
            throw error;
        }
    }

    /**
     * Get current draft
     */
    async getDraft() {
        try {
            const draftJson = await AsyncStorage.getItem(DRAFT_KEY);
            return draftJson ? JSON.parse(draftJson) : null;
        } catch (error) {
            Logger.error('Draft retrieval failed:', error);
            return null;
        }
    }

    /**
     * Check for existing drafts on app startup
     */
    async checkForDrafts() {
        try {
            const draft = await this.getDraft();
            if (!draft) return null;

            // Verify segments exist
            const validSegments = [];
            for (const segment of draft.segments) {
                const fileInfo = await FileSystem.getInfoAsync(segment.uri);
                if (fileInfo.exists) {
                    validSegments.push(segment);
                } else {
                    Logger.warn('Segment file missing:', segment.uri);
                }
            }

            if (validSegments.length === 0) {
                await this.clearDraft();
                return null;
            }

            draft.segments = validSegments;
            draft.total_duration = validSegments.reduce((sum, s) => sum + s.duration, 0);
            
            return draft;
        } catch (error) {
            Logger.error('Draft check failed:', error);
            return null;
        }
    }

    /**
     * Clear draft after successful save
     */
    async clearDraft() {
        try {
            await AsyncStorage.removeItem(DRAFT_KEY);
            
            const dirInfo = await FileSystem.getInfoAsync(SEGMENT_DIR);
            if (dirInfo.exists) {
                await FileSystem.deleteAsync(SEGMENT_DIR, { idempotent: true });
            }
            
            this.currentDraftId = null;
        } catch (error) {
            Logger.error('Draft clear failed:', error);
        }
    }

    /**
     * Update draft metadata (title, description, etc.)
     */
    async updateMetadata(updates) {
        try {
            const draft = await this.getDraft();
            if (!draft) return;

            draft.metadata = { ...draft.metadata, ...updates };
            draft.updated_at = new Date().toISOString();

            await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (error) {
            Logger.error('Metadata update failed:', error);
        }
    }

    /**
     * Get file size in bytes
     */
    async getFileSize(uri) {
        try {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            return fileInfo.size || 0;
        } catch {
            return 0;
        }
    }
}

export default new RecordingProtectionService();
