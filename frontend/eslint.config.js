// ESLint 9 flat config — minimal rules focused on catching real bugs.
// Intentionally kept small: this is a React Native / Expo project and many
// style decisions are already enforced by Prettier. We only enable rules that
// catch actual runtime errors.

export default [
    {
        files: ["**/*.js", "**/*.jsx"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                // React Native / Expo globals
                __DEV__: "readonly",
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                // Browser-like globals available in RN
                console: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                Promise: "readonly",
                fetch: "readonly",
            },
        },
        rules: {
            // Catches the exact bug we hit: two `const foo` in the same scope
            // after merging multiple PRs that both added the same function.
            "no-redeclare": "error",

            // Catches duplicate object keys — another silent merge artifact.
            "no-dupe-keys": "error",

            // Catches unreachable code after return/throw.
            "no-unreachable": "error",
        },
    },
];
