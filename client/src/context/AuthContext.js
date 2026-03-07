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
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
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
    await signOut(auth);
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
