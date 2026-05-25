import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckSquare, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';

type Mode = 'login' | 'register' | 'forgot';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearState = () => { setError(''); setSuccess(''); setPassword(''); setConfirmPassword(''); };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      setError('Đăng nhập Google thất bại. Thử lại nhé!');
    } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!email) { setError('Vui lòng nhập email!'); return; }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Email đặt lại mật khẩu đã được gửi! Kiểm tra hộp thư nhé.');
      } catch {
        setError('Email không tồn tại hoặc có lỗi xảy ra.');
      } finally { setLoading(false); }
      return;
    }

    if (!password) { setError('Vui lòng nhập mật khẩu!'); return; }
    if (mode === 'register' && password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp!'); return; }
    if (mode === 'register' && password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự!'); return; }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      const code = e.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') setError('Email hoặc mật khẩu không đúng!');
      else if (code === 'auth/email-already-in-use') setError('Email này đã được đăng ký!');
      else if (code === 'auth/invalid-email') setError('Email không hợp lệ!');
      else if (code === 'auth/too-many-requests') setError('Quá nhiều lần thử. Vui lòng thử lại sau!');
      else setError('Có lỗi xảy ra. Vui lòng thử lại!');
    } finally { setLoading(false); }
  };

  const titles = { login: 'Đăng nhập', register: 'Tạo tài khoản', forgot: 'Quên mật khẩu' };
  const subtitles = { login: 'Chào mừng trở lại!', register: 'Bắt đầu hành trình mới', forgot: 'Đặt lại mật khẩu của bạn' };

  return (
    <div
      className="w-full h-screen flex items-center justify-center select-none"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{WebkitAppRegion:'drag'} as any}
        className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-8 w-96 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-indigo-600/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-purple-600/10 blur-3xl rounded-full pointer-events-none" />

        <div className="flex flex-col items-center gap-3 mb-6 relative z-10" style={{WebkitAppRegion:'no-drag'} as any}>
          <div className="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
            <CheckSquare size={28} className="text-indigo-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-white">TaskFlow</h1>
            <p className="text-slate-500 text-xs mt-0.5">{subtitles[mode]}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 relative z-10" style={{WebkitAppRegion:'no-drag'} as any}>
          <AnimatePresence mode="wait">
            <motion.h2 key={mode} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-white font-bold text-base mb-1">
              {titles[mode]}
            </motion.h2>
          </AnimatePresence>

          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all" />
          </div>

          {mode !== 'forgot' && (
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type={showPassword ? 'text' : 'password'} placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          )}

          {mode === 'register' && (
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type={showPassword ? 'text' : 'password'} placeholder="Xác nhận mật khẩu" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all" />
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
              <AlertCircle size={13} className="text-rose-400 shrink-0" />
              <p className="text-rose-400 text-xs">{error}</p>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
              <p className="text-green-400 text-xs">{success}</p>
            </motion.div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-2.5 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer mt-1">
            {loading ? <Loader2 size={15} className="animate-spin" /> : titles[mode]}
          </button>

          {mode === 'login' && (
            <button onClick={() => { setMode('forgot'); clearState(); }} className="text-slate-500 hover:text-slate-300 text-xs text-right transition-colors cursor-pointer">
              Quên mật khẩu?
            </button>
          )}

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-slate-600 text-xs">hoặc</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button onClick={handleGoogle} disabled={loading}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Đăng nhập với Google
              </button>
            </>
          )}

          <div className="text-center text-xs text-slate-500 mt-1">
            {mode === 'login' && (
              <span>Chưa có tài khoản?{' '}
                <button onClick={() => { setMode('register'); clearState(); }} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">Đăng ký</button>
              </span>
            )}
            {mode === 'register' && (
              <span>Đã có tài khoản?{' '}
                <button onClick={() => { setMode('login'); clearState(); }} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">Đăng nhập</button>
              </span>
            )}
            {mode === 'forgot' && (
              <button onClick={() => { setMode('login'); clearState(); }} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">← Quay lại đăng nhập</button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
