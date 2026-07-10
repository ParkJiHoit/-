import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = 로딩 중
  const [session, setSession] = useState(null);
  // 비밀번호 재설정 이메일의 링크를 눌러 돌아온 상태 — 이 세션은 로그인이 아니라
  // "새 비밀번호를 설정하기 전까지" 임시로 발급된 것이라 일반 로그인과 구분해야 한다.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setSession(session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setSession(session ?? null);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

  const signInWithEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUpWithEmail = (email, password, name, phone) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, phone },
        emailRedirectTo: window.location.origin,
      },
    });

  const signOut = () => supabase.auth.signOut();

  const resetPasswordForEmail = (email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });

  const updatePassword = (newPassword) =>
    supabase.auth.updateUser({ password: newPassword });

  const clearPasswordRecovery = () => setPasswordRecovery(false);

  return (
    <AuthContext.Provider value={{
      user, session, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
      resetPasswordForEmail, updatePassword, passwordRecovery, clearPasswordRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
