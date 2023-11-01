module.exports = {
    extends: ["./node_modules/@blitzjs/next/eslint"],
    rules: {
        "react-hooks/rules-of-hooks": "off",
        "react-hooks/exhaustive-deps": "off",
        "import/no-cycle": "error",
    },
}
