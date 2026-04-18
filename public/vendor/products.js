(function attachVendorProductsPage(globalScope) {
    "use strict";

    const STORAGE_KEY = "vendorProducts";
    const DEFAULT_STATUS_MESSAGE = "Complete the form below to add a menu item.";
    const DEFAULT_NOTE_MESSAGE = "Add a new product or select an existing one to update it.";

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

    function createProductId() {
        return `product-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    }

    /*function validateProduct(values) {
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

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }*/
   function validateProduct(product) {
    const errors = {};

    if (!product.name || product.name.length < 2) {
        errors.name = "Please enter the item name.";
    }

    if (!product.description || product.description.length < 10) {
        errors.description = "Please enter a longer item description.";
    }

    if (product.price == null || product.price < 0) {
        errors.price = "Please enter a valid price of R0.00 or more.";
    }

    if (!isValidPhotoUrl(product.photoUrl)) {
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
        return new Promise((resolve, reject) => {
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
        return new Promise((resolve, reject) => {
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
        const maxWidth = Number.isFinite(safeOptions.maxWidth) ? safeOptions.maxWidth : 800;
        const maxHeight = Number.isFinite(safeOptions.maxHeight) ? safeOptions.maxHeight : 800;
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

    function isValidPhotoUrl(url) {
        if (!url) return true;
        return url.startsWith("http://") || url.startsWith("https://");
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

        return {
            id: normalizeText(safeValues.productId) || createProductId(),
            name: normalizeText(safeValues.name),
            description: normalizeText(safeValues.description),
            price: parsePrice(safeValues.price),
            photoUrl: safeValues.photoDataUrl || normalizeText(safeValues.photoUrl),
            availability: normalizeAvailability(safeValues.availability),
            soldOut: safeValues.soldOut === true
        };
    }

    function createVendorProductsPage(dependencies = {}) {
        const storage =
            dependencies.storage ||
            (typeof globalScope !== "undefined" ? globalScope.localStorage : null);

        const state = {
            products: [],
            selectedPhotoDataUrl: ""
        };

        function getElement(id) {
            return document.getElementById(id);
        }

        function getFormElements() {
            return {
                form: getElement("products-form"),
                productIdInput: getElement("product-id"),
                nameInput: getElement("product-name"),
                descriptionInput: getElement("product-description"),
                priceInput: getElement("product-price"),
                photoFileInput: getElement("product-photo-file"),
                availabilityInput: getElement("product-availability"),
                soldOutInput: getElement("product-sold-out"),
                saveButton: getElement("save-product-button"),
                clearButton: getElement("clear-product-button"),
                previewPhotoButton: getElement("preview-product-photo-button"),
                removePhotoButton: getElement("remove-product-photo-button"),
                backButton: getElement("back-button")
            };
        }

        function setStatus(message, stateName) {
            const statusElement = getElement("products-status");

            if (!statusElement) {
                return;
            }

            statusElement.textContent = message || "";

            if (stateName) {
                statusElement.setAttribute("data-state", stateName);
            } else {
                statusElement.removeAttribute("data-state");
            }
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
                description: elements.descriptionInput,
                price: elements.priceInput,
                availability: elements.availabilityInput
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
            ["name", "description", "price", "availability"].forEach(function clearOne(name) {
                setFieldError(name, "");
            });
        }

        function showValidationErrors(errors) {
            clearFieldErrors();

            Object.keys(errors).forEach(function applyOne(key) {
                setFieldError(key, errors[key]);
            });
        }

        function collectFormValues() {
            const elements = getFormElements();

            return {
                productId: elements.productIdInput ? elements.productIdInput.value : "",
                name: elements.nameInput ? elements.nameInput.value : "",
                description: elements.descriptionInput ? elements.descriptionInput.value : "",
                price: elements.priceInput ? elements.priceInput.value : "",
                photoDataUrl: state.selectedPhotoDataUrl,
                availability: elements.availabilityInput ? elements.availabilityInput.value : "available",
                soldOut: elements.soldOutInput ? elements.soldOutInput.checked === true : false
            };
        }

        function updateSummary(product) {
            const safeProduct = product && typeof product === "object" ? product : {};

            const nameOutput = getElement("product-name-output");
            const descriptionOutput = getElement("product-description-output");
            const priceOutput = getElement("product-price-output");
            const availabilityOutput = getElement("product-availability-output");
            const soldOutOutput = getElement("product-sold-out-output");
            const previewImage = getElement("product-photo-preview");

            if (nameOutput) {
                nameOutput.textContent = normalizeText(safeProduct.name) || "-";
            }

            if (descriptionOutput) {
                descriptionOutput.textContent = normalizeText(safeProduct.description) || "-";
            }

            if (priceOutput) {
                priceOutput.textContent = formatPrice(safeProduct.price);
            }

            if (availabilityOutput) {
                availabilityOutput.textContent = normalizeText(safeProduct.availability) || "-";
            }

            if (soldOutOutput) {
                soldOutOutput.textContent = safeProduct.soldOut === true ? "Yes" : "No";
            }

            if (previewImage) {
                const previewSource = normalizeText(safeProduct.photoDataUrl);

                if (previewSource) {
                    previewImage.src = previewSource;
                    previewImage.hidden = false;
                } else {
                    previewImage.removeAttribute("src");
                    previewImage.hidden = true;
                }
            }
        }

        function saveProducts() {
            if (!storage || typeof storage.setItem !== "function") {
                return;
            }

            storage.setItem(STORAGE_KEY, JSON.stringify(state.products));
        }

        function loadProducts() {
            if (!storage || typeof storage.getItem !== "function") {
                state.products = [];
                return [];
            }

            try {
                const raw = storage.getItem(STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : [];

                state.products = Array.isArray(parsed) ? parsed : [];
                return state.products;
            } catch (error) {
                state.products = [];
                return [];
            }
        }

        function fillForm(product) {
            const safeProduct = product && typeof product === "object" ? product : {};
            const elements = getFormElements();

            if (elements.productIdInput) {
                elements.productIdInput.value = normalizeText(safeProduct.id);
            }

            if (elements.nameInput) {
                elements.nameInput.value = normalizeText(safeProduct.name);
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

            if (elements.soldOutInput) {
                elements.soldOutInput.checked = safeProduct.soldOut === true;
            }

            state.selectedPhotoDataUrl = normalizeText(safeProduct.photoDataUrl);
            clearFileInput(elements.photoFileInput);
        }

        function resetFormState() {
            const elements = getFormElements();

            if (elements.productIdInput) {
                elements.productIdInput.value = "";
            }

            if (elements.photoFileInput) {
                clearFileInput(elements.photoFileInput);
            }

            state.selectedPhotoDataUrl = "";
            clearFieldErrors();
            updateSummary({});
            setStatus(DEFAULT_STATUS_MESSAGE, "info");
            setNote(DEFAULT_NOTE_MESSAGE);
        }

        function renderProductsList() {
            const list = getElement("products-list");
            const emptyState = getElement("products-empty-state");

            if (!list) {
                return;
            }

            list.innerHTML = "";

            if (!Array.isArray(state.products) || state.products.length === 0) {
                if (emptyState) {
                    emptyState.hidden = false;
                }
                return;
            }

            if (emptyState) {
                emptyState.hidden = true;
            }

            state.products.forEach(function renderProduct(product) {
                const item = document.createElement("li");
                const button = document.createElement("button");

                button.type = "button";
                button.textContent = `${product.name || "Unnamed item"} - ${formatPrice(product.price)} - ${product.soldOut ? "Sold Out" : normalizeAvailability(product.availability)}`;

                button.addEventListener("click", function handleSelect() {
                    fillForm(product);
                    updateSummary(product);
                    setStatus("Loaded product into the form for editing.", "info");
                    setNote("Update the fields you want and save again.");
                });

                item.appendChild(button);
                list.appendChild(item);
            });
        }

        function upsertProduct(product) {
            const existingIndex = state.products.findIndex(function findIndex(item) {
                return item.id === product.id;
            });

            if (existingIndex >= 0) {
                state.products[existingIndex] = product;
                return "updated";
            }

            state.products.push(product);
            return "created";
        }

        async function previewSelectedPhoto() {
            const elements = getFormElements();
            const selectedFile = getSelectedPhotoFile(elements.photoFileInput);

            if (!selectedFile) {
                setStatus("Choose a product photo first.", "error");
                setNote("Select an image from your device to preview it.");
                return {
                    success: false
                };
            }

            if (!isImageFile(selectedFile)) {
                setStatus("Please choose an image file.", "error");
                setNote("Only image files can be used for product photos.");
                return {
                    success: false
                };
            }

            if (selectedFile.size > 5 * 1024 * 1024) {
                setStatus("Please choose an image smaller than 5 MB.", "error");
                setNote("Large images should be compressed before upload.");
                return {
                    success: false
                };
            }

            const previewDataUrl = await fileToOptimizedDataURL(selectedFile, {
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.85
            });

            state.selectedPhotoDataUrl = previewDataUrl;

            updateSummary(toProduct({
                ...collectFormValues(),
                photoDataUrl: previewDataUrl
            }));

            setStatus("Photo preview ready.", "success");
            setNote("Save the product to keep this image.");

            return {
                success: true,
                photoDataUrl: previewDataUrl
            };
        }

        function removeSelectedPhoto() {
            const elements = getFormElements();

            state.selectedPhotoDataUrl = "";

            if (elements.photoFileInput) {
                clearFileInput(elements.photoFileInput);
            }

            updateSummary(toProduct({
                ...collectFormValues(),
                photoDataUrl: ""
            }));

            setStatus("Product photo removed.", "success");
            setNote("You can choose a new image or save without one.");

            return {
                success: true
            };
        }

        /*function saveCurrentProduct() {
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

            clearFieldErrors();

            const product = toProduct(values);
            const action = upsertProduct(product);

            saveProducts();
            fillForm(product);
            updateSummary(product);
            renderProductsList();

            if (action === "created") {
                setStatus("Product created successfully.", "success");
                setNote("Your new menu item has been added.");
            } else {
                setStatus("Product updated successfully.", "success");
                setNote("Your menu item changes have been saved.");
            }

            return {
                success: true,
                action,
                product
            };
            state.products.push(product);
            product.id=Date.now().toString();
        }*/
       function saveCurrentProduct() {

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

        clearFieldErrors();

        const product = toProduct(values);
        product.id = product.id || Date.now().toString();

        const action = upsertProduct(product);

        state.products = state.products || [];

        const existingIndex = state.products.findIndex(p => p.id === product.id);

        if (existingIndex >= 0) {
            state.products[existingIndex] = product;
        } else {
            state.products.push(product);
        }

        saveProducts();
        fillForm(product);
        updateSummary(product);
        renderProductsList();

        if (action === "created") {
            setStatus("Product created successfully.", "success");
            setNote("Your new menu item has been added.");
        } else {
            setStatus("Product updated successfully.", "success");
            setNote("Your menu item changes have been saved.");
        }

        return {
            success: true,
            action,
            product
        };
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
                    updateSummary(toProduct(collectFormValues()));
                });

                if (eventName !== "change") {
                    field.addEventListener("blur", function handleBlur() {
                        validateSingleField(fieldName);
                    });
                }
            });

            if (elements.soldOutInput) {
                elements.soldOutInput.addEventListener("change", function handleSoldOut() {
                    updateSummary(toProduct(collectFormValues()));
                });
            }
        }

        function goBack() {
            window.location.href = "./index.html";
        }

        function bindEvents() {
            const elements = getFormElements();

            if (elements.form) {
                elements.form.addEventListener("submit", function handleSubmit(event) {
                    event.preventDefault();
                    saveCurrentProduct();
                });

                elements.form.addEventListener("reset", function handleReset() {
                    window.setTimeout(function afterReset() {
                        resetFormState();
                        renderProductsList();
                        setNote("The form has been cleared.");
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
                elements.backButton.addEventListener("click", goBack);
            }

            bindLiveValidation();
        }

        function initializeProductsPage() {
            loadProducts();
            renderProductsList();
            resetFormState();
            bindEvents();

            return {
                success: true
            };
        }

        return {
            initializeProductsPage,
            saveCurrentProduct,
            previewSelectedPhoto,
            removeSelectedPhoto,
            helpers: {
                normalizeText,
                normalizeLowerText,
                parsePrice,
                formatPrice,
                normalizeAvailability,
                validateProduct,
                toProduct,
                isImageFile,
                readFileAsDataURL,
                loadImageFromSource,
                fileToOptimizedDataURL,
                getSelectedPhotoFile,
                clearFileInput
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
            normalizeAvailability,
            validateProduct,
            toProduct,
            isImageFile,
            readFileAsDataURL,
            loadImageFromSource,
            fileToOptimizedDataURL,
            getSelectedPhotoFile,
            clearFileInput,
            createVendorProductsPage,
            isValidPhotoUrl,
            validateProduct,
            toProduct
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