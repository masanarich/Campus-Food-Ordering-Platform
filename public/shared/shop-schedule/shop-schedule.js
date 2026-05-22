(function attachShopSchedule(globalScope) {
    "use strict";

    const DAYS = [
        { key: "monday",    label: "Monday",    short: "Mon" },
        { key: "tuesday",   label: "Tuesday",   short: "Tue" },
        { key: "wednesday", label: "Wednesday", short: "Wed" },
        { key: "thursday",  label: "Thursday",  short: "Thu" },
        { key: "friday",    label: "Friday",    short: "Fri" },
        { key: "saturday",  label: "Saturday",  short: "Sat" },
        { key: "sunday",    label: "Sunday",    short: "Sun" }
    ];

    // Sunday is index 0 from Date#getDay(); map to our keys.
    const DAY_KEY_BY_DATE_INDEX = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ];

    function pad2(value) {
        const str = String(value);
        return str.length >= 2 ? str : `0${str}`;
    }

    function normalizeTimeString(value) {
        if (typeof value !== "string") {
            return "";
        }

        const trimmed = value.trim();

        if (!trimmed) {
            return "";
        }

        const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);

        if (!match) {
            return "";
        }

        const hours = Number.parseInt(match[1], 10);
        const minutes = Number.parseInt(match[2], 10);

        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
            return "";
        }

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return "";
        }

        return `${pad2(hours)}:${pad2(minutes)}`;
    }

    function timeToMinutes(value) {
        const safe = normalizeTimeString(value);

        if (!safe) {
            return null;
        }

        const [hours, minutes] = safe.split(":").map(function toNumber(token) {
            return Number.parseInt(token, 10);
        });

        return hours * 60 + minutes;
    }

    function formatTimeForDisplay(value) {
        const safe = normalizeTimeString(value);

        if (!safe) {
            return "";
        }

        const [hours, minutes] = safe.split(":");
        const hourNum = Number.parseInt(hours, 10);
        const suffix = hourNum >= 12 ? "PM" : "AM";
        const displayHour = ((hourNum + 11) % 12) + 1;
        return `${displayHour}:${minutes} ${suffix}`;
    }

    function getDefaultSchedule() {
        const schedule = {};

        DAYS.forEach(function setDefault(day) {
            const isWeekend = day.key === "saturday" || day.key === "sunday";
            schedule[day.key] = {
                open: !isWeekend,
                openTime: "08:00",
                closeTime: "17:00"
            };
        });

        return schedule;
    }

    function normalizeDaySchedule(raw) {
        const safe = raw && typeof raw === "object" ? raw : {};
        const openTime = normalizeTimeString(safe.openTime) || "08:00";
        const closeTime = normalizeTimeString(safe.closeTime) || "17:00";
        const open = safe.open === true;

        return { open, openTime, closeTime };
    }

    function normalizeSchedule(raw) {
        const safe = raw && typeof raw === "object" ? raw : {};
        const defaults = getDefaultSchedule();
        const schedule = {};

        DAYS.forEach(function normalizeDay(day) {
            if (Object.prototype.hasOwnProperty.call(safe, day.key)) {
                schedule[day.key] = normalizeDaySchedule(safe[day.key]);
            } else {
                schedule[day.key] = defaults[day.key];
            }
        });

        return schedule;
    }

    function isEmptySchedule(schedule) {
        const safe = normalizeSchedule(schedule);
        return DAYS.every(function isClosed(day) {
            return safe[day.key].open !== true;
        });
    }

    function groupConsecutiveDays(schedule) {
        const safe = normalizeSchedule(schedule);
        const groups = [];
        let currentGroup = null;

        DAYS.forEach(function inspectDay(day) {
            const slot = safe[day.key];

            if (!slot.open) {
                if (currentGroup) {
                    groups.push(currentGroup);
                    currentGroup = null;
                }
                groups.push({ closed: true, start: day, end: day });
                return;
            }

            const signature = `${slot.openTime}-${slot.closeTime}`;

            if (
                currentGroup &&
                currentGroup.closed !== true &&
                currentGroup.signature === signature
            ) {
                currentGroup.end = day;
                return;
            }

            if (currentGroup) {
                groups.push(currentGroup);
            }

            currentGroup = {
                closed: false,
                start: day,
                end: day,
                openTime: slot.openTime,
                closeTime: slot.closeTime,
                signature
            };
        });

        if (currentGroup) {
            groups.push(currentGroup);
        }

        // Merge consecutive closed-day groups.
        const merged = [];
        groups.forEach(function appendGroup(group) {
            const last = merged[merged.length - 1];
            if (
                group.closed === true &&
                last &&
                last.closed === true
            ) {
                last.end = group.end;
            } else {
                merged.push(group);
            }
        });

        return merged;
    }

    function describeRange(group) {
        const startLabel = group.start.short;
        const endLabel = group.end.short;
        const dayPart = startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;

        if (group.closed) {
            return `${dayPart} closed`;
        }

        return `${dayPart} ${formatTimeForDisplay(group.openTime)} – ${formatTimeForDisplay(group.closeTime)}`;
    }

    function formatScheduleSummary(schedule) {
        const safe = normalizeSchedule(schedule);

        if (isEmptySchedule(safe)) {
            return "Closed all week";
        }

        return groupConsecutiveDays(safe).map(describeRange).join(", ");
    }

    function getCurrentDayKey(date) {
        const safeDate = date instanceof Date ? date : new Date();
        return DAY_KEY_BY_DATE_INDEX[safeDate.getDay()];
    }

    function isOpenNowFromSchedule(schedule, date) {
        const safeDate = date instanceof Date ? date : new Date();
        const safeSchedule = normalizeSchedule(schedule);
        const dayKey = getCurrentDayKey(safeDate);
        const slot = safeSchedule[dayKey];

        if (!slot || !slot.open) {
            return false;
        }

        const openMinutes = timeToMinutes(slot.openTime);
        const closeMinutes = timeToMinutes(slot.closeTime);

        if (openMinutes === null || closeMinutes === null) {
            return false;
        }

        const nowMinutes = safeDate.getHours() * 60 + safeDate.getMinutes();

        // Handle overnight schedules (close <= open means it wraps past midnight).
        if (closeMinutes <= openMinutes) {
            return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
        }

        return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    }

    function getNextOpenSlot(schedule, date) {
        const safeDate = date instanceof Date ? date : new Date();
        const safeSchedule = normalizeSchedule(schedule);

        for (let offset = 0; offset < 7; offset += 1) {
            const candidateIndex = (safeDate.getDay() + offset) % 7;
            const dayKey = DAY_KEY_BY_DATE_INDEX[candidateIndex];
            const slot = safeSchedule[dayKey];

            if (!slot || !slot.open) {
                continue;
            }

            const openMinutes = timeToMinutes(slot.openTime);

            if (openMinutes === null) {
                continue;
            }

            if (offset === 0) {
                const nowMinutes = safeDate.getHours() * 60 + safeDate.getMinutes();
                const closeMinutes = timeToMinutes(slot.closeTime);

                if (closeMinutes !== null && closeMinutes <= openMinutes && nowMinutes < closeMinutes) {
                    return { dayKey, openTime: slot.openTime, isToday: true, isLater: false };
                }

                if (nowMinutes < openMinutes) {
                    return { dayKey, openTime: slot.openTime, isToday: true, isLater: true };
                }

                continue;
            }

            const day = DAYS.find(function matchDay(d) { return d.key === dayKey; });
            return { dayKey, openTime: slot.openTime, isToday: false, isLater: true, dayLabel: day ? day.label : dayKey };
        }

        return null;
    }

    function getShopOpenState(shopOrOptions, date) {
        const safeOptions = shopOrOptions && typeof shopOrOptions === "object" ? shopOrOptions : {};
        const acceptingOrders = safeOptions.acceptingOrders !== false;
        const schedule = safeOptions.schedule || safeOptions.vendorSchedule || null;
        const summary = formatScheduleSummary(schedule);
        const openByHours = isOpenNowFromSchedule(schedule, date);

        if (!acceptingOrders) {
            return {
                isOpen: false,
                reason: "manually-closed",
                label: "Closed",
                summary
            };
        }

        if (!schedule) {
            return {
                isOpen: true,
                reason: "no-schedule",
                label: "Open",
                summary
            };
        }

        if (openByHours) {
            return {
                isOpen: true,
                reason: "within-hours",
                label: "Open now",
                summary
            };
        }

        const next = getNextOpenSlot(schedule, date);
        return {
            isOpen: false,
            reason: "outside-hours",
            label: "Closed",
            summary,
            nextOpen: next
        };
    }

    const shopSchedule = {
        DAYS,
        DAY_KEY_BY_DATE_INDEX,
        normalizeTimeString,
        timeToMinutes,
        formatTimeForDisplay,
        getDefaultSchedule,
        normalizeDaySchedule,
        normalizeSchedule,
        isEmptySchedule,
        groupConsecutiveDays,
        formatScheduleSummary,
        getCurrentDayKey,
        isOpenNowFromSchedule,
        getNextOpenSlot,
        getShopOpenState
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = shopSchedule;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.shopSchedule = shopSchedule;
    }
})(typeof window !== "undefined" ? window : globalThis);
