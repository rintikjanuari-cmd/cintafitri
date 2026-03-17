
import React, { useState } from 'react';
import { Lock, User, LogIn, Database, Zap, Chrome } from 'lucide-react';
import { login } from '../services/authService';
import { UserAccount } from '../types';
import { DEFAULT_ADMIN } from '../services/db';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase';
import { db } from '../services/db';

interface Props {
  onLoginSuccess: (user: UserAccount) => void;
}

const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [authMode, setAuthMode] = useState<'firebase' | 'clinic'>('firebase');
  const [username, setUsername] = useState('');

  const handleClinicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const user = await login(username, password);
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Username atau password salah.');
      }
    } catch (err: any) {
      setError(`Gagal login: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      let user;
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        user = result.user;
      }

      const userAccount: UserAccount = {
        username: user.email?.split('@')[0] || 'User',
        password: '',
        role: 'user',
        createdAt: Date.now()
      };

      await db.users.add({
        ...userAccount,
        uid: user.uid
      });

      onLoginSuccess(userAccount);
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Email atau password salah.');
      } else if (error.code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar. Silakan login.');
      } else if (error.code === 'auth/weak-password') {
        setError('Password terlalu lemah (min. 6 karakter).');
      } else if (error.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else {
        setError(`Gagal: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAccess = () => {
    onLoginSuccess(DEFAULT_ADMIN);
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userAccount: UserAccount = {
        username: user.displayName || user.email || 'User',
        password: '',
        role: 'user',
        createdAt: Date.now()
      };
      
      // Save/Update user in Firestore
      await db.users.add({
        ...userAccount,
        uid: user.uid
      });

      onLoginSuccess(userAccount);
    } catch (error: any) {
      console.error("Google login error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setError('Domain ini belum diizinkan di Firebase Console. Tambahkan domain Cloud Run Anda ke "Authorized Domains".');
      } else if (error.code === 'auth/popup-blocked') {
        setError('Popup diblokir oleh browser. Izinkan popup untuk login.');
      } else {
        setError(`Gagal login dengan Google: ${error.message || 'Error tidak diketahui'}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-purple-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300 blur-[120px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-300 blur-[120px] rounded-full animate-pulse delay-1000"></div>
      </div>

        <div className="bg-white/80 backdrop-blur-xl border border-purple-100 w-full max-w-md rounded-3xl shadow-2xl shadow-purple-200/50 p-8 relative z-10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-200">
             <Database className="w-8 h-8 text-tcm-primary" />
          </div>
          <h1 className="text-2xl font-black text-purple-950 uppercase tracking-tighter">TCM WuXing PRO</h1>
          <p className="text-purple-500 text-xs font-bold uppercase tracking-widest mt-1">Clinical Decision Support System</p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="flex bg-purple-50 p-1 rounded-2xl mb-8 border border-purple-100">
          <button 
            onClick={() => setAuthMode('firebase')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'firebase' ? 'bg-white text-tcm-primary shadow-sm' : 'text-purple-400 hover:text-purple-600'}`}
          >
            Google / Email
          </button>
          <button 
            onClick={() => setAuthMode('clinic')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'clinic' ? 'bg-white text-tcm-primary shadow-sm' : 'text-purple-400 hover:text-purple-600'}`}
          >
            Clinic Account
          </button>
        </div>

        <form onSubmit={authMode === 'firebase' ? handleEmailAuth : handleClinicLogin} className="space-y-4">
          {authMode === 'firebase' ? (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
              <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-purple-50/50 border border-purple-200 rounded-2xl py-4 pl-12 pr-4 text-purple-950 focus:border-tcm-primary focus:bg-white outline-none transition-all"
                placeholder="Email Klinik"
                required
              />
            </div>
          ) : (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
              <input 
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-purple-50/50 border border-purple-200 rounded-2xl py-4 pl-12 pr-4 text-purple-950 focus:border-tcm-primary focus:bg-white outline-none transition-all"
                placeholder="Username Klinik"
                required
              />
            </div>
          )}
          
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-purple-50/50 border border-purple-200 rounded-2xl py-4 pl-12 pr-4 text-purple-950 focus:border-tcm-primary focus:bg-white outline-none transition-all"
              placeholder="Password"
              required
            />
          </div>
          {error && <p className="text-rose-500 text-xs font-bold text-center">{error}</p>}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-tcm-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-purple-900/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
             {isLoading ? 'MEMPROSES...' : authMode === 'firebase' ? (isRegistering ? 'DAFTAR AKUN BARU' : 'MASUK SISTEM') : 'LOGIN KLINIK'}
          </button>

          {authMode === 'firebase' && (
            <button 
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-[10px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-600 transition-colors"
            >
              {isRegistering ? 'Sudah punya akun? Login di sini' : 'Belum punya akun? Daftar di sini'}
            </button>
          )}
        </form>

        <div className="mt-8 pt-8 border-t border-purple-100">
           {authMode === 'firebase' && (
             <button 
               onClick={handleGoogleLogin}
               className="w-full flex items-center justify-center gap-2 py-4 bg-white border border-slate-200 text-slate-700 font-black rounded-2xl hover:bg-slate-50 transition-all shadow-sm mb-4"
             >
                <Chrome className="w-5 h-5 text-blue-500" /> LOGIN DENGAN GOOGLE
             </button>
           )}
           <button 
             onClick={handleQuickAccess}
             className="w-full flex items-center justify-center gap-2 py-4 bg-purple-100 border border-purple-200 text-tcm-primary font-black rounded-2xl hover:bg-tcm-primary hover:text-white transition-all group"
           >
              <Zap className="w-5 h-5 group-hover:animate-bounce" /> AKSES CEPAT (ADMIN LOKAL)
           </button>
           <div className="mt-4 space-y-2">
             <p className="text-[10px] text-purple-400 text-center uppercase font-black tracking-widest leading-relaxed">
               Login Google diperlukan untuk sinkronisasi antar perangkat dan menyimpan API Key ke Cloud.
             </p>
             <p className="text-[9px] text-amber-600 text-center font-bold leading-relaxed px-4">
               PENTING: Akses Cepat tidak dapat menyimpan API Key secara permanen. Jika Anda ingin menyimpan API Key, harap Login dengan Google.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
