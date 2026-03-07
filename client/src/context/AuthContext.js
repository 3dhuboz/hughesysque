import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as fbUpdateProfile,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    // Restore dev session from localStorage (persists across refreshes on same device)
    const saved = localStorage.getItem('__devSession');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { localStorage.removeItem('__devSession'); }
    }

    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Load full profile from Firestore
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) {
            setUser({ uid: fbUser.uid, email: fbUser.email, ...snap.data() });
          } else {
            // Minimal user if Firestore doc missing
            setUser({ uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName || '', role: 'customer' });
          }
        } catch {
          setUser({ uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName || '', role: 'customer' });
        }
      } else {
        // Only clear user if there's no dev session saved
        if (!localStorage.getItem('__devSession')) setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [];

  const login = async (email, password) => {
    // Dev backdoor — hardcoded, not in Firebase
    if (email === 'dev' && password === '123') {
      const devUser = { uid: 'dev1', email: 'dev@hughesysque.au', name: 'Developer', role: 'dev' };
      localStorage.setItem('__devSession', JSON.stringify(devUser));
      setUser(devUser);
      return devUser;
    }
    if (!isFirebaseConfigured) throw new Error('Auth not configured — set REACT_APP_FIREBASE_* vars.');
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    const profile = snap.exists() ? snap.data() : {};
    const userData = { uid: cred.user.uid, email: cred.user.email, ...profile };
    setUser(userData);
    return userData;
  };

  const register = async ({ name, email, password }) => {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await fbUpdateProfile(cred.user, { displayName: name });
    const profile = { name, email, role: 'customer', stamps: 0, hasCateringDiscount: false, createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', cred.user.uid), profile);
    const userData = { uid: cred.user.uid, ...profile };
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    localStorage.removeItem('__devSession');
    if (isFirebaseConfigured) await signOut(auth);
    setUser(null);
  };

  const updateProfile = async (data) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), data);
    setUser(prev => ({ ...prev, ...data }));
    return { ...user, ...data };
  };

  // Stub kept for any legacy callers
  const googleLogin = async () => { throw new Error('Google login not configured'); };
  const loadUser = async () => { };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout, updateProfile, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
