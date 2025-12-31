module.exports = function (api) {
    const isTest = api.env("test");
    api.cache.using(() => isTest);

    if (isTest) {
        return {
            presets: [
                ["@babel/preset-env", { targets: { node: "current" } }],
                "@babel/preset-react",
            ],
            plugins: [],
        };
    }

    return {
        presets: ["babel-preset-expo"],
        plugins: [
            "nativewind/babel",
            "react-native-reanimated/plugin",
        ],
    };
};
