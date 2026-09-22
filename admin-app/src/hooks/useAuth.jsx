import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [staffStatus, setStaffStatus] = useState('checking');

  useEffect(() => {
    let active = true;
    let checkNumber = 0;

    async function applySession(nextSession) {
      const currentCheck = ++checkNumber;
      if (!active) return;

      setSession(nextSession);
      if (!nextSession) {
        setStaffStatus('signed_out');
        return;
      }

      setStaffStatus('checking');
      const { data, error } = await supabase.rpc('is_staff');
      if (!active || currentCheck !== checkNumber) return;
      setStaffStatus(error ? 'error' : (data === true ? 'staff' : 'client'));
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = {
    session,
    isLoading: session === undefined || (!!session && staffStatus === 'checking'),
    isAuthenticated: !!session,
    isStaff: staffStatus === 'staff',
    isClient: staffStatus === 'client',
    hasAccessError: staffStatus === 'error',
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
