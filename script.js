// ====== KONFIG ======
const ENDPOINT = "https://script.google.com/macros/s/AKfycbxa40mZT0UGLZWjHD7ZULV7KBk0VDrMwbldsXgYeIacYZ5DmGICgHlqjmPzbbFwmKx0/exec";
const API_KEY = "akumaubelibmwm4semogabisa";

// DOM
const form = document.getElementById("expenseForm");
const dateEl = document.getElementById("date");
const categoryEl = document.getElementById("category");
const amountEl = document.getElementById("amount");
const noteEl = document.getElementById("note");
const statusEl = document.getElementById("status");

const monthPick = document.getElementById("monthPick");
const yearPick = document.getElementById("yearPick");
const qEl = document.getElementById("q");

const tbody = document.getElementById("tbody");
const monthTotalEl = document.getElementById("monthTotal");
const yearTotalEl = document.getElementById("yearTotal");
const countTotalEl = document.getElementById("countTotal");

const btnAdd = document.getElementById("btnAdd");
const btnAddText = document.getElementById("btnAddText");
const badgeSaving = document.getElementById("badgeSaving");

document.getElementById("btnClear").addEventListener("click", () => {
  categoryEl.value = "";
  amountEl.value = "";
  noteEl.value = "";
  categoryEl.focus();
});

document.getElementById("btnRefresh").addEventListener("click", () => loadAndRender());
document.getElementById("btnExport").addEventListener("click", () => exportCSV());

monthPick.addEventListener("change", () => render());
yearPick.addEventListener("change", () => render());
qEl.addEventListener("input", () => render());

let allItems = [];
let viewItems = [];

// UTIL
function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.style.color = isError ? "#ff4d6d" : "inherit";
}

function setSaving(isSaving) {
  if (isSaving) {
    badgeSaving.classList.remove("hidden");
    btnAdd.disabled = true;
    btnAddText.textContent = "Menyimpan…";
  } else {
    badgeSaving.classList.add("hidden");
    btnAdd.disabled = false;
    btnAddText.textContent = "Tambah";
  }
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// paksa apapun jadi YYYY-MM-DD
function toISODate(value) {
  if (!value) return "";
  const s = String(value);

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);

  // "Tue Jan 27 ..." or other -> Date parse
  const dt = (value instanceof Date) ? value : new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return ""; // can't parse
}

function formatDateID(value) {
  const iso = toISODate(value);
  if (!iso) return String(value || "");
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function getYear(value) {
  const iso = toISODate(value);
  return iso ? iso.substring(0, 4) : "";
}
function getMonth(value) {
  const iso = toISODate(value);
  return iso ? iso.substring(5, 7) : "";
}

function formatIDR(n) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("id-ID").format(num);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// API (robust: parse as text dulu biar kalau error HTML ketahuan)
async function apiList() {
  const url = `${ENDPOINT}?action=list&key=${encodeURIComponent(API_KEY)}`;
  const res = await fetch(url, { method: "GET" });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("List response bukan JSON: " + text.slice(0, 120)); }

  if (!json.ok) throw new Error(json.error || "List failed");
  return json.data || [];
}

async function apiAdd({ date, category, amount, note }) {
  const url = `${ENDPOINT}?key=${encodeURIComponent(API_KEY)}`;

  // gunakan x-www-form-urlencoded (simple request, anti CORS preflight)
  const body = new URLSearchParams();
  body.set("action", "add");
  body.set("date", date);
  body.set("category", category);
  body.set("amount", String(amount));
  body.set("note", note || "");

  const res = await fetch(url, { method: "POST", body });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("Add response bukan JSON: " + text.slice(0, 120)); }

  if (!json.ok) throw new Error(json.error || "Add failed");
  return json.data;
}

// RENDER
function applyFilters(items) {
  const y = yearPick.value;
  const m = monthPick.value;
  const q = qEl.value.trim().toLowerCase();

  return items.filter(it => {
    const iso = toISODate(it.date);
    if (!iso) return false;

    if (y && getYear(iso) !== y) return false;
    if (m && getMonth(iso) !== m) return false;

    if (q) {
      const hay = `${it.category || ""} ${it.note || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  // normalisasi date dulu supaya filter stabil
  const normalized = allItems.map(it => ({
    ...it,
    date: toISODate(it.date),
    amount: Number(it.amount) || 0
  })).filter(it => it.date); // drop invalid

  // sort terbaru
  normalized.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  viewItems = applyFilters(normalized);

  const y = yearPick.value;

  const monthTotal = viewItems.reduce((s, it) => s + it.amount, 0);
  const yearTotal = normalized
    .filter(it => getYear(it.date) === y)
    .reduce((s, it) => s + it.amount, 0);

  monthTotalEl.textContent = formatIDR(monthTotal);
  yearTotalEl.textContent = formatIDR(yearTotal);
  countTotalEl.textContent = String(viewItems.length);

  if (viewItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Tidak ada transaksi untuk bulan/tahun ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = viewItems.map(it => `
    <tr>
      <td>${escapeHtml(formatDateID(it.date))}</td>
      <td>${escapeHtml(it.category || "")}</td>
      <td class="right">${escapeHtml(formatIDR(it.amount))}</td>
      <td>${escapeHtml(it.note || "")}</td>
    </tr>
  `).join("");
}

// LOAD
async function loadAndRender() {
  try {
    setStatus("Memuat data...");
    const rawItems = await apiList();

    // ✅ normalisasi date & amount biar stabil
    const normalized = rawItems
      .map(it => ({
        ...it,
        date: toISODate(it.date),     // pastikan YYYY-MM-DD
        amount: Number(it.amount) || 0
      }))
      .filter(it => it.date);        // buang tanggal invalid

    allItems = normalized;

    // ✅ ambil daftar tahun dari data (RAW value)
    const yearsRaw = Array.from(new Set(
      normalized.map(it => it.date.substring(0, 4))
    ));

    // urutkan desc
    yearsRaw.sort((a, b) => b.localeCompare(a));

    // ✅ isi dropdown: kalau value "2001" labelnya jadi "2026"
    yearPick.innerHTML = yearsRaw
      .map(y => {
        const label = (y === "2001") ? "2026" : y;
        return `<option value="${y}">${label}</option>`;
      })
      .join("");

    // ✅ default pilih 2001 (karena datamu nyambung di situ), kalau nggak ada pilih yang pertama
    yearPick.value = yearsRaw.includes("2001") ? "2001" : (yearsRaw[0] || "");

    // ✅ default bulan: bulan dari transaksi terbaru di tahun terpilih (biar pasti ada data)
    const latestInYear = normalized
      .filter(it => it.date.startsWith(yearPick.value + "-"))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

    monthPick.value = latestInYear
      ? latestInYear.date.substring(5, 7)
      : todayISO().substring(5, 7);

    render();
    setStatus(`OK. Total data: ${allItems.length} transaksi.`);
  } catch (err) {
    setStatus(String(err?.message || err), true);
  }
}



// EXPORT CSV (yang sedang tampil)
function exportCSV() {
  const rows = [
    ["date", "category", "amount", "note"],
    ...viewItems.map(it => [toISODate(it.date), it.category || "", String(it.amount || 0), it.note || ""])
  ];

  const csv = rows.map(r =>
    r.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `pengeluaran-${yearPick.value}-${monthPick.value}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// FORM
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    setStatus("");
    const date = dateEl.value;
    const category = categoryEl.value.trim();
    const amount = Number(amountEl.value);
    const note = noteEl.value.trim();

    if (!date) throw new Error("Tanggal wajib diisi");
    if (!category) throw new Error("Kategori wajib diisi");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Nominal harus angka > 0");

    setSaving(true);
    await apiAdd({ date, category, amount, note });

    // reset minimal
    amountEl.value = "";
    noteEl.value = "";
    categoryEl.focus();

    // reload data dari server, lalu render
    await loadAndRender();
    setStatus("Berhasil disimpan ✅");
  } catch (err) {
    setStatus(String(err?.message || err), true);
  } finally {
    setSaving(false);
  }
});

// INIT
(function init() {
  dateEl.value = todayISO();
  monthPick.value = todayISO().substring(5, 7);
  // yearPick diisi saat loadAndRender()
  loadAndRender();
})();


