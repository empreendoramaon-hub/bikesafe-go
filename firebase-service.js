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
  if (coords) {
    if (Array.isArray(coords)) { data.lat = coords[0]; data.lng = coords[1]; }
    else { data.lat = coords.lat; data.lng = coords.lng; }
  }
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
