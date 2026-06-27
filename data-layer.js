// data-layer.js - ponte entre o app e o backend (Firebase OU localStorage)
let MODE = "local";   // "firebase" ou "local"
let svc = null;       // modulo firebase-service carregado dinamicamente
let unsub = [];       // listeners para limpar depois

const AUTH_KEY = "bikesafe-demo-user";
const LOCAL_STATE_KEY = "bikesafe-go-state-v3";

function stopListeners() {
  unsub.forEach(fn => { try { if (typeof fn === "function") fn(); } catch (e) {} });
  unsub = [];
}

function appUserFromFirebase(user) {
  if (!user) return null;
  const email = user.email || "";
  return {
    name: user.displayName || (email ? email.split("@")[0] : "Ciclista"),
    email,
    uid: user.uid,
    firebase: true
  };
}

function syncFirebaseUser(user) {
  const before = (() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; }
  })();

  if (!user) {
    const hadCachedUser = !!before;
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
    window.__bikesafeFirebaseUser = null;
    if (hadCachedUser && !sessionStorage.getItem("bikesafe-auth-logout-sync")) {
      sessionStorage.setItem("bikesafe-auth-logout-sync", "1");
      setTimeout(() => location.reload(), 80);
    }
    return;
  }

  const appUser = appUserFromFirebase(user);
  window.__bikesafeFirebaseUser = appUser;
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(appUser)); } catch (e) {}

  const needsReload = !before || before.uid !== appUser.uid;
  if (needsReload && !sessionStorage.getItem("bikesafe-auth-login-sync")) {
    sessionStorage.setItem("bikesafe-auth-login-sync", "1");
    setTimeout(() => location.reload(), 120);
  }
}

function getAllKnownStolenBikes() {
  const cloud = Array.isArray(window.__bikesafeStolenBikes) ? window.__bikesafeStolenBikes : [];
  let local = [];
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || "{}");
    local = Array.isArray(saved.bikes) ? saved.bikes.filter(b => b && b.status === "stolen") : [];
  } catch (e) {}
  const byId = new Map();
  [...cloud, ...local].forEach(b => { if (b) byId.set(b.id || `${b.serial || ""}-${b.brand || ""}-${b.model || ""}`, b); });
  return [...byId.values()];
}

function normalizeSerial(value) {
  return (value || "").toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function patchVerifyBike() {
  window.verifySuspectBike = function () {
    const inp = document.getElementById("verifySerial");
    const box = document.getElementById("verifyResult");
    if (!inp || !box) return;

    const q = normalizeSerial(inp.value);
    if (!q) {
      box.innerHTML = '<p style="color:var(--muted,#888);font-size:13px;">Digite um número de série.</p>';
      return;
    }

    const hit = getAllKnownStolenBikes().find(b => {
      const serial = normalizeSerial(b.serial);
      return serial && (serial === q || (q.length >= 4 && serial.includes(q)));
    });

    if (hit) {
      const title = [hit.brand, hit.model].filter(Boolean).join(" ") || "Bike em alerta";
      const details = [title, hit.color].filter(Boolean).join(" • ");
      box.innerHTML =
        '<div style="border:1px solid #d12b22;background:rgba(255,59,48,.08);border-radius:14px;padding:14px;">' +
          '<div style="display:flex;align-items:center;gap:8px;font-weight:900;color:#d12b22;font-size:15px;">⚠️ ATENÇÃO: marcada como ROUBADA</div>' +
          '<p style="margin:8px 0 0;font-size:13px;color:var(--text,#111);">' + details + '</p>' +
          '<button class="report-suspect-btn" style="margin-top:10px;border-color:#d12b22;color:#d12b22;" onclick="reportSightingFor(\'' + (hit.id || "") + '\')">📍 Reportar que vi esta bike</button>' +
        '</div>';
    } else {
      box.innerHTML =
        '<div style="border:1px solid var(--border,#ddd);background:var(--chip,#f4f4f4);border-radius:14px;padding:14px;">' +
          '<div style="font-weight:900;color:var(--text,#111);font-size:14px;">Não consta como roubada</div>' +
          '<p style="margin:6px 0 0;font-size:12px;color:var(--muted,#888);">Nenhum registro de roubo encontrado para esta série na comunidade. Ainda assim, desconfie de preços muito baixos e peça nota fiscal.</p>' +
        '</div>';
    }
  };

  window.reportSightingFor = function (id) {
    try { if (typeof window.closeOverlay === "function") window.closeOverlay("verifyOverlay"); } catch (e) {}
    try { if (typeof window.openReportSighting === "function") { window.openReportSighting(id || undefined); return; } } catch (e) {}
    try { if (typeof window.openHuntCenter === "function") window.openHuntCenter(); } catch (e) {}
  };
}

function syncConsentVisibility() {
  const nameField = document.getElementById("nameField");
  const consentField = document.getElementById("consentField");
  if (!nameField || !consentField) return;
  const signupVisible = nameField.style.display !== "none";
  consentField.style.display = signupVisible ? "block" : "none";
}

function patchAuthUI() {
  if (window.toggleAuthMode && !window.toggleAuthMode.__bikesafeConsentPatched) {
    const original = window.toggleAuthMode;
    window.toggleAuthMode = function () {
      const result = original.apply(this, arguments);
      setTimeout(syncConsentVisibility, 0);
      return result;
    };
    window.toggleAuthMode.__bikesafeConsentPatched = true;
  }
  syncConsentVisibility();
}

function patchGlobalUtilities() {
  patchVerifyBike();
  patchAuthUI();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", patchGlobalUtilities, { once: true });
  else patchGlobalUtilities();
  let patchTicks = 0;
  const patchTimer = setInterval(() => {
    patchGlobalUtilities();
    patchTicks += 1;
    if (patchTicks > 30) clearInterval(patchTimer);
  }, 250);
}

export async function initDataLayer({ onBikes, onSightings, onMode, onAuth, onStolen }) {
  try {
    svc = await import("./firebase-service.js");
    await new Promise((resolve) => {
      let resolved = false;
      svc.watchAuth(async (user) => {
        stopListeners();
        syncFirebaseUser(user);

        if (!user) {
          MODE = "local";
          if (onMode) onMode("local");
          if (onAuth) onAuth(null);
          if (!resolved) { resolved = true; resolve(); }
          return;
        }

        if (onAuth) onAuth(user);
        MODE = "firebase";
        if (onMode) onMode("firebase");
        unsub.push(svc.watchMyBikes(user.uid, onBikes));
        unsub.push(svc.watchSightings(onSightings));
        if (onStolen && svc.watchStolenBikes) {
          unsub.push(svc.watchStolenBikes((list) => {
            window.__bikesafeStolenBikes = list || [];
            onStolen(list || []);
          }));
        }
        if (!resolved) { resolved = true; resolve(); }
      });
    });
  } catch (e) {
    console.warn("Firebase indisponivel, usando modo local:", e);
    MODE = "local";
    if (onMode) onMode("local");
  }
  return MODE;
}

export const isCloud = () => MODE === "firebase";

export async function saveBikeCloud(bike) {
  if (MODE !== "firebase") return null;
  return svc.createBike(svc.getUid(), bike);
}
export async function editBikeCloud(bikeId, bike) {
  if (MODE !== "firebase") return null;
  return svc.updateBike(bikeId, bike);
}
export async function removeBikeCloud(bikeId) {
  if (MODE !== "firebase") return null;
  return svc.removeBike(bikeId);
}

export async function stolenCloud(bikeId, coords) {
  if (MODE !== "firebase") return null;
  const normalizedCoords = coords && !Array.isArray(coords) ? [coords.lat, coords.lng] : coords;
  return svc.markStolen(bikeId, normalizedCoords);
}
export async function recoverCloud(bikeId) {
  if (MODE !== "firebase") return null;
  return svc.markRecovered(bikeId);
}
export async function sightingCloud(text) {
  if (MODE !== "firebase") return null;
  return svc.addSighting(svc.getUid(), text);
}
