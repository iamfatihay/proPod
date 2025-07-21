module.exports = {
    // JavaScript and JSX files
    "*.{js,jsx}": [
        "eslint --fix",
        "prettier --write",
        "jest --findRelatedTests --passWithNoTests",
    ],

    // JSON files
    "*.json": ["prettier --write"],

    // Markdown files
    "*.md": ["prettier --write"],

    // Configuration files
    "*.{yml,yaml}": ["prettier --write"],
};
