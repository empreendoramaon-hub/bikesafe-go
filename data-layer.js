// data-layer.js - ponte entre o app e o backend (Firebase OU localStorage)
let MODE = "local";   // "firebase" ou "local"
let svc = null;       // modulo firebase-service carregado dinamicamente
let unsub = [];       // listeners para limpar depois

const AUTH_KEY = "bikesafe-demo-user";
const LOCAL_STATE_KEY = "bikesafe-go-state-v3";
const GOOGLE_DARK = "https://developers.google.com/identity/images/branding_guideline_sample_dk_rd_lg.svg";
const GOOGLE_LIGHT = "https://developers.google.com/identity/images/branding_guideline_sample_lt_rd_lg.svg";

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

function readCachedUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; }
}

function syncFirebaseUser(user) {
  const before = readCachedUser();

  if (!user) {
    if (before) {
      try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
      if (!sessionStorage.getItem("bikesafe-logout-reload")) {
        sessionStorage.setItem("bikesafe-logout-reload", "1");
        setTimeout(() => location.reload(), 120);
      }
    }
    window.__bikesafeFirebaseUser = null;
    return;
  }

  sessionStorage.removeItem("bikesafe-logout-reload");
  const appUser = appUserFromFirebase(user);
  window.__bikesafeFirebaseUser = appUser;
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(appUser)); } catch (e) {}

  const stored = readCachedUser();
  if ((!before || before.uid !== appUser.uid) && stored && stored.uid === appUser.uid) {
    setTimeout(() => location.reload(), 160);
  }
}

function normalizeSerial(value) {
  return (value || "").toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getAllKnownStolenBikes() {
  const cloud = Array.isArray(window.__bikesafeStolenBikes) ? window.__bikesafeStolenBikes : [];
  let local = [];
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || "{}");
    local = Array.isArray(saved.bikes) ? saved.bikes.filter(b => b && b.status === "stolen") : [];
  } catch (e) {}
  const byId = new Map();
  [...cloud, ...local].forEach(b => {
    if (!b) return;
    const key = b.id || `${b.serial || ""}-${b.brand || ""}-${b.model || ""}`;
    byId.set(key, b);
  });
  return [...byId.values()];
}

function injectUiCss() {
  if (document.getElementById("bikesafe-stability-css")) return;
  const css = document.createElement("style");
  css.id = "bikesafe-stability-css";
  css.textContent = `
    #themeBtn{display:flex!important;position:static!important}
    #mtbg-theme-toggle{display:inline-flex!important}
    .auth-google.google-brand-btn{background:transparent!important;border:0!important;box-shadow:none!important;min-height:40px!important;padding:0!important;border-radius:6px!important;overflow:hidden;display:flex!important;align-items:center!important;justify-content:center!important;color:transparent!important}
    .auth-google.google-brand-btn img{height:40px;width:auto;max-width:100%;display:block}
    .profile-action-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
    .profile-action-btn{min-height:66px;border-radius:19px;border:1px solid var(--border);background:var(--chip);color:var(--text);font-weight:950;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:10px 12px;text-align:center}
    .profile-action-btn .mtbg-theme-toggle{position:relative;display:inline-flex;align-items:center;gap:4px;width:58px;height:30px;border-radius:999px;padding:0 6px;background:var(--surface);border:1px solid var(--border);font-size:13px;line-height:1;color:var(--text);margin:0;flex:0 0 auto;pointer-events:none}
    .profile-action-btn .mtbg-theme-thumb{position:absolute;top:50%;left:4px;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .25s ease}
    [data-theme="dark"] .profile-action-btn .mtbg-theme-thumb{left:calc(100% - 26px)}
    [data-theme="dark"] .profile-action-btn .mtbg-theme-toggle{background:#2a2a2a;border-color:#444;color:#f2f2f2}
    .install-icon{width:26px;height:26px;object-fit:contain;flex:0 0 auto}
    .delete-account-profile{width:100%;min-height:58px;border-radius:18px;border:1px solid var(--red,#ff3b30);background:transparent;color:var(--red,#ff3b30);font-weight:950;display:flex;align-items:center;justify-content:center;gap:9px;margin-top:12px;cursor:pointer}
    .profile-note{font-size:11px;color:var(--muted);line-height:1.5;margin-top:12px;padding:13px;border-radius:14px;background:var(--chip)}
    #verifyOverlay{align-items:flex-end!important;justify-content:center!important;padding:0!important;background:rgba(0,0,0,.58)!important;backdrop-filter:blur(6px)}
    #verifyOverlay>.sheet{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;top:auto!important;transform:none!important;width:100%!important;max-width:520px!important;height:auto!important;min-height:0!important;max-height:82vh!important;margin:0 auto!important;border-radius:30px 30px 0 0!important;background:var(--app-bg)!important;border:1px solid var(--border)!important;border-bottom:0!important;box-shadow:0 -20px 60px rgba(0,0,0,.42)!important;display:block!important;overflow-y:auto!important;padding:14px 18px calc(22px + var(--safe-bottom))!important}
    @media(max-width:390px){.profile-action-grid{grid-template-columns:1fr}.profile-action-btn{min-height:60px}}
  `;
  document.head.appendChild(css);
}

function refreshGoogleButton() {
  const btn = document.querySelector(".auth-google");
  if (!btn) return;
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  const src = theme === "dark" ? GOOGLE_DARK : GOOGLE_LIGHT;
  btn.classList.add("google-brand-btn");
  btn.innerHTML = '<img src="' + src + '" alt="Entrar com Google">';
}

function syncConsentVisibility() {
  const nameField = document.getElementById("nameField");
  const consentField = document.getElementById("consentField");
  if (!nameField || !consentField) return;
  consentField.style.display = nameField.style.display !== "none" ? "block" : "none";
}

function renderThemeToggleMarkup() {
  return '<span class="mtbg-theme-toggle" aria-hidden="true"><span>☀</span><span class="mtbg-theme-thumb"></span><span>☾</span></span><span>Trocar tema</span>';
}

function enhanceProfileContent() {
  const content = document.getElementById("profileContent");
  if (!content) return;
  if (content.querySelector(".profile-action-grid")) return;

  const firstCard = content.querySelector(".feed-card");
  const isVisitor = /Visitante/i.test(content.textContent || "");
  const identity = firstCard ? firstCard.outerHTML : '<div class="feed-card"><h3>Visitante</h3><p>Voce ainda nao entrou. • Modo: <b>Nuvem</b></p></div>';

  content.innerHTML =
    identity +
    '<div class="profile-action-grid">' +
      '<button type="button" class="profile-action-btn" id="profileThemeBtn">' + renderThemeToggleMarkup() + '</button>' +
      '<button type="button" class="profile-action-btn" onclick="installApp()"><img class="install-icon" src="install-app.svg" alt="" aria-hidden="true"><span>Instalar app</span></button>' +
    '</div>' +
    (isVisitor
      ? '<div class="submit-row single"><button class="action-btn primary" onclick="closeOverlay(\'profileOverlay\'); openAuthPublic()">Entrar / criar conta</button></div>'
      : '<div class="submit-row single"><button class="action-btn danger" onclick="logout()">Sair da conta</button></div>') +
    '<button type="button" class="delete-account-profile" id="deleteAccountBtn"><span>⚠</span><span>Excluir minha conta</span></button>' +
    '<div class="profile-note">Para ativar login e banco de dados reais compartilhados entre dispositivos, mantenha o Firebase configurado. Sem ele, o app roda em modo demonstracao local.</div>';

  const themeBtn = document.getElementById("profileThemeBtn");
  if (themeBtn) themeBtn.addEventListener("click", function(){ if (typeof window.toggleTheme === "function") window.toggleTheme(); setTimeout(refreshGoogleButton, 0); });
}

function patchProfile() {
  if (!window.openProfile || window.openProfile.__bikesafeStablePatch) return;
  const original = window.openProfile;
  window.openProfile = function () {
    const result = original.apply(this, arguments);
    setTimeout(enhanceProfileContent, 0);
    setTimeout(enhanceProfileContent, 200);
    return result;
  };
  window.openProfile.__bikesafeStablePatch = true;
}

function patchTheme() {
  if (!window.toggleTheme || window.toggleTheme.__bikesafeStablePatch) return;
  const original = window.toggleTheme;
  window.toggleTheme = function () {
    const result = original.apply(this, arguments);
    setTimeout(refreshGoogleButton, 0);
    return result;
  };
  window.toggleTheme.__bikesafeStablePatch = true;
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

function patchGlobalUtilities() {
  injectUiCss();
  refreshGoogleButton();
  patchAuthUI();
  patchProfile();
  patchTheme();
  patchVerifyBike();
  if (document.getElementById("profileOverlay")?.classList.contains("open")) enhanceProfileContent();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", patchGlobalUtilities, { once: true });
  else patchGlobalUtilities();
  let patchTicks = 0;
  const patchTimer = setInterval(() => {
    patchGlobalUtilities();
    patchTicks += 1;
    if (patchTicks > 40) clearInterval(patchTimer);
  }, 250);
}

export async function initDataLayer({ onBikes, onSightings, onMode, onAuth, onStolen }) {
  try {
    svc = await import("./firebase-service.js?v=12");
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
