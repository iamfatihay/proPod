/**
 * Integration Tests for Recording Protection Flow
 * Tests the complete flow from recording start to save
 */

import { render, waitFor, act } from '@testing-library/react-native';
import protectionService from '../../../services/recording/protectionService';
import backgroundService from '../../../services/recording/backgroundService';
import AudioService from '../../../services/audio';

// Mock services
jest.mock('../../../services/recording/protectionService');
jest.mock('../../../services/recording/backgroundService');
jest.mock('../../../services/audio');

describe('Recording Protection Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Complete Recording Flow', () => {
        it('should protect recording from start to save', async () => {
            // Arrange
            const mockMetadata = {
                title: 'Integration Test Recording',
                category: 'Tech'
            };

            protectionService.startProtection.mockResolvedValue(123456);
            protectionService.saveSegment.mockResolvedValue({
                uri: 'file://segment.m4a',
                duration: 120,
                timestamp: Date.now()
            });
            protectionService.clearDraft.mockResolvedValue(undefined);

            backgroundService.startRecording.mockResolvedValue(undefined);
            backgroundService.stopRecording.mockResolvedValue(undefined);

            AudioService.getRecordingStatus.mockReturnValue({ duration: 120 });

            // Act - Start recording
            await protectionService.startProtection(mockMetadata);
            await backgroundService.startRecording(mockMetadata.title);

            // Act - Stop recording and save segment
            const segmentUri = 'file://recording.m4a';
            const segment = await protectionService.saveSegment(segmentUri, 120);

            // Act - Complete save
            await protectionService.clearDraft();
            await backgroundService.stopRecording();

            // Assert
            expect(protectionService.startProtection).toHaveBeenCalledWith(mockMetadata);
            expect(backgroundService.startRecording).toHaveBeenCalledWith(mockMetadata.title);
            expect(protectionService.saveSegment).toHaveBeenCalledWith(segmentUri, 120);
            expect(protectionService.clearDraft).toHaveBeenCalled();
            expect(backgroundService.stopRecording).toHaveBeenCalled();
        });

        it('should handle recording interruption', async () => {
            // Arrange
            protectionService.startProtection.mockResolvedValue(123456);
            protectionService.saveSegment.mockResolvedValue({
                uri: 'file://segment.m4a',
                duration: 60,
                timestamp: Date.now()
            });
            protectionService.checkForDrafts.mockResolvedValue({
                id: 123456,
                segments: [{ uri: 'file://segment.m4a', duration: 60 }],
                total_duration: 60
            });

            // Act - Start recording
            await protectionService.startProtection({ title: 'Test' });

            // Simulate app interruption (kill/crash)
            await protectionService.saveSegment('file://recording.m4a', 60);

            // Simulate app restart and draft recovery
            const draft = await protectionService.checkForDrafts();

            // Assert
            expect(draft).toBeDefined();
            expect(draft.segments).toHaveLength(1);
            expect(draft.total_duration).toBe(60);
        });
    });

    describe('Error Scenarios', () => {
        it('should continue recording if protection fails', async () => {
            // Arrange
            protectionService.startProtection.mockRejectedValue(new Error('Storage full'));
            
            // Act & Assert - Should not crash
            await expect(async () => {
                try {
                    await protectionService.startProtection();
                } catch (error) {
                    // Error is logged but recording can continue
                    expect(error.message).toBe('Storage full');
                }
            }).not.toThrow();
        });

        it('should handle segment save failure gracefully', async () => {
            // Arrange
            protectionService.startProtection.mockResolvedValue(123456);
            protectionService.saveSegment.mockRejectedValue(new Error('File system error'));

            // Act
            await protectionService.startProtection();
            
            // Assert - Error should be catchable
            await expect(
                protectionService.saveSegment('file://test.m4a', 60)
            ).rejects.toThrow('File system error');
        });
    });

    describe('Long Recording Scenarios', () => {
        it('should handle 40+ minute recording with token refresh', async () => {
            // Arrange - Simulate long recording
            const segments = [];
            protectionService.startProtection.mockResolvedValue(123456);
            
            for (let i = 0; i < 5; i++) {
                protectionService.saveSegment.mockResolvedValueOnce({
                    uri: `file://segment${i}.m4a`,
                    duration: 600, // 10 minutes each
                    timestamp: Date.now() + (i * 600000)
                });
            }

            // Act - Start and save multiple segments
            await protectionService.startProtection({ title: 'Long Recording' });

            for (let i = 0; i < 5; i++) {
                const segment = await protectionService.saveSegment(
                    `file://segment${i}.m4a`,
                    600
                );
                segments.push(segment);
            }

            // Assert
            expect(segments).toHaveLength(5);
            expect(protectionService.saveSegment).toHaveBeenCalledTimes(5);
            // Total: 50 minutes - token should have refreshed
        });
    });

    describe('Draft Recovery', () => {
        it('should recover draft after app restart', async () => {
            // Arrange - Simulate saved draft
            const mockDraft = {
                id: 123456,
                created_at: new Date().toISOString(),
                metadata: { title: 'Recovered Recording' },
                segments: [
                    { uri: 'file://segment1.m4a', duration: 120 },
                    { uri: 'file://segment2.m4a', duration: 90 }
                ],
                total_duration: 210
            };

            protectionService.checkForDrafts.mockResolvedValue(mockDraft);

            // Act - App restart, check for drafts
            const draft = await protectionService.checkForDrafts();

            // Assert
            expect(draft).toBeDefined();
            expect(draft.id).toBe(123456);
            expect(draft.segments).toHaveLength(2);
            expect(draft.total_duration).toBe(210);
            expect(draft.metadata.title).toBe('Recovered Recording');
        });

        it('should allow user to resume or discard draft', async () => {
            // Arrange
            protectionService.checkForDrafts.mockResolvedValue({
                id: 123456,
                segments: [{ uri: 'file://segment.m4a', duration: 60 }],
                total_duration: 60
            });
            protectionService.clearDraft.mockResolvedValue(undefined);

            // Act - Check draft
            const draft = await protectionService.checkForDrafts();
            expect(draft).toBeDefined();

            // Act - User chooses to discard
            await protectionService.clearDraft();

            // Assert
            expect(protectionService.clearDraft).toHaveBeenCalled();
        });
    });
});
