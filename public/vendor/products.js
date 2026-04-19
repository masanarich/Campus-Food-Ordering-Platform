(function attachVendorProductsPage(globalScope) {
    "use strict";

    const DEFAULT_STATUS_MESSAGE = "Loading your menu workspace...";
    const DEFAULT_NOTE_MESSAGE = "Use this page to create, update, and organize your shop menu.";
    const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function parsePrice(value) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function formatPrice(value) {
        const parsed = typeof value === "number" ? value : parsePrice(value);

        if (!Number.isFinite(parsed)) {
            return "-";
        }

        return `R${parsed.toFixed(2)}`;
    }

    function normalizeAvailability(value) {
        return normalizeLowerText(value) === "unavailable" ? "unavailable" : "available";
    }

    function normalizeTagList(value) {
        const rawValue = Array.isArray(value) ? value.join(",") : normalizeText(value);

        if (!rawValue) {
            return [];
        }

        return rawValue
            .split(",")
            .map(function normalizeItem(item) {
                return normalizeLowerText(item);
            })
            .filter(Boolean)
            .filter(function makeUnique(item, index, array) {
                return array.indexOf(item) === index;
            });
    }

    function formatTagList(tags) {
        const safeTags = Array.isArray(tags) ? tags.filter(Boolean) : [];

        if (safeTags.length === 0) {
            return "-";
        }

        return safeTags.join(", ");
    }

    function getDisplayPhotoUrl(productRecord) {
        const safeRecord = productRecord && typeof productRecord === "object" ? productRecord : {};
        return normalizeText(safeRecord.photoURL || safeRecord.photoDataUrl || safeRecord.photoUrl);
    }

    function normalizeProductRecord(productRecord, fallbackId) {
        const safeRecord = productRecord && typeof productRecord === "object" ? productRecord : {};

        return {
            id: normalizeText(safeRecord.id || fallbackId),
            vendorUid: normalizeText(safeRecord.vendorUid),
            name: normalizeText(safeRecord.name),
            category: normalizeText(safeRecord.category),
            description: normalizeText(safeRecord.description),
            price: typeof safeRecord.price === "number" ? safeRecord.price : parsePrice(safeRecord.price),
            photoURL: getDisplayPhotoUrl(safeRecord),
            photoPath: normalizeText(safeRecord.photoPath),
            availability: normalizeAvailability(safeRecord.availability),
            soldOut: safeRecord.soldOut === true,
            dietaryTags: normalizeTagList(safeRecord.dietaryTags),
            allergenTags: normalizeTagList(safeRecord.allergenTags),
            createdAt: safeRecord.createdAt || null,
            updatedAt: safeRecord.updatedAt || null
        };
    }

    function validateProduct(values) {
        const safeValues = values && typeof values === "object" ? values : {};
        const errors = {};

        if (!normalizeText(safeValues.name)) {
            errors.name = "Please enter the item name.";
        }

        if (!normalizeText(safeValues.description)) {
            errors.description = "Please enter the item description.";
        } else if (normalizeText(safeValues.description).length < 10) {
            errors.description = "Please enter a longer item description.";
        }

        if (normalizeText(safeValues.price) === "") {
            errors.price = "Please enter the item price.";
        } else {
            const parsed = parsePrice(safeValues.price);

            if (!Number.isFinite(parsed) || parsed < 0) {
                errors.price = "Please enter a valid price of R0.00 or more.";
            }
        }

        if (
            normalizeText(safeValues.category) &&
            normalizeText(safeValues.category).length < 2
        ) {
            errors.category = "Please use a longer category name.";
        }

        // validate photo URL if provided (backwards compatible with older tests)
        if (normalizeText(safeValues.photoUrl) !== "" && !isValidPhotoUrl(safeValues.photoUrl)) {
            errors.photoUrl = "Please enter a valid photo URL starting with http:// or https://";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
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
        const maxWidth = Number.isFinite(safeOptions.maxWidth) ? safeOptions.maxWidth : 1200;
        const maxHeight = Number.isFinite(safeOptions.maxHeight) ? safeOptions.maxHeight : 1200;
        const quality = Number.isFinite(safeOptions.quality) ? safeOptions.quality : 0.85;

        const originalDataUrl = await readFileAsDataURL(file);
        const image = await loadImageFromSource(originalDataUrl);

        const originalWidth = image.naturalWidth || image.width || maxWidth;
        const originalHeight = image.naturalHeight || image.height || maxHeight;

        let targetWidth = originalWidth;
        let targetHeight = originalHeight;

        const widthRatio = maxWidth / targetWidth;
        const heightRatio = maxHeight / targetHeight;
        const ratio = Math.min(widthRatio, heightRatio, 1);

        targetWidth = Math.max(1, Math.round(targetWidth * ratio));
        targetHeight = Math.max(1, Math.round(targetHeight * ratio));

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

    function toProduct(values) {
        const safeValues = values && typeof values === "object" ? values : {};

        return normalizeProductRecord({
            id: normalizeText(safeValues.productId),
            vendorUid: normalizeText(safeValues.vendorUid),
            name: normalizeText(safeValues.name),
            category: normalizeText(safeValues.category),
            description: normalizeText(safeValues.description),
            price: parsePrice(safeValues.price),
            photoURL: normalizeText(safeValues.photoURL || safeValues.photoDataUrl),
            photoPath: normalizeText(safeValues.photoPath),
            photoDataUrl: normalizeText(safeValues.photoDataUrl),
            // keep compatibility: accept photoUrl in tests and expose it on product
            photoUrl: normalizeText(safeValues.photoUrl) || normalizeText(safeValues.photoDataUrl),
            availability: normalizeAvailability(safeValues.availability),
            soldOut: safeValues.soldOut === true,
            dietaryTags: normalizeTagList(safeValues.dietaryTags),
            allergenTags: normalizeTagList(safeValues.allergenTags)
        });
    }

    function createMenuItemId() {
        if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
            return globalThis.crypto.randomUUID();
        }

        return `menu-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

    function buildMenuItemPhotoPath(vendorUid, productId, file) {
        return `menuItemPhotos/${normalizeText(vendorUid)}/${normalizeText(productId)}/cover.${getFileExtension(file)}`;
    }

    function isValidPhotoUrl(value) {
        const v = normalizeText(value);
        if (v === "") return true;
        return /^https?:\/\/.+/.test(v);
    }

    function createVendorProductsPage(dependencies = {}) {
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
                    window.location.href = nextRoute;
                };
        const confirmAction =
            typeof dependencies.confirmAction === "function"
                ? dependencies.confirmAction
                : function fallbackConfirm(message) {
                    return window.confirm(message);
                };
        const createId =
            typeof dependencies.createId === "function"
                ? dependencies.createId
                : createMenuItemId;

        const state = {
            currentUser: null,
            currentProfile: null,
            products: [],
            selectedPhotoDataUrl: "",
            editingProductId: "",
            searchQuery: "",
            photoMarkedForRemoval: false
        };

        function getElement(id) {
            return document.getElementById(id);
        }

        function navigateTo(route) {
            const nextRoute = normalizeText(route);

            if (!nextRoute) {
                return;
            }

            navigate(nextRoute);
        }

        function getProductsCollectionRef(vendorUid) {
            return firestoreFns.collection(db, "users", vendorUid, "menuItems");
        }

        function getProductDocRef(vendorUid, productId) {
            return firestoreFns.doc(db, "users", vendorUid, "menuItems", productId);
        }

        function getProductPhotoRef(photoPath) {
            return storageFns.ref(storage, photoPath);
        }

        function getFormElements() {
            return {
                modal: getElement("products-editor-modal"),
                form: getElement("products-form"),
                formHeading: getElement("products-form-heading"),
                formSubheading: getElement("products-form-subheading"),
                productIdInput: getElement("product-id"),
                nameInput: getElement("product-name"),
                categoryInput: getElement("product-category"),
                descriptionInput: getElement("product-description"),
                priceInput: getElement("product-price"),
                photoFileInput: getElement("product-photo-file"),
                availabilityInput: getElement("product-availability"),
                dietaryTagsInput: getElement("product-dietary-tags"),
                allergenTagsInput: getElement("product-allergen-tags"),
                soldOutInput: getElement("product-sold-out"),
                saveButton: getElement("save-product-button"),
                clearButton: getElement("clear-product-button"),
                deleteButton: getElement("delete-product-button"),
                previewPhotoButton: getElement("preview-product-photo-button"),
                removePhotoButton: getElement("remove-product-photo-button"),
                backButton: getElement("back-button"),
                resetEditorButton: getElement("reset-editor-button"),
                searchInput: getElement("products-search"),
                closeEditorButton: getElement("close-editor-button")
            };
        }

        function setStatus(message, stateName) {
            const statusElement = getElement("products-status");

            if (!statusElement) {
                return;
            }

            statusElement.textContent = message || "";
            statusElement.dataset.state = stateName || "";
        }

        function setNote(message) {
            const noteElement = getElement("products-note");

            if (!noteElement) {
                return;
            }

            noteElement.textContent = message || "";
        }

        function getErrorElement(fieldName) {
            return getElement(`product-${fieldName}-error`);
        }

        function setFieldError(fieldName, message) {
            const elements = getFormElements();
            const fieldMap = {
                name: elements.nameInput,
                category: elements.categoryInput,
                description: elements.descriptionInput,
                price: elements.priceInput,
                availability: elements.availabilityInput,
                dietaryTags: elements.dietaryTagsInput,
                allergenTags: elements.allergenTagsInput
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
            ["name", "category", "description", "price", "availability", "dietaryTags", "allergenTags"].forEach(function clearOne(name) {
                setFieldError(name, "");
            });
        }

        function showValidationErrors(errors) {
            clearFieldErrors();

            Object.keys(errors).forEach(function applyOne(key) {
                setFieldError(key, errors[key]);
            });
        }

        function getVisibleProducts() {
            const needle = normalizeLowerText(state.searchQuery);

            if (!needle) {
                return state.products;
            }

            return state.products.filter(function filterProduct(product) {
                return [
                    product.name,
                    product.category,
                    product.description,
                    formatTagList(product.dietaryTags),
                    formatTagList(product.allergenTags),
                    normalizeAvailability(product.availability),
                    product.soldOut ? "sold out" : "available"
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(needle);
            });
        }

        function updateResultsMeta() {
            const resultsMeta = getElement("products-results-meta");
            const visibleProducts = getVisibleProducts();

            if (!resultsMeta) {
                return;
            }

            resultsMeta.textContent = `Showing ${visibleProducts.length} of ${state.products.length} items`;
        }

        function updateStats() {
            const totalCount = getElement("products-total-count");
            const availableCount = getElement("products-available-count");
            const soldOutCount = getElement("products-sold-out-count");
            const photoCount = getElement("products-photo-count");

            const totalProducts = state.products.length;
            const totalAvailable = state.products.filter(function filterAvailable(product) {
                return product.availability === "available" && product.soldOut !== true;
            }).length;
            const totalSoldOut = state.products.filter(function filterSoldOut(product) {
                return product.soldOut === true;
            }).length;
            const totalWithPhotos = state.products.filter(function filterPhotos(product) {
                return getDisplayPhotoUrl(product) !== "";
            }).length;

            if (totalCount) {
                totalCount.textContent = String(totalProducts);
            }

            if (availableCount) {
                availableCount.textContent = String(totalAvailable);
            }

            if (soldOutCount) {
                soldOutCount.textContent = String(totalSoldOut);
            }

            if (photoCount) {
                photoCount.textContent = String(totalWithPhotos);
            }
        }

        function updatePreviewVisibility(photoDataUrl) {
            const previewImage = getElement("product-photo-preview");
            const emptyState = getElement("product-photo-empty-state");
            const safeUrl = normalizeText(photoDataUrl);

            if (!previewImage || !emptyState) {
                return;
            }

            if (safeUrl) {
                previewImage.src = safeUrl;
                previewImage.hidden = false;
                emptyState.hidden = true;
            } else {
                previewImage.removeAttribute("src");
                previewImage.hidden = true;
                emptyState.hidden = false;
            }
        }

        function updateSummary(product) {
            const safeProduct = product && typeof product === "object" ? product : {};

            const nameOutput = getElement("product-name-output");
            const categoryOutput = getElement("product-category-output");
            const descriptionOutput = getElement("product-description-output");
            const priceOutput = getElement("product-price-output");
            const availabilityOutput = getElement("product-availability-output");
            const soldOutOutput = getElement("product-sold-out-output");
            const dietaryTagsOutput = getElement("product-dietary-tags-output");
            const allergenTagsOutput = getElement("product-allergen-tags-output");

            if (nameOutput) {
                nameOutput.textContent = normalizeText(safeProduct.name) || "-";
            }

            if (categoryOutput) {
                categoryOutput.textContent = normalizeText(safeProduct.category) || "-";
            }

            if (descriptionOutput) {
                descriptionOutput.textContent = normalizeText(safeProduct.description) || "-";
            }

            if (priceOutput) {
                priceOutput.textContent = formatPrice(safeProduct.price);
            }

            if (availabilityOutput) {
                availabilityOutput.textContent = normalizeAvailability(safeProduct.availability);
            }

            if (soldOutOutput) {
                soldOutOutput.textContent = safeProduct.soldOut === true ? "Yes" : "No";
            }

            if (dietaryTagsOutput) {
                dietaryTagsOutput.textContent = formatTagList(safeProduct.dietaryTags);
            }

            if (allergenTagsOutput) {
                allergenTagsOutput.textContent = formatTagList(safeProduct.allergenTags);
            }

            updatePreviewVisibility(getDisplayPhotoUrl(safeProduct));
        }

        function updateEditingState() {
            const elements = getFormElements();

            if (getElement("editing-state-pill")) {
                getElement("editing-state-pill").textContent = state.editingProductId ? "Editing Existing Item" : "Creating New Item";
            }

            if (elements.formHeading) {
                elements.formHeading.textContent = state.editingProductId ? "Update Menu Item" : "Create Menu Item";
            }

            if (elements.formSubheading) {
                elements.formSubheading.textContent = state.editingProductId
                    ? "Update the selected menu item, then save the changes back to Firestore."
                    : "Fill in the product details below and save them to your vendor menu.";
            }

            if (elements.deleteButton) {
                elements.deleteButton.hidden = !state.editingProductId;
            }
        }

        function collectFormValues() {
            const elements = getFormElements();

            return {
                productId: elements.productIdInput ? elements.productIdInput.value : "",
                vendorUid: state.currentUser ? state.currentUser.uid : "",
                name: elements.nameInput ? elements.nameInput.value : "",
                category: elements.categoryInput ? elements.categoryInput.value : "",
                description: elements.descriptionInput ? elements.descriptionInput.value : "",
                price: elements.priceInput ? elements.priceInput.value : "",
                photoURL: state.selectedPhotoDataUrl,
                availability: elements.availabilityInput ? elements.availabilityInput.value : "available",
                dietaryTags: elements.dietaryTagsInput ? elements.dietaryTagsInput.value : "",
                allergenTags: elements.allergenTagsInput ? elements.allergenTagsInput.value : "",
                soldOut: elements.soldOutInput ? elements.soldOutInput.checked === true : false
            };
        }

        function showEditorModal() {
            const dialog = getFormElements().modal;

            if (!dialog) {
                return;
            }

            if (typeof dialog.showModal === "function") {
                if (!dialog.open) {
                    dialog.showModal();
                }
            } else {
                dialog.setAttribute("open", "open");
                dialog.open = true;
            }
        }

        function closeEditorModal() {
            const dialog = getFormElements().modal;

            if (!dialog) {
                return;
            }

            if (typeof dialog.close === "function" && dialog.open) {
                dialog.close();
            } else {
                dialog.removeAttribute("open");
                dialog.open = false;
            }
        }

        function fillForm(product) {
            const safeProduct = product && typeof product === "object" ? product : {};
            const elements = getFormElements();

            state.editingProductId = normalizeText(safeProduct.id);
            state.selectedPhotoDataUrl = getDisplayPhotoUrl(safeProduct);
            state.photoMarkedForRemoval = false;

            if (elements.productIdInput) {
                elements.productIdInput.value = normalizeText(safeProduct.id);
            }

            if (elements.nameInput) {
                elements.nameInput.value = normalizeText(safeProduct.name);
            }

            if (elements.categoryInput) {
                elements.categoryInput.value = normalizeText(safeProduct.category);
            }

            if (elements.descriptionInput) {
                elements.descriptionInput.value = normalizeText(safeProduct.description);
            }

            if (elements.priceInput) {
                elements.priceInput.value =
                    typeof safeProduct.price === "number" ? safeProduct.price.toFixed(2) : "";
            }

            if (elements.availabilityInput) {
                elements.availabilityInput.value = normalizeAvailability(safeProduct.availability);
            }

            if (elements.dietaryTagsInput) {
                elements.dietaryTagsInput.value =
                    formatTagList(safeProduct.dietaryTags) === "-" ? "" : formatTagList(safeProduct.dietaryTags);
            }

            if (elements.allergenTagsInput) {
                elements.allergenTagsInput.value =
                    formatTagList(safeProduct.allergenTags) === "-" ? "" : formatTagList(safeProduct.allergenTags);
            }

            if (elements.soldOutInput) {
                elements.soldOutInput.checked = safeProduct.soldOut === true;
            }

            clearFileInput(elements.photoFileInput);
            updateEditingState();
            clearFieldErrors();
            updateSummary(safeProduct);
        }

        function resetFormState(options = {}) {
            const safeOptions = options && typeof options === "object" ? options : {};
            const preserveMessages = safeOptions.preserveMessages === true;
            const elements = getFormElements();

            state.editingProductId = "";
            state.selectedPhotoDataUrl = "";
            state.photoMarkedForRemoval = false;

            if (elements.productIdInput) {
                elements.productIdInput.value = "";
            }

            if (elements.nameInput) {
                elements.nameInput.value = "";
            }

            if (elements.categoryInput) {
                elements.categoryInput.value = "";
            }

            if (elements.descriptionInput) {
                elements.descriptionInput.value = "";
            }

            if (elements.priceInput) {
                elements.priceInput.value = "";
            }

            if (elements.availabilityInput) {
                elements.availabilityInput.value = "available";
            }

            if (elements.dietaryTagsInput) {
                elements.dietaryTagsInput.value = "";
            }

            if (elements.allergenTagsInput) {
                elements.allergenTagsInput.value = "";
            }

            if (elements.soldOutInput) {
                elements.soldOutInput.checked = false;
            }

            clearFileInput(elements.photoFileInput);
            updateEditingState();
            clearFieldErrors();
            updateSummary({});

            if (!preserveMessages) {
                setStatus(DEFAULT_STATUS_MESSAGE, "info");
                setNote(DEFAULT_NOTE_MESSAGE);
            }
        }

        function createProductCard(product) {
            const item = document.createElement("li");
            item.className = "product-card-item";

            const article = document.createElement("article");
            article.className = "product-card";

            const displayPhotoUrl = getDisplayPhotoUrl(product);

            if (displayPhotoUrl) {
                const photo = document.createElement("img");
                photo.className = "product-card-photo";
                photo.alt = `${product.name || "Product"} photo`;
                photo.src = displayPhotoUrl;
                article.appendChild(photo);
            } else {
                const photoFallback = document.createElement("p");
                photoFallback.className = "product-card-photo-fallback";
                photoFallback.textContent = "No product image uploaded yet";
                article.appendChild(photoFallback);
            }

            const content = document.createElement("section");
            content.className = "product-card-content";

            const topRow = document.createElement("header");
            topRow.className = "product-card-top";

            const titleWrap = document.createElement("section");

            const title = document.createElement("h4");
            title.textContent = product.name || "Unnamed Item";

            const category = document.createElement("p");
            category.className = "product-card-category";
            category.textContent = normalizeText(product.category) || "No category";

            titleWrap.appendChild(title);
            titleWrap.appendChild(category);

            const price = document.createElement("p");
            price.className = "product-card-price";
            price.textContent = formatPrice(product.price);

            topRow.appendChild(titleWrap);
            topRow.appendChild(price);

            const description = document.createElement("p");
            description.className = "product-card-description";
            description.textContent = product.description || "No description available.";

            const badges = document.createElement("ul");
            badges.className = "product-card-badges";

            [
                {
                    text: product.soldOut === true ? "Sold Out" : normalizeAvailability(product.availability),
                    className: product.soldOut === true
                        ? "product-badge product-badge-danger"
                        : "product-badge product-badge-success"
                },
                {
                    text: normalizeText(product.category) || "General",
                    className: "product-badge product-badge-neutral"
                },
                {
                    text: displayPhotoUrl ? "Photo Stored" : "No Photo",
                    className: "product-badge product-badge-info"
                }
            ].forEach(function appendBadge(config) {
                const badge = document.createElement("li");
                badge.className = config.className;
                badge.textContent = config.text;
                badges.appendChild(badge);
            });

            const tags = document.createElement("p");
            tags.className = "product-card-tags";
            tags.textContent =
                `Dietary: ${formatTagList(product.dietaryTags)} | Allergens: ${formatTagList(product.allergenTags)}`;

            const actions = document.createElement("menu");
            actions.className = "action-menu product-card-actions";

            const editItem = document.createElement("li");
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "button-primary";
            editButton.textContent = "Edit Item";
            editButton.dataset.action = "edit-product";
            editButton.dataset.productId = product.id;
            editItem.appendChild(editButton);

            const deleteItem = document.createElement("li");
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "button-danger";
            deleteButton.textContent = "Delete";
            deleteButton.dataset.action = "delete-product";
            deleteButton.dataset.productId = product.id;
            deleteItem.appendChild(deleteButton);

            actions.appendChild(editItem);
            actions.appendChild(deleteItem);

            content.appendChild(topRow);
            content.appendChild(description);
            content.appendChild(badges);
            content.appendChild(tags);
            content.appendChild(actions);

            article.appendChild(content);
            item.appendChild(article);

            return item;
        }

        function renderProductsList() {
            const list = getElement("products-list");
            const emptyState = getElement("products-empty-state");
            const visibleProducts = getVisibleProducts();

            if (!list) {
                return;
            }

            list.innerHTML = "";

            if (visibleProducts.length === 0) {
                if (emptyState) {
                    emptyState.hidden = false;
                    emptyState.textContent = state.products.length === 0
                        ? "No menu items added yet. Start by creating your first product."
                        : "No menu items match your search right now.";
                }
                updateResultsMeta();
                return;
            }

            if (emptyState) {
                emptyState.hidden = true;
            }

            visibleProducts.forEach(function appendProduct(product) {
                list.appendChild(createProductCard(product));
            });

            updateResultsMeta();
        }

        async function loadProducts() {
            if (!state.currentUser || !state.currentUser.uid) {
                state.products = [];
                renderProductsList();
                updateStats();
                return {
                    success: false,
                    products: []
                };
            }

            try {
                const productsCollection = getProductsCollectionRef(state.currentUser.uid);
                const snapshot = await firestoreFns.getDocs(productsCollection);
                const loadedProducts = [];

                snapshot.forEach(function forEachSnapshot(productDoc) {
                    loadedProducts.push(
                        normalizeProductRecord(productDoc.data(), productDoc.id)
                    );
                });

                state.products = loadedProducts.sort(function compareProducts(a, b) {
                    return normalizeLowerText(a.name).localeCompare(normalizeLowerText(b.name));
                });
                updateStats();
                renderProductsList();
                return {
                    success: true,
                    products: state.products
                };
            } catch (error) {
                console.error("Failed to load products:", error);
                state.products = [];
                updateStats();
                renderProductsList();
                setStatus("Failed to load menu items.", "error");
                return {
                    success: false,
                    error: error,
                    products: []
                };
            }
        }

        async function previewSelectedPhoto() {
            const elements = getFormElements();
            const selectedFile = getSelectedPhotoFile(elements.photoFileInput);

            if (!selectedFile) {
                setStatus("Choose a product photo first.", "error");
                setNote("Select an image from your device to preview it.");
                return { success: false };
            }

            if (!isImageFile(selectedFile)) {
                setStatus("Please choose an image file.", "error");
                setNote("Only image files can be used for product photos.");
                return { success: false };
            }

            if (selectedFile.size > MAX_IMAGE_SIZE_BYTES) {
                setStatus("Please choose an image smaller than 5 MB.", "error");
                setNote("Large images should be compressed before upload.");
                return { success: false };
            }

            try {
                const previewDataUrl = await fileToOptimizedDataURL(selectedFile, {
                    maxWidth: 1200,
                    maxHeight: 1200,
                    quality: 0.85
                });

                state.selectedPhotoDataUrl = previewDataUrl;
                state.photoMarkedForRemoval = false;
                updateSummary(toProduct({
                    ...collectFormValues(),
                    photoURL: previewDataUrl
                }));
                setStatus("Photo preview ready.", "success");
                setNote("Save the menu item to upload this image to Firebase Storage.");

                return {
                    success: true,
                    photoDataUrl: previewDataUrl
                };
            } catch (error) {
                setStatus(error && error.message ? error.message : "Unable to preview the selected image.", "error");
                return { success: false, error: error };
            }
        }

        function removeSelectedPhoto() {
            const elements = getFormElements();

            state.selectedPhotoDataUrl = "";
            state.photoMarkedForRemoval = true;
            clearFileInput(elements.photoFileInput);
            updateSummary(toProduct({
                ...collectFormValues(),
                photoURL: ""
            }));
            setStatus("Product photo removed.", "success");
            setNote("Save the menu item to remove the stored image as well.");

            return { success: true };
        }

        function getCurrentEditingProduct(productId) {
            const idToFind = normalizeText(productId || state.editingProductId);

            return state.products.find(function findProduct(product) {
                return normalizeText(product.id) === idToFind;
            }) || null;
        }

        function createFirestorePayload(product, serverTimestampValue) {
            return {
                vendorUid: product.vendorUid,
                name: product.name,
                category: product.category,
                description: product.description,
                price: product.price,
                photoURL: product.photoURL,
                photoPath: product.photoPath,
                availability: product.availability,
                soldOut: product.soldOut,
                dietaryTags: product.dietaryTags,
                allergenTags: product.allergenTags,
                updatedAt: serverTimestampValue,
                createdAt: serverTimestampValue
            };
        }

        async function deleteStoredPhoto(photoPath) {
            const safePhotoPath = normalizeText(photoPath);

            if (!safePhotoPath) {
                return { success: true };
            }

            if (!storage || typeof storageFns.ref !== "function" || typeof storageFns.deleteObject !== "function") {
                return { success: false };
            }

            try {
                await storageFns.deleteObject(getProductPhotoRef(safePhotoPath));
                return { success: true };
            } catch (error) {
                const errorCode = normalizeLowerText(error && error.code);

                if (errorCode === "storage/object-not-found") {
                    return { success: true, skipped: true };
                }

                throw error;
            }
        }

        async function uploadSelectedPhoto(productId, existingProduct) {
            const elements = getFormElements();
            const selectedFile = getSelectedPhotoFile(elements.photoFileInput);
            const currentProduct = existingProduct && typeof existingProduct === "object" ? existingProduct : {};
            let photoURL = getDisplayPhotoUrl(currentProduct);
            let photoPath = normalizeText(currentProduct.photoPath);

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

                photoPath = buildMenuItemPhotoPath(state.currentUser.uid, productId, selectedFile);
                const storageRef = getProductPhotoRef(photoPath);

                await storageFns.uploadBytes(storageRef, selectedFile, {
                    contentType: selectedFile.type || "image/jpeg"
                });
                photoURL = await storageFns.getDownloadURL(storageRef);
                state.photoMarkedForRemoval = false;
                state.selectedPhotoDataUrl = photoURL;
                clearFileInput(elements.photoFileInput);
            } else if (state.photoMarkedForRemoval) {
                await deleteStoredPhoto(photoPath);
                photoURL = "";
                photoPath = "";
                state.photoMarkedForRemoval = false;
            }

            return {
                photoURL: photoURL,
                photoPath: photoPath
            };
        }

        async function saveCurrentProduct() {
            const values = collectFormValues();
            const validation = validateProduct(values);

            if (!validation.isValid) {
                showValidationErrors(validation.errors);

                const firstError = Object.values(validation.errors)[0];
                setStatus(firstError, "error");
                setNote("Please correct the highlighted fields and try again.");

                return {
                    success: false,
                    errors: validation.errors
                };
            }

            if (!state.currentUser || !state.currentUser.uid) {
                setStatus("You must be signed in to manage menu items.", "error");
                return { success: false };
            }

            clearFieldErrors();

            const existingProduct = getCurrentEditingProduct();
            const isEditing = !!existingProduct;
            const productId = normalizeText(values.productId) || createId();
            const serverTimestampValue =
                typeof firestoreFns.serverTimestamp === "function"
                    ? firestoreFns.serverTimestamp()
                    : null;

            try {
                const photoFields = await uploadSelectedPhoto(productId, existingProduct);
                const product = toProduct({
                    ...values,
                    productId: productId,
                    vendorUid: state.currentUser.uid,
                    photoURL: photoFields.photoURL,
                    photoPath: photoFields.photoPath
                });

                const payload = createFirestorePayload(product, serverTimestampValue);
                const productRef = getProductDocRef(state.currentUser.uid, productId);

                if (isEditing) {
                    delete payload.createdAt;
                    await firestoreFns.setDoc(productRef, payload, { merge: true });
                } else {
                    await firestoreFns.setDoc(productRef, payload);
                }

                await loadProducts();
                closeEditorModal();
                resetFormState({ preserveMessages: true });
                setStatus(
                    isEditing ? "Menu item updated successfully." : "Menu item created successfully.",
                    "success"
                );
                setNote(
                    isEditing
                        ? "Your menu item changes have been saved, including any image updates."
                        : "Your new menu item has been added to the menu list."
                );

                return {
                    success: true,
                    action: isEditing ? "update" : "create",
                    productId: productId
                };
            } catch (error) {
                console.error("Failed to save product:", error);
                setStatus(error && error.message ? error.message : "Failed to save the menu item.", "error");
                return {
                    success: false,
                    error: error
                };
            }
        }

        async function deleteCurrentProduct(productId) {
            const currentProduct = getCurrentEditingProduct(productId);

            if (!currentProduct || !state.currentUser || !state.currentUser.uid) {
                setStatus("Choose a menu item first before trying to delete it.", "error");
                return { success: false };
            }

            const shouldDelete = confirmAction(
                `Delete "${currentProduct.name || "this menu item"}"? This will also remove its stored product image.`
            );

            if (!shouldDelete) {
                return { success: false, cancelled: true };
            }

            try {
                await deleteStoredPhoto(currentProduct.photoPath);
                await firestoreFns.deleteDoc(getProductDocRef(state.currentUser.uid, currentProduct.id));
                await loadProducts();
                closeEditorModal();
                resetFormState({ preserveMessages: true });
                setStatus("Menu item deleted successfully.", "success");
                setNote("The selected item and its stored image have been removed.");

                return { success: true };
            } catch (error) {
                console.error("Failed to delete product:", error);
                setStatus("Failed to delete the menu item.", "error");
                return { success: false, error: error };
            }
        }

        function validateSingleField(fieldName) {
            const values = collectFormValues();
            const validation = validateProduct(values);
            const error = validation.errors[fieldName] || "";

            setFieldError(fieldName, error);
            return !error;
        }

        function bindLiveValidation() {
            const elements = getFormElements();
            const fieldMap = {
                name: elements.nameInput,
                category: elements.categoryInput,
                description: elements.descriptionInput,
                price: elements.priceInput,
                availability: elements.availabilityInput
            };

            Object.keys(fieldMap).forEach(function attach(fieldName) {
                const field = fieldMap[fieldName];

                if (!field) {
                    return;
                }

                const eventName = field.tagName === "SELECT" ? "change" : "input";

                field.addEventListener(eventName, function handleLiveUpdate() {
                    validateSingleField(fieldName);
                    updateSummary(toProduct({
                        ...collectFormValues(),
                        vendorUid: state.currentUser ? state.currentUser.uid : ""
                    }));
                });
            });

            if (elements.dietaryTagsInput) {
                elements.dietaryTagsInput.addEventListener("input", function handleDietary() {
                    updateSummary(toProduct({
                        ...collectFormValues(),
                        vendorUid: state.currentUser ? state.currentUser.uid : ""
                    }));
                });
            }

            if (elements.allergenTagsInput) {
                elements.allergenTagsInput.addEventListener("input", function handleAllergens() {
                    updateSummary(toProduct({
                        ...collectFormValues(),
                        vendorUid: state.currentUser ? state.currentUser.uid : ""
                    }));
                });
            }

            if (elements.soldOutInput) {
                elements.soldOutInput.addEventListener("change", function handleSoldOut() {
                    updateSummary(toProduct({
                        ...collectFormValues(),
                        vendorUid: state.currentUser ? state.currentUser.uid : ""
                    }));
                });
            }
        }

        function openCreateModal() {
            resetFormState({ preserveMessages: true });
            showEditorModal();
            setStatus("Create a new menu item.", "info");
            setNote("Add the item details below, preview the image if needed, then save.");
        }

        function editProductById(productId) {
            const product = state.products.find(function findProduct(item) {
                return normalizeText(item.id) === normalizeText(productId);
            });

            if (!product) {
                return;
            }

            fillForm(product);
            showEditorModal();
            setStatus("Loaded menu item into the editor.", "info");
            setNote("Update the fields you want, then save again.");
        }

        async function handleProductsListClick(event) {
            const button = event.target;

            if (!button) {
                return;
            }

            if (button.matches('button[data-action="edit-product"]')) {
                editProductById(button.dataset.productId);
                return;
            }

            if (button.matches('button[data-action="delete-product"]')) {
                await deleteCurrentProduct(button.dataset.productId);
            }
        }

        function goBack() {
            navigateTo("./index.html");
        }

        async function ensureVendorAccess() {
            if (!authService || typeof authService.getCurrentUser !== "function") {
                throw new Error("authService.getCurrentUser is required.");
            }

            if (!authService || typeof authService.getCurrentUserProfile !== "function") {
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
            const productsList = getElement("products-list");

            if (elements.form) {
                elements.form.addEventListener("submit", function handleSubmit(event) {
                    event.preventDefault();
                    saveCurrentProduct();
                });

                elements.form.addEventListener("reset", function handleReset() {
                    window.setTimeout(function afterReset() {
                        resetFormState({ preserveMessages: true });
                        setStatus("Editor reset.", "info");
                        setNote("The form is clear and ready for a fresh menu item.");
                    }, 0);
                });
            }

            if (elements.previewPhotoButton) {
                elements.previewPhotoButton.addEventListener("click", function handlePreview(event) {
                    event.preventDefault();
                    previewSelectedPhoto();
                });
            }

            if (elements.removePhotoButton) {
                elements.removePhotoButton.addEventListener("click", function handleRemove(event) {
                    event.preventDefault();
                    removeSelectedPhoto();
                });
            }

            if (elements.backButton) {
                elements.backButton.addEventListener("click", function handleBack(event) {
                    event.preventDefault();
                    goBack();
                });
            }

            if (elements.resetEditorButton) {
                elements.resetEditorButton.addEventListener("click", function handleNewItem(event) {
                    event.preventDefault();
                    openCreateModal();
                });
            }

            if (elements.closeEditorButton) {
                elements.closeEditorButton.addEventListener("click", function handleClose(event) {
                    event.preventDefault();
                    closeEditorModal();
                });
            }

            if (elements.deleteButton) {
                elements.deleteButton.addEventListener("click", function handleDelete(event) {
                    event.preventDefault();
                    deleteCurrentProduct();
                });
            }

            if (elements.searchInput) {
                elements.searchInput.addEventListener("input", function handleSearch(event) {
                    state.searchQuery = event.target.value || "";
                    renderProductsList();
                });
            }

            if (productsList) {
                productsList.addEventListener("click", handleProductsListClick);
            }

            bindLiveValidation();
        }

        async function initializeProductsPage() {
            setStatus(DEFAULT_STATUS_MESSAGE, "info");
            setNote(DEFAULT_NOTE_MESSAGE);
            bindEvents();
            resetFormState({ preserveMessages: true });

            const allowed = await ensureVendorAccess();

            if (!allowed) {
                return {
                    success: false
                };
            }

            const loadResult = await loadProducts();

            if (!loadResult.success) {
                setNote("We could not load your menu items right now. Check your data connection and try again.");
                return {
                    success: false,
                    error: loadResult.error || null
                };
            }

            setStatus("Menu workspace ready.", "success");
            setNote("Manage your menu below. Click Edit Item to work inside the popup editor.");

            return {
                success: true
            };
        }

        return {
            initializeProductsPage,
            saveCurrentProduct,
            previewSelectedPhoto,
            removeSelectedPhoto,
            deleteCurrentProduct,
            loadProducts,
            editProductById,
            openCreateModal,
            closeEditorModal,
            helpers: {
                normalizeText,
                normalizeLowerText,
                parsePrice,
                formatPrice,
                normalizeAvailability,
                normalizeTagList,
                formatTagList,
                getDisplayPhotoUrl,
                normalizeProductRecord,
                validateProduct,
                toProduct,
                isImageFile,
                readFileAsDataURL,
                loadImageFromSource,
                fileToOptimizedDataURL,
                getSelectedPhotoFile,
                clearFileInput,
                createMenuItemId,
                buildMenuItemPhotoPath
            },
            state
        };
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            normalizeText,
            normalizeLowerText,
            parsePrice,
            formatPrice,
            // backwards-compatible helper name
            isValidPhotoUrl,
            normalizeAvailability,
            normalizeTagList,
            formatTagList,
            getDisplayPhotoUrl,
            normalizeProductRecord,
            validateProduct,
            toProduct,
            isImageFile,
            readFileAsDataURL,
            loadImageFromSource,
            fileToOptimizedDataURL,
            getSelectedPhotoFile,
            clearFileInput,
            createMenuItemId,
            buildMenuItemPhotoPath,
            createVendorProductsPage
        };
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorProductsPage = {
            initializeProductsPage: function initializeProductsPage(dependencies) {
                const page = createVendorProductsPage(dependencies);
                globalScope.vendorProductsPage.instance = page;
                return page.initializeProductsPage();
            }
        };
    }
})(typeof window !== "undefined" ? window : globalThis);
