(function attachVendorShopPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/shop";
    const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
    const DEFAULT_STATUS_MESSAGE = "Loading your shop details...";
    const DEFAULT_NOTE_MESSAGE = "Update any field below, preview your shopfront image, then save your changes.";

    const FIELD_KEYS = [
        "businessName",
        "foodType",
        "description",
        "university",
        "campusLocation",
        "openingHours",
        "contactNumber",
        "businessEmail"
    ];

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

    function normalizeShopRecord(profile) {
        const safe = profile && typeof profile === "object" ? profile : {};
        const businessName = normalizeText(
            safe.vendorBusinessName ||
            safe.businessName ||
            safe.displayName ||
            ""
        );

        return {
            uid: normalizeText(safe.uid),
            businessName: businessName,
            foodType: normalizeText(safe.vendorFoodType || safe.foodType),
            description: normalizeText(safe.vendorDescription || safe.description),
            university: normalizeText(safe.vendorUniversity || safe.university),
            campusLocation: normalizeText(
                safe.vendorLocation || safe.campusLocation || safe.location
            ),
            openingHours: normalizeText(safe.vendorOpeningHours || safe.openingHours),
            contactNumber: normalizePhoneNumber(
                safe.vendorPhoneNumber || safe.contactNumber || safe.phoneNumber
            ),
            businessEmail: normalizeEmail(safe.vendorEmail || safe.businessEmail),
            acceptingOrders: safe.vendorAcceptingOrders === false ? false : true,
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

        if (!normalizeText(safe.campusLocation)) {
            errors.campusLocation = "Please enter your campus stall location.";
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

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    function toShopUpdates(values) {
        const safe = values && typeof values === "object" ? values : {};

        return {
            vendorBusinessName: normalizeText(safe.businessName),
            businessName: normalizeText(safe.businessName),
            vendorFoodType: normalizeText(safe.foodType),
            vendorDescription: normalizeText(safe.description),
            description: normalizeText(safe.description),
            vendorUniversity: normalizeText(safe.university),
            vendorLocation: normalizeText(safe.campusLocation),
            campusLocation: normalizeText(safe.campusLocation),
            vendorOpeningHours: normalizeText(safe.openingHours),
            vendorPhoneNumber: normalizePhoneNumber(safe.contactNumber),
            contactNumber: normalizePhoneNumber(safe.contactNumber),
            vendorEmail: normalizeEmail(safe.businessEmail),
            vendorAcceptingOrders: safe.acceptingOrders === true,
            vendorBannerURL: normalizeText(safe.shopPhotoURL),
            vendorBannerPath: normalizeText(safe.shopPhotoPath)
        };
    }

    function createVendorShopPage(dependencies = {}) {
        const authService = dependencies.authService || null;
        const authUtils = dependencies.authUtils || null;
        const db = dependencies.db || null;
        const storage = dependencies.storage || null;
        const firestoreFns = dependencies.firestoreFns || {};
        const storageFns = dependencies.storageFns || {};
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
            photoMarkedForRemoval: false
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
                universityInput: getElement("shop-university"),
                campusLocationInput: getElement("shop-campus-location"),
                openingHoursInput: getElement("shop-opening-hours"),
                contactNumberInput: getElement("shop-contact-number"),
                businessEmailInput: getElement("shop-business-email"),
                acceptingOrdersInput: getElement("shop-accepting-orders"),
                photoFileInput: getElement("shop-photo-file"),
                previewPhotoButton: getElement("preview-shop-photo-button"),
                removePhotoButton: getElement("remove-shop-photo-button"),
                photoPreview: getElement("shop-photo-preview"),
                photoEmptyState: getElement("shop-photo-empty-state")
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
                university: elements.universityInput,
                campusLocation: elements.campusLocationInput,
                openingHours: elements.openingHoursInput,
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

        function updateSummary(values, photoUrl) {
            const safe = values && typeof values === "object" ? values : {};

            const nameOutput = getElement("shop-summary-name");
            const foodOutput = getElement("shop-summary-food-type");
            const universityOutput = getElement("shop-summary-university");
            const locationOutput = getElement("shop-summary-location");
            const hoursOutput = getElement("shop-summary-hours");
            const phoneOutput = getElement("shop-summary-phone");
            const emailOutput = getElement("shop-summary-email");
            const acceptingOutput = getElement("shop-summary-accepting");
            const descriptionOutput = getElement("shop-summary-description");

            if (nameOutput) {
                nameOutput.textContent = normalizeText(safe.businessName) || "-";
            }

            if (foodOutput) {
                foodOutput.textContent = normalizeText(safe.foodType) || "-";
            }

            if (universityOutput) {
                universityOutput.textContent = normalizeText(safe.university) || "-";
            }

            if (locationOutput) {
                locationOutput.textContent = normalizeText(safe.campusLocation) || "-";
            }

            if (hoursOutput) {
                hoursOutput.textContent = normalizeText(safe.openingHours) || "-";
            }

            if (phoneOutput) {
                phoneOutput.textContent = normalizePhoneNumber(safe.contactNumber) || "-";
            }

            if (emailOutput) {
                emailOutput.textContent = normalizeEmail(safe.businessEmail) || "-";
            }

            if (acceptingOutput) {
                acceptingOutput.textContent = safe.acceptingOrders === false ? "No" : "Yes";
            }

            if (descriptionOutput) {
                descriptionOutput.textContent = normalizeText(safe.description) || "-";
            }

            updatePhotoPreview(photoUrl);
        }

        function collectFormValues() {
            const elements = getFormElements();

            return {
                businessName: elements.businessNameInput ? elements.businessNameInput.value : "",
                foodType: elements.foodTypeInput ? elements.foodTypeInput.value : "",
                description: elements.descriptionInput ? elements.descriptionInput.value : "",
                university: elements.universityInput ? elements.universityInput.value : "",
                campusLocation: elements.campusLocationInput ? elements.campusLocationInput.value : "",
                openingHours: elements.openingHoursInput ? elements.openingHoursInput.value : "",
                contactNumber: elements.contactNumberInput ? elements.contactNumberInput.value : "",
                businessEmail: elements.businessEmailInput ? elements.businessEmailInput.value : "",
                acceptingOrders: elements.acceptingOrdersInput
                    ? elements.acceptingOrdersInput.checked === true
                    : true
            };
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

            if (elements.universityInput) {
                elements.universityInput.value = normalizeText(safe.university);
            }

            if (elements.campusLocationInput) {
                elements.campusLocationInput.value = normalizeText(safe.campusLocation);
            }

            if (elements.openingHoursInput) {
                elements.openingHoursInput.value = normalizeText(safe.openingHours);
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

            state.selectedPhotoDataUrl = normalizeText(safe.shopPhotoURL);
            state.photoMarkedForRemoval = false;
            clearFileInput(elements.photoFileInput);
            clearFieldErrors();
            updateStatsPanel(safe);
            updateSummary({
                businessName: safe.businessName,
                foodType: safe.foodType,
                description: safe.description,
                university: safe.university,
                campusLocation: safe.campusLocation,
                openingHours: safe.openingHours,
                contactNumber: safe.contactNumber,
                businessEmail: safe.businessEmail,
                acceptingOrders: safe.acceptingOrders
            }, state.selectedPhotoDataUrl);
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

            updateSummary(collectFormValues(), state.selectedPhotoDataUrl);
        }

        function bindLiveValidation() {
            const elements = getFormElements();
            const fieldMap = {
                businessName: elements.businessNameInput,
                foodType: elements.foodTypeInput,
                description: elements.descriptionInput,
                university: elements.universityInput,
                campusLocation: elements.campusLocationInput,
                openingHours: elements.openingHoursInput,
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
        }

        async function initializeShopPage() {
            setStatus(DEFAULT_STATUS_MESSAGE, "info");
            setNote(DEFAULT_NOTE_MESSAGE);
            bindEvents();

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
