/* ============================================================
   visits.js — Firestore Visit Log Service
   NEU Library VMS v2
   ============================================================ */

import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs,
  query, where, orderBy,
  Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const VISITS = "visits";

/* ── Log a visit ───────────────────────────────────────── */
export async function logVisit({ uid, name, email, college, purpose }) {
  return addDoc(collection(db, VISITS), {
    uid,
    name,
    email:     email.toLowerCase(),
    college,
    purpose,
    timestamp: serverTimestamp(),
    createdAt: new Date().toISOString()   // local fallback for display
  });
}

/* ── Fetch all visits ──────────────────────────────────── */
export async function getAllVisits() {
  const snap = await getDocs(
    query(collection(db, VISITS), orderBy("timestamp", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ── Fetch visits today ────────────────────────────────── */
export async function getVisitsToday() {
  const start = new Date(); start.setHours(0,0,0,0);
  return _rangeQuery(Timestamp.fromDate(start), Timestamp.now());
}

/* ── Fetch visits this week ────────────────────────────── */
export async function getVisitsThisWeek() {
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0,0,0,0);
  return _rangeQuery(Timestamp.fromDate(start), Timestamp.now());
}

/* ── Fetch visits this month ───────────────────────────── */
export async function getVisitsThisMonth() {
  const start = new Date();
  start.setDate(1); start.setHours(0,0,0,0);
  return _rangeQuery(Timestamp.fromDate(start), Timestamp.now());
}

/* ── Fetch visits by custom range ──────────────────────── */
export async function getVisitsByRange(fromStr, toStr) {
  const from = new Date(fromStr); from.setHours(0,0,0,0);
  const to   = new Date(toStr);   to.setHours(23,59,59,999);
  return _rangeQuery(Timestamp.fromDate(from), Timestamp.fromDate(to));
}

async function _rangeQuery(from, to) {
  const snap = await getDocs(
    query(
      collection(db, VISITS),
      where("timestamp", ">=", from),
      where("timestamp", "<=", to),
      orderBy("timestamp", "desc")
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
