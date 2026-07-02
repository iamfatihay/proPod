// Mock for react-native-reanimated
//
// react-native-reanimated ships ES modules that Jest cannot transform, so we
// stub it here. Animations are no-ops and animated components render as plain
// host elements, which lets components that use reanimated render under
// react-test-renderer without pulling in the native/worklet internals.

const useSharedValue = (initial) => ({ value: initial });
const useAnimatedStyle = (factory) => (typeof factory === "function" ? factory() : {});
const withTiming = (toValue) => toValue;
const withRepeat = (animation) => animation;
const withSequence = (...animations) => animations[animations.length - 1];
const cancelAnimation = () => {};

const identityEasing = (value) => value;
const Easing = {
    linear: identityEasing,
    ease: identityEasing,
    quad: identityEasing,
    cubic: identityEasing,
    in: (easing) => easing,
    out: (easing) => easing,
    inOut: (easing) => easing,
    bezier: () => identityEasing,
};

// Chainable entering/exiting/layout builders (e.g. FadeIn.duration(300)).
const createAnimationBuilder = () => {
    const builder = {
        duration: () => builder,
        delay: () => builder,
        springify: () => builder,
        easing: () => builder,
        build: () => builder,
    };
    return builder;
};

const AnimatedComponents = {
    View: "AnimatedView",
    Text: "AnimatedText",
    ScrollView: "AnimatedScrollView",
    Image: "AnimatedImage",
    createAnimatedComponent: (component) => component,
};

module.exports = {
    __esModule: true,
    default: AnimatedComponents,
    ...AnimatedComponents,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    cancelAnimation,
    Easing,
    FadeIn: createAnimationBuilder(),
    FadeOut: createAnimationBuilder(),
    Layout: createAnimationBuilder(),
};
