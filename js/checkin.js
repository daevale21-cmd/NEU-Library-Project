/* ============================================================
   checkin.js — Visitor Check-In Logic
   NEU Library VMS v2
   ============================================================ */

import { requireAuth, logoutUser, fullName, initials } from "./auth.js";
import { logVisit } from "./visits.js";

/* ── Auth guard ─────────────────────────────────────────── */
const user = await requireAuth();

/* ── PH Real-Time Clock ─────────────────────────────────── */
function tickClock() {
  const now = new Date();
  const str = now.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short", month: "short", day: "numeric",
    year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true
  });
  const el = document.getElementById("nav-clock");
  if (el) el.textContent = str;
}
tickClock();
setInterval(tickClock, 1000);

/* ── Populate UI with user info ─────────────────────────── */
const inits = initials(user);
const name  = fullName(user);

document.getElementById("nav-avatar").textContent   = inits;
document.getElementById("nav-name").textContent     = name;
document.getElementById("ci-avatar").textContent    = inits;
document.getElementById("ci-name").textContent      = name;
document.getElementById("ci-college").textContent   = user.college;
document.getElementById("ci-email").textContent     = user.email;
document.getElementById("ci-college-input").value   = user.college;

/* ── Multi-select purpose chips ─────────────────────────── */
document.querySelectorAll(".purpose-chip input[type=checkbox]").forEach(cb => {
  cb.addEventListener("change", () => {
    cb.closest(".purpose-chip").classList.toggle("selected", cb.checked);

    // Show/hide the "Other" text field
    const otherCb = document.getElementById("chip-other");
    document.getElementById("other-field")
      .classList.toggle("hidden", !otherCb?.checked);
  });
});

/* ── Logout buttons ─────────────────────────────────────── */
document.getElementById("btn-logout").addEventListener("click", logoutUser);
document.getElementById("btn-logout-success").addEventListener("click", logoutUser);

/* ── Check-in ───────────────────────────────────────────── */
document.getElementById("btn-checkin").addEventListener("click", handleCheckin);

async function handleCheckin() {
  const alertEl = document.getElementById("ci-alert");
  alertEl.classList.add("hidden");

  // Collect all checked purposes
  const checked = [...document.querySelectorAll(".purpose-chip input:checked")]
    .map(cb => cb.value);

  if (!checked.length) {
    alertEl.textContent = "Please select at least one purpose of visit.";
    alertEl.classList.remove("hidden");
    return;
  }

  // If "Other" is checked, get the text
  let purposes = [...checked];
  if (purposes.includes("Other")) {
    const txt = document.getElementById("ci-other").value.trim();
    if (!txt) {
      alertEl.textContent = "Please describe your other purpose.";
      alertEl.classList.remove("hidden");
      return;
    }
    purposes = purposes.filter(p => p !== "Other");
    purposes.push(txt);
  }

  const purposeStr = purposes.join(", ");

  const btn = document.getElementById("btn-checkin");
  btn.disabled = true;
  btn.textContent = "Logging visit…";

  try {
    await logVisit({
      uid:     user.uid,
      name:    name,
      email:   user.email,
      college: user.college,
      purpose: purposeStr
    });
    showSuccess(purposeStr);
  } catch (err) {
    alertEl.textContent = "Failed to log visit: " + err.message;
    alertEl.classList.remove("hidden");
    btn.disabled = false;
    btn.innerHTML = "✅ &nbsp;Check In to Library";
  }
}

/* ── Success screen ─────────────────────────────────────── */
function showSuccess(purpose) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const timeStr = now.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });

  document.getElementById("visit-summary").innerHTML = `
    <div class="visit-summary-row">
      <span class="vs-key">Name</span>
      <span class="vs-value">${name}</span>
    </div>
    <div class="visit-summary-row">
      <span class="vs-key">College / Office</span>
      <span class="vs-value">${user.college}</span>
    </div>
    <div class="visit-summary-row">
      <span class="vs-key">Purpose</span>
      <span class="vs-value">${purpose}</span>
    </div>
    <div class="visit-summary-row">
      <span class="vs-key">Date</span>
      <span class="vs-value">${dateStr}</span>
    </div>
    <div class="visit-summary-row">
      <span class="vs-key">Check-In Time</span>
      <span class="vs-value">${timeStr}</span>
    </div>
  `;

  document.getElementById("terminal-lines").innerHTML = `
    <div class="terminal-line"><span class="tk">$ </span><span class="tv">neu-library --checkin</span></div>
    <div class="terminal-line"><span class="tk">NAME    </span><span class="tv">${name}</span></div>
    <div class="terminal-line"><span class="tk">COLLEGE </span><span class="tv">${user.college}</span></div>
    <div class="terminal-line"><span class="tk">PURPOSE </span><span class="tv">${purpose}</span></div>
    <div class="terminal-line"><span class="tk">TIME    </span><span class="tv">${timeStr}</span></div>
    <div class="terminal-line"><span class="tk">STATUS  </span><span class="ts">✓ CHECK-IN SUCCESSFUL</span></div>
  `;

  document.getElementById("view-checkin").classList.add("hidden");
  document.getElementById("view-success").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Auto sign-out after 3 seconds
  startAutoSignout(3);
}

/* ── Auto sign-out countdown (3 seconds) ───────────────── */
function startAutoSignout(seconds) {
  let remaining = seconds;
  const bar      = document.getElementById("signout-progress");
  const text     = document.getElementById("signout-countdown-text");

  // Animate the progress bar
  bar.style.transition = "none";
  bar.style.width = "100%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = `width ${seconds}s linear`;
      bar.style.width = "0%";
    });
  });

  const tick = setInterval(() => {
    remaining--;
    text.textContent = remaining > 0
      ? `Signing out in ${remaining}s…`
      : "Signing out…";
    if (remaining <= 0) {
      clearInterval(tick);
      logoutUser();
    }
  }, 1000);

  // Let "Check In Again" cancel the auto sign-out
  document.getElementById("btn-again").addEventListener("click", () => {
    clearInterval(tick);
  }, { once: true });

  // "Sign Out Now" also clears the interval (logoutUser handles redirect)
  document.getElementById("btn-logout-success").addEventListener("click", () => {
    clearInterval(tick);
  }, { once: true });
}

/* ── Check-in again ─────────────────────────────────────── */
document.getElementById("btn-again").addEventListener("click", () => {
  // Uncheck all purposes
  document.querySelectorAll(".purpose-chip input[type=checkbox]").forEach(cb => {
    cb.checked = false;
    cb.closest(".purpose-chip").classList.remove("selected");
  });
  document.getElementById("other-field").classList.add("hidden");
  document.getElementById("ci-other").value = "";
  document.getElementById("ci-alert").classList.add("hidden");
  const btn = document.getElementById("btn-checkin");
  btn.disabled = false;
  btn.innerHTML = "✅ &nbsp;Check In to Library";
  document.getElementById("view-success").classList.add("hidden");
  document.getElementById("view-checkin").classList.remove("hidden");
});
