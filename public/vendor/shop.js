(function attachVendorShopPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/shop";
    const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
    const DEFAULT_STATUS_MESSAGE = "Loading your shop details...";
    const DEFAULT_NOTE_MESSAGE = "Update any field below, preview your shopfront image, then save your changes.";
    const OTHER_OPTION_VALUE = "__other__";

    const FIELD_KEYS = [
        "businessName",
        "foodType",
        "description",
        "institution",
        "campus",
        "stallLocation",
        "contactNumber",
        "businessEmail"
    ];

    function resolveShopSchedule() {
        if (typeof globalScope !== "undefined" && globalScope.shopSchedule) {
            return globalScope.shopSchedule;
        }

        if (typeof require === "function") {
            try {
                return require("../shared/shop-schedule/shop-schedule.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveInstitutions() {
        if (typeof globalScope !== "undefined" && globalScope.southAfricanInstitutions) {
            return globalScope.southAfricanInstitutions;
        }

        if (typeof require === "function") {
            try {
                return require("../shared/institutions/south-african-institutions.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    const scheduleModule = resolveShopSchedule();
    const institutionsModule = resolveInstitutions();

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function normalizeEmail(value) {
        return normalizeLowerText(value);
    }

    function normalizePhoneNumber(value) {
        return normalizeText(value).replace(/\s+/g, "");
    }

    function isValidEmail(value) {
        const email = normalizeEmail(value);

        if (!email) {
            return false;
        }

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isValidPhoneNumber(value) {
        const phone = normalizePhoneNumber(value);

        if (!phone) {
            return false;
        }

        return /^\+?[0-9]{7,15}$/.test(phone);
    }

    function isImageFile(file) {
        return !!(file && typeof file.type === "string" && file.type.startsWith("image/"));
    }

    function readFileAsDataURL(file) {
        return new Promise(function buildReaderPromise(resolve, reject) {
            const reader = new FileReader();

            reader.onload = function handleLoad() {
                resolve(typeof reader.result === "string" ? reader.result : "");
            };

            reader.onerror = function handleError() {
                reject(new Error("Unable to read the selected image."));
            };

            reader.readAsDataURL(file);
        });
    }

    function loadImageFromSource(src) {
        return new Promise(function buildImagePromise(resolve, reject) {
            const image = new Image();

            image.onload = function handleLoad() {
                resolve(image);
            };

            image.onerror = function handleError() {
                reject(new Error("Unable to process the selected image."));
            };

            image.src = src;
        });
    }

    async function fileToOptimizedDataURL(file, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const maxWidth = Number.isFinite(safeOptions.maxWidth) ? safeOptions.maxWidth : 1600;
        const maxHeight = Number.isFinite(safeOptions.maxHeight) ? safeOptions.maxHeight : 1600;
        const quality = Number.isFinite(safeOptions.quality) ? safeOptions.quality : 0.85;

        const originalDataUrl = await readFileAsDataURL(file);
        const image = await loadImageFromSource(originalDataUrl);

        const originalWidth = image.naturalWidth || image.width || maxWidth;
        const originalHeight = image.naturalHeight || image.height || maxHeight;

        const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
        const targetWidth = Math.max(1, Math.round(originalWidth * ratio));
        const targetHeight = Math.max(1, Math.round(originalHeight * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext("2d");

        if (!context) {
            return originalDataUrl;
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);

        const targetType =
            file.type === "image/png" || file.type === "image/webp"
                ? file.type
                : "image/jpeg";

        return canvas.toDataURL(targetType, quality);
    }

    function getSelectedPhotoFile(fileInput) {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            return null;
        }

        return fileInput.files[0];
    }

    function clearFileInput(fileInput) {
        if (!fileInput) {
            return;
        }

        fileInput.value = "";
    }

    function getFileExtension(file) {
        if (!file || typeof file.type !== "string") {
            return "jpg";
        }

        if (file.type === "image/png") {
            return "png";
        }

        if (file.type === "image/webp") {
            return "webp";
        }

        if (file.type === "image/gif") {
            return "gif";
        }

        return "jpg";
    }

    function buildShopPhotoPath(vendorUid, file) {
        return `vendorShopPhotos/${normalizeText(vendorUid)}/cover.${getFileExtension(file)}`;
    }

    function getDisplayShopPhotoUrl(record) {
        const safe = record && typeof record === "object" ? record : {};
        return normalizeText(
            safe.vendorBannerURL ||
            safe.vendorPhotoURL ||
            safe.shopPhotoURL ||
            safe.shopPhotoDataUrl ||
            ""
        );
    }

    function getDefaultSchedule() {
        if (scheduleModule && typeof scheduleModule.getDefaultSchedule === "function") {
            return scheduleModule.getDefaultSchedule();
        }
        return {};
    }

    function normalizeSchedule(value) {
        if (scheduleModule && typeof scheduleModule.normalizeSchedule === "function") {
            return scheduleModule.normalizeSchedule(value);
        }
        return value || {};
    }

    function formatScheduleSummary(value) {
        if (scheduleModule && typeof scheduleModule.formatScheduleSummary === "function") {
            return scheduleModule.formatScheduleSummary(value);
        }
        return "";
    }

    function getShopOpenState(record, date) {
        if (scheduleModule && typeof scheduleModule.getShopOpenState === "function") {
            return scheduleModule.getShopOpenState(record, date);
        }
        return { isOpen: true, label: "Open", summary: "", reason: "no-schedule" };
    }

    function normalizeShopRecord(profile) {
        const safe = profile && typeof profile === "object" ? profile : {};
        const businessName = normalizeText(
            safe.vendorBusinessName ||
            safe.businessName ||
            safe.displayName ||
            ""
        );

        const institution = normalizeText(
            safe.vendorInstitution || safe.vendorUniversity || safe.university
        );
        const institutionType = normalizeText(safe.vendorInstitutionType);
        const campus = normalizeText(safe.vendorCampus);
        const stallLocation = normalizeText(
            safe.vendorStallLocation ||
            safe.vendorLocation ||
            safe.campusLocation ||
            safe.location
        );

        const schedule = normalizeSchedule(
            safe.vendorSchedule || safe.shopSchedule || null
        );

        return {
            uid: normalizeText(safe.uid),
            businessName: businessName,
            foodType: normalizeText(safe.vendorFoodType || safe.foodType),
            description: normalizeText(safe.vendorDescription || safe.description),
            institution,
            institutionType,
            campus,
            stallLocation,
            contactNumber: normalizePhoneNumber(
                safe.vendorPhoneNumber || safe.contactNumber || safe.phoneNumber
            ),
            businessEmail: normalizeEmail(safe.vendorEmail || safe.businessEmail),
            acceptingOrders: safe.vendorAcceptingOrders === false ? false : true,
            schedule,
            scheduleSummary: formatScheduleSummary(schedule),
            shopPhotoURL: getDisplayShopPhotoUrl(safe),
            shopPhotoPath: normalizeText(safe.vendorBannerPath || safe.shopPhotoPath),
            vendorStatus: normalizeLowerText(safe.vendorStatus) || "none",
            accountStatus: normalizeLowerText(safe.accountStatus) || "active"
        };
    }

    function validateShopValues(values) {
        const safe = values && typeof values === "object" ? values : {};
        const errors = {};

        if (!normalizeText(safe.businessName)) {
            errors.businessName = "Please enter your business name.";
        } else if (normalizeText(safe.businessName).length < 2) {
            errors.businessName = "Business name is too short.";
        }

        if (!normalizeText(safe.description)) {
            errors.description = "Please describe your shop.";
        } else if (normalizeText(safe.description).length < 10) {
            errors.description = "Please write a longer shop description.";
        }

        if (!normalizeText(safe.institution)) {
            errors.institution = "Please choose or type your school.";
        }

        if (!normalizeText(safe.stallLocation)) {
            errors.stallLocation = "Please enter the stall / building detail.";
        }

        if (!normalizeText(safe.contactNumber)) {
            errors.contactNumber = "Please enter a contact number.";
        } else if (!isValidPhoneNumber(safe.contactNumber)) {
            errors.contactNumber = "Please enter a valid contact number.";
        }

        if (normalizeText(safe.businessEmail) && !isValidEmail(safe.businessEmail)) {
            errors.businessEmail = "Please enter a valid email address.";
        }

        if (normalizeText(safe.foodType) && normalizeText(safe.foodType).length < 2) {
            errors.foodType = "Food type is too short.";
        }

        if (safe.schedule && scheduleModule && typeof scheduleModule.isEmptySchedule === "function") {
            // Schedule with no open days is allowed (acts as "always manually closed")
            // but we surface it as a warning in the UI rather than blocking save.
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    function toShopUpdates(values) {
        const safe = values && typeof values === "object" ? values : {};
        const schedule = normalizeSchedule(safe.schedule);
        const summary = formatScheduleSummary(schedule);

        return {
            vendorBusinessName: normalizeText(safe.businessName),
            businessName: normalizeText(safe.businessName),
            vendorFoodType: normalizeText(safe.foodType),
            vendorDescription: normalizeText(safe.description),
            description: normalizeText(safe.description),
            vendorInstitution: normalizeText(safe.institution),
            vendorUniversity: normalizeText(safe.institution),
            vendorInstitutionType: normalizeText(safe.institutionType),
            vendorCampus: normalizeText(safe.campus),
            vendorStallLocation: normalizeText(safe.stallLocation),
            vendorLocation: normalizeText(safe.stallLocation),
            campusLocation: normalizeText(safe.stallLocation),
            vendorOpeningHours: summary,
            vendorSchedule: schedule,
            vendorPhoneNumber: normalizePhoneNumber(safe.contactNumber),
            contactNumber: normalizePhoneNumber(safe.contactNumber),
            vendorEmail: normalizeEmail(safe.businessEmail),
            vendorAcceptingOrders: safe.acceptingOrders === true,
            vendorBannerURL: normalizeText(safe.shopPhotoURL),
            vendorBannerPath: normalizeText(safe.shopPhotoPath)
        };
    }

    function getAllInstitutions() {
        if (institutionsModule && typeof institutionsModule.getAllInstitutions === "function") {
            return institutionsModule.getAllInstitutions();
        }
        return [];
    }

    function findInstitutionByName(name) {
        if (institutionsModule && typeof institutionsModule.findInstitutionByName === "function") {
            return institutionsModule.findInstitutionByName(name);
        }
        return null;
    }

    function getCampusesFor(name) {
        if (institutionsModule && typeof institutionsModule.getCampusesFor === "function") {
            return institutionsModule.getCampusesFor(name);
        }
        return [];
    }

    function groupInstitutionsByType() {
        if (institutionsModule && typeof institutionsModule.groupInstitutionsByType === "function") {
            return institutionsModule.groupInstitutionsByType();
        }
        return { publicUniversities: [], tvetColleges: [], privateColleges: [] };
    }

    function renderInstitutionOptions(selectElement, selectedInstitutionName) {
        if (!selectElement || typeof document === "undefined") {
            return;
        }

        selectElement.innerHTML = "";

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "-- Select a school --";
        selectElement.appendChild(placeholder);

        const groups = groupInstitutionsByType();
        const groupConfig = [
            { label: "Public Universities", list: groups.publicUniversities },
            { label: "TVET Colleges", list: groups.tvetColleges },
            { label: "Private Colleges", list: groups.privateColleges }
        ];

        const selectedNeedle = normalizeLowerText(selectedInstitutionName);
        let matchedKnown = false;

        groupConfig.forEach(function appendGroup(config) {
            if (!config.list || config.list.length === 0) {
                return;
            }

            const optgroup = document.createElement("optgroup");
            optgroup.label = config.label;

            config.list.forEach(function appendOption(entry) {
                const option = document.createElement("option");
                option.value = entry.name;
                option.textContent = entry.shortName ? `${entry.name} (${entry.shortName})` : entry.name;
                if (normalizeLowerText(entry.name) === selectedNeedle) {
                    option.selected = true;
                    matchedKnown = true;
                }
                optgroup.appendChild(option);
            });

            selectElement.appendChild(optgroup);
        });

        const otherOption = document.createElement("option");
        otherOption.value = OTHER_OPTION_VALUE;
        otherOption.textContent = "Other (type it in)";
        if (selectedNeedle && !matchedKnown) {
            otherOption.selected = true;
        }
        selectElement.appendChild(otherOption);
    }

    function renderCampusOptions(selectElement, institutionName, selectedCampusName) {
        if (!selectElement || typeof document === "undefined") {
            return;
        }

        selectElement.innerHTML = "";

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "-- Select a campus --";
        selectElement.appendChild(placeholder);

        const campuses = getCampusesFor(institutionName);
        const selectedNeedle = normalizeLowerText(selectedCampusName);
        let matchedKnown = false;

        campuses.forEach(function appendCampus(campus) {
            const option = document.createElement("option");
            option.value = campus;
            option.textContent = campus;
            if (normalizeLowerText(campus) === selectedNeedle) {
                option.selected = true;
                matchedKnown = true;
            }
            selectElement.appendChild(option);
        });

        const otherOption = document.createElement("option");
        otherOption.value = OTHER_OPTION_VALUE;
        otherOption.textContent = "Other (type it in)";
        if (selectedNeedle && !matchedKnown) {
            otherOption.selected = true;
        }
        selectElement.appendChild(otherOption);
    }

    function createVendorShopPage(dependencies = {}) {
        const authService = dependencies.authService || null;
        const authUtils = dependencies.authUtils || null;
        const db = dependencies.db || null;
        const storage = dependencies.storage || null;
        const firestoreFns = dependencies.firestoreFns || {};
        const storageFns = dependencies.storageFns || {};
        const now = typeof dependencies.now === "function" ? dependencies.now : function defaultNow() { return new Date(); };
        const navigate =
            typeof dependencies.navigate === "function"
                ? dependencies.navigate
                : function fallbackNavigate(nextRoute) {
                    if (typeof window !== "undefined") {
                        window.location.href = nextRoute;
                    }
                };

        const state = {
            currentUser: null,
            currentProfile: null,
            currentShop: null,
            selectedPhotoDataUrl: "",
            photoMarkedForRemoval: false,
            schedule: getDefaultSchedule(),
            institutionInUseList: false,
            campusInUseList: false,
            liveTimer: null
        };

        function getElement(id) {
            return document.getElementById(id);
        }

        function navigateTo(route) {
            const target = normalizeText(route);

            if (!target) {
                return;
            }

            navigate(target);
        }

        function getUserDocRef(uid) {
            if (typeof firestoreFns.doc !== "function") {
                return null;
            }

            return firestoreFns.doc(db, "users", uid);
        }

        function getShopPhotoStorageRef(path) {
            if (!storage || typeof storageFns.ref !== "function") {
                return null;
            }

            return storageFns.ref(storage, path);
        }

        function getFormElements() {
            return {
                form: getElement("vendor-shop-form"),
                backButton: getElement("back-to-dashboard-button"),
                saveButton: getElement("save-shop-button"),
                resetButton: getElement("reset-shop-button"),
                businessNameInput: getElement("shop-business-name"),
                foodTypeInput: getElement("shop-food-type"),
                descriptionInput: getElement("shop-description"),
                institutionSelect: getElement("shop-institution-select"),
                institutionOtherInput: getElement("shop-institution-other"),
                institutionOtherWrap: getElement("shop-institution-other-wrap"),
                institutionTypeDisplay: getElement("shop-institution-type-display"),
                campusSelect: getElement("shop-campus-select"),
                campusOtherInput: getElement("shop-campus-other"),
                campusOtherWrap: getElement("shop-campus-other-wrap"),
                stallLocationInput: getElement("shop-stall-location"),
                contactNumberInput: getElement("shop-contact-number"),
                businessEmailInput: getElement("shop-business-email"),
                acceptingOrdersInput: getElement("shop-accepting-orders"),
                photoFileInput: getElement("shop-photo-file"),
                previewPhotoButton: getElement("preview-shop-photo-button"),
                removePhotoButton: getElement("remove-shop-photo-button"),
                photoPreview: getElement("shop-photo-preview"),
                photoEmptyState: getElement("shop-photo-empty-state"),
                scheduleEditor: getElement("schedule-editor"),
                scheduleSummary: getElement("schedule-summary"),
                schedulePresetWeekdays: getElement("schedule-preset-weekdays"),
                schedulePresetAllWeek: getElement("schedule-preset-allweek"),
                schedulePresetClear: getElement("schedule-preset-clear"),
                liveStatus: getElement("shop-live-status"),
                liveStatusNote: getElement("shop-live-status-note"),
                summaryLive: getElement("shop-summary-live")
            };
        }

        function setStatus(message, stateName) {
            const status = getElement("shop-status");

            if (!status) {
                return;
            }

            status.textContent = message || "";
            status.dataset.state = stateName || "";
        }

        function setNote(message) {
            const note = getElement("shop-note");

            if (!note) {
                return;
            }

            note.textContent = message || "";
        }

        function getErrorElement(fieldName) {
            return getElement(`shop-${fieldName}-error`);
        }

        function setFieldError(fieldName, message) {
            const elements = getFormElements();
            const fieldMap = {
                businessName: elements.businessNameInput,
                foodType: elements.foodTypeInput,
                description: elements.descriptionInput,
                institution: elements.institutionSelect,
                campus: elements.campusSelect,
                stallLocation: elements.stallLocationInput,
                contactNumber: elements.contactNumberInput,
                businessEmail: elements.businessEmailInput
            };

            const field = fieldMap[fieldName];
            const errorElement = getErrorElement(fieldName);

            if (field) {
                if (message) {
                    field.setAttribute("aria-invalid", "true");
                } else {
                    field.removeAttribute("aria-invalid");
                }
            }

            if (errorElement) {
                errorElement.textContent = message || "";
                errorElement.hidden = !message;
            }
        }

        function clearFieldErrors() {
            FIELD_KEYS.forEach(function clearOne(key) {
                setFieldError(key, "");
            });
        }

        function showValidationErrors(errors) {
            clearFieldErrors();

            Object.keys(errors).forEach(function applyOne(key) {
                setFieldError(key, errors[key]);
            });
        }

        function buildScheduleEditor(schedule) {
            const elements = getFormElements();
            const container = elements.scheduleEditor;

            if (!container || !scheduleModule) {
                return;
            }

            container.innerHTML = "";

            const safeSchedule = normalizeSchedule(schedule);

            scheduleModule.DAYS.forEach(function appendRow(day) {
                const slot = safeSchedule[day.key];

                const row = document.createElement("li");
                row.className = "schedule-row";
                row.dataset.dayKey = day.key;

                const toggleLabel = document.createElement("label");
                toggleLabel.className = "schedule-toggle";
                toggleLabel.setAttribute("for", `schedule-${day.key}-open`);

                const toggleInput = document.createElement("input");
                toggleInput.type = "checkbox";
                toggleInput.id = `schedule-${day.key}-open`;
                toggleInput.dataset.dayKey = day.key;
                toggleInput.dataset.role = "open-toggle";
                toggleInput.checked = slot.open === true;

                const dayName = document.createElement("strong");
                dayName.className = "schedule-day-name";
                dayName.textContent = day.label;

                toggleLabel.appendChild(toggleInput);
                toggleLabel.appendChild(dayName);

                const timesWrap = document.createElement("section");
                timesWrap.className = "schedule-times";

                const openLabel = document.createElement("label");
                openLabel.className = "schedule-time-field";
                openLabel.setAttribute("for", `schedule-${day.key}-open-time`);
                const openLabelText = document.createElement("small");
                openLabelText.textContent = "Opens";
                const openInput = document.createElement("input");
                openInput.type = "time";
                openInput.id = `schedule-${day.key}-open-time`;
                openInput.value = slot.openTime;
                openInput.dataset.dayKey = day.key;
                openInput.dataset.role = "open-time";
                openInput.disabled = !slot.open;
                openLabel.appendChild(openLabelText);
                openLabel.appendChild(openInput);

                const closeLabel = document.createElement("label");
                closeLabel.className = "schedule-time-field";
                closeLabel.setAttribute("for", `schedule-${day.key}-close-time`);
                const closeLabelText = document.createElement("small");
                closeLabelText.textContent = "Closes";
                const closeInput = document.createElement("input");
                closeInput.type = "time";
                closeInput.id = `schedule-${day.key}-close-time`;
                closeInput.value = slot.closeTime;
                closeInput.dataset.dayKey = day.key;
                closeInput.dataset.role = "close-time";
                closeInput.disabled = !slot.open;
                closeLabel.appendChild(closeLabelText);
                closeLabel.appendChild(closeInput);

                const closedNote = document.createElement("p");
                closedNote.className = "schedule-closed-note";
                closedNote.textContent = "Closed all day";
                closedNote.hidden = slot.open === true;

                timesWrap.appendChild(openLabel);
                timesWrap.appendChild(closeLabel);
                timesWrap.appendChild(closedNote);

                row.appendChild(toggleLabel);
                row.appendChild(timesWrap);
                container.appendChild(row);
            });
        }

        function readScheduleFromEditor() {
            const elements = getFormElements();
            const container = elements.scheduleEditor;

            if (!container || !scheduleModule) {
                return state.schedule;
            }

            const result = {};

            scheduleModule.DAYS.forEach(function readRow(day) {
                const toggle = container.querySelector(`input[data-day-key="${day.key}"][data-role="open-toggle"]`);
                const openTime = container.querySelector(`input[data-day-key="${day.key}"][data-role="open-time"]`);
                const closeTime = container.querySelector(`input[data-day-key="${day.key}"][data-role="close-time"]`);

                result[day.key] = {
                    open: toggle ? toggle.checked === true : false,
                    openTime: openTime && openTime.value ? openTime.value : "08:00",
                    closeTime: closeTime && closeTime.value ? closeTime.value : "17:00"
                };
            });

            return normalizeSchedule(result);
        }

        function applyScheduleRowDisabledStates() {
            const elements = getFormElements();
            const container = elements.scheduleEditor;

            if (!container) {
                return;
            }

            Array.from(container.querySelectorAll(".schedule-row")).forEach(function updateRow(row) {
                const toggle = row.querySelector('input[data-role="open-toggle"]');
                const openTime = row.querySelector('input[data-role="open-time"]');
                const closeTime = row.querySelector('input[data-role="close-time"]');
                const closedNote = row.querySelector(".schedule-closed-note");
                const isOpen = toggle && toggle.checked === true;

                if (openTime) {
                    openTime.disabled = !isOpen;
                }
                if (closeTime) {
                    closeTime.disabled = !isOpen;
                }
                if (closedNote) {
                    closedNote.hidden = isOpen;
                }
            });
        }

        function setScheduleAndRender(schedule) {
            state.schedule = normalizeSchedule(schedule);
            buildScheduleEditor(state.schedule);
            updateScheduleSummary();
            updateLiveStatus();
            updateSummaryFromForm();
        }

        function applySchedulePreset(presetName) {
            if (!scheduleModule) {
                return;
            }

            let preset;
            if (presetName === "weekdays") {
                preset = scheduleModule.getDefaultSchedule();
            } else if (presetName === "allweek") {
                preset = scheduleModule.getDefaultSchedule();
                scheduleModule.DAYS.forEach(function setOpen(day) {
                    preset[day.key] = { open: true, openTime: "09:00", closeTime: "18:00" };
                });
            } else if (presetName === "clear") {
                preset = scheduleModule.getDefaultSchedule();
                scheduleModule.DAYS.forEach(function setClosed(day) {
                    preset[day.key] = { open: false, openTime: "08:00", closeTime: "17:00" };
                });
            } else {
                return;
            }

            setScheduleAndRender(preset);
        }

        function updateScheduleSummary() {
            const elements = getFormElements();
            const summaryEl = elements.scheduleSummary;
            const summary = formatScheduleSummary(state.schedule);

            if (summaryEl) {
                summaryEl.textContent = summary;
            }

            const hoursOutput = getElement("shop-summary-hours");
            if (hoursOutput) {
                hoursOutput.textContent = summary;
            }
        }

        function updateLiveStatus() {
            const elements = getFormElements();
            const values = collectFormValues();
            const openState = getShopOpenState({
                acceptingOrders: values.acceptingOrders,
                schedule: state.schedule
            }, now());

            if (elements.liveStatus) {
                elements.liveStatus.textContent = openState.label;
                elements.liveStatus.classList.remove(
                    "shop-live-status-open",
                    "shop-live-status-closed",
                    "shop-live-status-unknown"
                );
                elements.liveStatus.classList.add(
                    openState.isOpen ? "shop-live-status-open" : "shop-live-status-closed"
                );
            }

            if (elements.liveStatusNote) {
                if (openState.reason === "manually-closed") {
                    elements.liveStatusNote.textContent = "You've ticked off 'accepting orders'. Customers see your shop as closed.";
                } else if (openState.reason === "outside-hours") {
                    const next = openState.nextOpen;
                    if (next && next.isToday) {
                        elements.liveStatusNote.textContent = `Outside your opening hours. You're set to reopen today at ${next.openTime}.`;
                    } else if (next && next.dayLabel) {
                        elements.liveStatusNote.textContent = `Outside your opening hours. Next open: ${next.dayLabel} at ${next.openTime}.`;
                    } else {
                        elements.liveStatusNote.textContent = "Outside your opening hours.";
                    }
                } else if (openState.reason === "no-schedule") {
                    elements.liveStatusNote.textContent = "No schedule saved yet — set your weekly hours below.";
                } else {
                    elements.liveStatusNote.textContent = "You're open for orders right now.";
                }
            }

            if (elements.summaryLive) {
                elements.summaryLive.textContent = openState.label;
            }
        }

        function updatePhotoPreview(photoUrl) {
            const elements = getFormElements();
            const safeUrl = normalizeText(photoUrl);
            const photoStateOutput = getElement("shop-photo-state");

            if (elements.photoPreview && elements.photoEmptyState) {
                if (safeUrl) {
                    elements.photoPreview.src = safeUrl;
                    elements.photoPreview.hidden = false;
                    elements.photoEmptyState.hidden = true;
                } else {
                    elements.photoPreview.removeAttribute("src");
                    elements.photoPreview.hidden = true;
                    elements.photoEmptyState.hidden = false;
                }
            }

            if (photoStateOutput) {
                photoStateOutput.textContent = safeUrl ? "Photo uploaded" : "No photo uploaded";
            }
        }

        function updateStatsPanel(shop) {
            const safe = shop && typeof shop === "object" ? shop : {};
            const vendorStatusOutput = getElement("shop-vendor-status");
            const accountStatusOutput = getElement("shop-account-status");
            const visibilityOutput = getElement("shop-visibility");

            if (vendorStatusOutput) {
                vendorStatusOutput.textContent = normalizeText(safe.vendorStatus) || "none";
            }

            if (accountStatusOutput) {
                accountStatusOutput.textContent = normalizeText(safe.accountStatus) || "active";
            }

            if (visibilityOutput) {
                const isVisible =
                    normalizeLowerText(safe.vendorStatus) === "approved" &&
                    normalizeLowerText(safe.accountStatus) === "active";
                visibilityOutput.textContent = isVisible ? "Yes" : "No";
            }
        }

        function updateSummaryFromForm() {
            const values = collectFormValues();
            updateSummary(values, state.selectedPhotoDataUrl);
        }

        function updateSummary(values, photoUrl) {
            const safe = values && typeof values === "object" ? values : {};

            const nameOutput = getElement("shop-summary-name");
            const foodOutput = getElement("shop-summary-food-type");
            const institutionOutput = getElement("shop-summary-institution");
            const campusOutput = getElement("shop-summary-campus");
            const stallOutput = getElement("shop-summary-stall");
            const phoneOutput = getElement("shop-summary-phone");
            const emailOutput = getElement("shop-summary-email");
            const descriptionOutput = getElement("shop-summary-description");

            if (nameOutput) {
                nameOutput.textContent = normalizeText(safe.businessName) || "-";
            }

            if (foodOutput) {
                foodOutput.textContent = normalizeText(safe.foodType) || "-";
            }

            if (institutionOutput) {
                institutionOutput.textContent = normalizeText(safe.institution) || "-";
            }

            if (campusOutput) {
                campusOutput.textContent = normalizeText(safe.campus) || "-";
            }

            if (stallOutput) {
                stallOutput.textContent = normalizeText(safe.stallLocation) || "-";
            }

            if (phoneOutput) {
                phoneOutput.textContent = normalizePhoneNumber(safe.contactNumber) || "-";
            }

            if (emailOutput) {
                emailOutput.textContent = normalizeEmail(safe.businessEmail) || "-";
            }

            if (descriptionOutput) {
                descriptionOutput.textContent = normalizeText(safe.description) || "-";
            }

            updatePhotoPreview(photoUrl);
        }

        function getInstitutionSelectionValues() {
            const elements = getFormElements();
            const selectValue = elements.institutionSelect ? elements.institutionSelect.value : "";

            if (selectValue === OTHER_OPTION_VALUE) {
                return {
                    institution: elements.institutionOtherInput ? elements.institutionOtherInput.value : "",
                    matchedKnown: false
                };
            }

            return {
                institution: selectValue || "",
                matchedKnown: !!selectValue
            };
        }

        function getCampusSelectionValues() {
            const elements = getFormElements();
            const selectValue = elements.campusSelect ? elements.campusSelect.value : "";

            if (selectValue === OTHER_OPTION_VALUE) {
                return {
                    campus: elements.campusOtherInput ? elements.campusOtherInput.value : "",
                    matchedKnown: false
                };
            }

            return {
                campus: selectValue || "",
                matchedKnown: !!selectValue
            };
        }

        function collectFormValues() {
            const elements = getFormElements();
            const institutionInfo = getInstitutionSelectionValues();
            const campusInfo = getCampusSelectionValues();
            const found = findInstitutionByName(institutionInfo.institution);

            return {
                businessName: elements.businessNameInput ? elements.businessNameInput.value : "",
                foodType: elements.foodTypeInput ? elements.foodTypeInput.value : "",
                description: elements.descriptionInput ? elements.descriptionInput.value : "",
                institution: institutionInfo.institution,
                institutionType: found ? found.type : "",
                campus: campusInfo.campus,
                stallLocation: elements.stallLocationInput ? elements.stallLocationInput.value : "",
                contactNumber: elements.contactNumberInput ? elements.contactNumberInput.value : "",
                businessEmail: elements.businessEmailInput ? elements.businessEmailInput.value : "",
                acceptingOrders: elements.acceptingOrdersInput
                    ? elements.acceptingOrdersInput.checked === true
                    : true,
                schedule: state.schedule
            };
        }

        function updateInstitutionTypeDisplay(institutionName) {
            const elements = getFormElements();
            if (!elements.institutionTypeDisplay) {
                return;
            }

            const found = findInstitutionByName(institutionName);
            elements.institutionTypeDisplay.textContent = found ? found.type : (normalizeText(institutionName) ? "Other / custom" : "-");
        }

        function setInstitutionFromShop(institutionName) {
            const elements = getFormElements();

            renderInstitutionOptions(elements.institutionSelect, institutionName);

            const found = findInstitutionByName(institutionName);
            const useList = !!found;

            if (elements.institutionOtherWrap) {
                elements.institutionOtherWrap.hidden = useList;
            }

            if (elements.institutionOtherInput) {
                elements.institutionOtherInput.value = useList ? "" : normalizeText(institutionName);
            }

            updateInstitutionTypeDisplay(institutionName);
            state.institutionInUseList = useList;
        }

        function setCampusFromShop(institutionName, campusName) {
            const elements = getFormElements();

            renderCampusOptions(elements.campusSelect, institutionName, campusName);

            const knownCampuses = getCampusesFor(institutionName);
            const knownMatch = knownCampuses.some(function matchesCampus(name) {
                return normalizeLowerText(name) === normalizeLowerText(campusName);
            });
            const useList = knownMatch;

            if (elements.campusOtherWrap) {
                elements.campusOtherWrap.hidden = useList || !campusName;
                if (!campusName) {
                    elements.campusOtherWrap.hidden = true;
                }
            }

            if (elements.campusOtherInput) {
                elements.campusOtherInput.value = useList ? "" : normalizeText(campusName);
            }

            state.campusInUseList = useList;
        }

        function fillForm(shop) {
            const safe = shop && typeof shop === "object" ? shop : {};
            const elements = getFormElements();

            if (elements.businessNameInput) {
                elements.businessNameInput.value = normalizeText(safe.businessName);
            }

            if (elements.foodTypeInput) {
                elements.foodTypeInput.value = normalizeText(safe.foodType);
            }

            if (elements.descriptionInput) {
                elements.descriptionInput.value = normalizeText(safe.description);
            }

            setInstitutionFromShop(safe.institution);
            setCampusFromShop(safe.institution, safe.campus);

            if (elements.stallLocationInput) {
                elements.stallLocationInput.value = normalizeText(safe.stallLocation);
            }

            if (elements.contactNumberInput) {
                elements.contactNumberInput.value = normalizePhoneNumber(safe.contactNumber);
            }

            if (elements.businessEmailInput) {
                elements.businessEmailInput.value = normalizeEmail(safe.businessEmail);
            }

            if (elements.acceptingOrdersInput) {
                elements.acceptingOrdersInput.checked = safe.acceptingOrders !== false;
            }

            setScheduleAndRender(safe.schedule);

            state.selectedPhotoDataUrl = normalizeText(safe.shopPhotoURL);
            state.photoMarkedForRemoval = false;
            clearFileInput(elements.photoFileInput);
            clearFieldErrors();
            updateStatsPanel(safe);
            updateSummaryFromForm();
        }

        async function loadShopProfile() {
            if (!state.currentUser || !state.currentUser.uid) {
                setStatus("You must be signed in to view your shop details.", "error");
                return { success: false };
            }

            if (!db || typeof firestoreFns.doc !== "function" || typeof firestoreFns.getDoc !== "function") {
                const shop = normalizeShopRecord(state.currentProfile || { uid: state.currentUser.uid });
                state.currentShop = shop;
                fillForm(shop);
                setStatus("Shop details loaded from your profile.", "success");
                setNote("Update any field below, then save your changes.");
                return { success: true, shop };
            }

            try {
                const docRef = getUserDocRef(state.currentUser.uid);
                const snapshot = await firestoreFns.getDoc(docRef);
                const data = snapshot && typeof snapshot.data === "function" ? snapshot.data() || {} : {};
                const merged = Object.assign(
                    { uid: state.currentUser.uid },
                    state.currentProfile || {},
                    data
                );
                const shop = normalizeShopRecord(merged);

                state.currentShop = shop;
                fillForm(shop);
                setStatus("Shop details loaded.", "success");
                setNote("Update any field below, then save your changes.");

                return { success: true, shop };
            } catch (error) {
                console.error("Failed to load shop details:", error);
                setStatus("We could not load your shop details right now.", "error");
                setNote("Please refresh the page and try again.");
                return { success: false, error };
            }
        }

        async function previewSelectedPhoto() {
            const elements = getFormElements();
            const selectedFile = getSelectedPhotoFile(elements.photoFileInput);

            if (!selectedFile) {
                setStatus("Choose a shopfront photo first.", "error");
                setNote("Select an image from your device to preview it.");
                return { success: false };
            }

            if (!isImageFile(selectedFile)) {
                setStatus("Please choose an image file.", "error");
                setNote("Only image files can be used for the shopfront photo.");
                return { success: false };
            }

            if (selectedFile.size > MAX_IMAGE_SIZE_BYTES) {
                setStatus("Please choose an image smaller than 5 MB.", "error");
                setNote("Large images should be compressed before upload.");
                return { success: false };
            }

            try {
                const previewDataUrl = await fileToOptimizedDataURL(selectedFile, {
                    maxWidth: 1600,
                    maxHeight: 1600,
                    quality: 0.85
                });

                state.selectedPhotoDataUrl = previewDataUrl;
                state.photoMarkedForRemoval = false;
                updateSummary(collectFormValues(), previewDataUrl);
                setStatus("Shopfront photo preview ready.", "success");
                setNote("Save your shop to upload the image to Firebase Storage.");

                return { success: true, photoDataUrl: previewDataUrl };
            } catch (error) {
                setStatus(error && error.message ? error.message : "Unable to preview the selected image.", "error");
                return { success: false, error };
            }
        }

        function removeSelectedPhoto() {
            const elements = getFormElements();

            state.selectedPhotoDataUrl = "";
            state.photoMarkedForRemoval = true;
            clearFileInput(elements.photoFileInput);
            updateSummary(collectFormValues(), "");
            setStatus("Shopfront photo removed.", "success");
            setNote("Save your shop to remove the stored image as well.");

            return { success: true };
        }

        async function deleteStoredShopPhoto(photoPath) {
            const safePath = normalizeText(photoPath);

            if (!safePath) {
                return { success: true, skipped: true };
            }

            if (!storage || typeof storageFns.ref !== "function" || typeof storageFns.deleteObject !== "function") {
                return { success: false };
            }

            try {
                await storageFns.deleteObject(getShopPhotoStorageRef(safePath));
                return { success: true };
            } catch (error) {
                const code = normalizeLowerText(error && error.code);

                if (code === "storage/object-not-found") {
                    return { success: true, skipped: true };
                }

                throw error;
            }
        }

        async function uploadShopPhotoIfSelected(existingShop) {
            const elements = getFormElements();
            const selectedFile = getSelectedPhotoFile(elements.photoFileInput);
            const currentShop = existingShop && typeof existingShop === "object" ? existingShop : {};
            let photoURL = normalizeText(currentShop.shopPhotoURL);
            let photoPath = normalizeText(currentShop.shopPhotoPath);

            if (selectedFile) {
                if (!isImageFile(selectedFile)) {
                    throw new Error("Please choose an image file.");
                }

                if (selectedFile.size > MAX_IMAGE_SIZE_BYTES) {
                    throw new Error("Please choose an image smaller than 5 MB.");
                }

                if (!storage) {
                    throw new Error("Firebase Storage is not ready.");
                }

                if (
                    typeof storageFns.ref !== "function" ||
                    typeof storageFns.uploadBytes !== "function" ||
                    typeof storageFns.getDownloadURL !== "function"
                ) {
                    throw new Error("Storage functions are not available.");
                }

                photoPath = buildShopPhotoPath(state.currentUser.uid, selectedFile);
                const storageRef = getShopPhotoStorageRef(photoPath);

                await storageFns.uploadBytes(storageRef, selectedFile, {
                    contentType: selectedFile.type || "image/jpeg"
                });
                photoURL = await storageFns.getDownloadURL(storageRef);
                state.photoMarkedForRemoval = false;
                state.selectedPhotoDataUrl = photoURL;
                clearFileInput(elements.photoFileInput);
            } else if (state.photoMarkedForRemoval) {
                await deleteStoredShopPhoto(photoPath);
                photoURL = "";
                photoPath = "";
                state.photoMarkedForRemoval = false;
            }

            return { photoURL, photoPath };
        }

        async function saveShop() {
            state.schedule = readScheduleFromEditor();
            const values = collectFormValues();
            const validation = validateShopValues(values);

            if (!validation.isValid) {
                showValidationErrors(validation.errors);

                const firstError = Object.values(validation.errors)[0];
                setStatus(firstError, "error");
                setNote("Please correct the highlighted fields and try again.");

                return { success: false, errors: validation.errors };
            }

            if (!state.currentUser || !state.currentUser.uid) {
                setStatus("You must be signed in to update your shop.", "error");
                return { success: false };
            }

            clearFieldErrors();

            try {
                const photoFields = await uploadShopPhotoIfSelected(state.currentShop || {});
                const updates = toShopUpdates({
                    ...values,
                    shopPhotoURL: photoFields.photoURL,
                    shopPhotoPath: photoFields.photoPath
                });

                if (typeof firestoreFns.serverTimestamp === "function") {
                    updates.updatedAt = firestoreFns.serverTimestamp();
                }

                if (
                    db &&
                    typeof firestoreFns.doc === "function" &&
                    typeof firestoreFns.updateDoc === "function"
                ) {
                    const docRef = getUserDocRef(state.currentUser.uid);
                    await firestoreFns.updateDoc(docRef, updates);
                } else if (
                    authService &&
                    typeof authService.updateUserProfile === "function"
                ) {
                    await authService.updateUserProfile(state.currentUser.uid, updates);
                } else {
                    throw new Error("No Firestore writer is available.");
                }

                state.currentShop = normalizeShopRecord({
                    ...(state.currentShop || {}),
                    ...updates,
                    uid: state.currentUser.uid
                });
                fillForm(state.currentShop);
                setStatus("Shop details saved successfully.", "success");
                setNote("Your customer-facing shop card has been updated.");

                return { success: true, updates };
            } catch (error) {
                console.error("Failed to save shop details:", error);
                setStatus(error && error.message ? error.message : "Failed to save your shop details.", "error");
                setNote("Check your connection and try saving again.");
                return { success: false, error };
            }
        }

        function validateSingleField(fieldName) {
            const values = collectFormValues();
            const validation = validateShopValues(values);
            const error = validation.errors[fieldName] || "";

            setFieldError(fieldName, error);
            return !error;
        }

        function handleLiveUpdate(fieldName) {
            if (fieldName) {
                validateSingleField(fieldName);
            }

            updateSummaryFromForm();
            updateLiveStatus();
        }

        function bindLiveValidation() {
            const elements = getFormElements();
            const fieldMap = {
                businessName: elements.businessNameInput,
                foodType: elements.foodTypeInput,
                description: elements.descriptionInput,
                stallLocation: elements.stallLocationInput,
                contactNumber: elements.contactNumberInput,
                businessEmail: elements.businessEmailInput
            };

            Object.keys(fieldMap).forEach(function attach(fieldName) {
                const field = fieldMap[fieldName];

                if (!field) {
                    return;
                }

                field.addEventListener("input", function onInput() {
                    handleLiveUpdate(fieldName);
                });
            });

            if (elements.acceptingOrdersInput) {
                elements.acceptingOrdersInput.addEventListener("change", function onToggle() {
                    handleLiveUpdate("");
                });
            }

            if (elements.institutionOtherInput) {
                elements.institutionOtherInput.addEventListener("input", function onOtherInst() {
                    updateInstitutionTypeDisplay(elements.institutionOtherInput.value);
                    handleLiveUpdate("institution");
                });
            }

            if (elements.campusOtherInput) {
                elements.campusOtherInput.addEventListener("input", function onOtherCampus() {
                    handleLiveUpdate("campus");
                });
            }
        }

        function bindInstitutionCascade() {
            const elements = getFormElements();

            if (elements.institutionSelect) {
                elements.institutionSelect.addEventListener("change", function onInstitutionChange() {
                    const value = elements.institutionSelect.value;
                    const isOther = value === OTHER_OPTION_VALUE;

                    if (elements.institutionOtherWrap) {
                        elements.institutionOtherWrap.hidden = !isOther;
                    }

                    if (elements.institutionOtherInput) {
                        if (isOther) {
                            elements.institutionOtherInput.focus();
                        } else {
                            elements.institutionOtherInput.value = "";
                        }
                    }

                    const institutionName = isOther
                        ? (elements.institutionOtherInput ? elements.institutionOtherInput.value : "")
                        : value;

                    updateInstitutionTypeDisplay(institutionName);
                    renderCampusOptions(elements.campusSelect, institutionName, "");

                    if (elements.campusOtherWrap) {
                        elements.campusOtherWrap.hidden = true;
                    }

                    if (elements.campusOtherInput) {
                        elements.campusOtherInput.value = "";
                    }

                    handleLiveUpdate("institution");
                });
            }

            if (elements.campusSelect) {
                elements.campusSelect.addEventListener("change", function onCampusChange() {
                    const value = elements.campusSelect.value;
                    const isOther = value === OTHER_OPTION_VALUE;

                    if (elements.campusOtherWrap) {
                        elements.campusOtherWrap.hidden = !isOther;
                    }

                    if (elements.campusOtherInput) {
                        if (isOther) {
                            elements.campusOtherInput.focus();
                        } else {
                            elements.campusOtherInput.value = "";
                        }
                    }

                    handleLiveUpdate("campus");
                });
            }
        }

        function bindScheduleEditor() {
            const elements = getFormElements();
            const container = elements.scheduleEditor;

            if (!container) {
                return;
            }

            container.addEventListener("change", function onChange(event) {
                const target = event.target;
                if (!target || !target.dataset || !target.dataset.dayKey) {
                    return;
                }

                state.schedule = readScheduleFromEditor();
                applyScheduleRowDisabledStates();
                updateScheduleSummary();
                updateLiveStatus();
            });

            if (elements.schedulePresetWeekdays) {
                elements.schedulePresetWeekdays.addEventListener("click", function onPreset(event) {
                    if (event && typeof event.preventDefault === "function") event.preventDefault();
                    applySchedulePreset("weekdays");
                });
            }
            if (elements.schedulePresetAllWeek) {
                elements.schedulePresetAllWeek.addEventListener("click", function onPreset(event) {
                    if (event && typeof event.preventDefault === "function") event.preventDefault();
                    applySchedulePreset("allweek");
                });
            }
            if (elements.schedulePresetClear) {
                elements.schedulePresetClear.addEventListener("click", function onPreset(event) {
                    if (event && typeof event.preventDefault === "function") event.preventDefault();
                    applySchedulePreset("clear");
                });
            }
        }

        function goBack() {
            navigateTo("./index.html");
        }

        function handleResetForm() {
            if (state.currentShop) {
                fillForm(state.currentShop);
                setStatus("Changes discarded. Showing last saved shop details.", "info");
                setNote("Make new edits below or head back to the dashboard.");
            } else {
                clearFieldErrors();
                setStatus(DEFAULT_STATUS_MESSAGE, "info");
                setNote(DEFAULT_NOTE_MESSAGE);
            }
        }

        async function ensureVendorAccess() {
            if (!authService || typeof authService.getCurrentUser !== "function") {
                throw new Error("authService.getCurrentUser is required.");
            }

            if (typeof authService.getCurrentUserProfile !== "function") {
                throw new Error("authService.getCurrentUserProfile is required.");
            }

            const user = authService.getCurrentUser();

            if (!user || !user.uid) {
                navigateTo("../authentication/login.html");
                return false;
            }

            const rawProfile = await authService.getCurrentUserProfile(user.uid);
            const profile =
                authUtils && typeof authUtils.normaliseUserData === "function"
                    ? authUtils.normaliseUserData(rawProfile || { uid: user.uid })
                    : rawProfile || { uid: user.uid };

            state.currentUser = user;
            state.currentProfile = profile;

            if (
                authUtils &&
                typeof authUtils.canAccessVendorPortal === "function" &&
                !authUtils.canAccessVendorPortal(profile)
            ) {
                navigateTo("./index.html");
                return false;
            }

            return true;
        }

        function startLiveStatusTimer() {
            if (typeof window === "undefined" || typeof window.setInterval !== "function") {
                return;
            }

            if (state.liveTimer) {
                window.clearInterval(state.liveTimer);
            }

            state.liveTimer = window.setInterval(function tick() {
                updateLiveStatus();
            }, 60 * 1000);
        }

        function bindEvents() {
            const elements = getFormElements();

            if (elements.form) {
                elements.form.addEventListener("submit", function onSubmit(event) {
                    if (event && typeof event.preventDefault === "function") {
                        event.preventDefault();
                    }

                    saveShop();
                });
            }

            if (elements.backButton) {
                elements.backButton.addEventListener("click", function onBack(event) {
                    if (event && typeof event.preventDefault === "function") {
                        event.preventDefault();
                    }

                    goBack();
                });
            }

            if (elements.resetButton) {
                elements.resetButton.addEventListener("click", function onReset(event) {
                    if (event && typeof event.preventDefault === "function") {
                        event.preventDefault();
                    }

                    handleResetForm();
                });
            }

            if (elements.previewPhotoButton) {
                elements.previewPhotoButton.addEventListener("click", function onPreview(event) {
                    if (event && typeof event.preventDefault === "function") {
                        event.preventDefault();
                    }

                    previewSelectedPhoto();
                });
            }

            if (elements.removePhotoButton) {
                elements.removePhotoButton.addEventListener("click", function onRemove(event) {
                    if (event && typeof event.preventDefault === "function") {
                        event.preventDefault();
                    }

                    removeSelectedPhoto();
                });
            }

            bindLiveValidation();
            bindInstitutionCascade();
            bindScheduleEditor();
        }

        async function initializeShopPage() {
            setStatus(DEFAULT_STATUS_MESSAGE, "info");
            setNote(DEFAULT_NOTE_MESSAGE);

            const elements = getFormElements();
            renderInstitutionOptions(elements.institutionSelect, "");
            renderCampusOptions(elements.campusSelect, "", "");
            buildScheduleEditor(state.schedule);
            updateScheduleSummary();
            updateLiveStatus();
            bindEvents();
            startLiveStatusTimer();

            const allowed = await ensureVendorAccess();

            if (!allowed) {
                return { success: false };
            }

            const loadResult = await loadShopProfile();

            if (!loadResult.success) {
                return { success: false, error: loadResult.error || null };
            }

            return { success: true, shop: loadResult.shop };
        }

        return {
            initializeShopPage,
            loadShopProfile,
            saveShop,
            previewSelectedPhoto,
            removeSelectedPhoto,
            goBack,
            handleResetForm,
            ensureVendorAccess,
            collectFormValues,
            fillForm,
            updateSummary,
            updateStatsPanel,
            updateLiveStatus,
            updateScheduleSummary,
            setScheduleAndRender,
            applySchedulePreset,
            readScheduleFromEditor,
            validateSingleField,
            state
        };
    }

    function initializeVendorShopPage(options = {}) {
        const navigate =
            typeof options.navigate === "function"
                ? options.navigate
                : function fallbackNavigate(nextRoute) {
                    if (typeof window !== "undefined") {
                        window.location.href = nextRoute;
                    }
                };

        const backButton = document.querySelector("#back-to-dashboard-button");

        if (backButton && !options.authService) {
            backButton.addEventListener("click", function handleClick(event) {
                if (event && typeof event.preventDefault === "function") {
                    event.preventDefault();
                }

                navigate("./index.html");
            });
        }

        if (!options.authService) {
            return { success: true };
        }

        const page = createVendorShopPage({
            ...options,
            navigate
        });

        if (typeof window !== "undefined") {
            window.vendorShopPage = window.vendorShopPage || {};
            window.vendorShopPage.instance = page;
        }

        page.initializeShopPage();
        return page;
    }

    const exportsObject = {
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
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = exportsObject;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorShopPage = exportsObject;
    }
})(typeof window !== "undefined" ? window : globalThis);
