/* ============================================================
   auth.js — Authentication & User Profile Logic
   NEU Library VMS v2
   ============================================================ */

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── HARDCODED ADMIN EMAILS ─────────────────────────────── */
export const ADMIN_EMAILS = [
  "admin@neu.edu.ph",
  "librarian@neu.edu.ph",
  // Add more admin institutional emails here
];

const NEU_DOMAIN = "@neu.edu.ph";
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: "neu.edu.ph" }); // hint: restrict to NEU domain

/* ── Domain check ──────────────────────────────────────── */
export function isNEUEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith(NEU_DOMAIN);
}

/* ── Get full name ─────────────────────────────────────── */
export function fullName(user) {
  const mi = user.mi ? ` ${user.mi}` : "";
  return `${user.firstName}${mi} ${user.lastName}`;
}

/* ── Get initials ──────────────────────────────────────── */
export function initials(user) {
  return (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "");
}

/* ── Register new user (email/password) ────────────────── */
export async function registerUser(fields) {
  const {
    schoolId, firstName, mi, lastName,
    email, college, program, password
  } = fields;

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid  = cred.user.uid;

  const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

  await setDoc(doc(db, "users", uid), {
    uid, schoolId,
    firstName, mi: mi || "", lastName,
    email: email.toLowerCase(),
    college, program,
    role:      isAdmin ? "admin" : "visitor",
    isBlocked: false,
    createdAt: serverTimestamp()
  });

  return cred.user;
}

/* ── Create Firestore profile for Google-authenticated user */
export async function createProfileFromGoogle({ uid, schoolId, firstName, mi, lastName, email, college, program }) {
  const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
  await setDoc(doc(db, "users", uid), {
    uid, schoolId,
    firstName, mi: mi || "", lastName,
    email: email.toLowerCase(),
    college, program,
    role:      isAdmin ? "admin" : "visitor",
    isBlocked: false,
    createdAt: serverTimestamp()
  });
}

/* ── Google Sign-In ─────────────────────────────────────── */
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;

  if (!isNEUEmail(user.email)) {
    await signOut(auth);
    throw new Error("Only @neu.edu.ph Google accounts are allowed.");
  }

  // Check if Firestore profile exists
  const snap = await getDoc(doc(db, "users", user.uid));
  const isNew = !snap.exists();

  return { user, isNew };
}

/* ── Sign in (email/password) ───────────────────────────── */
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/* ── Fetch Firestore user profile ──────────────────────── */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("User profile not found.");
  const data = snap.data();

  // Dynamically assign admin role if email matches hardcoded list
  if (ADMIN_EMAILS.includes(data.email?.toLowerCase()) && data.role !== "admin") {
    data.role = "admin";
  }

  return data;
}

/* ── Sign out ──────────────────────────────────────────── */
export async function logoutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

/* ── Auth state listener ────────────────────────────────── */
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/* ── Require auth guard ─────────────────────────────────── */
export function requireAuth(redirectTo = "index.html") {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      unsub();
      if (!firebaseUser) {
        window.location.href = redirectTo;
        return;
      }
      const profile = await getUserProfile(firebaseUser.uid);
      if (profile.isBlocked) {
        await signOut(auth);
        window.location.href = redirectTo + "?blocked=1";
        return;
      }
      resolve(profile);
    });
  });
}

/* ── Require admin guard ────────────────────────────────── */
export function requireAdmin() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      unsub();
      if (!firebaseUser) { window.location.href = "index.html"; return; }
      const profile = await getUserProfile(firebaseUser.uid);
      const isAdmin = profile.role === "admin" || ADMIN_EMAILS.includes(profile.email?.toLowerCase());
      if (!isAdmin) { window.location.href = "checkin.html"; return; }
      resolve(profile);
    });
  });
}
