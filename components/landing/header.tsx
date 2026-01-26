'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, Menu, X } from 'lucide-react';

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Navigation Header - ForemanOS Brand */}
      <header className="sticky top-0 z-50 bg-[var(--color-charcoal)] border-b border-gray-700 shadow-lg">
        <nav className="container mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo - Optimized for navigation */}
            <Link href="/" className="flex items-center flex-shrink-0">
              <Image
                src="/foremanos-new-logo.png"
                alt="ForemanOS - Return to Home"
                width={400}
                height={100}
                className="h-10 w-auto sm:h-12 drop-shadow-[0_2px_8px_rgba(249,115,22,0.3)]"
                priority
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-6 xl:gap-8">
              <Link 
                href="/pricing" 
                className="text-[var(--color-text-light)] hover:text-[var(--color-primary)] font-[var(--font-body)] font-medium transition-colors whitespace-nowrap"
              >
                Pricing
              </Link>
              <Link 
                href="/product-tour" 
                className="text-[var(--color-text-light)] hover:text-[var(--color-primary)] font-[var(--font-body)] font-medium transition-colors whitespace-nowrap"
              >
                Product Tour
              </Link>
              <Link 
                href="/security" 
                className="text-[var(--color-text-light)] hover:text-[var(--color-primary)] font-[var(--font-body)] font-medium transition-colors whitespace-nowrap"
              >
                Security
              </Link>
              <Link 
                href="/demo" 
                className="text-[var(--color-text-light)] hover:text-[var(--color-primary)] font-[var(--font-body)] font-medium transition-colors whitespace-nowrap"
              >
                Request Demo
              </Link>
            </div>

            {/* Desktop Auth Buttons */}
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <Link href="/login">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[var(--color-text-light)] hover:text-white hover:bg-white/10"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button 
                  size="sm" 
                  className="bg-[var(--color-primary)] hover:bg-[#ea580c] text-white min-h-[var(--touch-target)] shadow-lg"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Sign Up
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[var(--color-text-light)] hover:text-[var(--color-primary)]"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-4 py-4 border-t border-gray-700">
              <div className="flex flex-col space-y-4">
                <Link
                  href="/pricing"
                  className="text-[var(--color-text-light)] hover:text-[var(--color-primary)] font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="/product-tour"
                  className="text-[var(--color-text-light)] hover:text-[var(--color-primary)] font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Product Tour
                </Link>
                <Link
                  href="/security"
                  className="text-[var(--color-text-light)] hover:text-[var(--color-primary)] font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Security
                </Link>
                <Link
                  href="/demo"
                  className="text-[var(--color-text-light)] hover:text-[var(--color-primary)] font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Request Demo
                </Link>
                <div className="pt-4 border-t border-gray-700 space-y-3">
                  <Link href="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full min-h-[var(--touch-target)] border-white text-white hover:bg-white/10">
                      <LogIn className="w-4 h-4 mr-2" />
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup" className="block" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-[var(--color-primary)] hover:bg-[#ea580c] text-white min-h-[var(--touch-target)]">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Sign Up
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>
    </>
  );
}
