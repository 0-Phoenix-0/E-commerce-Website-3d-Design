'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer id="footer" className="border-t border-gray-150 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12">
          
          {/* Brand Info */}
          <div className="col-span-2 space-y-4">
            <span className="text-2xl font-bold tracking-tight text-gray-900">ShopCo</span>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              Carefully engineered premium goods designed to elevate your everyday routines and provide an unmatched lifestyle experience.
            </p>
            {/* Social Links */}
            <div className="flex gap-4 pt-2">
              <a href="#" className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-400 transition-colors" aria-label="Facebook">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a href="#" className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-400 transition-colors" aria-label="Instagram">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.01 3.71.054 1.14.051 1.96.222 2.65.493a5.18 5.18 0 011.89 1.23 5.18 5.18 0 011.23 1.89c.271.69.442 1.51.493 2.65.043.92.054 1.28.054 3.71s-.01 2.784-.054 3.71c-.051 1.14-.222 1.96-.493 2.65a5.18 5.18 0 01-1.23 1.89 5.18 5.18 0 01-1.89 1.23c-.69.271-1.51.442-2.65.493-.92.043-1.28.054-3.71.054s-2.784-.01-3.71-.054c-1.14-.051-1.96-.222-2.65-.493a5.18 5.18 0 01-1.89-1.23 5.18 5.18 0 01-1.23-1.89c-.271-.69-.442-1.51-.493-2.65C2.01 14.82 2 14.46 2 12s.01-2.784.054-3.71c.051-1.14.222-1.96.493-2.65a5.18 5.18 0 011.23-1.89 5.18 5.18 0 011.89-1.23C5.64 2.23 6 2.01 7.13 1.96 8.06 1.92 8.42 1.92 10.84 1.92h1.475zm-1.077 1.681c-2.405 0-2.685.01-3.631.053-.88.041-1.358.187-1.675.31a3.5 3.5 0 00-1.3 1.3c-.123.317-.268.795-.31 1.675-.043.947-.053 1.227-.053 3.631s.01 2.685.053 3.631c.041.88.187 1.358.31 1.675a3.5 3.5 0 001.3 1.3c.317.123.795.268 1.675.31.947.043 1.227.053 3.631.053s2.685-.01 3.631-.053c.88-.041 1.358-.187 1.675-.31a3.5 3.5 0 001.3-1.3c.123-.317.268-.795.31-1.675.043-.947.053-1.227.053-3.631s-.01-2.685-.053-3.631c-.041-.88-.187-1.358-.31-1.675a3.5 3.5 0 00-1.3-1.3c-.317-.123-.795-.268-1.675-.31-.947-.043-1.227-.053-3.631-.053zm0 4.134a4.185 4.185 0 100 8.37 4.185 4.185 0 000-8.37zm0 1.681a2.504 2.504 0 110 5.008 2.504 2.504 0 010-5.008zm5.277-2.909a.996.996 0 100 1.992.996.996 0 000-1.992z" />
              </svg>
              </a>
              <a href="#" className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-400 transition-colors" aria-label="Twitter">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 1: Shop */}
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Shop</h3>
            <ul className="space-y-2.5">
              <li><Link href="/products" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">All Products</Link></li>
              <li><Link href="/products?sort=newest" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">New Arrivals</Link></li>
              <li><Link href="/products?sort=rating_desc" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Top Rated</Link></li>
            </ul>
          </div>

          {/* Column 2: Account */}
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Account</h3>
            <ul className="space-y-2.5">
              <li><Link href="/orders" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Profile Hub</Link></li>
              <li><Link href="/orders?tab=addresses" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Shipping Addresses</Link></li>
              <li><Link href="/wishlist" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">My Wishlist</Link></li>
            </ul>
          </div>

          {/* Column 3: Help */}
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">Help & Info</h3>
            <ul className="space-y-2.5">
              <li><Link href="/cart" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Shopping Cart</Link></li>
              <li><a href="#footer" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Shipping FAQ</a></li>
              <li><a href="#footer" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Returns & Policy</a></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} ShopCo. Engineered with premium design.
          </p>
          <span className="text-xs text-gray-400 flex items-center gap-1.5 font-semibold">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            100% Encrypted Checkout Guarantee
          </span>
        </div>

      </div>
    </footer>
  );
}
