// script.js

const SHEET_ID = "15121EMhmrUMDrdkcr9vbePnMGtI67ilEYICaoAkFiDM";
const SHEET_NAME = "Data";
const WRITE_URL = "https://script.google.com/macros/s/AKfycbxfCKH07OQ7-X5HDqRpsyzKkTXEvG5AO2NTZKYs3TdYZAEu08hfO2Y8ZheggiIghcXM/exec";

const DB_NAME = "CaptionPOC";
const STORE_NAME = "entries";

// --- IndexedDB utility ---
function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e);
  });
}

async function saveToIndexedDB(dataArray) {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.clear();
  dataArray.forEach(entry => store.add(entry));
  return tx.complete;
}

async function getAllFromIndexedDB() {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Sync from Google Sheets ---
async function syncFromGoogleSheets() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));

    const rows = json.table.rows.map(row => ({
      hashtag: row.c[0]?.v || "",
      identifiers: row.c[1]?.v || "",
      platforms: row.c[2]?.v || "",
      type: row.c[3]?.v || "",
      timestamp: row.c[4]?.v || ""
    }));

    await saveToIndexedDB(rows);
    logOutput("✅ Synced from Google Sheets:", rows);
  } catch (err) {
    logOutput("❌ Sync failed:", err);
  }
}

// --- Show Local Data ---
async function showLocalData() {
  const data = await getAllFromIndexedDB();
  if (!data.length) {
    logOutput("📦 Local IndexedDB:", "No data found.");
    return;
  }

  const formatted = data.map(entry => {
    return `🔹 ${entry.hashtag}
  Type: ${entry.type}
  Platforms: ${entry.platforms}
  Identifiers: ${entry.identifiers}
  Timestamp: ${entry.timestamp}`;
  }).join("\n\n");

  logOutput("📦 Local IndexedDB:", formatted);
}

// --- Push New Value to Google Sheets ---
async function pushToGoogleSheets() {
  const formData = new FormData();
  formData.append("hashtag", "#creativevision");
  formData.append("type", "Niche");
  formData.append("identifiers", "digital art, creative, inspiring");
  formData.append("platforms", "Instagram, TikTok");

  try {
    const res = await fetch(WRITE_URL, {
      method: "POST",
      body: formData
    });

    const resultText = await res.text();
    logOutput("📤 Push Result:", resultText);
  } catch (err) {
    logOutput("❌ Push failed:", err);
  }
}

// --- Log Output Helper ---
function logOutput(title, data) {
  const output = document.getElementById("output");
  output.textContent = `${title}\n\n` + JSON.stringify(data, null, 2);
}
