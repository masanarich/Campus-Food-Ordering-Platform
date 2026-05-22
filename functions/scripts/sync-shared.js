"use strict";

// Mirrors the shared browser modules that the Cloud Functions need at runtime
// into the functions/ deploy bundle. Cloud Functions only ships the functions/
// folder, so reaching up into ../../public would crash the container on cold
// start. The CI test suite also relies on this script because functions/shared/
// is gitignored — a fresh checkout has no copy until this runs.
//
// Wired into:
//   - firebase.json `functions.predeploy` (runs before every deploy)
//   - package.json  `pretest` / `pretest:coverage` (runs before every test)
// Also safe to run manually: `node functions/scripts/sync-shared.js`.

const fs = require("fs");
const path = require("path");

const SHARED_GROUPS = [
    {
        sourceDir: "support",
        files: [
            "ticket-status.js",
            "ticket-categories.js",
            "refund-case-model.js",
            "refund-case-validation.js",
            "ticket-model.js",
            "ticket-queries.js",
            "ticket-validation.js",
            "ticket-service.js"
        ]
    },
    {
        sourceDir: "payments",
        files: [
            "payment-status.js",
            "payment-model.js",
            "payment-validation.js",
            "payment-service.js"
        ]
    }
];

const PUBLIC_SHARED_ROOT = path.resolve(__dirname, "..", "..", "public", "shared");
const FUNCTIONS_SHARED_ROOT = path.resolve(__dirname, "..", "shared");

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function copyOne(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file missing: ${sourcePath}`);
    }

    fs.copyFileSync(sourcePath, targetPath);
}

function syncGroup(group) {
    const sourceDir = path.join(PUBLIC_SHARED_ROOT, group.sourceDir);
    const targetDir = path.join(FUNCTIONS_SHARED_ROOT, group.sourceDir);

    ensureDir(targetDir);

    group.files.forEach(function copyFile(fileName) {
        copyOne(path.join(sourceDir, fileName), path.join(targetDir, fileName));
    });

    return group.files.length;
}

function main() {
    let totalFiles = 0;

    SHARED_GROUPS.forEach(function syncOne(group) {
        const count = syncGroup(group);
        const relativeTarget = path.relative(process.cwd(), path.join(FUNCTIONS_SHARED_ROOT, group.sourceDir));

        console.log(`sync-shared: copied ${count} files into ${relativeTarget}`);
        totalFiles += count;
    });

    console.log(`sync-shared: ${totalFiles} file${totalFiles === 1 ? "" : "s"} total.`);
}

main();
