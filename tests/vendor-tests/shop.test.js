/**
 * @jest-environment jsdom
 */

const {
    MODULE_NAME,
    MAX_IMAGE_SIZE_BYTES,
    FIELD_KEYS,
    OTHER_OPTION_VALUE,
    normalizeText,
    normalizeLowerText,
    normalizeEmail,
    normalizePhoneNumber,
    isValidEmail,
    isValidPhoneNumber,
    isImageFile,
    readFileAsDataURL,
    loadImageFromSource,
    fileToOptimizedDataURL,
    getSelectedPhotoFile,
    clearFileInput,
    getFileExtension,
    buildShopPhotoPath,
    getDisplayShopPhotoUrl,
    getDefaultSchedule,
    normalizeSchedule,
    formatScheduleSummary,
    getShopOpenState,
    getAllInstitutions,
    findInstitutionByName,
    getCampusesFor,
    groupInstitutionsByType,
    renderInstitutionOptions,
    renderCampusOptions,
    normalizeShopRecord,
    validateShopValues,
    toShopUpdates,
    createVendorShopPage,
    initializeVendorShopPage
} = require("../../public/vendor/shop.js");

const shopSchedule = require("../../public/shared/shop-schedule/shop-schedule.js");
const institutions = require("../../public/shared/institutions/south-african-institutions.js");

function createDom() {
    document.body.innerHTML = `
        <main>
            <p id="shop-status"></p>
            <p id="shop-note"></p>
            <output id="shop-vendor-status">-</output>
            <output id="shop-account-status">-</output>
            <output id="shop-visibility">-</output>
            <output id="shop-photo-state">No photo uploaded</output>
            <output id="shop-live-status">Checking...</output>
            <p id="shop-live-status-note"></p>

            <button id="back-to-dashboard-button" type="button">Back</button>

            <form id="vendor-shop-form">
                <input id="shop-business-name" name="businessName" type="text">
                <p id="shop-businessName-error" hidden></p>

                <input id="shop-food-type" name="foodType" type="text">
                <p id="shop-foodType-error" hidden></p>

                <textarea id="shop-description" name="description"></textarea>
                <p id="shop-description-error" hidden></p>

                <select id="shop-institution-select" name="institutionSelect"></select>
                <label id="shop-institution-other-wrap" hidden>
                    <input id="shop-institution-other" name="institutionOther" type="text">
                </label>
                <output id="shop-institution-type-display">-</output>
                <p id="shop-institution-error" hidden></p>

                <select id="shop-campus-select" name="campusSelect"></select>
                <label id="shop-campus-other-wrap" hidden>
                    <input id="shop-campus-other" name="campusOther" type="text">
                </label>
                <p id="shop-campus-error" hidden></p>

                <input id="shop-stall-location" name="stallLocation" type="text">
                <p id="shop-stallLocation-error" hidden></p>

                <input id="shop-contact-number" name="contactNumber" type="tel">
                <p id="shop-contactNumber-error" hidden></p>

                <input id="shop-business-email" name="businessEmail" type="email">
                <p id="shop-businessEmail-error" hidden></p>

                <input id="shop-accepting-orders" name="acceptingOrders" type="checkbox" checked>

                <input id="shop-photo-file" name="photoFile" type="file">
                <button id="preview-shop-photo-button" type="button">Preview</button>
                <button id="remove-shop-photo-button" type="button">Remove</button>
                <img id="shop-photo-preview" alt="preview" hidden>
                <p id="shop-photo-empty-state"></p>

                <button id="schedule-preset-weekdays" type="button">Weekdays</button>
                <button id="schedule-preset-allweek" type="button">All week</button>
                <button id="schedule-preset-clear" type="button">Clear</button>
                <ul id="schedule-editor"></ul>
                <p id="schedule-error" hidden></p>
                <output id="schedule-summary">Closed all week</output>

                <output id="shop-summary-name">-</output>
                <output id="shop-summary-food-type">-</output>
                <output id="shop-summary-institution">-</output>
                <output id="shop-summary-campus">-</output>
                <output id="shop-summary-stall">-</output>
                <output id="shop-summary-hours">-</output>
                <output id="shop-summary-phone">-</output>
                <output id="shop-summary-email">-</output>
                <output id="shop-summary-live">-</output>
                <output id="shop-summary-description">-</output>

                <button id="save-shop-button" type="submit">Save</button>
                <button id="reset-shop-button" type="reset">Reset</button>
            </form>
        </main>
    `;
}

function createMockFile(name, type, size = 1024) {
    const file = new File(["hello"], name, { type });
    Object.defineProperty(file, "size", {
        value: size,
        configurable: true
    });
    return file;
}

function attachFile(input, file) {
    Object.defineProperty(input, "files", {
        value: file ? [file] : [],
        configurable: true
    });
}

function buildDependencies(options = {}) {
    const profileFromOptions =
        options.currentProfile === undefined
            ? {
                uid: "vendor-1",
                vendorStatus: "approved",
                accountStatus: "active",
                isAdmin: false,
                vendorBusinessName: "Burger Hut",
                vendorDescription: "Tasty burgers, fast service.",
                vendorInstitution: "University of Pretoria",
                vendorInstitutionType: "Public University",
                vendorCampus: "Hatfield Campus — Hatfield, Pretoria",
                vendorStallLocation: "Hatfield Plaza, Stall 7",
                vendorFoodType: "Burgers",
                vendorOpeningHours: "Mon-Fri 08:00 AM – 5:00 PM",
                vendorSchedule: shopSchedule.getDefaultSchedule(),
                vendorPhoneNumber: "+27712345678",
                vendorEmail: "orders@burgerhut.co.za",
                vendorAcceptingOrders: true,
                vendorBannerURL: "https://files.example/banner.jpg",
                vendorBannerPath: "vendorShopPhotos/vendor-1/cover.jpg"
            }
            : options.currentProfile;

    const docData =
        options.docData === undefined ? profileFromOptions : options.docData;

    const authService = {
        getCurrentUser: jest.fn(() =>
            options.currentUser === undefined ? { uid: "vendor-1" } : options.currentUser
        ),
        getCurrentUserProfile: jest.fn(async () => profileFromOptions),
        updateUserProfile: jest.fn(async () => true)
    };

    const authUtils = {
        normaliseUserData: jest.fn((profile) => Object.assign({}, profile)),
        canAccessVendorPortal: jest.fn((profile) =>
            options.canAccessVendor === undefined
                ? profile && profile.accountStatus === "active" && profile.vendorStatus === "approved"
                : options.canAccessVendor
        )
    };

    const firestoreFns = {
        doc: jest.fn((db, ...segments) => ({ db, segments })),
        getDoc: jest.fn(async () => {
            if (options.getDocError) {
                throw options.getDocError;
            }
            return {
                exists: () => true,
                data: () => docData || {}
            };
        }),
        updateDoc: jest.fn(async () => {
            if (options.updateDocError) {
                throw options.updateDocError;
            }
            return true;
        }),
        serverTimestamp: jest.fn(() => "SERVER_TIME")
    };

    const storageFns = {
        ref: jest.fn((storage, path) => ({ storage, path })),
        uploadBytes: jest.fn(async () => {
            if (options.uploadBytesError) {
                throw options.uploadBytesError;
            }
            return true;
        }),
        getDownloadURL: jest.fn(async (storageRef) => `https://storage.example/${storageRef.path}`),
        deleteObject: jest.fn(async () => {
            if (options.deleteObjectError) {
                throw options.deleteObjectError;
            }
            return true;
        })
    };

    return {
        authService,
        authUtils,
        db: { app: "test-db" },
        storage: { app: "test-storage" },
        firestoreFns,
        storageFns,
        navigate: jest.fn(),
        now: options.now || (() => new Date("2026-05-21T10:00:00"))
    };
}

function fillValidForm() {
    document.getElementById("shop-business-name").value = "Burger Hut";
    document.getElementById("shop-food-type").value = "Burgers";
    document.getElementById("shop-description").value = "Tasty burgers, fast service.";

    // Choose UP from the cascade
    const instSelect = document.getElementById("shop-institution-select");
    instSelect.value = "University of Pretoria";
    instSelect.dispatchEvent(new Event("change", { bubbles: true }));

    const campusSelect = document.getElementById("shop-campus-select");
    campusSelect.value = "Hatfield Campus — Hatfield, Pretoria";
    campusSelect.dispatchEvent(new Event("change", { bubbles: true }));

    document.getElementById("shop-stall-location").value = "Hatfield Plaza, Stall 7";
    document.getElementById("shop-contact-number").value = "+27712345678";
    document.getElementById("shop-business-email").value = "orders@burgerhut.co.za";
    document.getElementById("shop-accepting-orders").checked = true;
}

// ==========================================
// Shared shop-schedule module tests
// ==========================================

describe("shared/shop-schedule", () => {
    test("getDefaultSchedule opens Mon-Fri, closes weekends", () => {
        const schedule = shopSchedule.getDefaultSchedule();
        expect(schedule.monday.open).toBe(true);
        expect(schedule.friday.open).toBe(true);
        expect(schedule.saturday.open).toBe(false);
        expect(schedule.sunday.open).toBe(false);
        expect(schedule.monday.openTime).toBe("08:00");
        expect(schedule.monday.closeTime).toBe("17:00");
    });

    test("normalizeSchedule fills missing days with defaults and validates times", () => {
        const result = shopSchedule.normalizeSchedule({
            monday: { open: true, openTime: "9:5", closeTime: "18:00" }
        });
        // Invalid time string falls back to default
        expect(result.monday.openTime).toBe("08:00");
        expect(result.monday.closeTime).toBe("18:00");
        // Missing days fall back to the default Mon-Fri-open schedule
        expect(result.tuesday.open).toBe(true);
        expect(result.sunday.open).toBe(false);
    });

    test("normalizeTimeString returns empty on invalid input", () => {
        expect(shopSchedule.normalizeTimeString("not-a-time")).toBe("");
        expect(shopSchedule.normalizeTimeString("25:00")).toBe("");
        expect(shopSchedule.normalizeTimeString("12:99")).toBe("");
        expect(shopSchedule.normalizeTimeString(123)).toBe("");
        expect(shopSchedule.normalizeTimeString("9:30")).toBe("09:30");
    });

    test("timeToMinutes works for valid times and returns null otherwise", () => {
        expect(shopSchedule.timeToMinutes("08:00")).toBe(480);
        expect(shopSchedule.timeToMinutes("17:30")).toBe(17 * 60 + 30);
        expect(shopSchedule.timeToMinutes("invalid")).toBeNull();
    });

    test("formatTimeForDisplay produces 12-hour display strings", () => {
        expect(shopSchedule.formatTimeForDisplay("08:00")).toBe("8:00 AM");
        expect(shopSchedule.formatTimeForDisplay("17:30")).toBe("5:30 PM");
        expect(shopSchedule.formatTimeForDisplay("00:15")).toBe("12:15 AM");
        expect(shopSchedule.formatTimeForDisplay("12:00")).toBe("12:00 PM");
        expect(shopSchedule.formatTimeForDisplay("bad")).toBe("");
    });

    test("formatScheduleSummary groups consecutive days with identical hours", () => {
        const schedule = shopSchedule.getDefaultSchedule();
        const summary = shopSchedule.formatScheduleSummary(schedule);
        expect(summary).toContain("Mon-Fri");
        expect(summary).toContain("Sat-Sun closed");
    });

    test("formatScheduleSummary describes a single-day open island", () => {
        const schedule = shopSchedule.normalizeSchedule({});
        Object.keys(schedule).forEach((key) => {
            schedule[key] = { open: false, openTime: "08:00", closeTime: "17:00" };
        });
        schedule.wednesday = { open: true, openTime: "10:00", closeTime: "14:00" };

        const summary = shopSchedule.formatScheduleSummary(schedule);
        expect(summary).toContain("Wed 10:00 AM");
    });

    test("formatScheduleSummary handles all-closed weeks", () => {
        const schedule = {};
        shopSchedule.DAYS.forEach((day) => {
            schedule[day.key] = { open: false, openTime: "08:00", closeTime: "17:00" };
        });
        expect(shopSchedule.formatScheduleSummary(schedule)).toBe("Closed all week");
    });

    test("isOpenNowFromSchedule respects day + time", () => {
        const schedule = shopSchedule.getDefaultSchedule();
        // 2026-05-21 is a Thursday
        expect(shopSchedule.isOpenNowFromSchedule(schedule, new Date("2026-05-21T10:00:00"))).toBe(true);
        // 06:00 same Thursday — before opening
        expect(shopSchedule.isOpenNowFromSchedule(schedule, new Date("2026-05-21T06:00:00"))).toBe(false);
        // 18:00 same Thursday — after closing
        expect(shopSchedule.isOpenNowFromSchedule(schedule, new Date("2026-05-21T18:00:00"))).toBe(false);
        // Sunday — closed by default
        expect(shopSchedule.isOpenNowFromSchedule(schedule, new Date("2026-05-24T12:00:00"))).toBe(false);
    });

    test("isOpenNowFromSchedule treats opening minute as open", () => {
        const schedule = shopSchedule.getDefaultSchedule();
        expect(shopSchedule.isOpenNowFromSchedule(schedule, new Date("2026-05-21T08:00:00"))).toBe(true);
    });

    test("isOpenNowFromSchedule handles overnight wrap (e.g. 22:00 - 02:00)", () => {
        const schedule = shopSchedule.getDefaultSchedule();
        schedule.friday = { open: true, openTime: "22:00", closeTime: "02:00" };

        // 23:00 on Friday — within wrap
        expect(shopSchedule.isOpenNowFromSchedule(schedule, new Date("2026-05-22T23:00:00"))).toBe(true);
        // 01:30 on Friday — still within wrap (start of day, before close)
        expect(shopSchedule.isOpenNowFromSchedule(schedule, new Date("2026-05-22T01:30:00"))).toBe(true);
        // 12:00 on Friday — outside
        expect(shopSchedule.isOpenNowFromSchedule(schedule, new Date("2026-05-22T12:00:00"))).toBe(false);
    });

    test("getShopOpenState returns 'manually-closed' when acceptingOrders is false", () => {
        const state = shopSchedule.getShopOpenState({
            acceptingOrders: false,
            schedule: shopSchedule.getDefaultSchedule()
        }, new Date("2026-05-21T10:00:00"));
        expect(state.isOpen).toBe(false);
        expect(state.reason).toBe("manually-closed");
    });

    test("getShopOpenState returns 'outside-hours' when schedule excludes current time", () => {
        const state = shopSchedule.getShopOpenState({
            acceptingOrders: true,
            schedule: shopSchedule.getDefaultSchedule()
        }, new Date("2026-05-21T20:00:00"));
        expect(state.isOpen).toBe(false);
        expect(state.reason).toBe("outside-hours");
    });

    test("getShopOpenState returns 'no-schedule' when no schedule provided", () => {
        const state = shopSchedule.getShopOpenState({
            acceptingOrders: true,
            schedule: null
        }, new Date());
        expect(state.isOpen).toBe(true);
        expect(state.reason).toBe("no-schedule");
    });

    test("getShopOpenState returns 'within-hours' label when open", () => {
        const state = shopSchedule.getShopOpenState({
            acceptingOrders: true,
            schedule: shopSchedule.getDefaultSchedule()
        }, new Date("2026-05-21T10:00:00"));
        expect(state.isOpen).toBe(true);
        expect(state.label).toBe("Open now");
    });

    test("getNextOpenSlot finds today later when current time is before open", () => {
        const result = shopSchedule.getNextOpenSlot(
            shopSchedule.getDefaultSchedule(),
            new Date("2026-05-21T06:00:00")
        );
        expect(result).toEqual(expect.objectContaining({ isToday: true, isLater: true, openTime: "08:00" }));
    });

    test("getNextOpenSlot finds the next open day when today is closed", () => {
        const result = shopSchedule.getNextOpenSlot(
            shopSchedule.getDefaultSchedule(),
            new Date("2026-05-24T12:00:00") // Sunday
        );
        expect(result.isToday).toBe(false);
        expect(result.dayLabel).toBe("Monday");
    });

    test("getNextOpenSlot returns null when nothing is open", () => {
        const closed = {};
        shopSchedule.DAYS.forEach((day) => {
            closed[day.key] = { open: false, openTime: "08:00", closeTime: "17:00" };
        });
        expect(shopSchedule.getNextOpenSlot(closed, new Date("2026-05-21T10:00:00"))).toBeNull();
    });

    test("isEmptySchedule detects fully closed schedules", () => {
        const closed = {};
        shopSchedule.DAYS.forEach((day) => {
            closed[day.key] = { open: false, openTime: "08:00", closeTime: "17:00" };
        });
        expect(shopSchedule.isEmptySchedule(closed)).toBe(true);
        expect(shopSchedule.isEmptySchedule(shopSchedule.getDefaultSchedule())).toBe(false);
    });
});

// ==========================================
// Institutions data tests
// ==========================================

describe("shared/south-african-institutions", () => {
    test("exposes 26 public universities", () => {
        const grouped = institutions.groupInstitutionsByType();
        expect(grouped.publicUniversities).toHaveLength(26);
    });

    test("exposes 50 TVET colleges", () => {
        const grouped = institutions.groupInstitutionsByType();
        expect(grouped.tvetColleges).toHaveLength(50);
    });

    test("exposes 15 private colleges", () => {
        const grouped = institutions.groupInstitutionsByType();
        expect(grouped.privateColleges).toHaveLength(15);
    });

    test("findInstitutionByName matches both full name and short name", () => {
        const wits = institutions.findInstitutionByName("Wits");
        expect(wits).not.toBeNull();
        expect(wits.name).toBe("University of the Witwatersrand");

        const up = institutions.findInstitutionByName("University of Pretoria");
        expect(up).not.toBeNull();
        expect(up.campuses.length).toBeGreaterThan(0);

        expect(institutions.findInstitutionByName("Unknown School")).toBeNull();
        expect(institutions.findInstitutionByName("")).toBeNull();
    });

    test("getCampusesFor returns campuses for a known institution", () => {
        const campuses = institutions.getCampusesFor("University of Pretoria");
        expect(campuses).toEqual(expect.arrayContaining([
            expect.stringContaining("Hatfield")
        ]));
    });

    test("getCampusesFor returns empty array for unknown institutions", () => {
        expect(institutions.getCampusesFor("Unknown")).toEqual([]);
    });

    test("getAllInstitutions returns a shallow copy", () => {
        const all = institutions.getAllInstitutions();
        const original = institutions.getAllInstitutions();
        all.pop();
        expect(all.length).toBe(original.length - 1);
    });
});

// ==========================================
// vendor/shop.js helpers
// ==========================================

describe("vendor/shop.js helpers", () => {
    test("module exposes key constants and field keys", () => {
        expect(MODULE_NAME).toBe("vendor/shop");
        expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
        expect(OTHER_OPTION_VALUE).toBe("__other__");
        expect(FIELD_KEYS).toEqual(expect.arrayContaining([
            "businessName",
            "foodType",
            "description",
            "institution",
            "campus",
            "stallLocation",
            "contactNumber",
            "businessEmail"
        ]));
    });

    test("normalization helpers", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeLowerText("  HELLO  ")).toBe("hello");
        expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
        expect(normalizePhoneNumber(" +27 71 234 5678 ")).toBe("+27712345678");
    });

    test("validation", () => {
        expect(isValidEmail("a@b.com")).toBe(true);
        expect(isValidEmail("nope")).toBe(false);
        expect(isValidPhoneNumber("+27712345678")).toBe(true);
        expect(isValidPhoneNumber("123")).toBe(false);
    });

    test("isImageFile and getFileExtension", () => {
        expect(isImageFile(createMockFile("a.png", "image/png"))).toBe(true);
        expect(isImageFile(createMockFile("a.txt", "text/plain"))).toBe(false);
        expect(isImageFile(null)).toBe(false);
        expect(getFileExtension(createMockFile("a.png", "image/png"))).toBe("png");
        expect(getFileExtension(createMockFile("a.webp", "image/webp"))).toBe("webp");
        expect(getFileExtension(createMockFile("a.gif", "image/gif"))).toBe("gif");
        expect(getFileExtension(null)).toBe("jpg");
    });

    test("buildShopPhotoPath", () => {
        expect(buildShopPhotoPath("vendor-1", createMockFile("a.png", "image/png")))
            .toBe("vendorShopPhotos/vendor-1/cover.png");
    });

    test("getDisplayShopPhotoUrl prefers banner URL", () => {
        expect(getDisplayShopPhotoUrl({ vendorBannerURL: "https://a" })).toBe("https://a");
        expect(getDisplayShopPhotoUrl(null)).toBe("");
    });

    test("normalizeShopRecord pulls institution/campus/schedule from new fields", () => {
        const record = normalizeShopRecord({
            uid: "vendor-1",
            vendorBusinessName: "Burger Hut",
            vendorDescription: "Tasty",
            vendorInstitution: "University of Pretoria",
            vendorInstitutionType: "Public University",
            vendorCampus: "Hatfield Campus — Hatfield, Pretoria",
            vendorStallLocation: "Stall 7",
            vendorFoodType: "Burgers",
            vendorPhoneNumber: "+27712345678",
            vendorEmail: "x@y.co.za",
            vendorAcceptingOrders: false,
            vendorBannerURL: "https://banner",
            vendorSchedule: shopSchedule.getDefaultSchedule()
        });

        expect(record.institution).toBe("University of Pretoria");
        expect(record.campus).toBe("Hatfield Campus — Hatfield, Pretoria");
        expect(record.stallLocation).toBe("Stall 7");
        expect(record.acceptingOrders).toBe(false);
        expect(record.schedule.monday.openTime).toBe("08:00");
        expect(record.scheduleSummary).toContain("Mon-Fri");
    });

    test("normalizeShopRecord falls back to legacy vendorUniversity/vendorLocation", () => {
        const record = normalizeShopRecord({
            vendorUniversity: "Legacy University",
            vendorLocation: "Legacy Location"
        });
        expect(record.institution).toBe("Legacy University");
        expect(record.stallLocation).toBe("Legacy Location");
    });

    test("validateShopValues catches missing institution and stall", () => {
        const result = validateShopValues({
            businessName: "Burger Hut",
            description: "Tasty burgers and chips.",
            institution: "",
            stallLocation: "",
            contactNumber: "+27712345678"
        });
        expect(result.errors.institution).toBe("Please choose or type your school.");
        expect(result.errors.stallLocation).toBe("Please enter the stall / building detail.");
    });

    test("validateShopValues passes with all required fields", () => {
        const result = validateShopValues({
            businessName: "Burger Hut",
            description: "Tasty burgers and chips.",
            institution: "University of Pretoria",
            stallLocation: "Stall 7",
            contactNumber: "+27712345678",
            businessEmail: "x@y.com",
            foodType: "Burgers"
        });
        expect(result.isValid).toBe(true);
    });

    test("toShopUpdates produces both new and legacy fields, plus schedule + summary", () => {
        const schedule = shopSchedule.getDefaultSchedule();
        const updates = toShopUpdates({
            businessName: "Burger Hut",
            foodType: "Burgers",
            description: "Tasty",
            institution: "University of Pretoria",
            institutionType: "Public University",
            campus: "Hatfield Campus",
            stallLocation: "Stall 7",
            contactNumber: " +27 71 234 5678 ",
            businessEmail: "X@Y.COM",
            acceptingOrders: true,
            schedule,
            shopPhotoURL: "https://banner",
            shopPhotoPath: "vendorShopPhotos/v/cover.jpg"
        });

        expect(updates.vendorInstitution).toBe("University of Pretoria");
        expect(updates.vendorUniversity).toBe("University of Pretoria");
        expect(updates.vendorInstitutionType).toBe("Public University");
        expect(updates.vendorCampus).toBe("Hatfield Campus");
        expect(updates.vendorStallLocation).toBe("Stall 7");
        expect(updates.vendorLocation).toBe("Stall 7");
        expect(updates.vendorPhoneNumber).toBe("+27712345678");
        expect(updates.vendorEmail).toBe("x@y.com");
        expect(updates.vendorAcceptingOrders).toBe(true);
        expect(updates.vendorBannerURL).toBe("https://banner");
        expect(updates.vendorSchedule.monday.openTime).toBe("08:00");
        expect(updates.vendorOpeningHours).toContain("Mon-Fri");
    });

    test("renderInstitutionOptions writes optgroups and selects known matches", () => {
        document.body.innerHTML = '<select id="sel"></select>';
        const select = document.getElementById("sel");

        renderInstitutionOptions(select, "University of Pretoria");

        const optgroups = select.querySelectorAll("optgroup");
        expect(optgroups.length).toBe(3);
        expect(optgroups[0].label).toBe("Public Universities");

        const selected = Array.from(select.options).find((o) => o.selected);
        expect(selected.value).toBe("University of Pretoria");
        // "Other" option exists
        expect(Array.from(select.options).some((o) => o.value === OTHER_OPTION_VALUE)).toBe(true);
    });

    test("renderInstitutionOptions selects 'Other' when value is custom", () => {
        document.body.innerHTML = '<select id="sel"></select>';
        const select = document.getElementById("sel");

        renderInstitutionOptions(select, "Some Custom School");

        const selected = Array.from(select.options).find((o) => o.selected);
        expect(selected.value).toBe(OTHER_OPTION_VALUE);
    });

    test("renderCampusOptions lists campuses for the chosen institution", () => {
        document.body.innerHTML = '<select id="sel"></select>';
        const select = document.getElementById("sel");

        renderCampusOptions(select, "University of Pretoria", "Hatfield Campus — Hatfield, Pretoria");

        const opts = Array.from(select.options).map((o) => o.value);
        expect(opts).toContain("Hatfield Campus — Hatfield, Pretoria");
        const selected = Array.from(select.options).find((o) => o.selected);
        expect(selected.value).toBe("Hatfield Campus — Hatfield, Pretoria");
    });

    test("renderCampusOptions selects 'Other' when campus is custom", () => {
        document.body.innerHTML = '<select id="sel"></select>';
        const select = document.getElementById("sel");

        renderCampusOptions(select, "University of Pretoria", "My Custom Stall");

        const selected = Array.from(select.options).find((o) => o.selected);
        expect(selected.value).toBe(OTHER_OPTION_VALUE);
    });

    test("clearFileInput, getSelectedPhotoFile, readFileAsDataURL", async () => {
        const input = document.createElement("input");
        input.type = "file";
        clearFileInput(input);
        expect(input.value).toBe("");
        expect(getSelectedPhotoFile(null)).toBeNull();
        expect(getSelectedPhotoFile({ files: [] })).toBeNull();
        expect(getSelectedPhotoFile({ files: ["a"] })).toBe("a");

        const originalFileReader = global.FileReader;
        global.FileReader = class MockFileReader {
            readAsDataURL() {
                this.result = "data:image/jpeg;base64,mock";
                this.onload();
            }
        };
        await expect(readFileAsDataURL(createMockFile("a.jpg", "image/jpeg")))
            .resolves.toBe("data:image/jpeg;base64,mock");
        global.FileReader = originalFileReader;
    });

    test("getAllInstitutions / findInstitutionByName / getCampusesFor / groupInstitutionsByType pass through", () => {
        expect(getAllInstitutions().length).toBeGreaterThan(0);
        expect(findInstitutionByName("Wits").name).toBe("University of the Witwatersrand");
        expect(getCampusesFor("University of Pretoria").length).toBeGreaterThan(0);
        const grouped = groupInstitutionsByType();
        expect(grouped.publicUniversities.length).toBe(26);
    });

    test("getDefaultSchedule / normalizeSchedule / formatScheduleSummary pass through", () => {
        expect(getDefaultSchedule().monday.open).toBe(true);
        expect(normalizeSchedule({}).monday.openTime).toBe("08:00");
        expect(formatScheduleSummary(getDefaultSchedule())).toContain("Mon-Fri");
    });

    test("getShopOpenState pass-through", () => {
        const state = getShopOpenState({ acceptingOrders: true, schedule: getDefaultSchedule() }, new Date("2026-05-21T10:00:00"));
        expect(state.isOpen).toBe(true);
    });
});

// ==========================================
// createVendorShopPage flows
// ==========================================

describe("createVendorShopPage", () => {
    let page;
    let deps;
    let consoleErrorSpy;

    beforeEach(() => {
        createDom();
        deps = buildDependencies();
        page = createVendorShopPage(deps);
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("initializeShopPage loads profile, fills institution + campus + schedule", async () => {
        const result = await page.initializeShopPage();

        expect(result.success).toBe(true);
        expect(document.getElementById("shop-business-name").value).toBe("Burger Hut");
        expect(document.getElementById("shop-institution-select").value).toBe("University of Pretoria");
        expect(document.getElementById("shop-campus-select").value).toBe("Hatfield Campus — Hatfield, Pretoria");
        expect(document.getElementById("shop-stall-location").value).toBe("Hatfield Plaza, Stall 7");
        expect(document.getElementById("shop-institution-type-display").textContent).toBe("Public University");
        expect(document.getElementById("schedule-editor").querySelectorAll(".schedule-row").length).toBe(7);
        // 10:00 on a Thursday with default schedule → open
        expect(document.getElementById("shop-live-status").textContent).toBe("Open now");
        expect(document.getElementById("shop-summary-institution").textContent).toBe("University of Pretoria");
    });

    test("Choosing 'Other' on the institution dropdown reveals the typed-in input", async () => {
        await page.initializeShopPage();

        const select = document.getElementById("shop-institution-select");
        select.value = OTHER_OPTION_VALUE;
        select.dispatchEvent(new Event("change", { bubbles: true }));

        const wrap = document.getElementById("shop-institution-other-wrap");
        expect(wrap.hidden).toBe(false);

        const otherInput = document.getElementById("shop-institution-other");
        otherInput.value = "My Local College";
        otherInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("shop-institution-type-display").textContent).toBe("Other / custom");
    });

    test("Choosing a known institution populates the campus dropdown", async () => {
        await page.initializeShopPage();

        const instSelect = document.getElementById("shop-institution-select");
        instSelect.value = "University of Cape Town";
        instSelect.dispatchEvent(new Event("change", { bubbles: true }));

        const campusSelect = document.getElementById("shop-campus-select");
        const options = Array.from(campusSelect.options).map((o) => o.value);
        expect(options.some((v) => v.includes("Upper Campus"))).toBe(true);
    });

    test("Choosing 'Other' on the campus dropdown reveals the campus-other input", async () => {
        await page.initializeShopPage();

        const campusSelect = document.getElementById("shop-campus-select");
        campusSelect.value = OTHER_OPTION_VALUE;
        campusSelect.dispatchEvent(new Event("change", { bubbles: true }));

        expect(document.getElementById("shop-campus-other-wrap").hidden).toBe(false);
    });

    test("Schedule preset 'allweek' opens every day with 09:00-18:00", async () => {
        await page.initializeShopPage();

        page.applySchedulePreset("allweek");

        const sunToggle = document.getElementById("schedule-sunday-open");
        expect(sunToggle.checked).toBe(true);
        const sunOpen = document.getElementById("schedule-sunday-open-time");
        expect(sunOpen.value).toBe("09:00");
    });

    test("Schedule preset 'clear' closes every day", async () => {
        await page.initializeShopPage();

        page.applySchedulePreset("clear");

        const monToggle = document.getElementById("schedule-monday-open");
        expect(monToggle.checked).toBe(false);
        expect(document.getElementById("schedule-summary").textContent).toBe("Closed all week");
    });

    test("Toggling a schedule day disables its time inputs", async () => {
        await page.initializeShopPage();

        const toggle = document.getElementById("schedule-tuesday-open");
        toggle.checked = false;
        toggle.dispatchEvent(new Event("change", { bubbles: true }));

        const openTime = document.getElementById("schedule-tuesday-open-time");
        const closeTime = document.getElementById("schedule-tuesday-close-time");
        expect(openTime.disabled).toBe(true);
        expect(closeTime.disabled).toBe(true);
    });

    test("Changing schedule updates live status to 'Closed' when out of hours", async () => {
        // Force "now" to be Saturday — closed by default
        deps = buildDependencies({ now: () => new Date("2026-05-23T10:00:00") });
        page = createVendorShopPage(deps);

        await page.initializeShopPage();

        expect(document.getElementById("shop-live-status").textContent).toBe("Closed");
        expect(document.getElementById("shop-summary-live").textContent).toBe("Closed");
    });

    test("Unchecking 'accepting orders' overrides schedule to Closed", async () => {
        await page.initializeShopPage();

        const accepting = document.getElementById("shop-accepting-orders");
        accepting.checked = false;
        accepting.dispatchEvent(new Event("change", { bubbles: true }));

        expect(document.getElementById("shop-live-status").textContent).toBe("Closed");
    });

    test("saveShop writes the new institution / schedule fields", async () => {
        await page.initializeShopPage();
        fillValidForm();

        const result = await page.saveShop();

        expect(result.success).toBe(true);
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                vendorInstitution: "University of Pretoria",
                vendorInstitutionType: "Public University",
                vendorCampus: "Hatfield Campus — Hatfield, Pretoria",
                vendorStallLocation: "Hatfield Plaza, Stall 7",
                vendorSchedule: expect.objectContaining({
                    monday: expect.objectContaining({ open: true })
                }),
                vendorOpeningHours: expect.stringContaining("Mon-Fri")
            })
        );
    });

    test("saveShop rejects when institution is empty", async () => {
        await page.initializeShopPage();
        // Wipe institution
        const inst = document.getElementById("shop-institution-select");
        inst.value = "";
        const result = await page.saveShop();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-institution-error").textContent)
            .toBe("Please choose or type your school.");
    });

    test("saveShop with 'Other' institution uses the typed value", async () => {
        await page.initializeShopPage();
        fillValidForm();

        const inst = document.getElementById("shop-institution-select");
        inst.value = OTHER_OPTION_VALUE;
        inst.dispatchEvent(new Event("change", { bubbles: true }));
        document.getElementById("shop-institution-other").value = "Custom Town College";

        const result = await page.saveShop();

        expect(result.success).toBe(true);
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                vendorInstitution: "Custom Town College",
                vendorInstitutionType: ""
            })
        );
    });

    test("back button click navigates to vendor dashboard", async () => {
        await page.initializeShopPage();

        document.getElementById("back-to-dashboard-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });

    test("reset button restores last loaded shop and clears errors", async () => {
        await page.initializeShopPage();

        document.getElementById("shop-business-name").value = "Changed";

        document.getElementById("reset-shop-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(document.getElementById("shop-business-name").value).toBe("Burger Hut");
    });

    test("Manual accepting-orders toggle disables ordering even within hours", async () => {
        await page.initializeShopPage();
        fillValidForm();

        document.getElementById("shop-accepting-orders").checked = false;
        const result = await page.saveShop();
        expect(result.success).toBe(true);
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ vendorAcceptingOrders: false })
        );
    });

    test("loadShopProfile uses profile fallback when firestore deps are missing", async () => {
        deps = buildDependencies();
        delete deps.firestoreFns.getDoc;
        page = createVendorShopPage(deps);

        await page.ensureVendorAccess();
        const result = await page.loadShopProfile();

        expect(result.success).toBe(true);
        expect(result.shop.institution).toBe("University of Pretoria");
    });

    test("loadShopProfile reports error when getDoc throws", async () => {
        deps = buildDependencies({ getDocError: new Error("boom") });
        page = createVendorShopPage(deps);
        await page.ensureVendorAccess();
        const result = await page.loadShopProfile();
        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("We could not load your shop details right now.");
    });

    test("initializeShopPage redirects to login when no user", async () => {
        deps = buildDependencies({ currentUser: null });
        page = createVendorShopPage(deps);
        await page.initializeShopPage();
        expect(deps.navigate).toHaveBeenCalledWith("../authentication/login.html");
    });

    test("initializeShopPage redirects to dashboard when not vendor", async () => {
        deps = buildDependencies({ canAccessVendor: false });
        page = createVendorShopPage(deps);
        await page.initializeShopPage();
        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });

    test("previewSelectedPhoto requires a file", async () => {
        await page.initializeShopPage();
        const result = await page.previewSelectedPhoto();
        expect(result.success).toBe(false);
    });

    test("previewSelectedPhoto rejects non-image files", async () => {
        await page.initializeShopPage();
        attachFile(document.getElementById("shop-photo-file"), createMockFile("a.txt", "text/plain"));
        const result = await page.previewSelectedPhoto();
        expect(result.success).toBe(false);
    });

    test("removeSelectedPhoto clears state", async () => {
        await page.initializeShopPage();
        const result = page.removeSelectedPhoto();
        expect(result.success).toBe(true);
        expect(page.state.photoMarkedForRemoval).toBe(true);
    });

    test("saveShop uploads selected photo and stores URL", async () => {
        await page.initializeShopPage();
        fillValidForm();
        attachFile(document.getElementById("shop-photo-file"), createMockFile("shop.png", "image/png"));

        const result = await page.saveShop();
        expect(result.success).toBe(true);
        expect(deps.storageFns.uploadBytes).toHaveBeenCalled();
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                vendorBannerURL: expect.stringContaining("https://storage.example/")
            })
        );
    });

    test("saveShop falls back to authService.updateUserProfile when firestore is unavailable", async () => {
        deps = buildDependencies();
        delete deps.firestoreFns.updateDoc;
        page = createVendorShopPage(deps);

        await page.initializeShopPage();
        fillValidForm();
        const result = await page.saveShop();
        expect(result.success).toBe(true);
        expect(deps.authService.updateUserProfile).toHaveBeenCalled();
    });

    test("saveShop reports failure when updateDoc throws", async () => {
        deps = buildDependencies({ updateDocError: new Error("offline") });
        page = createVendorShopPage(deps);
        await page.initializeShopPage();
        fillValidForm();
        const result = await page.saveShop();
        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent).toBe("offline");
    });

    test("submit event triggers saveShop with preventDefault", async () => {
        await page.initializeShopPage();
        fillValidForm();

        const evt = new Event("submit", { bubbles: true, cancelable: true });
        document.getElementById("vendor-shop-form").dispatchEvent(evt);
        await new Promise((r) => setTimeout(r, 0));
        expect(evt.defaultPrevented).toBe(true);
    });

    test("Editing a schedule row updates state, summary, and disables time inputs", async () => {
        await page.initializeShopPage();

        const monToggle = document.getElementById("schedule-monday-open");
        monToggle.checked = false;
        monToggle.dispatchEvent(new Event("change", { bubbles: true }));

        expect(page.state.schedule.monday.open).toBe(false);
        expect(document.getElementById("schedule-monday-open-time").disabled).toBe(true);
        expect(document.getElementById("schedule-summary").textContent).not.toContain("Mon-Fri");
    });

    test("Changing the institution dropdown to a known school refreshes the campus list", async () => {
        await page.initializeShopPage();

        const inst = document.getElementById("shop-institution-select");
        inst.value = "Stellenbosch University";
        inst.dispatchEvent(new Event("change", { bubbles: true }));

        const campusOpts = Array.from(document.getElementById("shop-campus-select").options).map((o) => o.value);
        expect(campusOpts.some((v) => v.includes("Stellenbosch Main Campus"))).toBe(true);
    });

    test("Schedule preset buttons fire through their click handlers", async () => {
        await page.initializeShopPage();

        document.getElementById("schedule-preset-allweek")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(document.getElementById("schedule-sunday-open").checked).toBe(true);

        document.getElementById("schedule-preset-clear")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(document.getElementById("schedule-monday-open").checked).toBe(false);

        document.getElementById("schedule-preset-weekdays")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(document.getElementById("schedule-monday-open").checked).toBe(true);
        expect(document.getElementById("schedule-saturday-open").checked).toBe(false);
    });

    test("Typing in the 'Other' institution field updates the type display live", async () => {
        await page.initializeShopPage();

        const inst = document.getElementById("shop-institution-select");
        inst.value = OTHER_OPTION_VALUE;
        inst.dispatchEvent(new Event("change", { bubbles: true }));

        const other = document.getElementById("shop-institution-other");
        other.value = "My Custom School";
        other.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("shop-institution-type-display").textContent).toBe("Other / custom");
    });

    test("readScheduleFromEditor produces a normalized schedule object", async () => {
        await page.initializeShopPage();

        const schedule = page.readScheduleFromEditor();
        expect(schedule.monday).toEqual(expect.objectContaining({ open: true, openTime: "08:00", closeTime: "17:00" }));
        expect(schedule.sunday).toEqual(expect.objectContaining({ open: false }));
    });
});

// ==========================================
// initializeVendorShopPage entry point
// ==========================================

describe("initializeVendorShopPage entry point", () => {
    beforeEach(() => {
        createDom();
    });

    test("wires the back button when no auth service is provided", () => {
        const navigate = jest.fn();
        const result = initializeVendorShopPage({ navigate });
        expect(result.success).toBe(true);

        document.getElementById("back-to-dashboard-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(navigate).toHaveBeenCalledWith("./index.html");
    });

    test("creates and initializes a full page when dependencies are supplied", async () => {
        const deps = buildDependencies();
        const page = initializeVendorShopPage(deps);
        expect(page).toBeTruthy();
        expect(typeof page.initializeShopPage).toBe("function");
        await new Promise((r) => setTimeout(r, 0));
        expect(deps.authService.getCurrentUser).toHaveBeenCalled();
    });
});
