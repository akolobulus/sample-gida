import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Testimonials from './components/Testimonials';
import CTA from './components/CTA';
import Footer from './components/Footer';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { supabase } from './supabase';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'auth' | 'dashboard'>('home');
  const [loading, setLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setView('dashboard');
      }
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes (e.g. sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setView('dashboard');
      } else {
        setView('home');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const navigateToAuth = () => setView('auth');
  const navigateToHome = () => setView('home');
  const navigateToDashboard = () => setView('dashboard');

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#E67E22]" size={40} />
      </div>
    );
  }

  if (view === 'dashboard') {
    return <Dashboard onLogout={async () => {
      await supabase.auth.signOut();
      navigateToHome();
    }} />;
  }

  if (view === 'auth') {
    return <Auth onBack={navigateToHome} onLoginSuccess={navigateToDashboard} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onSignInClick={navigateToAuth} onSignUpClick={navigateToAuth} />
      <main className="flex-grow">
        <Hero onCtaClick={navigateToAuth} />
        <Features />
        <Testimonials />
        <CTA onCtaClick={navigateToAuth} />
      </main>
      <Footer />
    </div>
  );
};

export default App;