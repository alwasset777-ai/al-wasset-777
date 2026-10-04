import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { Lock, LogOut, Loader2 } from 'lucide-react';
import { isFirebaseEnabled, onUserChange, signIn, signOut } from '../services/firebase';

// Utilisateur Firebase connecté (null si déconnecté ; undefined pendant le chargement).
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(isFirebaseEnabled ? undefined : null);
  useEffect(() => onUserChange(setUser), []);
  return user;
}

// Formulaire de connexion du gérant (compte créé dans la console Firebase).
export const LoginCard: React.FC<{ title?: string }> = ({ title = 'تسجيل الدخول' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} dir="rtl" className="max-w-sm mx-auto bg-white rounded-3xl p-6 border border-[#f0e4e2] space-y-3">
      <div className="flex items-center gap-2 text-sm font-black">
        <Lock className="w-4 h-4 text-[#ff6f61]" /> {title}
      </div>
      <p className="text-xs text-[#7a5c58]">هذا القسم خاص بمدير المكتب. البيانات محفوظة على الإنترنت ومحمية.</p>
      <input type="email" required dir="ltr" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm" />
      <input type="password" required dir="ltr" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2.5 rounded-xl bg-[#fff8f7] border border-[#f0e4e2] text-sm" />
      {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
      <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-[#ff6f61] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} دخول
      </button>
    </form>
  );
};

export const SignOutButton: React.FC<{ user: User }> = ({ user }) => (
  <button onClick={() => signOut()} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#99807d] hover:text-[#ff6f61] cursor-pointer" title={user.email || ''}>
    <LogOut className="w-3.5 h-3.5" /> {user.email}
  </button>
);
