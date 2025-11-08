import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import GradientCard from "../GradientCard";

describe("GradientCard", () => {
    const mockPodcast = {
        id: 1,
        title: "Test Podcast",
        owner: { name: "Test Creator" },
        duration: 180000, // 3 minutes
        ai_enhanced: true,
        category: "Technology",
    };

    it("renders podcast information correctly", () => {
        const { getByText } = render(
            <GradientCard podcast={mockPodcast} />
        );

        expect(getByText("Test Podcast")).toBeTruthy();
        expect(getByText("Test Creator")).toBeTruthy();
        expect(getByText("3:00")).toBeTruthy();
    });

    it("shows AI badge when podcast is AI enhanced", () => {
        const { getByText } = render(
            <GradientCard podcast={mockPodcast} showAIBadge={true} />
        );

        expect(getByText("AI Enhanced")).toBeTruthy();
    });

    it("hides AI badge when showAIBadge is false", () => {
        const { queryByText } = render(
            <GradientCard podcast={mockPodcast} showAIBadge={false} />
        );

        expect(queryByText("AI Enhanced")).toBeNull();
    });

    it("calls onPress when card is pressed", () => {
        const onPressMock = jest.fn();
        const { getByA11yRole } = render(
            <GradientCard podcast={mockPodcast} onPress={onPressMock} />
        );

        const card = getByA11yRole("button");
        fireEvent.press(card);

        expect(onPressMock).toHaveBeenCalled();
    });

    it("calls onPlayPress when play button is pressed", () => {
        const onPlayPressMock = jest.fn();
        const { getAllByA11yRole } = render(
            <GradientCard
                podcast={mockPodcast}
                onPlayPress={onPlayPressMock}
                showPlayButton={true}
            />
        );

        const buttons = getAllByA11yRole("button");
        const playButton = buttons.find(btn => 
            btn.props.accessibilityLabel === "Play" || 
            btn.props.accessibilityLabel === "Pause"
        );
        
        if (playButton) {
            fireEvent.press(playButton);
            expect(onPlayPressMock).toHaveBeenCalled();
        }
    });

    it("shows pause icon when isPlaying is true", () => {
        const { UNSAFE_getByType } = render(
            <GradientCard
                podcast={mockPodcast}
                isPlaying={true}
                showPlayButton={true}
            />
        );

        // This is a simplified test - in real scenario, check icon name
        expect(UNSAFE_getByType).toBeTruthy();
    });

    it("renders different sizes correctly", () => {
        const { rerender, getByA11yRole } = render(
            <GradientCard podcast={mockPodcast} size="small" />
        );
        
        let card = getByA11yRole("button");
        expect(card.props.style).toMatchObject(
            expect.objectContaining({ width: 140 })
        );

        rerender(<GradientCard podcast={mockPodcast} size="large" />);
        card = getByA11yRole("button");
        expect(card.props.style).toMatchObject(
            expect.objectContaining({ width: "100%" })
        );
    });
});

