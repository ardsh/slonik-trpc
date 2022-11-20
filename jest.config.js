module.exports = {
    transform: {
        "^.+\\.(t|j)s$": ["ts-jest", {
            diagnostics: { warnOnly: true },
        }],
    },
    testRegex: '((\\.)(test|spec))\\.(t|j)sx?$',
    moduleFileExtensions: ["ts", "js", "json", "node"],
};
