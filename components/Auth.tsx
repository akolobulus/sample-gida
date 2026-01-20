import React, { useState } from 'react';
import { Home, Chrome, Loader2, AlertCircle, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';

interface AuthProps {
  onBack: () => void;
  onLoginSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onBack, onLoginSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false); // New State for Success Screen

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 1. Handle Google Login
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // 2. Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        // --- SIGN UP ---
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name } // Save name to Supabase Meta
          }
        });
        if (error) throw error;

        // Triggers the Success Screen instead of an alert
        setShowSuccess(true); 
      } else {
        // --- SIGN IN ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // --- SYNC WITH BACKEND ---
        if (data.user && data.session) {
          try {
            await fetch('http://localhost:3001/api/auth/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.session.access_token}`
              },
              body: JSON.stringify({ name: name || 'Landlord' })
            });
          } catch (syncErr) {
            console.warn("Backend sync warning (non-fatal):", syncErr);
          }
          onLoginSuccess();
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER: SUCCESS SCREEN (Email Confirmation) ---
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center px-4 py-12 animate-in fade-in duration-500">
        <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl shadow-gray-200/50 border border-gray-100 p-8 md:p-12 text-center">
          
          {/* Animated Icon */}
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative">
            <div className="absolute inset-0 rounded-full border-2 border-orange-100 animate-ping opacity-20"></div>
            <Mail size={40} className="text-[#E67E22]" />
            <div className="absolute -right-1 -top-1 bg-green-500 rounded-full p-1.5 border-4 border-white">
              <CheckCircle2 size={14} className="text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-[#1A1A1A] mb-4">Check your inbox</h2>
          <p className="text-gray-500 text-lg mb-8 leading-relaxed">
            We've sent a confirmation link to <br/>
            <span className="font-bold text-gray-900">{email}</span>.
          </p>
          
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-8 font-medium">
            Please click the link in the email to activate your account and sign in.
          </div>

          <button 
            onClick={() => {
              setShowSuccess(false);
              setMode('signin');
              setError(null);
            }}
            className="w-full bg-[#E67E22] hover:bg-[#D35400] text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-orange-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Back to Sign In
            <ArrowRight size={20} />
          </button>

          <p className="mt-8 text-sm text-gray-400">
            Didn't receive the email? <button className="text-[#E67E22] font-bold hover:underline">Click to resend</button>
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN AUTH FORM ---
  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center px-4 py-12">
      {/* Brand Logo Header */}
      <div 
        onClick={onBack}
        className="flex items-center gap-3 mb-10 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <div className="bg-[#E67E22] p-2 rounded-xl text-white shadow-lg shadow-orange-100">
          <Home size={28} />
        </div>
        <span className="text-3xl font-extrabold text-[#333333]">GidaNa</span>
      </div>

      {/* Main Auth Card */}
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl shadow-gray-200/50 border border-gray-100 p-8 md:p-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-[#1A1A1A] mb-2 tracking-tight">
            {mode === 'signin' ? 'Welcome Back' : 'Get Started'}
          </h1>
          <p className="text-gray-500 font-medium">
            {mode === 'signin' ? 'Sign in to manage your properties' : 'Create your landlord account today'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Google Auth Button */}
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full border border-gray-200 rounded-xl py-3.5 px-4 flex items-center justify-center gap-3 hover:bg-gray-50 transition-all mb-8 font-semibold text-gray-700 shadow-sm disabled:opacity-50 hover:shadow-md"
        >
          {loading ? <Loader2 className="animate-spin text-gray-500" size={20} /> : <Chrome size={20} className="text-gray-900" />}
          Continue with Google
        </button>

        <div className="relative flex items-center mb-8">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="flex-shrink mx-4 text-[10px] font-bold text-gray-400 tracking-widest uppercase">
            OR CONTINUE WITH EMAIL
          </span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        {/* Toggle Switches */}
        <div className="bg-[#F1F1F1] p-1.5 rounded-2xl flex mb-10">
          <button 
            type="button"
            onClick={() => { setMode('signin'); setError(null); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${mode === 'signin' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign In
          </button>
          <button 
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${mode === 'signup' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign Up
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'signup' && (
            <div className="space-y-2 animate-in slide-in-from-top-4 fade-in duration-300">
              <label className="text-sm font-bold text-gray-800 ml-1">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Kamau"
                className="w-full bg-[#F9FAFB] border border-gray-100 rounded-2xl py-4 px-6 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all font-medium"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-800 ml-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="landlord@example.com"
              className="w-full bg-[#F9FAFB] border border-gray-100 rounded-2xl py-4 px-6 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all font-medium"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-800 ml-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#F9FAFB] border border-gray-100 rounded-2xl py-4 px-6 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all font-medium"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#E67E22] hover:bg-[#D35400] text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-orange-100 transition-all mt-4 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={20} />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>

      <p className="mt-12 text-sm text-gray-500 text-center max-w-xs leading-relaxed">
        By continuing, you agree to our <a href="#" className="underline font-medium text-gray-700">Terms of Service</a> and <a href="#" className="underline font-medium text-gray-700">Privacy Policy</a>
      </p>
    </div>
  );
};

export default Auth;