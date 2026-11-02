import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [staffStatus, setStaffStatus] = useState('checking');
  const sessionUserIdRef = useRef(null);
  const staffStatusRef = useRef('checking');

  useEffect(() => {
    let active = true;
    let checkNumber = 0;

    function updateStaffStatus(nextStatus) {
      staffStatusRef.current = nextStatus;
      setStaffStatus(nextStatus);
    }

    async function applySession(nextSession) {
      const currentCheck = ++checkNumber;
      if (!active) return;

      const nextUserId = nextSession?.user?.id || null;
      const isKnownUser = !!nextUserId && nextUserId === sessionUserIdRef.current;
      setSession(nextSession);
      if (!nextSession) {
        sessionUserIdRef.current = null;
        updateStaffStatus('signed_out');
        return;
      }

      // The standalone quote tool runs in a same-origin iframe and creates a
      // second Supabase client. That client broadcasts SIGNED_IN when it
      // restores the existing session. Rechecking access for the already
      // verified user would switch Gate back to its loading screen, unmount
      // the iframe, and create an endless mount/broadcast/unmount loop.
      if (isKnownUser && ['staff', 'client'].includes(staffStatusRef.current)) {
        return;
      }

      sessionUserIdRef.current = nextUserId;
      updateStaffStatus('checking');
      const { data, error } = await supabase.rpc('is_staff');
      if (!active || currentCheck !== checkNumber) return;
      updateStaffStatus(error ? 'error' : (data === true ? 'staff' : 'client'));
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
