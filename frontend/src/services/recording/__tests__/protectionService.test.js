/**
 * Unit Tests for RecordingProtectionService
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import protectionService from '../protectionService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-file-system');
jest.mock('../../api/apiService');
jest.mock('../../../utils/logger');

describe('RecordingProtectionService', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        
        // Reset service state
        protectionService.stopAutoBackup();
        protectionService.currentDraftId = null;
    });

    describe('startProtection', () => {
        it('should initialize protection with valid metadata', async () => {
            FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
            AsyncStorage.setItem.mockResolvedValue(undefined);

            const metadata = {
                title: 'Test Recording',
                category: 'Tech'
            };

            const draftId = await protectionService.startProtection(metadata);

            expect(draftId).toBeDefined();
            expect(typeof draftId).toBe('number');
            expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledTimes(1);
            expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
        });

        it('should use default metadata if not provided', async () => {
            FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
            AsyncStorage.setItem.mockResolvedValue(undefined);

            await protectionService.startProtection();

            const setItemCall = AsyncStorage.setItem.mock.calls[0];
            const savedDraft = JSON.parse(setItemCall[1]);

            expect(savedDraft.metadata.title).toBe('Untitled Recording');
            expect(savedDraft.metadata.category).toBe('General');
        });

        it('should throw error if FileSystem fails', async () => {
            FileSystem.makeDirectoryAsync.mockRejectedValue(new Error('Permission denied'));

            await expect(protectionService.startProtection()).rejects.toThrow();
        });
    });

    describe('saveSegment', () => {
        beforeEach(async () => {
            FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
            AsyncStorage.setItem.mockResolvedValue(undefined);
            await protectionService.startProtection();
        });

        it('should save segment successfully', async () => {
            const segmentUri = 'file://test-segment.m4a';
            const duration = 120;

            FileSystem.copyAsync.mockResolvedValue(undefined);
            FileSystem.getInfoAsync.mockResolvedValue({ size: 1024000 });
            AsyncStorage.getItem.mockResolvedValue(JSON.stringify({
                id: 123,
                segments: [],
                total_duration: 0
            }));

            const result = await protectionService.saveSegment(segmentUri, duration);

            expect(result).toBeDefined();
            expect(result.duration).toBe(duration);
            expect(FileSystem.copyAsync).toHaveBeenCalled();
        });

        it('should throw error if protection not started', async () => {
            protectionService.currentDraftId = null;
            AsyncStorage.getItem.mockResolvedValue(null); // No draft exists

            await expect(
                protectionService.saveSegment('file://test.m4a', 60)
            ).rejects.toThrow('No active draft found. Call startProtection() first.');
        });

        it('should handle file copy failure', async () => {
            FileSystem.copyAsync.mockRejectedValue(new Error('Disk full'));

            await expect(
                protectionService.saveSegment('file://test.m4a', 60)
            ).rejects.toThrow();
        });
    });

    describe('checkForDrafts', () => {
        it('should return null if no draft exists', async () => {
            AsyncStorage.getItem.mockResolvedValue(null);

            const result = await protectionService.checkForDrafts();

            expect(result).toBeNull();
        });

        it('should return draft with valid segments', async () => {
            const mockDraft = {
                id: 123,
                segments: [
                    { uri: 'file://segment1.m4a', duration: 60 },
                    { uri: 'file://segment2.m4a', duration: 30 }
                ],
                total_duration: 90
            };

            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockDraft));
            FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

            const result = await protectionService.checkForDrafts();

            expect(result).toBeDefined();
            expect(result.segments).toHaveLength(2);
        });

        it('should filter out missing segment files', async () => {
            const mockDraft = {
                id: 123,
                segments: [
                    { uri: 'file://segment1.m4a', duration: 60 },
                    { uri: 'file://segment2.m4a', duration: 30 }
                ]
            };

            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockDraft));
            FileSystem.getInfoAsync
                .mockResolvedValueOnce({ exists: true })  // segment1 exists
                .mockResolvedValueOnce({ exists: false }); // segment2 missing

            const result = await protectionService.checkForDrafts();

            expect(result.segments).toHaveLength(1);
            expect(result.segments[0].uri).toBe('file://segment1.m4a');
        });

        it('should clear draft if no valid segments', async () => {
            const mockDraft = {
                id: 123,
                segments: [{ uri: 'file://missing.m4a', duration: 60 }]
            };

            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockDraft));
            FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
            AsyncStorage.removeItem.mockResolvedValue(undefined);

            const result = await protectionService.checkForDrafts();

            expect(result).toBeNull();
            expect(AsyncStorage.removeItem).toHaveBeenCalled();
        });
    });

    describe('clearDraft', () => {
        it('should clear draft and stop auto-backup', async () => {
            AsyncStorage.removeItem.mockResolvedValue(undefined);
            FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
            FileSystem.deleteAsync.mockResolvedValue(undefined);

            await protectionService.clearDraft();

            expect(AsyncStorage.removeItem).toHaveBeenCalled();
            expect(protectionService.currentDraftId).toBeNull();
        });

        it('should handle deletion errors gracefully', async () => {
            AsyncStorage.removeItem.mockRejectedValue(new Error('Storage error'));

            // Should not throw
            await expect(protectionService.clearDraft()).resolves.not.toThrow();
        });
    });

    describe('updateMetadata', () => {
        beforeEach(async () => {
            FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
            AsyncStorage.setItem.mockResolvedValue(undefined);
            await protectionService.startProtection();
        });

        it('should update draft metadata', async () => {
            const existingDraft = {
                id: 123,
                metadata: { title: 'Old Title' },
                segments: []
            };

            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingDraft));

            await protectionService.updateMetadata({ title: 'New Title' });

            const setItemCall = AsyncStorage.setItem.mock.calls[1]; // Second call (first is startProtection)
            const updatedDraft = JSON.parse(setItemCall[1]);

            expect(updatedDraft.metadata.title).toBe('New Title');
        });
    });

    describe('Memory Management', () => {
        it('should stop auto-backup interval on clearDraft', async () => {
            FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
            AsyncStorage.setItem.mockResolvedValue(undefined);

            await protectionService.startProtection();
            
            expect(protectionService.autoBackupInterval).not.toBeNull();

            await protectionService.clearDraft();

            expect(protectionService.autoBackupInterval).toBeNull();
        });

        it('should not create multiple intervals', async () => {
            FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
            AsyncStorage.setItem.mockResolvedValue(undefined);

            await protectionService.startProtection();
            const firstInterval = protectionService.autoBackupInterval;

            await protectionService.startProtection();
            const secondInterval = protectionService.autoBackupInterval;

            // Should be different intervals (old one cleared)
            expect(firstInterval).not.toBe(secondInterval);
        });
    });
});
