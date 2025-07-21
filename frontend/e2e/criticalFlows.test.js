/**
 * E2E Tests: Critical User Flows
 * Tests complete user journeys from start to finish
 * Covers authentication, recording, playback, and social interactions
 */

describe("Critical User Flows", () => {
    beforeAll(async () => {
        await device.launchApp();
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    describe("User Onboarding and Authentication", () => {
        test("should complete registration flow", async () => {
            // Navigate to registration
            await element(by.id("register-button")).tap();

            // Fill registration form
            await element(by.id("name-input")).typeText("Test User");
            await element(by.id("email-input")).typeText("test@example.com");
            await element(by.id("password-input")).typeText("testpass123");
            await element(by.id("confirm-password-input")).typeText(
                "testpass123"
            );

            // Submit registration
            await element(by.id("register-submit-button")).tap();

            // Should navigate to home screen
            await waitFor(element(by.id("home-screen")))
                .toBeVisible()
                .withTimeout(10000);

            // Verify user is logged in
            await expect(element(by.text("Welcome, Test User!"))).toBeVisible();
        });

        test("should complete login flow", async () => {
            // Navigate to login
            await element(by.id("login-button")).tap();

            // Fill login form
            await helpers.loginUser("test@example.com", "testpass123");

            // Should be on home screen
            await expect(element(by.id("home-screen"))).toBeVisible();
        });

        test("should handle Google sign-in flow", async () => {
            // Tap Google sign-in button
            await element(by.id("google-signin-button")).tap();

            // Note: This would require Google Auth mocking in real implementation
            // For now, verify the button triggers the flow
            await waitFor(element(by.text("Signing in with Google...")))
                .toBeVisible()
                .withTimeout(5000);
        });
    });

    describe("Podcast Recording Journey", () => {
        beforeEach(async () => {
            // Login first
            await helpers.loginUser("test@example.com", "testpass123");
            await helpers.navigateToTab("create");
        });

        test("should complete full recording and publication flow", async () => {
            // Start recording
            await element(by.id("start-recording-button")).tap();

            // Grant permissions if needed
            if (await element(by.text("Allow")).isVisible()) {
                await element(by.text("Allow")).tap();
            }

            // Verify recording started
            await waitFor(element(by.id("recording-indicator")))
                .toBeVisible()
                .withTimeout(5000);

            await expect(element(by.text("Recording..."))).toBeVisible();

            // Record for a few seconds
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Stop recording
            await element(by.id("stop-recording-button")).tap();

            // Should navigate to podcast details form
            await waitFor(element(by.id("podcast-form-screen")))
                .toBeVisible()
                .withTimeout(10000);

            // Fill podcast details
            await element(by.id("podcast-title-input")).typeText(
                "My First Podcast"
            );
            await element(by.id("podcast-description-input")).typeText(
                "This is a test podcast created with E2E testing"
            );

            // Select category
            await element(by.id("category-selector")).tap();
            await element(by.text("Technology")).tap();

            // Enable AI enhancement
            await element(by.id("ai-enhancement-toggle")).tap();

            // Publish podcast
            await element(by.id("publish-button")).tap();

            // Should show success message
            await waitFor(element(by.text("Podcast published successfully!")))
                .toBeVisible()
                .withTimeout(15000);

            // Should navigate to podcast details page
            await waitFor(element(by.id("podcast-details-screen")))
                .toBeVisible()
                .withTimeout(5000);

            // Verify podcast details
            await expect(element(by.text("My First Podcast"))).toBeVisible();
            await expect(
                element(
                    by.text("This is a test podcast created with E2E testing")
                )
            ).toBeVisible();
        });

        test("should handle recording interruption gracefully", async () => {
            // Start recording
            await element(by.id("start-recording-button")).tap();

            // Verify recording started
            await waitFor(element(by.id("recording-indicator")))
                .toBeVisible()
                .withTimeout(5000);

            // Simulate app going to background
            await device.sendToHome();
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Bring app back to foreground
            await device.launchApp({ newInstance: false });

            // Should show recording interruption dialog
            await waitFor(element(by.text("Recording was interrupted")))
                .toBeVisible()
                .withTimeout(5000);

            // Should offer to resume or discard
            await expect(
                element(by.id("resume-recording-button"))
            ).toBeVisible();
            await expect(
                element(by.id("discard-recording-button"))
            ).toBeVisible();
        });
    });

    describe("Podcast Discovery and Playback", () => {
        beforeEach(async () => {
            await helpers.loginUser("test@example.com", "testpass123");
        });

        test("should discover and play podcasts", async () => {
            // Navigate to home/discover
            await helpers.navigateToTab("home");

            // Wait for podcasts to load
            await helpers.waitForLoadingComplete();

            // Should see podcast list
            await waitFor(element(by.id("podcast-list")))
                .toBeVisible()
                .withTimeout(10000);

            // Tap on first podcast
            await element(by.id("podcast-card-1")).tap();

            // Should navigate to podcast details
            await waitFor(element(by.id("podcast-details-screen")))
                .toBeVisible()
                .withTimeout(5000);

            // Start playback
            await element(by.id("play-button")).tap();

            // Should show audio player
            await waitFor(element(by.id("audio-player")))
                .toBeVisible()
                .withTimeout(5000);

            // Verify playback started
            await expect(element(by.id("pause-button"))).toBeVisible();
            await expect(element(by.id("progress-indicator"))).toBeVisible();

            // Wait for a bit of playback
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Pause playback
            await element(by.id("pause-button")).tap();

            // Should show play button again
            await expect(element(by.id("play-button"))).toBeVisible();
        });

        test("should handle podcast interactions (like, bookmark)", async () => {
            // Navigate to a podcast details page
            await helpers.navigateToTab("home");
            await helpers.waitForLoadingComplete();
            await element(by.id("podcast-card-1")).tap();

            // Like the podcast
            await element(by.id("like-button")).tap();

            // Should show liked state
            await waitFor(element(by.id("liked-indicator")))
                .toBeVisible()
                .withTimeout(5000);

            // Bookmark the podcast
            await element(by.id("bookmark-button")).tap();

            // Should show bookmarked state
            await waitFor(element(by.id("bookmarked-indicator")))
                .toBeVisible()
                .withTimeout(5000);

            // Navigate to library to verify bookmark
            await helpers.navigateToTab("library");

            // Should see bookmarked podcast
            await waitFor(element(by.text("Bookmarks")))
                .toBeVisible()
                .withTimeout(5000);

            await element(by.text("Bookmarks")).tap();
            await expect(element(by.id("podcast-card-1"))).toBeVisible();
        });
    });

    describe("Social Features and Comments", () => {
        beforeEach(async () => {
            await helpers.loginUser("test@example.com", "testpass123");
        });

        test("should add and view comments on podcasts", async () => {
            // Navigate to podcast details
            await helpers.navigateToTab("home");
            await helpers.waitForLoadingComplete();
            await element(by.id("podcast-card-1")).tap();

            // Scroll to comments section
            await helpers.scrollToElement(
                "podcast-details-scroll",
                "comments-section"
            );

            // Add a comment
            await element(by.id("comment-input")).typeText(
                "Great podcast! Really enjoyed the discussion."
            );
            await element(by.id("submit-comment-button")).tap();

            // Should show comment in list
            await waitFor(
                element(
                    by.text("Great podcast! Really enjoyed the discussion.")
                )
            )
                .toBeVisible()
                .withTimeout(5000);

            // Should show comment metadata
            await expect(element(by.text("Test User"))).toBeVisible();
            await expect(
                element(by.text(/just now|a few seconds ago/))
            ).toBeVisible();
        });
    });

    describe("Search and Discovery", () => {
        beforeEach(async () => {
            await helpers.loginUser("test@example.com", "testpass123");
        });

        test("should search and filter podcasts", async () => {
            // Navigate to search
            await helpers.navigateToTab("search");

            // Enter search term
            await element(by.id("search-input")).typeText("technology");

            // Should show search results
            await helpers.waitForLoadingComplete();
            await waitFor(element(by.id("search-results")))
                .toBeVisible()
                .withTimeout(10000);

            // Filter by category
            await element(by.id("filter-button")).tap();
            await element(by.text("Technology")).tap();
            await element(by.id("apply-filters-button")).tap();

            // Should show filtered results
            await helpers.waitForLoadingComplete();
            await expect(element(by.id("search-results"))).toBeVisible();
        });
    });

    describe("Profile and Settings", () => {
        beforeEach(async () => {
            await helpers.loginUser("test@example.com", "testpass123");
        });

        test("should update user profile", async () => {
            // Navigate to profile
            await helpers.navigateToTab("profile");

            // Tap edit profile
            await element(by.id("edit-profile-button")).tap();

            // Update name
            await element(by.id("name-input")).clearText();
            await element(by.id("name-input")).typeText("Updated Test User");

            // Save changes
            await element(by.id("save-profile-button")).tap();

            // Should show success message
            await waitFor(element(by.text("Profile updated successfully")))
                .toBeVisible()
                .withTimeout(5000);

            // Should show updated name
            await expect(element(by.text("Updated Test User"))).toBeVisible();
        });

        test("should access and modify settings", async () => {
            // Navigate to settings
            await helpers.navigateToTab("profile");
            await element(by.id("settings-button")).tap();

            // Should show settings screen
            await waitFor(element(by.id("settings-screen")))
                .toBeVisible()
                .withTimeout(5000);

            // Toggle notification setting
            await element(by.id("notifications-toggle")).tap();

            // Change audio quality setting
            await element(by.id("audio-quality-selector")).tap();
            await element(by.text("High Quality")).tap();

            // Should auto-save settings
            await waitFor(element(by.text("Settings saved")))
                .toBeVisible()
                .withTimeout(3000);
        });
    });

    describe("Error Scenarios and Edge Cases", () => {
        test("should handle network disconnection gracefully", async () => {
            await helpers.loginUser("test@example.com", "testpass123");

            // Simulate network disconnection
            await helpers.mockApiError();

            // Try to load podcasts
            await helpers.navigateToTab("home");

            // Should show offline message
            await waitFor(element(by.text(/offline|no internet connection/i)))
                .toBeVisible()
                .withTimeout(10000);

            // Should show retry button
            await expect(element(by.id("retry-button"))).toBeVisible();

            // Restore network
            await helpers.mockApiSuccess();

            // Retry loading
            await element(by.id("retry-button")).tap();

            // Should load successfully
            await helpers.waitForLoadingComplete();
            await expect(element(by.id("podcast-list"))).toBeVisible();
        });

        test("should handle app crash recovery", async () => {
            await helpers.loginUser("test@example.com", "testpass123");

            // Start recording
            await helpers.navigateToTab("create");
            await element(by.id("start-recording-button")).tap();

            // Simulate app crash by terminating and relaunching
            await device.terminateApp();
            await device.launchApp();

            // Should restore recording state or show recovery dialog
            await waitFor(
                element(by.text(/recording recovery|restore session/i))
            )
                .toBeVisible()
                .withTimeout(10000);
        });
    });
});
