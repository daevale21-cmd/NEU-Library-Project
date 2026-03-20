/* ============================================================
   dashboard.js — Admin Dashboard Logic
   NEU Library VMS v2
   ============================================================ */

import { requireAdmin, logoutUser, fullName, initials } from "./auth.js";
import { getAllVisits, getVisitsToday, getVisitsThisWeek,
         getVisitsThisMonth, getVisitsByRange } from "./visits.js";
import { getAllUsers, toggleBlock } from "./users.js";

/* ── Auth guard ─────────────────────────────────────────── */
const admin = await requireAdmin();
document.getElementById("sb-avatar").textContent = initials(admin);
document.getElementById("sb-name").textContent   = fullName(admin);
document.getElementById("btn-signout").addEventListener("click", logoutUser);

/* ── Clock ──────────────────────────────────────────────── */
function tick() {
  document.getElementById("time-chip").textContent = new Date().toLocaleString("en-PH", {
    timeZone:  "Asia/Manila",
    weekday:   "long",
    month:     "long",
    day:       "numeric",
    year:      "numeric",
    hour:      "2-digit",
    minute:    "2-digit",
    second:    "2-digit",
    hour12:    true
  });
}
tick(); setInterval(tick, 1000);

/* ── Section navigation ─────────────────────────────────── */
const sectionMeta = {
  overview: { title:"Dashboard Overview",   sub:"Visitor statistics at a glance" },
  logs:     { title:"Visitor Logs",          sub:"Browse and search all visit records" },
  users:    { title:"User Management",       sub:"View, block, or unblock registered users" },
  reports:  { title:"Generate Reports",      sub:"Download PDF reports for any period" },
};

document.querySelectorAll(".nav-link[data-section]").forEach(btn => {
  btn.addEventListener("click", () => activateSection(btn.dataset.section, btn));
});

function activateSection(name, btn) {
  document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  (btn || document.querySelector(`[data-section="${name}"]`))?.classList.add("active");
  document.getElementById(`section-${name}`)?.classList.add("active");

  const m = sectionMeta[name];
  document.getElementById("topbar-title").textContent = m?.title || "";
  document.getElementById("topbar-sub").textContent   = m?.sub   || "";

  if (name === "overview") renderOverview();
  if (name === "logs")     loadLogs();
  if (name === "users")    loadUsers();
}

/* ── Filter state ───────────────────────────────────────── */
let currentFilter = "today";
let customFrom = null, customTo = null;

document.querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    document.getElementById("custom-dates").classList.toggle("hidden", currentFilter !== "custom");
    if (currentFilter !== "custom") renderOverview();
  });
});

document.getElementById("btn-apply-range").addEventListener("click", () => {
  customFrom = document.getElementById("range-from").value;
  customTo   = document.getElementById("range-to").value;
  if (!customFrom || !customTo) { alert("Select both dates."); return; }
  renderOverview();
});

async function fetchFiltered() {
  switch (currentFilter) {
    case "today":  return getVisitsToday();
    case "week":   return getVisitsThisWeek();
    case "month":  return getVisitsThisMonth();
    case "custom": return (customFrom && customTo)
                     ? getVisitsByRange(customFrom, customTo) : [];
    default:       return getAllVisits();
  }
}

/* ── CHARTS ─────────────────────────────────────────────── */
let chartTrend, chartCollege, chartPurpose, chartHour;

const BLUE_PALETTE = ["#1649c0","#f0b429","#16a362","#e05b3a","#6c5ce7","#2f5fd4","#0b1d3a","#b3c6f7"];

async function renderOverview() {
  const [visits, users] = await Promise.all([fetchFiltered(), getAllUsers()]);
  const todayVisits = await getVisitsToday();

  document.getElementById("s-total").textContent    = visits.length;
  document.getElementById("s-today").textContent    = todayVisits.length;
  document.getElementById("s-colleges").textContent = new Set(visits.map(v=>v.college)).size;
  document.getElementById("s-blocked").textContent  = users.filter(u=>u.isBlocked).length;

  buildTrendChart(visits);
  buildCollegeChart(visits);
  buildPurposeChart(visits);
  buildHourChart(visits);
}

function buildTrendChart(visits) {
  const by = {};
  visits.forEach(v => {
    const ts = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.createdAt);
    const k = ts.toLocaleDateString("en-PH", { month:"short", day:"numeric" });
    by[k] = (by[k]||0) + 1;
  });
  const labels = Object.keys(by);
  const data   = labels.map(k => by[k]);

  if (chartTrend) chartTrend.destroy();
  chartTrend = new Chart(document.getElementById("chart-trend"), {
    type:"line",
    data:{ labels, datasets:[{
      label:"Visitors", data,
      borderColor:"#1649c0", backgroundColor:"rgba(22,73,192,.08)",
      fill:true, tension:.4, pointBackgroundColor:"#1649c0",
      pointRadius:4, borderWidth:2
    }]},
    options:{ responsive:true, plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } },
               x:{ ticks:{ maxTicksLimit:8, maxRotation:30 } } } }
  });
}

function buildCollegeChart(visits) {
  const counts = {};
  visits.forEach(v => {
    const short = v.college.replace("College of ","").substring(0,14);
    counts[short] = (counts[short]||0) + 1;
  });
  const labels = Object.keys(counts);
  const data   = labels.map(k => counts[k]);

  if (chartCollege) chartCollege.destroy();
  chartCollege = new Chart(document.getElementById("chart-college"), {
    type:"doughnut",
    data:{ labels, datasets:[{ data, backgroundColor:BLUE_PALETTE, borderWidth:2, borderColor:"#fff" }]},
    options:{ responsive:true, plugins:{ legend:{ position:"bottom", labels:{ font:{ size:10 }, padding:8, boxWidth:10 } } } }
  });
}

function buildPurposeChart(visits) {
  const counts = {};
  visits.forEach(v => { counts[v.purpose] = (counts[v.purpose]||0) + 1; });
  const labels = Object.keys(counts);
  const data   = labels.map(k => counts[k]);

  if (chartPurpose) chartPurpose.destroy();
  chartPurpose = new Chart(document.getElementById("chart-purpose"), {
    type:"bar",
    data:{ labels, datasets:[{ data, backgroundColor:BLUE_PALETTE, borderRadius:5, borderSkipped:false }]},
    options:{ indexAxis:"y", responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{ x:{ beginAtZero:true, ticks:{ stepSize:1 } } } }
  });
}

function buildHourChart(visits) {
  const hours = Array(24).fill(0);
  visits.forEach(v => {
    const ts = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.createdAt);
    hours[ts.getHours()]++;
  });
  const labels = hours.map((_,i) => `${String(i).padStart(2,"0")}:00`);

  if (chartHour) chartHour.destroy();
  chartHour = new Chart(document.getElementById("chart-hour"), {
    type:"bar",
    data:{ labels, datasets:[{ data:hours, backgroundColor:"rgba(22,73,192,.25)",
      hoverBackgroundColor:"#1649c0", borderRadius:3 }]},
    options:{ responsive:true, plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } },
               x:{ ticks:{ maxTicksLimit:12, maxRotation:45 } } } }
  });
}

/* ── VISITOR LOGS TABLE ─────────────────────────────────── */
let allLogs = [];

async function loadLogs() {
  allLogs = await getAllVisits();
  renderLogs(allLogs);
}

function renderLogs(list) {
  const tbody = document.getElementById("logs-tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No records found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(v => {
    const ts = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.createdAt);
    const dateStr = ts.toLocaleDateString("en-PH", {
      timeZone:"Asia/Manila", weekday:"short", year:"numeric", month:"short", day:"numeric"
    });
    const timeStr = ts.toLocaleTimeString("en-PH", {
      timeZone:"Asia/Manila", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true
    });
    return `<tr>
      <td>${dateStr}</td>
      <td class="td-time">${timeStr}</td>
      <td class="td-name">${esc(v.name)}</td>
      <td class="td-email">${esc(v.email)}</td>
      <td>${esc(v.college)}</td>
      <td>${esc(v.purpose)}</td>
    </tr>`;
  }).join("");
}

document.getElementById("log-search").addEventListener("input", function() {
  const q = this.value.toLowerCase();
  renderLogs(q ? allLogs.filter(v =>
    v.name?.toLowerCase().includes(q) ||
    v.email?.toLowerCase().includes(q) ||
    v.college?.toLowerCase().includes(q)
  ) : allLogs);
});

document.getElementById("btn-csv").addEventListener("click", () => {
  const rows = [["Date","Check-In Time","Name","Email","College","Purpose"],
    ...allLogs.map(v => {
      const ts = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.createdAt);
      const dateStr = ts.toLocaleDateString("en-PH",{timeZone:"Asia/Manila"});
      const timeStr = ts.toLocaleTimeString("en-PH",{timeZone:"Asia/Manila",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});
      return [dateStr, timeStr, v.name, v.email, v.college, v.purpose];
    })
  ];
  const csv  = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const a    = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `neu-library-logs-${new Date().toISOString().split("T")[0]}.csv`
  });
  a.click(); URL.revokeObjectURL(a.href);
});

/* ── USERS TABLE ────────────────────────────────────────── */
let allUsers = [];

async function loadUsers() {
  allUsers = await getAllUsers();
  renderUsers(allUsers.filter(u => u.role !== "admin"));
}

function renderUsers(list) {
  const tbody = document.getElementById("users-tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No users found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td>${esc(u.schoolId)}</td>
      <td class="td-name">${esc((u.firstName||"")+" "+(u.lastName||""))}</td>
      <td class="td-email">${esc(u.email)}</td>
      <td>${esc(u.college)}</td>
      <td><span class="badge ${u.isBlocked?"badge-blocked":"badge-active"}">
        ${u.isBlocked?"Blocked":"Active"}
      </span></td>
      <td>
        <button class="${u.isBlocked?"btn btn-success-sm":"btn btn-danger"}"
                data-uid="${u.uid}" data-blocked="${u.isBlocked}">
          ${u.isBlocked?"Unblock":"Block"}
        </button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-uid]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid       = btn.dataset.uid;
      const isBlocked = btn.dataset.blocked === "true";
      btn.disabled = true;
      await toggleBlock(uid, isBlocked);
      await loadUsers();
      // Refresh blocked count on overview
      document.getElementById("s-blocked").textContent =
        allUsers.filter(u=>u.isBlocked).length;
    });
  });
}

document.getElementById("user-search").addEventListener("input", function() {
  const q = this.value.toLowerCase();
  const filtered = allUsers.filter(u => u.role !== "admin").filter(u =>
    !q ||
    (u.firstName+" "+u.lastName).toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q)
  );
  renderUsers(filtered);
});

/* ── REPORT TYPE CARDS ──────────────────────────────────── */
document.querySelectorAll(".report-option-card").forEach(card => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".report-option-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
  });
});

document.getElementById("rpt-period").addEventListener("change", function() {
  const custom = this.value === "custom";
  document.getElementById("rpt-from-field").classList.toggle("hidden", !custom);
  document.getElementById("rpt-to-field").classList.toggle("hidden", !custom);
});

/* ── HELPERS ────────────────────────────────────────────── */
function esc(s) {
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ── INITIAL LOAD ───────────────────────────────────────── */
renderOverview();

/* ── EXPORT for reports.js ──────────────────────────────── */
export { fetchFiltered, getAllVisits };
