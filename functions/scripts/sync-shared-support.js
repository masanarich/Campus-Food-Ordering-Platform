"use strict";

// Mirrors public/shared/support/ into functions/shared/support/ so the deploy
// bundle (which only ships the functions/ folder) can require these modules.
// Wired as a `predeploy` hook in firebase.json — also safe to run manually.

const fs = require("fs");
const path = require("path");

const SHARED_FILES = [
    "ticket-status.js",
    "ticket-categories.js",
    "refund-case-model.js",
    "refund-case-validation.js",
    "ticket-model.js",
    "ticket-queries.js",
    "ticket-validation.js",
    "ticket-service.js"
];

const SOURCE_DIR = path.resolve(__dirname, "..", "..", "public", "shared", "support");
const TARGET_DIR = path.resolve(__dirname, "..", "shared", "support");

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function copyOne(fileName) {
    const sourcePath = path.join(SOURCE_DIR, fileName);
    const targetPath = path.join(TARGET_DIR, fileName);

    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file missing: ${sourcePath}`);
    }

    fs.copyFileSync(sourcePath, targetPath);
}

function main() {
    ensureDir(TARGET_DIR);
    SHARED_FILES.forEach(copyOne);
    console.log(`sync-shared-support: copied ${SHARED_FILES.length} files into ${path.relative(process.cwd(), TARGET_DIR)}`);
}

main();
