const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.resolve(__dirname, "../../public");
const PUBLIC_FILE_EXTENSIONS = new Set([".html", ".js"]);
const FORBIDDEN_MARKUP_RE = /<\s*\/?\s*(?:div|span)(?=\s|>|\/)/gi;
const FORBIDDEN_DOM_CREATION_RE = /createElement\s*\(\s*["'`](?:div|span)["'`]\s*\)/gi;

function walkPublicFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true })
        .flatMap(function mapEntry(entry) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                return walkPublicFiles(fullPath);
            }

            if (!PUBLIC_FILE_EXTENSIONS.has(path.extname(entry.name))) {
                return [];
            }

            return [fullPath];
        });
}

function lineNumberForIndex(text, index) {
    return text.slice(0, index).split(/\r?\n/).length;
}

function collectMatches(files, pattern) {
    return files.flatMap(function scanFile(filePath) {
        const source = fs.readFileSync(filePath, "utf8");
        const matches = [];
        let match = pattern.exec(source);

        while (match) {
            const lineNumber = lineNumberForIndex(source, match.index);
            const lineText = source.split(/\r?\n/)[lineNumber - 1].trim();

            matches.push({
                filePath: path.relative(process.cwd(), filePath),
                lineNumber,
                matchText: match[0],
                lineText
            });

            match = pattern.exec(source);
        }

        pattern.lastIndex = 0;
        return matches;
    });
}

function formatViolations(violations) {
    return violations
        .map(function formatViolation(violation) {
            return `${violation.filePath}:${violation.lineNumber} ${violation.matchText} -> ${violation.lineText}`;
        })
        .join("\n");
}

describe("public semantic markup audit", () => {
    const publicFiles = walkPublicFiles(PUBLIC_DIR);

    test("public HTML and JS files do not contain div or span markup", () => {
        const violations = collectMatches(publicFiles, FORBIDDEN_MARKUP_RE);

        expect(formatViolations(violations)).toBe("");
    });

    test("public DOM creation does not create div or span elements", () => {
        const violations = collectMatches(publicFiles, FORBIDDEN_DOM_CREATION_RE);

        expect(formatViolations(violations)).toBe("");
    });
});
