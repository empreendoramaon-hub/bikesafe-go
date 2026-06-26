// data-layer.js - ponte entre o app e o backend (Firebase OU localStorage)
let MODE = "local";   // "firebase" ou "local"
let svc = null;       // modulo firebase-service carregado dinamicamente
let unsub = [];       // listeners para limpar depois

export async function initDataLayer({ onBikes, onSightings, onMode, onAuth }) {
  try {
    svc = await import("./firebase-service.js");
    await new Promise((resolve) => {
      svc.watchAuth(async (user) => {
        if (!user) { if (onAuth) onAuth(null); resolve(); return; }
          if (onAuth) onAuth(user);
        MODE = "firebase";
        if (onMode) onMode("firebase");
        unsub.push(svc.watchMyBikes(user.uid, onBikes));
        unsub.push(svc.watchSightings(onSightings));
        resolve();
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
  return svc.markStolen(bikeId, coords);
}
export async function recoverCloud(bikeId) {
  if (MODE !== "firebase") return null;
  return svc.markRecovered(bikeId);
}
export async function sightingCloud(text) {
  if (MODE !== "firebase") return null;
  return svc.addSighting(svc.getUid(), text);
}
