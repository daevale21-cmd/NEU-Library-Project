/* ============================================================
   login.js — Login & Register Page Logic
   NEU Library VMS v2
   ============================================================ */

import { auth }               from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  registerUser, loginUser, loginWithGoogle,
  getUserProfile, isNEUEmail, createProfileFromGoogle
} from "./auth.js";

/* ── HARDCODED ADMIN EMAILS ─────────────────────────────── */
const ADMIN_EMAILS = [
  "admin@neu.edu.ph",
  "librarian@neu.edu.ph",
  // Add more admin emails here as needed
];

/* ── Redirect if already logged in ─────────────────────── */
onAuthStateChanged(auth, async (u) => {
  if (!u) return;
  try {
    const profile = await getUserProfile(u.uid);
    handlePostLogin(profile);
  } catch { /* new user — stay on page */ }
});

/* ── Blocked param ──────────────────────────────────────── */
if (new URLSearchParams(location.search).get("blocked")) {
  showAlert("login-alert", "Your account has been blocked. Please contact library staff.");
}

/* ── Tab switching ──────────────────────────────────────── */
document.querySelectorAll(".tab-pill").forEach(btn =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab))
);
document.querySelectorAll("[data-goto]").forEach(a =>
  a.addEventListener("click", e => { e.preventDefault(); switchTab(a.dataset.goto); })
);

function switchTab(tab) {
  document.querySelectorAll(".tab-pill").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  document.querySelectorAll(".form-pane").forEach(p =>
    p.classList.toggle("active", p.id === `pane-${tab}`)
  );
  clearAlerts();
}

/* ── Password toggle ────────────────────────────────────── */
document.querySelectorAll(".pw-toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const inp = document.getElementById(btn.dataset.target);
    if (!inp) return;
    inp.type = inp.type === "password" ? "text" : "password";
    btn.textContent = inp.type === "password" ? "👁" : "🙈";
  });
});

/* ── ADMIN MODAL ─────────────────────────────────────────── */
document.getElementById("btn-go-dashboard").addEventListener("click", () => {
  window.location.href = "dashboard.html";
});
document.getElementById("btn-go-checkin").addEventListener("click", () => {
  window.location.href = "checkin.html";
});

function handlePostLogin(profile) {
  const isAdmin = profile.role === "admin" || ADMIN_EMAILS.includes(profile.email?.toLowerCase());
  if (isAdmin) {
    document.getElementById("admin-modal").classList.remove("hidden");
  } else {
    window.location.href = "checkin.html";
  }
}

/* ── GOOGLE LOGIN ────────────────────────────────────────── */
document.getElementById("btn-google-login").addEventListener("click", handleGoogleLogin);

async function handleGoogleLogin() {
  clearAlerts();
  setBtnLoading("btn-google-login", true, "Signing in with Google…");
  try {
    const { user, isNew } = await loginWithGoogle();
    if (isNew) {
      // New Google user — pre-fill register form and redirect there
      prefillRegisterFromGoogle(user);
      setBtnLoading("btn-google-login", false, "Continue with Google");
      return;
    }
    const profile = await getUserProfile(user.uid);
    if (profile.isBlocked) throw new Error("Your account has been blocked. Contact library staff.");
    handlePostLogin(profile);
  } catch (err) {
    showAlert("login-alert", friendlyError(err.message));
  } finally {
    setBtnLoading("btn-google-login", false, "Continue with Google");
  }
}

/* ── GOOGLE REGISTER ─────────────────────────────────────── */
document.getElementById("btn-google-register").addEventListener("click", handleGoogleRegister);

async function handleGoogleRegister() {
  clearAlerts();
  setBtnLoading("btn-google-register", true, "Connecting Google…");
  try {
    const { user, isNew } = await loginWithGoogle();
    prefillRegisterFromGoogle(user);
    if (!isNew) {
      // Already registered — go straight to post-login
      const profile = await getUserProfile(user.uid);
      handlePostLogin(profile);
    }
  } catch (err) {
    showAlert("reg-alert", friendlyError(err.message));
  } finally {
    setBtnLoading("btn-google-register", false, "Register with Google");
  }
}

let _googleUid = null; // track if user came from Google for registration
let _googleProvider = false;

function prefillRegisterFromGoogle(firebaseUser) {
  _googleUid = firebaseUser.uid;
  _googleProvider = true;

  // Split display name into first / last
  const parts = (firebaseUser.displayName || "").trim().split(" ");
  const firstName = parts[0] || "";
  const lastName  = parts.slice(1).join(" ") || "";

  document.getElementById("r-email").value = firebaseUser.email || "";
  document.getElementById("r-fn").value    = firstName;
  document.getElementById("r-ln").value    = lastName;

  // Lock prefilled fields
  document.getElementById("r-email").readOnly = true;
  document.getElementById("r-fn").readOnly    = true;
  document.getElementById("r-ln").readOnly    = true;

  // Hide password fields (Google auth, no password needed)
  document.getElementById("password-fields").style.display = "none";

  // Show notice
  document.getElementById("reg-prefilled-notice").classList.remove("hidden");

  switchTab("register");
}

/* ── LOGIN ──────────────────────────────────────────────── */
document.getElementById("btn-login").addEventListener("click", handleLogin);
document.getElementById("login-pw").addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });

async function handleLogin() {
  clearAlerts();
  const id = document.getElementById("login-id").value.trim();
  const pw = document.getElementById("login-pw").value;

  if (!id || !pw) return showAlert("login-alert", "Please enter your email and password.");
  if (!isNEUEmail(id)) return showAlert("login-alert", "Only @neu.edu.ph institutional emails are allowed.");

  setBtnLoading("btn-login", true, "Signing in…");
  try {
    const user    = await loginUser(id, pw);
    const profile = await getUserProfile(user.uid);

    if (profile.isBlocked)
      throw new Error("Your account has been blocked. Contact library staff.");

    handlePostLogin(profile);
  } catch (err) {
    showAlert("login-alert", friendlyError(err.message));
  } finally {
    setBtnLoading("btn-login", false, "Sign In");
  }
}

/* ── REGISTER ───────────────────────────────────────────── */
document.getElementById("btn-register").addEventListener("click", handleRegister);

async function handleRegister() {
  clearAlerts();
  const sid     = document.getElementById("r-sid").value.trim();
  const fn      = document.getElementById("r-fn").value.trim();
  const mi      = document.getElementById("r-mi").value.trim();
  const ln      = document.getElementById("r-ln").value.trim();
  const email   = document.getElementById("r-email").value.trim().toLowerCase();
  const college = document.getElementById("r-college").value;
  const program = document.getElementById("r-prog").value.trim();

  if (!sid || !fn || !ln || !email || !college || !program)
    return showAlert("reg-alert", "Please fill in all required fields.");
  if (!isNEUEmail(email))
    return showAlert("reg-alert", "Email must end with @neu.edu.ph.");

  setBtnLoading("btn-register", true, "Creating account…");

  try {
    if (_googleProvider && _googleUid) {
      // User registered via Google — just create Firestore profile
      await createProfileFromGoogle({
        uid: _googleUid, schoolId: sid, firstName: fn, mi, lastName: ln,
        email, college, program
      });
    } else {
      const pw  = document.getElementById("r-pw").value;
      const pw2 = document.getElementById("r-pw2").value;
      if (pw.length < 6) return showAlert("reg-alert", "Password must be at least 6 characters.");
      if (pw !== pw2)    return showAlert("reg-alert", "Passwords do not match.");
      await registerUser({ schoolId: sid, firstName: fn, mi, lastName: ln,
                           email, college, program, password: pw });
    }
    document.getElementById("reg-ok").textContent = "✅ Account created! You can now sign in.";
    document.getElementById("reg-ok").classList.remove("hidden");
    setTimeout(() => switchTab("login"), 1600);
  } catch (err) {
    showAlert("reg-alert", friendlyError(err.message));
  } finally {
    setBtnLoading("btn-register", false, "Create Account");
  }
}

/* ── UTILS ──────────────────────────────────────────────── */
function showAlert(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearAlerts() {
  ["login-alert","reg-alert","reg-ok"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; el.classList.add("hidden"); }
  });
}
function setBtnLoading(id, loading, text) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  // preserve icon for google buttons
  if (id.includes("google")) {
    if (loading) btn.dataset.origHtml = btn.innerHTML;
    btn.innerHTML = loading
      ? `<span style="opacity:.6">${text}</span>`
      : (btn.dataset.origHtml || text);
  } else {
    btn.textContent = text;
  }
}
function friendlyError(msg) {
  if (msg.includes("email-already-in-use")) return "This email is already registered.";
  if (msg.includes("wrong-password") || msg.includes("invalid-credential")) return "Incorrect email or password.";
  if (msg.includes("user-not-found")) return "No account found with this email.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment.";
  if (msg.includes("popup-closed")) return "Sign-in popup was closed. Please try again.";
  if (msg.includes("cancelled-popup-request")) return "Another sign-in is in progress.";
  return msg;
}
