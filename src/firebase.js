import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { initializeFirestore, doc, setDoc, getDoc, collection, getDocs, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAYrbqnsgwzMuEqktGxzceS0shbRbGPw3A",
  authDomain: "lia-allocation.firebaseapp.com",
  projectId: "lia-allocation",
  storageBucket: "lia-allocation.firebasestorage.app",
  messagingSenderId: "35371824358",
  appId: "1:35371824358:web:f9f33cb5e58cdb0893f727"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// ignoreUndefinedProperties: a single `undefined` anywhere in the state would
// otherwise make setDoc reject the ENTIRE document, silently losing the save.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

// ── Center app state ──────────────────────────────────────
export const loadCenterState = async (centerId) => {
  try {
    const snap = await getDoc(doc(db, 'centers', centerId, 'appState', 'current'));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('loadCenterState:', e);
    return null;
  }
};

export const saveCenterState = async (centerId, state) => {
  try {
    await setDoc(doc(db, 'centers', centerId, 'appState', 'current'), state);
  } catch (e) {
    console.error('saveCenterState:', e);
  }
};

// Real-time subscription to a centre's app state. The callback receives the
// remote state (or null) on every server change. Snapshots produced by this
// client's own un-acknowledged writes are skipped to avoid feedback loops.
export const subscribeCenterState = (centerId, cb) => {
  const ref = doc(db, 'centers', centerId, 'appState', 'current');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      cb(snap.exists() ? snap.data() : null);
    },
    (e) => console.error('subscribeCenterState:', e)
  );
};

// ── Centers ───────────────────────────────────────────────
export const getCenters = async () => {
  try {
    const snap = await getDocs(collection(db, 'centers'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('getCenters:', e);
    return [];
  }
};

export const createCenter = async (centerId, data) => {
  await setDoc(doc(db, 'centers', centerId), data);
};

// ── Users ─────────────────────────────────────────────────
export const getUsers = async () => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    console.error('getUsers:', e);
    return [];
  }
};

export const setUserDoc = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
};

// Creates a Firebase Auth user without disrupting the current admin session
export const createUserAsAdmin = async (email, password, profileData) => {
  const secondaryApp = initializeApp(firebaseConfig, `tmp-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setUserDoc(cred.user.uid, { email, ...profileData });
    return cred.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
};
