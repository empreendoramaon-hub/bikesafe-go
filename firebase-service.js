// firebase-service.js
import { auth, db } from "./firebase-config.js";
import {
  deleteUser,
  signInAnonymously, signInWithPopup, GoogleAuthProvider, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;

// ---- AUTENTICACAO ----
export function watchAuth(onChange) {
  return onAuthStateChanged(auth, user => { currentUser = user; onChange(user); });
}
export function loginAnon() { return signInAnonymously(auth); }
export function loginGoogle() { return signInWithPopup(auth, new GoogleAuthProvider()); }
export function signupEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}
export function loginEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
export function logout() {
  return signOut(auth);
}
export function getUid() { return currentUser ? currentUser.uid : null; }

// ---- BIKES ----
export function watchMyBikes(uid, onData) {
  const q = query(collection(db, "bikes"), where("ownerId", "==", uid));
  return onSnapshot(q, snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export function watchStolenBikes(onData) {
  const q = query(collection(db, "bikes"), where("status", "==", "stolen"));
  return onSnapshot(q, snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function createBike(uid, bike) {
  const ref = await addDoc(collection(db, "bikes"), {
    ownerId: uid,
    brand: bike.brand, model: bike.model, color: bike.color,
    serial: bike.serial || "", invoice: bike.invoice || "",
    tracker: bike.tracker || "", notes: bike.notes || "",
    status: "safe", lat: bike.lat, lng: bike.lng,
    photos: (bike.photos || []).filter(Boolean),
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateBike(bikeId, bike) {
  return updateDoc(doc(db, "bikes", bikeId), {
    brand: bike.brand, model: bike.model, color: bike.color,
    serial: bike.serial || "", invoice: bike.invoice || "",
    tracker: bike.tracker || "", notes: bike.notes || "",
    photos: (bike.photos || []).filter(Boolean)
  });
}

export function markStolen(bikeId, coords) {
  const data = { status: "stolen", stolenAt: serverTimestamp() };
  if (coords) { data.lat = coords[0]; data.lng = coords[1]; }
  return updateDoc(doc(db, "bikes", bikeId), data);
}
export function markRecovered(bikeId) {
  return updateDoc(doc(db, "bikes", bikeId), { status: "safe", stolenAt: null });
}
export function removeBike(bikeId) { return deleteDoc(doc(db, "bikes", bikeId)); }

// ---- PISTAS ----
export function watchSightings(onData) {
  const q = query(collection(db, "sightings"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export function addSighting(uid, text, type = "alert") {
  return addDoc(collection(db, "sightings"), {
    authorId: uid, text, type, createdAt: serverTimestamp()
  });
}

export async function deleteAccount() {
  const u = auth.currentUser;
  if (!u) return false;
  await deleteUser(u);
  return true;
}
export function isAnonymousUser() {
  return !!(auth.currentUser && auth.currentUser.isAnonymous);
}

// ---- Layout patch BikeSafe Go ----
(function bikeSafeLayoutPatch(){
  if (typeof window === "undefined" || window.__bikeSafeLayoutPatchV9) return;
  window.__bikeSafeLayoutPatchV9 = true;

  const LOGO_SRC = "bikesafe-logo.svg";
  const INSTALL_SRC = "install-app.svg";
  const GOOGLE_DARK = "https://developers.google.com/identity/images/branding_guideline_sample_dk_rd_lg.svg";
  const GOOGLE_LIGHT = "https://developers.google.com/identity/images/branding_guideline_sample_lt_rd_lg.svg";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  function icon(name) {
    const icons = {
      garage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 22V12h6v10"></path></svg>',
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>',
      users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path></svg>'
    };
    return icons[name] || icons.search;
  }

  function installCSS() {
    if (document.getElementById("bikesafe-layout-patch-css")) return;
    const css = document.createElement("style");
    css.id = "bikesafe-layout-patch-css";
    css.textContent = `
      .brand-chip{gap:8px;min-height:42px;padding:7px 12px;overflow:hidden}
      .bikesafe-brand-logo{width:30px;height:30px;object-fit:contain;color:var(--text);flex:0 0 auto}
      .bikesafe-brand-title{font-weight:950;letter-spacing:-.03em;color:var(--text);white-space:nowrap}
      .auth-logo{display:grid;place-items:center;min-height:76px;font-size:0!important;color:var(--text)}
      .bikesafe-auth-logo{width:86px;height:86px;object-fit:contain;color:var(--text)}
      .auth-google.google-brand-btn{background:transparent!important;border:0!important;box-shadow:none!important;min-height:40px!important;padding:0!important;border-radius:6px!important;overflow:hidden;display:flex!important;align-items:center!important;justify-content:center!important}
      .auth-google.google-brand-btn img{height:40px;width:auto;max-width:100%;display:block}
      .tabs{grid-template-columns:1fr 1.22fr 1fr 1fr!important;align-items:stretch;gap:6px!important;padding:6px!important}
      .tab-btn.nav-link{min-width:0;min-height:62px;white-space:normal;line-height:1.04;text-align:center;overflow:hidden}
      .tab-btn.nav-link span{display:block;max-width:100%;overflow:hidden;text-overflow:clip}
      .tab-btn.verify-tab-btn{font-size:9.4px;padding-left:3px!important;padding-right:3px!important}
      .tab-btn.verify-tab-btn svg{width:21px!important;height:21px!important}
      #verifyBikeBtnHunt,#verifyBikeBtn{display:none!important}
      #verifyOverlay{align-items:flex-end!important;justify-content:center!important;padding:0!important;background:rgba(0,0,0,.58)!important;backdrop-filter:blur(6px)}
      #verifyOverlay>.sheet{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;top:auto!important;transform:none!important;width:100%!important;max-width:520px!important;height:auto!important;min-height:0!important;max-height:82vh!important;margin:0 auto!important;border-radius:30px 30px 0 0!important;background:var(--app-bg)!important;border:1px solid var(--border)!important;border-bottom:0!important;box-shadow:0 -20px 60px rgba(0,0,0,.42)!important;display:block!important;overflow-y:auto!important;padding:14px 18px calc(22px + var(--safe-bottom))!important}
      #verifyOverlay .sheet-head{display:grid!important;grid-template-columns:42px 1fr 42px;align-items:center;gap:8px;padding:0 0 16px!important;text-align:center}
      #verifyOverlay .sheet-head h2{font-size:22px;line-height:1.05;letter-spacing:-.6px;margin:0;grid-column:2}
      #verifyOverlay .close-btn{grid-column:1;width:42px;height:42px;font-size:22px;background:var(--chip);color:var(--text)}
      #verifyOverlay input{min-height:54px!important;border-radius:17px!important;background:var(--surface)!important}
      #verifyOverlay .report-suspect-btn{min-height:54px;border-radius:17px}
      .profile-action-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
      .profile-action-btn{min-height:66px;border-radius:19px;border:1px solid var(--border);background:var(--chip);color:var(--text);font-weight:950;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:10px 12px;text-align:center}
      .profile-action-btn .mtbg-theme-toggle{position:relative;display:inline-flex;align-items:center;gap:4px;width:58px;height:30px;border-radius:999px;padding:0 6px;background:var(--surface);border:1px solid var(--border);font-size:13px;line-height:1;color:var(--text);margin:0;flex:0 0 auto;pointer-events:none}
      .profile-action-btn .mtbg-theme-thumb{position:absolute;top:50%;left:4px;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .25s ease}
      [data-theme="dark"] .profile-action-btn .mtbg-theme-thumb{left:calc(100% - 26px)}
      [data-theme="dark"] .profile-action-btn .mtbg-theme-toggle{background:#2a2a2a;border-color:#444;color:#f2f2f2}
      .install-icon{width:26px;height:26px;object-fit:contain;color:currentColor;flex:0 0 auto}
      .delete-account-profile{width:100%;min-height:58px;border-radius:18px;border:1px solid var(--red,#ff3b30);background:transparent;color:var(--red,#ff3b30);font-weight:950;display:flex;align-items:center;justify-content:center;gap:9px;margin-top:12px;cursor:pointer}
      .delete-account-profile i{font-size:19px}
      .profile-note{font-size:11px;color:var(--muted);line-height:1.5;margin-top:12px;padding:13px;border-radius:14px;background:var(--chip)}
      @media (max-width:390px){.tabs{grid-template-columns:1fr 1.28fr 1fr 1fr!important;gap:4px!important}.tab-btn.nav-link{font-size:10px;min-height:60px;padding:7px 2px!important}.tab-btn.verify-tab-btn{font-size:8.7px}.profile-action-grid{grid-template-columns:1fr}.profile-action-btn{min-height:60px}}
    `;
    document.head.appendChild(css);
  }

  function logoImg(className) {
    return `<img class="${className}" src="${LOGO_SRC}" alt="BikeSafe Go" loading="eager" decoding="async">`;
  }

  function replaceLogos() {
    const tag = document.getElementById("modeTag");
    const modeText = tag ? tag.textContent : "";
    const chip = document.querySelector(".brand-chip");
    if (chip && !chip.querySelector(".bikesafe-brand-logo")) {
      chip.innerHTML = logoImg("bikesafe-brand-logo") + '<span class="bikesafe-brand-title">BikeSafe Go</span><span class="mode-tag" id="modeTag">' + modeText + '</span>';
    }
    const authLogo = document.querySelector(".auth-logo");
    if (authLogo && !authLogo.querySelector(".bikesafe-auth-logo")) authLogo.innerHTML = logoImg("bikesafe-auth-logo");
  }

  function refreshGoogleButton() {
    const btn = document.querySelector(".auth-google");
    if (!btn) return;
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    const src = theme === "dark" ? GOOGLE_DARK : GOOGLE_LIGHT;
    if (!btn.classList.contains("google-brand-btn")) btn.classList.add("google-brand-btn");
    if (!btn.querySelector("img") || btn.querySelector("img").getAttribute("src") !== src) {
      btn.innerHTML = '<img src="' + src + '" alt="Entrar com Google">';
    }
  }

  function fixTabs() {
    const tabs = document.querySelector(".tabs");
    if (!tabs) return;
    const nested = document.getElementById("verifyBikeBtnHunt");
    if (nested) nested.remove();
    const stray = document.getElementById("verifyBikeBtn");
    if (stray) stray.remove();

    const garage = document.getElementById("tabGarage");
    const feed = document.getElementById("tabFeed");
    const hunt = document.getElementById("tabHunt");
    if (garage) garage.innerHTML = icon("garage") + "<span>Garagem</span>";
    if (feed) feed.innerHTML = icon("users") + "<span>Comunidade</span>";
    if (hunt) hunt.innerHTML = icon("search") + "<span>Procurando</span>";

    let verify = document.getElementById("tabVerify");
    if (!verify) {
      verify = document.createElement("button");
      verify.id = "tabVerify";
      verify.type = "button";
      verify.className = "tab-btn nav-link verify-tab-btn";
      verify.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll(".tab-btn.nav-link").forEach(function(b){ b.classList.remove("active"); });
        verify.classList.add("active");
        if (typeof window.openVerifyBike === "function") window.openVerifyBike();
      });
    }
    verify.innerHTML = icon("alert") + "<span>Verificar / reportar<br>bike suspeita</span>";

    if (garage && garage.parentNode === tabs) tabs.appendChild(garage);
    tabs.appendChild(verify);
    if (feed && feed.parentNode === tabs) tabs.appendChild(feed);
    if (hunt && hunt.parentNode === tabs) tabs.appendChild(hunt);
  }

  function renderThemeToggleMarkup() {
    return '<span class="mtbg-theme-toggle" aria-hidden="true"><span>☀</span><span class="mtbg-theme-thumb"></span><span>☾</span></span><span>Trocar tema</span>';
  }

  function enhanceProfileContent() {
    const content = document.getElementById("profileContent");
    if (!content) return;
    const firstCard = content.querySelector(".feed-card");
    const isVisitor = /Visitante/i.test(content.textContent || "");
    const identity = firstCard ? firstCard.outerHTML : '<div class="feed-card"><h3>Visitante</h3><p>Voce ainda nao entrou. • Modo: <b>Nuvem</b></p></div>';
    content.innerHTML =
      identity +
      '<div class="profile-action-grid">' +
        '<button type="button" class="profile-action-btn" id="profileThemeBtn">' + renderThemeToggleMarkup() + '</button>' +
        '<button type="button" class="profile-action-btn" onclick="installApp()"><img class="install-icon" src="' + INSTALL_SRC + '" alt="" aria-hidden="true"><span>Instalar app</span></button>' +
      '</div>' +
      (isVisitor
        ? '<div class="submit-row single"><button class="action-btn primary" onclick="closeOverlay(\'profileOverlay\'); openAuthPublic()">Entrar / criar conta</button></div>'
        : '<div class="submit-row single"><button class="action-btn danger" onclick="logout()">Sair da conta</button></div>') +
      '<button type="button" class="delete-account-profile" id="deleteAccountBtn"><i class="fi fi-sr-seal-exclamation"></i><span>Excluir minha conta</span></button>' +
      '<div class="profile-note">Para ativar login e banco de dados reais compartilhados entre dispositivos, mantenha o Firebase configurado. Sem ele, o app roda em modo demonstracao local.</div>';

    const themeBtn = document.getElementById("profileThemeBtn");
    if (themeBtn) themeBtn.addEventListener("click", function(){ if (typeof window.toggleTheme === "function") window.toggleTheme(); });

    const deleteBtn = document.getElementById("deleteAccountBtn");
    if (deleteBtn) deleteBtn.addEventListener("click", async function(){
      if (!confirm("Tem certeza? Sua conta sera excluida permanentemente. Esta acao nao pode ser desfeita.")) return;
      try {
        await deleteAccount();
        try { localStorage.removeItem("bikesafe-demo-user"); localStorage.removeItem("bikesafe-go-state-v3"); } catch(e) {}
        alert("Conta excluida.");
        location.reload();
      } catch (err) {
        alert("Para excluir, faca login novamente e tente de novo. (" + ((err && err.code) || err) + ")");
      }
    });
  }

  function hookProfile() {
    if (typeof window.openProfile !== "function" || window.openProfile.__bikeSafePatched) return;
    const original = window.openProfile;
    window.openProfile = function(){
      const result = original.apply(this, arguments);
      setTimeout(enhanceProfileContent, 0);
      setTimeout(enhanceProfileContent, 650);
      return result;
    };
    window.openProfile.__bikeSafePatched = true;
  }

  function hookTheme() {
    if (typeof window.toggleTheme !== "function" || window.toggleTheme.__bikeSafePatched) return;
    const original = window.toggleTheme;
    window.toggleTheme = function(){
      const result = original.apply(this, arguments);
      setTimeout(refreshGoogleButton, 0);
      return result;
    };
    window.toggleTheme.__bikeSafePatched = true;
  }

  function patchAll() {
    installCSS();
    replaceLogos();
    refreshGoogleButton();
    fixTabs();
    hookProfile();
    hookTheme();
    if (document.getElementById("profileOverlay")?.classList.contains("open")) enhanceProfileContent();
  }

  ready(function(){
    patchAll();
    let ticks = 0;
    const timer = setInterval(function(){
      patchAll();
      ticks += 1;
      if (ticks > 20) clearInterval(timer);
    }, 300);
    const obs = new MutationObserver(function(){ patchAll(); });
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-theme"] });
    setTimeout(function(){ try { obs.disconnect(); } catch(e) {} }, 12000);
  });
})();
