/* ============================================================
   users.js — Firestore Users Service (Admin)
   NEU Library VMS v2
   ============================================================ */

import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc,
  updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── Get all users ─────────────────────────────────────── */
export async function getAllUsers() {
  const snap = await getDocs(
    query(collection(db, "users"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ── Toggle block/unblock ──────────────────────────────── */
export async function toggleBlock(uid, currentStatus) {
  await updateDoc(doc(db, "users", uid), { isBlocked: !currentStatus });
  return !currentStatus;
}
