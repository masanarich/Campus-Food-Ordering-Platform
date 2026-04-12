/* ══════════════════════════════════════════════
   THE GOURMET SOCIAL — payment.js
   3D card animation, form validation, payment sim
   ══════════════════════════════════════════════ */

// ── Order data from cart ──────────────────────
const orderRaw = sessionStorage.getItem("gourmet_order");
const order = orderRaw ? JSON.parse(orderRaw) : null;

// ── DOM refs ─────────────────────────────────
const card3d          = document.getElementById("card3d");
const cardScene       = document.getElementById("cardScene");
const cardFront       = document.getElementById("cardFront");
const displayNumber   = document.getElementById("displayNumber");
const displayName     = document.getElementById("displayName");
const displayExpiry   = document.getElementById("displayExpiry");
const displayCvv      = document.getElementById("displayCvv");
const cardNetworkLogo = document.getElementById("cardNetworkLogo");
const cardBackNetwork = document.getElementById("cardBackNetwork");
const cardShimmer     = document.getElementById("cardShimmer");
const inputCardIcon   = document.getElementById("inputCardIcon");
const miniItems       = document.getElementById("miniItems");
const miniTotals      = document.getElementById("miniTotals");

const fCardNumber = document.getElementById("cardNumber");
const fCardName   = document.getElementById("cardName");
const fCardExpiry = document.getElementById("cardExpiry");
const fCardCvv    = document.getElementById("cardCvv");
const payBtn      = document.getElementById("payBtn");
const payBtnLabel = document.getElementById("payBtnLabel");
const payBtnAmount= document.getElementById("payBtnAmount");
const payBtnSpinner=document.getElementById("payBtnSpinner");
const cvvHelp     = document.getElementById("cvvHelp");
const cvvTooltip  = document.getElementById("cvvTooltip");
const payForm     = document.getElementById("paymentForm");

// ── Card state ────────────────────────────────
let isFlipped   = false;
let isTilting   = false;
let cardType    = "default";

// ── Card type detection ───────────────────────
const CARD_PATTERNS = {
  visa:       { regex: /^4/,            logo: buildVisaLogo,       max: 16, cvvLen: 3 },
  mastercard: { regex: /^5[1-5]|^2[2-7]/,logo: buildMastercardLogo, max: 16, cvvLen: 3 },
  amex:       { regex: /^3[47]/,        logo: buildAmexLogo,       max: 15, cvvLen: 4 },
  discover:   { regex: /^6(?:011|22|4|5)/,logo: buildDiscoverLogo,  max: 16, cvvLen: 3 },
};

function detectCardType(digits) {
  for (const [type, cfg] of Object.entries(CARD_PATTERNS)) {
    if (cfg.regex.test(digits)) return type;
  }
  return "default";
}

// ── Logo builders ─────────────────────────────
function buildVisaLogo() {
  const el = document.createElement("span");
  el.className = "logo-visa";
  el.textContent = "VISA";
  return el;
}

function buildMastercardLogo() {
  const el = document.createElement("div");
  el.className = "logo-mastercard";
  el.innerHTML = '<div class="mc-circle mc-left"></div><div class="mc-circle mc-right"></div>';
  return el;
}

function buildAmexLogo() {
  const el = document.createElement("span");
  el.className = "logo-amex";
  el.textContent = "AMEX";
  return el;
}

function buildDiscoverLogo() {
  const el = document.createElement("span");
  el.className = "logo-amex";
  el.style.color = "#f79e1b";
  el.textContent = "DISC";
  return el;
}

function buildDefaultLogo() {
  return null;
}

// ── Input icon ────────────────────────────────
const NETWORK_ICONS = {
  visa:       `<svg width="36" height="22" viewBox="0 0 36 22"><rect width="36" height="22" rx="4" fill="#1a3270"/><text x="5" y="16" font-family="serif" font-size="14" font-weight="900" font-style="italic" fill="white" letter-spacing="-0.5">VISA</text></svg>`,
  mastercard: `<svg width="36" height="22" viewBox="0 0 36 22"><rect width="36" height="22" rx="4" fill="#1a1a1a"/><circle cx="14" cy="11" r="8" fill="#eb001b"/><circle cx="22" cy="11" r="8" fill="#f79e1b" opacity="0.9"/></svg>`,
  amex:       `<svg width="36" height="22" viewBox="0 0 36 22"><rect width="36" height="22" rx="4" fill="#007bc1"/><text x="4" y="15" font-family="sans-serif" font-size="9" font-weight="800" fill="white" letter-spacing="1">AMEX</text></svg>`,
  discover:   `<svg width="36" height="22" viewBox="0 0 36 22"><rect width="36" height="22" rx="4" fill="#e65c00"/><text x="3" y="15" font-family="sans-serif" font-size="8" font-weight="800" fill="white" letter-spacing="0.5">DISC</text></svg>`,
  default:    `<svg width="28" height="18" viewBox="0 0 28 18"><rect width="28" height="18" rx="3" fill="#2a2a3a"/><rect y="4" width="28" height="4" fill="#444"/><rect x="3" y="11" width="8" height="3" rx="1" fill="#666"/></svg>`,
};

// ── Update card type + gradient ───────────────
function updateCardType(digits) {
  const detected = detectCardType(digits);
  if (detected === cardType) return;
  cardType = detected;

  // Update front gradient
  cardFront.setAttribute("data-type", detected);

  // Update network logos
  cardNetworkLogo.innerHTML = "";
  cardBackNetwork.innerHTML = "";

  const cfg = CARD_PATTERNS[detected];
  if (cfg) {
    const logo1 = cfg.logo();
    const logo2 = cfg.logo();
    if (logo1) {
      cardNetworkLogo.appendChild(logo1);
      cardBackNetwork.appendChild(logo2);
    }
  }

  // Update input icon
  inputCardIcon.innerHTML = NETWORK_ICONS[detected] || NETWORK_ICONS.default;
}

// ── Card number formatting ────────────────────
function formatCardNumber(raw) {
  const digits = raw.replace(/\D/g, "");
  if (cardType === "amex") {
    const p1 = digits.slice(0, 4);
    const p2 = digits.slice(4, 10);
    const p3 = digits.slice(10, 15);
    return [p1, p2, p3].filter(Boolean).join(" ");
  }
  return (digits.match(/.{1,4}/g) || []).join(" ");
}

function getMaxLength() {
  return cardType === "amex" ? 17 : 19; // with spaces
}

// ── Display card number (with masking) ────────
function renderDisplayNumber(formatted) {
  const parts = formatted
    ? formatted.split(" ")
    : ["", "", "", ""];

  if (cardType === "amex") {
    const [p1 = "", p2 = "", p3 = ""] = parts;
    displayNumber.innerHTML =
      `<span>${(p1 || "••••").padEnd(4, "•")}</span>` +
      `<span>${(p2 || "••••••").padEnd(6, "•")}</span>` +
      `<span>${(p3 || "•••••").padEnd(5, "•")}</span>`;
  } else {
    const filled = Array.from({ length: 4 }, (_, i) => parts[i] || "").map((p, i) =>
      (p || (i < parts.length - 1 ? "••••" : "")).padEnd(4, "•")
    );
    displayNumber.innerHTML = filled.map((p) => `<span>${p}</span>`).join("");
  }
}

// ── 3D tilt on mouse move ─────────────────────
cardScene.addEventListener("mousemove", (e) => {
  if (isFlipped) return;
  const rect = cardScene.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width  - 0.5;
  const y = (e.clientY - rect.top)  / rect.height - 0.5;
  const tX = y * 22;
  const tY = -x * 22;
  card3d.classList.add("is-tilting");
  card3d.style.transform = `rotateX(${tX}deg) rotateY(${tY}deg) translateY(-6px)`;

  // Move shimmer
  cardShimmer.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(255,255,255,0.12) 0%, transparent 60%)`;
});

cardScene.addEventListener("mouseleave", () => {
  if (isFlipped) return;
  card3d.classList.remove("is-tilting");
  card3d.style.transform = "";
  cardShimmer.style.background = `radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0%, transparent 60%)`;
});

// ── Card flip ─────────────────────────────────
function flipCard(toBack) {
  isFlipped = toBack;
  if (toBack) {
    card3d.classList.add("is-flipped");
    card3d.style.transform = "";
  } else {
    card3d.classList.remove("is-flipped");
    card3d.style.transform = "";
  }
}

// ── Field: Card Number ────────────────────────
fCardNumber.addEventListener("input", (e) => {
  const raw = e.target.value.replace(/\D/g, "");
  updateCardType(raw);

  const formatted = formatCardNumber(raw);
  e.target.maxLength = getMaxLength();
  e.target.value = formatted;

  renderDisplayNumber(formatted);
});

fCardNumber.addEventListener("focus", () => flipCard(false));
fCardNumber.addEventListener("blur",  () => validateField("number"));

// ── Field: Cardholder Name ────────────────────
fCardName.addEventListener("input", (e) => {
  const val = e.target.value.toUpperCase().slice(0, 26);
  displayName.textContent = val || "FULL NAME";
});

fCardName.addEventListener("focus", () => flipCard(false));
fCardName.addEventListener("blur",  () => validateField("name"));

// ── Field: Expiry ─────────────────────────────
fCardExpiry.addEventListener("input", (e) => {
  let raw = e.target.value.replace(/\D/g, "");
  if (raw.length > 4) raw = raw.slice(0, 4);
  if (raw.length >= 3) {
    raw = raw.slice(0, 2) + "/" + raw.slice(2);
  }
  e.target.value = raw;
  displayExpiry.textContent = raw || "MM/YY";
});

fCardExpiry.addEventListener("focus", () => flipCard(false));
fCardExpiry.addEventListener("blur",  () => validateField("expiry"));

// ── Field: CVV ────────────────────────────────
fCardCvv.addEventListener("input", (e) => {
  const raw = e.target.value.replace(/\D/g, "");
  e.target.value = raw;
  const len = CARD_PATTERNS[cardType]?.cvvLen || 3;
  displayCvv.textContent = raw.padEnd(len, "•").slice(0, len);
});

fCardCvv.addEventListener("focus", () => {
  flipCard(true);
  displayCvv.textContent = fCardCvv.value || "•••";
});

fCardCvv.addEventListener("blur", () => {
  flipCard(false);
  validateField("cvv");
});

// ── CVV tooltip ───────────────────────────────
cvvHelp.addEventListener("click", (e) => {
  e.preventDefault();
  cvvTooltip.classList.toggle("visible");
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#fg-cvv")) cvvTooltip.classList.remove("visible");
});

// ── Test card click-to-fill ───────────────────
document.querySelectorAll(".test-card").forEach((el) => {
  el.addEventListener("click", () => {
    const num = el.dataset.number;
    fCardNumber.value = num;
    fCardNumber.dispatchEvent(new Event("input"));
    fCardName.value = "TEST CARDHOLDER";
    fCardName.dispatchEvent(new Event("input"));
    fCardExpiry.value = "12/28";
    fCardExpiry.dispatchEvent(new Event("input"));
    fCardCvv.value = "123";
    fCardCvv.dispatchEvent(new Event("input"));
    clearAllErrors();
  });
});

// ── Validation ────────────────────────────────
function setError(field, msg) {
  const fg  = document.getElementById(`fg-${field}`);
  const err = document.getElementById(`err-${field}`);
  if (!fg || !err) return;
  fg.classList.add("has-error");
  fg.classList.remove("is-valid");
  err.textContent = msg;
}

function setValid(field) {
  const fg  = document.getElementById(`fg-${field}`);
  const err = document.getElementById(`err-${field}`);
  if (!fg || !err) return;
  fg.classList.remove("has-error");
  fg.classList.add("is-valid");
  err.textContent = "";
}

function clearAllErrors() {
  ["number", "name", "expiry", "cvv"].forEach((f) => {
    const fg  = document.getElementById(`fg-${f}`);
    const err = document.getElementById(`err-${f}`);
    if (fg) { fg.classList.remove("has-error", "is-valid"); }
    if (err) { err.textContent = ""; }
  });
}

function validateField(field) {
  switch (field) {
    case "number": {
      const digits = fCardNumber.value.replace(/\D/g, "");
      const maxDig = CARD_PATTERNS[cardType]?.max || 16;
      if (!digits)                setError("number", "Card number is required.");
      else if (digits.length < maxDig) setError("number", `Enter a valid ${maxDig}-digit card number.`);
      else if (!luhnCheck(digits)) setError("number", "This card number is invalid.");
      else                         setValid("number");
      break;
    }
    case "name": {
      const val = fCardName.value.trim();
      if (!val)              setError("name", "Cardholder name is required.");
      else if (val.length < 2) setError("name", "Please enter the full name.");
      else                     setValid("name");
      break;
    }
    case "expiry": {
      const val = fCardExpiry.value;
      const [mm, yy] = val.split("/");
      const month = parseInt(mm, 10);
      const year  = 2000 + parseInt(yy, 10);
      const now   = new Date();
      if (!val || val.length < 5)     setError("expiry", "Enter expiry as MM/YY.");
      else if (month < 1 || month > 12) setError("expiry", "Invalid month.");
      else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1))
                                       setError("expiry", "This card has expired.");
      else                             setValid("expiry");
      break;
    }
    case "cvv": {
      const val = fCardCvv.value;
      const len = CARD_PATTERNS[cardType]?.cvvLen || 3;
      if (!val)                setError("cvv", "CVV is required.");
      else if (val.length < len) setError("cvv", `CVV must be ${len} digits.`);
      else                       setValid("cvv");
      break;
    }
  }
}

// Luhn algorithm for card number validation
function luhnCheck(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function validateAll() {
  ["number", "name", "expiry", "cvv"].forEach(validateField);
  return document.querySelectorAll(".field-group.has-error").length === 0;
}

// ── Payment simulation ────────────────────────
function simulatePayment(cardDigits) {
  return new Promise((resolve) => {
    const prefix4 = cardDigits.slice(0, 4);
    const prefix8 = cardDigits.slice(0, 8);

    // Deliberately mapped outcomes
    if (prefix4 === "4242" || prefix4 === "5555" || prefix4 === "3782" || prefix4 === "3714") {
      setTimeout(() => resolve({ outcome: "success", code: "PAYMENT_APPROVED", authCode: randomHex(6) }), 2000);
    } else if (prefix4 === "4000" || prefix8 === "40000000") {
      setTimeout(() => resolve({ outcome: "declined", code: "CARD_DECLINED", message: "Your bank declined this transaction. Please contact your card issuer or try a different card." }), 1500);
    } else {
      // Other cards: 70% success, 20% declined, 10% failed
      const roll = Math.random();
      setTimeout(() => {
        if (roll < 0.70) resolve({ outcome: "success",  code: "PAYMENT_APPROVED", authCode: randomHex(6) });
        else if (roll < 0.90) resolve({ outcome: "declined", code: "INSUFFICIENT_FUNDS", message: "Insufficient funds. Please try another card or payment method." });
        else resolve({ outcome: "failed",   code: "PROCESSING_ERROR", message: "A technical error occurred. Please try again." });
      }, 1800);
    }
  });
}

function randomHex(n) {
  return Array.from({ length: n }, () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)]).join("");
}

// ── Form submit ───────────────────────────────
payForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateAll()) return;

  // Loading state
  payBtn.classList.add("loading");
  payBtn.disabled = true;
  payBtnLabel.style.opacity = "0";
  payBtnAmount.style.opacity = "0";
  payBtnSpinner.style.opacity = "1";

  const digits = fCardNumber.value.replace(/\D/g, "");
  const result = await simulatePayment(digits);

  // Enrich with order & card data
  const breakdown = order?.breakdown || { subtotal: 0, serviceFee: 0, tax: 0, total: 0 };
  const resultPayload = {
    outcome:    result.outcome,
    code:       result.code,
    authCode:   result.authCode || null,
    message:    result.message || null,
    total:      breakdown.total,
    breakdown,
    order,
    cardLast4:  digits.slice(-4),
    cardType,
    timestamp:  Date.now(),
  };

  sessionStorage.setItem("gourmet_payment_result", JSON.stringify(resultPayload));
  window.location.href = "../404.html";
});

// ── Order summary mini render ─────────────────
function renderOrderSummary() {
  if (!order) {
    document.getElementById("orderSummaryMini").style.display = "none";
    return;
  }

  // Items
  order.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "mini-item";
    row.innerHTML = `
      <span class="mini-item-name">${item.name}<span class="mini-item-qty">×${item.quantity}</span></span>
      <span class="mini-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
    `;
    miniItems.appendChild(row);
  });

  if (order.promo) {
    const row = document.createElement("div");
    row.className = "mini-item";
    row.innerHTML = `
      <span class="mini-item-name" style="color:#34d399">${order.promo.name}</span>
      <span class="mini-item-price" style="color:#34d399">-$${Math.abs(order.promo.price).toFixed(2)}</span>
    `;
    miniItems.appendChild(row);
  }

  // Totals
  const b = order.breakdown;
  const rows = [
    ["Subtotal",    b.subtotal],
    ["Service Fee", b.serviceFee],
    ["Tax",         b.tax],
  ];

  rows.forEach(([label, val]) => {
    const row = document.createElement("div");
    row.className = "mini-total-row";
    row.innerHTML = `<span class="mini-total-label">${label}</span><span class="mini-total-value">$${val.toFixed(2)}</span>`;
    miniTotals.appendChild(row);
  });

  const grandRow = document.createElement("div");
  grandRow.className = "mini-total-row grand-total";
  grandRow.innerHTML = `<span class="mini-total-label">Total</span><span class="mini-total-value">$${b.total.toFixed(2)}</span>`;
  miniTotals.appendChild(grandRow);

  // Set pay button amount
  payBtnAmount.textContent = `${b.total.toFixed(2)}`;
}

// ── Boot ──────────────────────────────────────
renderOrderSummary();
renderDisplayNumber("");

// Init input icon
inputCardIcon.innerHTML = NETWORK_ICONS.default;
