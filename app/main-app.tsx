"use client";

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { HardHat, LogOut, User, FileText } from 'lucide-react';
import { ChatInterface } from '@/components/chat-interface';
import { LoginForm } from '@/components/login-form';
import { AccessIndicator } from '@/components/access-indicator';
import { motion } from 'framer-motion';

interface MainAppProps {
  session: any;
}

export function MainApp({ session }: MainAppProps) {
  const [showLogin, setShowLogin] = useState(false);
  const userRole = session?.user?.role || 'guest';
  const isLoggedIn = !!session;

  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <img 
                src="/foremanos-new-logo.png" 
                alt="ForemanOS Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <AccessIndicator role={(userRole === 'admin' || userRole === 'client') ? 'admin' : 'guest'} />
              
              {isLoggedIn ? (
                <>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white hover:bg-gray-50 border-2 border-[#003B71] text-[#003B71] rounded-lg transition-all transform hover:scale-105 shadow-sm focus:ring-2 focus:ring-[#003B71] focus:ring-offset-2 focus:outline-none touch-manipulation"
                    aria-label="View profile"
                    title="User profile"
                  >
                    <User className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Profile</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-all transform hover:scale-105 shadow-sm focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none touch-manipulation"
                    aria-label="Logout from account"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLogin(!showLogin)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#003B71] hover:bg-[#002855] text-white rounded-lg transition-all transform hover:scale-105 shadow-md focus:ring-2 focus:ring-[#003B71] focus:ring-offset-2 focus:outline-none touch-manipulation"
                  aria-label="Open login modal"
                  title="Login for full access"
                >
                  <HardHat className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Login</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {showLogin && !isLoggedIn && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <button
              onClick={() => setShowLogin(false)}
              className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 z-10 focus:ring-2 focus:ring-[#003B71] focus:outline-none transform hover:scale-110 transition-all"
              aria-label="Close login modal"
              title="Close"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <LoginForm onClose={() => setShowLogin(false)} />
          </motion.div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4"
          >
            Welcome to <span className="text-[#003B71]">One Senior Care Construction Site ChatBot</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4"
          >
            {(userRole === 'admin' || userRole === 'client') ? (
              <>
                Get instant answers about your project schedules, plans, specifications, budgets, and contracts. Access all project documentation with our AI assistant.
              </>
            ) : (
              <>
                Get instant answers about your project schedules, plans, and specifications. Our AI assistant is here to help.
              </>
            )}
          </motion.p>
        </div>

        {/* Chat Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-5xl mx-auto"
        >
          <ChatInterface />
        </motion.div>

        {/* AI Disclaimer + Access Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 max-w-5xl mx-auto space-y-4"
        >
          {/* AI Disclaimer Ribbon */}
          <div className="flex justify-center px-4">
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 w-full md:w-3/4">
              <p className="text-sm md:text-base text-yellow-800 text-center">
                <strong>⚠️ AI Disclaimer:</strong> AI responses may not always be accurate. Please verify all information before making critical decisions.
              </p>
            </div>
          </div>

          {/* Access Info Card */}
          <div className="flex justify-center px-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 w-full md:w-3/4">
              <FileText className="w-6 h-6 text-blue-600 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm md:text-base text-blue-800 text-center">
                {(userRole === 'admin' || userRole === 'client') ? (
                  <>
                    <strong>Full Access:</strong> You have access to all project documents including budget, contracts, and administrative files.
                  </>
                ) : (
                  <>
                    <strong>Welcome! No sign-in required.</strong>
                    <br /><br />
                    You can start using the chatbot right away to get information about plans, schedules, specifications, and site surveys.
                    <br /><br />
                    <span className="text-sm">Admin/Client staff: Click "Login" above for access to budget and contract information. Chat history is only saved for logged-in users.</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p>© 2024 One Senior Care Construction Site ChatBot. Powered by AI.</p>
          </div>
        </div>
      </footer>

      {/* Document Library Modal */}
      {/* Document library temporarily disabled in main app - needs project context */}
    </div>
  );
}
