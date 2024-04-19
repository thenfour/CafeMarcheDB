module.exports = {
    extends: ["./node_modules/@blitzjs/next/eslint"],
    rules: {
        "react-hooks/rules-of-hooks": "off",
        "react-hooks/exhaustive-deps": "off",
        "react/no-unescaped-entities": "off",
        "jsx-a11y/alt-text": "off",
        "@next/next/no-img-element": "off",
        "@next/next/no-css-tags": "off",
        "import/no-cycle": "error",
    },
}
