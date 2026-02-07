import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[var(--color-charcoal)] text-[var(--color-text-light)] py-12">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4">ForemanOS</h3>
            <p className="text-sm text-gray-400">
              AI-powered project management for construction teams. Upload plans, get answers, manage your build — starting at $15/mo.
            </p>
            <div className="mt-4">
              <a 
                href="mailto:ForemanOS@outlook.com" 
                className="text-sm text-[var(--color-primary)] hover:underline"
              >
                ForemanOS@outlook.com
              </a>
            </div>
          </div>
          
          {/* Product */}
          <div>
            <h4 className="font-[var(--font-headline)] font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/pricing" className="hover:text-[var(--color-primary)] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/product-tour" className="hover:text-[var(--color-primary)] transition-colors">
                  Product Tour
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-[var(--color-primary)] transition-colors">
                  Security
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Solutions */}
          <div>
            <h4 className="font-[var(--font-headline)] font-semibold mb-4">Solutions</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/solutions/general-contractors" className="hover:text-[var(--color-primary)] transition-colors">
                  General Contractors
                </Link>
              </li>
              <li>
                <Link href="/solutions/construction-managers" className="hover:text-[var(--color-primary)] transition-colors">
                  Construction Managers
                </Link>
              </li>
              <li>
                <Link href="/solutions/electrical" className="hover:text-[var(--color-primary)] transition-colors">
                  Electrical
                </Link>
              </li>
              <li>
                <Link href="/solutions/plumbing-hvac" className="hover:text-[var(--color-primary)] transition-colors">
                  Plumbing & HVAC
                </Link>
              </li>
              <li>
                <Link href="/solutions/concrete-masons" className="hover:text-[var(--color-primary)] transition-colors">
                  Concrete & Masons
                </Link>
              </li>
              <li>
                <Link href="/solutions/site-work" className="hover:text-[var(--color-primary)] transition-colors">
                  Site Work
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Company */}
          <div>
            <h4 className="font-[var(--font-headline)] font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-[var(--color-primary)] transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/demo" className="hover:text-[var(--color-primary)] transition-colors">
                  Request Demo
                </Link>
              </li>
              <li>
                <a href="mailto:ForemanOS@outlook.com" className="hover:text-[var(--color-primary)] transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-700 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} ForemanOS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
