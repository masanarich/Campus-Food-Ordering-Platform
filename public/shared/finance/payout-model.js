(function attachPayoutModel(globalScope) {
    "use strict";

    const MODULE_NAME = "payout-model";
    const DEFAULT_CURRENCY = "ZAR";
    const DEFAULT_STATUS = "pending";
    const PAYOUT_STATUSES = Object.freeze({
        PENDING: "pending",
        APPROVED: "approved",
        PAID: "paid",
        REJECTED: "rejected",
        CANCELLED: "cancelled"
    });
    const PAYOUT_STATUS_LABELS = Object.freeze({
        pending: "Pending",
        approved: "Approved",
        paid: "Paid",
        rejected: "Rejected",
        cancelled: "Cancelled"
    });
    const ACTIVE_PAYOUT_STATUSES = Object.freeze([
        PAYOUT_STATUSES.PENDING,
        PAYOUT_STATUSES.APPROVED
    ]);
    const BALANCE_RESERVING_STATUSES = Object.freeze([
        PAYOUT_STATUSES.PENDING,
        PAYOUT_STATUSES.APPROVED,
        PAYOUT_STATUSES.PAID
    ]);

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function normalizeUpperText(value) {
        return normalizeText(value).toUpperCase();
    }

    function parseCurrencyNumber(value) {
        if (typeof value === "number") {
            return value;
        }

        if (typeof value !== "string") {
            return Number.parseFloat(value);
        }

        const normalized = value
            .trim()
            .replace(/\s+/g, "")
            .replace(/,/g, ".");

        return Number.parseFloat(normalized);
    }

    function normalizeCurrencyAmount(value, fallbackValue) {
        const parsed = parseCurrencyNumber(value);
        const fallbackParsed = parseCurrencyNumber(fallbackValue);

        if (Number.isFinite(parsed)) {
            return Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100);
        }

        if (Number.isFinite(fallbackParsed)) {
            return Math.max(0, Math.round((fallbackParsed + Number.EPSILON) * 100) / 100);
        }

        return 0;
    }

    function hasValue(value) {
        return value !== undefined && value !== null && String(value).trim() !== "";
    }

    function normalizeAmountInMinorUnits(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        const fallbackParsed = Number.parseInt(fallbackValue, 10);

        if (Number.isFinite(parsed) && parsed >= 0) {
            return Math.round(parsed);
        }

        if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0) {
            return Math.round(fallbackParsed);
        }

        return 0;
    }

    function amountFromMinorUnits(value, fallbackValue) {
        return normalizeCurrencyAmount(normalizeAmountInMinorUnits(value, fallbackValue) / 100);
    }

    function resolveCurrencyAmount(amountValue, minorUnitValue, fallbackValue) {
        if (hasValue(minorUnitValue)) {
            return amountFromMinorUnits(minorUnitValue);
        }

        return normalizeCurrencyAmount(amountValue, fallbackValue);
    }

    function amountToMinorUnits(amount) {
        return Math.round(normalizeCurrencyAmount(amount) * 100);
    }

    function normalizePayoutStatus(status, fallbackStatus) {
        const normalized = normalizeLowerText(status);

        if (Object.values(PAYOUT_STATUSES).indexOf(normalized) >= 0) {
            return normalized;
        }

        const fallback = normalizeLowerText(fallbackStatus);

        if (Object.values(PAYOUT_STATUSES).indexOf(fallback) >= 0) {
            return fallback;
        }

        return DEFAULT_STATUS;
    }

    function isActivePayoutStatus(status) {
        return ACTIVE_PAYOUT_STATUSES.indexOf(normalizePayoutStatus(status)) >= 0;
    }

    function payoutReservesBalance(status) {
        return BALANCE_RESERVING_STATUSES.indexOf(normalizePayoutStatus(status)) >= 0;
    }

    function getPayoutStatusLabel(status) {
        return PAYOUT_STATUS_LABELS[normalizePayoutStatus(status)] || PAYOUT_STATUS_LABELS[DEFAULT_STATUS];
    }

    function normalizeDigits(value) {
        return normalizeText(value).replace(/\D+/g, "");
    }

    function maskAccountNumber(value) {
        const digits = normalizeDigits(value);

        if (!digits) {
            return "";
        }

        const last4 = digits.slice(-4);

        return `****${last4}`;
    }

    function createFakeBankSnapshot(values = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const accountNumber = normalizeDigits(
            safeValues.fakeAccountNumber ||
            safeValues.accountNumber ||
            safeValues.bankAccountNumber
        );

        return {
            fakeBankName: normalizeText(safeValues.fakeBankName || safeValues.bankName),
            fakeAccountHolder: normalizeText(
                safeValues.fakeAccountHolder ||
                safeValues.accountHolder ||
                safeValues.accountName
            ),
            fakeAccountNumberLast4: accountNumber ? accountNumber.slice(-4) : "",
            fakeAccountNumberMasked: maskAccountNumber(accountNumber),
            fakeBranchCode: normalizeDigits(safeValues.fakeBranchCode || safeValues.branchCode),
            fakeAccountType: normalizeLowerText(safeValues.fakeAccountType || safeValues.accountType) || "cheque"
        };
    }

    /**
     * Coerce a candidate `at` value to something Firestore will accept inside
     * an array entry. The Firebase SDK rejects writes when a `serverTimestamp()`
     * sentinel ends up nested in an array — only top-level fields can use it.
     * Acceptable shapes: Date, ISO string, finite number, Firestore Timestamp
     * (object with `toDate` or `seconds`). Anything else (incl. FieldValue
     * sentinels and other unknown objects) is converted to the current Date so
     * timeline entries still carry an approximate timestamp.
     */
    function sanitizeTimelineAt(candidate) {
        if (candidate == null) return null;
        if (candidate instanceof Date) return candidate;
        const t = typeof candidate;
        if (t === "string") return candidate;
        if (t === "number" && Number.isFinite(candidate)) return candidate;
        if (t === "object") {
            if (typeof candidate.toDate === "function") return candidate;
            if (typeof candidate.seconds === "number" && Number.isFinite(candidate.seconds)) {
                return candidate;
            }
            // Unknown object — most likely a Firestore FieldValue sentinel
            // (serverTimestamp / increment / arrayUnion). Replace with a real
            // Date so the array entry is writable.
            return new Date();
        }
        return new Date();
    }

    function createPayoutTimelineEntry(status, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedStatus = normalizePayoutStatus(status);
        const rawAt = safeOptions.at !== undefined
            ? safeOptions.at
            : safeOptions.timestamp !== undefined
                ? safeOptions.timestamp
                : null;

        return {
            status: normalizedStatus,
            label: getPayoutStatusLabel(normalizedStatus),
            actorRole: normalizeLowerText(safeOptions.actorRole || safeOptions.role) || "system",
            actorUid: normalizeText(safeOptions.actorUid || safeOptions.uid),
            actorName: normalizeText(safeOptions.actorName || safeOptions.name),
            note: normalizeText(safeOptions.note),
            at: sanitizeTimelineAt(rawAt)
        };
    }

    function createPayoutId(values = {}, options = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const explicitId = normalizeText(
            safeOptions.payoutId ||
            safeValues.payoutId ||
            safeValues.id ||
            safeValues.withdrawalId
        );

        if (explicitId) {
            return explicitId;
        }

        if (typeof safeOptions.payoutIdFactory === "function") {
            const generatedId = normalizeText(safeOptions.payoutIdFactory(safeValues, safeOptions));

            if (generatedId) {
                return generatedId;
            }
        }

        const seed = normalizeText(
            safeOptions.timestampSeed ||
            safeOptions.createdAt ||
            safeValues.requestedAt
        ).replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();

        if (seed) {
            return `payout-${seed}`;
        }

        // No usable string seed (e.g. a Firestore serverTimestamp() sentinel
        // was passed in). Falling back to the literal "generated" would make
        // every payout collide on the id "payout-generated", which Firestore
        // then treats as an update of an existing doc and the rules deny.
        const uniqueSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        return `payout-${uniqueSeed}`;
    }

    function createPayoutRequestRecord(values = {}, options = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const createdAt = safeValues.createdAt !== undefined
            ? safeValues.createdAt
            : safeValues.requestedAt !== undefined
                ? safeValues.requestedAt
                : safeOptions.createdAt !== undefined
                    ? safeOptions.createdAt
                    : null;
        const updatedAt = safeValues.updatedAt !== undefined
            ? safeValues.updatedAt
            : createdAt;
        const status = normalizePayoutStatus(safeValues.status || safeOptions.status);
        const bankSnapshot = createFakeBankSnapshot(safeValues.bank || safeValues);
        const amount = resolveCurrencyAmount(
            safeValues.amount || safeValues.withdrawalAmount,
            safeValues.amountInMinorUnits !== undefined
                ? safeValues.amountInMinorUnits
                : safeValues.amountMinor
        );
        const providedTimeline = Array.isArray(safeValues.timeline) ? safeValues.timeline : [];
        const timeline = providedTimeline.length > 0
            ? providedTimeline.map(function normalizeEntry(entry) {
                const safeEntry = entry && typeof entry === "object" ? entry : {};
                return createPayoutTimelineEntry(safeEntry.status || status, safeEntry);
            })
            : [
                createPayoutTimelineEntry(status, {
                    actorRole: safeValues.createdByRole || safeOptions.createdByRole || "vendor",
                    actorUid: safeValues.vendorUid || safeOptions.vendorUid,
                    actorName: safeValues.vendorName || safeOptions.vendorName,
                    note: safeValues.statusNote || safeValues.note || "Vendor requested a simulated payout.",
                    at: createdAt
                })
            ];

        return {
            payoutId: createPayoutId(safeValues, safeOptions),
            vendorUid: normalizeText(safeValues.vendorUid || safeOptions.vendorUid),
            vendorName: normalizeText(safeValues.vendorName || safeOptions.vendorName) || "Unknown Vendor",
            vendorEmail: normalizeLowerText(safeValues.vendorEmail || safeOptions.vendorEmail),
            amount,
            amountInMinorUnits: amountToMinorUnits(amount),
            currency: normalizeUpperText(safeValues.currency || safeOptions.currency) || DEFAULT_CURRENCY,
            status,
            statusLabel: getPayoutStatusLabel(status),
            ...bankSnapshot,
            requestedAt: safeValues.requestedAt !== undefined ? safeValues.requestedAt : createdAt,
            approvedAt: safeValues.approvedAt || null,
            paidAt: safeValues.paidAt || null,
            rejectedAt: safeValues.rejectedAt || null,
            cancelledAt: safeValues.cancelledAt || null,
            processedAt: safeValues.processedAt || safeValues.paidAt || safeValues.rejectedAt || null,
            processedByUid: normalizeText(safeValues.processedByUid || safeValues.adminUid),
            processedByName: normalizeText(safeValues.processedByName || safeValues.adminName),
            rejectionReason: normalizeText(safeValues.rejectionReason || safeValues.reason),
            notes: normalizeText(safeValues.notes || safeValues.note),
            testMode: safeValues.testMode !== false,
            testEmailQueued: safeValues.testEmailQueued === true,
            emailNotificationId: normalizeText(safeValues.emailNotificationId),
            timeline,
            createdAt,
            updatedAt
        };
    }

    function normalizePayoutRecord(values = {}, options = {}) {
        return createPayoutRequestRecord(values, options);
    }

    function validatePayoutRequestInput(values = {}, options = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const value = createPayoutRequestRecord(safeValues, safeOptions);
        const errors = {};
        const availableBalance = safeOptions.availableBalance !== undefined
            ? normalizeCurrencyAmount(safeOptions.availableBalance)
            : null;
        const accountNumberDigits = normalizeDigits(
            safeValues.fakeAccountNumber ||
            safeValues.accountNumber ||
            safeValues.bankAccountNumber
        );

        if (!value.vendorUid) {
            errors.vendorUid = "Vendor UID is required.";
        }

        if (value.amount <= 0) {
            errors.amount = "Withdrawal amount must be greater than zero.";
        }

        if (availableBalance !== null && value.amount > availableBalance) {
            errors.amount = "Withdrawal amount cannot exceed the available balance.";
        }

        if (!value.fakeBankName) {
            errors.fakeBankName = "Fake bank name is required.";
        }

        if (!value.fakeAccountHolder) {
            errors.fakeAccountHolder = "Fake account holder is required.";
        }

        if (accountNumberDigits.length < 6) {
            errors.fakeAccountNumber = "Fake account number must have at least 6 digits.";
        }

        if (!value.fakeBranchCode) {
            errors.fakeBranchCode = "Fake branch code is required.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            value
        };
    }

    function canTransitionPayoutStatus(currentStatus, nextStatus, actorRole) {
        const current = normalizePayoutStatus(currentStatus);
        const next = normalizePayoutStatus(nextStatus);
        const role = normalizeLowerText(actorRole) || "system";

        if (current === next) {
            return {
                isValid: true,
                currentStatus: current,
                nextStatus: next,
                actorRole: role,
                message: "Payout status is unchanged."
            };
        }

        if (role === "vendor") {
            const isAllowed = current === PAYOUT_STATUSES.PENDING &&
                next === PAYOUT_STATUSES.CANCELLED;

            return {
                isValid: isAllowed,
                currentStatus: current,
                nextStatus: next,
                actorRole: role,
                message: isAllowed
                    ? "Vendor cancelled the pending payout request."
                    : "Vendors can only cancel pending payout requests."
            };
        }

        if (role !== "admin" && role !== "system") {
            return {
                isValid: false,
                currentStatus: current,
                nextStatus: next,
                actorRole: role,
                message: "Only an admin or system actor can process payout requests."
            };
        }

        const allowedTransitions = {
            pending: ["approved", "rejected", "paid", "cancelled"],
            approved: ["paid", "rejected", "cancelled"],
            paid: [],
            rejected: [],
            cancelled: []
        };
        const isAllowed = (allowedTransitions[current] || []).indexOf(next) >= 0;

        return {
            isValid: isAllowed,
            currentStatus: current,
            nextStatus: next,
            actorRole: role,
            message: isAllowed
                ? `Payout can move from ${getPayoutStatusLabel(current)} to ${getPayoutStatusLabel(next)}.`
                : `${getPayoutStatusLabel(current)} payouts cannot move to ${getPayoutStatusLabel(next)}.`
        };
    }

    function applyPayoutStatus(payoutRecord, nextStatus, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const currentPayout = createPayoutRequestRecord(payoutRecord, safeOptions);
        const actorRole = safeOptions.actorRole || "admin";
        const transition = canTransitionPayoutStatus(currentPayout.status, nextStatus, actorRole);

        if (!transition.isValid) {
            return {
                success: false,
                payout: currentPayout,
                transition,
                error: {
                    code: "payout/invalid-status-transition",
                    message: transition.message
                }
            };
        }

        const timestamp = safeOptions.timestamp !== undefined
            ? safeOptions.timestamp
            : safeOptions.updatedAt !== undefined
                ? safeOptions.updatedAt
                : new Date().toISOString();
        const normalizedNextStatus = normalizePayoutStatus(nextStatus);
        const timelineEntry = createPayoutTimelineEntry(normalizedNextStatus, {
            actorRole,
            actorUid: safeOptions.actorUid || safeOptions.adminUid,
            actorName: safeOptions.actorName || safeOptions.adminName,
            note: safeOptions.note || safeOptions.rejectionReason || "",
            at: timestamp
        });
        const patch = {
            status: normalizedNextStatus,
            statusLabel: getPayoutStatusLabel(normalizedNextStatus),
            updatedAt: timestamp,
            timeline: currentPayout.timeline.concat(timelineEntry)
        };

        if (normalizedNextStatus === PAYOUT_STATUSES.APPROVED) {
            patch.approvedAt = timestamp;
            patch.processedByUid = normalizeText(safeOptions.actorUid || safeOptions.adminUid);
            patch.processedByName = normalizeText(safeOptions.actorName || safeOptions.adminName);
        }

        if (normalizedNextStatus === PAYOUT_STATUSES.PAID) {
            patch.paidAt = timestamp;
            patch.processedAt = timestamp;
            patch.processedByUid = normalizeText(safeOptions.actorUid || safeOptions.adminUid);
            patch.processedByName = normalizeText(safeOptions.actorName || safeOptions.adminName);
        }

        if (normalizedNextStatus === PAYOUT_STATUSES.REJECTED) {
            patch.rejectedAt = timestamp;
            patch.processedAt = timestamp;
            patch.processedByUid = normalizeText(safeOptions.actorUid || safeOptions.adminUid);
            patch.processedByName = normalizeText(safeOptions.actorName || safeOptions.adminName);
            patch.rejectionReason = normalizeText(safeOptions.rejectionReason || safeOptions.note);
        }

        if (normalizedNextStatus === PAYOUT_STATUSES.CANCELLED) {
            patch.cancelledAt = timestamp;
        }

        return {
            success: true,
            payout: {
                ...currentPayout,
                ...patch
            },
            previousPayout: currentPayout,
            patch,
            timelineEntry,
            transition
        };
    }

    function createPayoutEmailNotification(payoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const payout = createPayoutRequestRecord(payoutRecord, safeOptions);
        const notificationId = normalizeText(safeOptions.notificationId) ||
            `${payout.payoutId}-email`;

        return {
            notificationId,
            recipientUid: payout.vendorUid,
            recipientRole: "vendor",
            channel: "test_email",
            type: "payout_request_submitted",
            title: "Withdrawal request submitted",
            message: `Your simulated withdrawal request for ${payout.currency} ${payout.amount.toFixed(2)} was submitted.`,
            payoutId: payout.payoutId,
            vendorUid: payout.vendorUid,
            vendorEmail: payout.vendorEmail,
            read: false,
            isRead: false,
            testMode: true,
            queuedAt: safeOptions.queuedAt !== undefined ? safeOptions.queuedAt : payout.createdAt
        };
    }

    const payoutModel = {
        MODULE_NAME,
        DEFAULT_CURRENCY,
        DEFAULT_STATUS,
        PAYOUT_STATUSES,
        PAYOUT_STATUS_LABELS,
        ACTIVE_PAYOUT_STATUSES,
        BALANCE_RESERVING_STATUSES,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        parseCurrencyNumber,
        normalizeCurrencyAmount,
        normalizeAmountInMinorUnits,
        amountFromMinorUnits,
        resolveCurrencyAmount,
        amountToMinorUnits,
        normalizePayoutStatus,
        isActivePayoutStatus,
        payoutReservesBalance,
        getPayoutStatusLabel,
        normalizeDigits,
        maskAccountNumber,
        createFakeBankSnapshot,
        sanitizeTimelineAt,
        createPayoutTimelineEntry,
        createPayoutId,
        createPayoutRequestRecord,
        normalizePayoutRecord,
        validatePayoutRequestInput,
        canTransitionPayoutStatus,
        applyPayoutStatus,
        createPayoutEmailNotification
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = payoutModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.payoutModel = payoutModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
