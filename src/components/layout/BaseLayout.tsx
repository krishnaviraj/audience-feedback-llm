import React, { ReactNode } from 'react';

// Logo placeholder - we can replace this with actual logo later
const LogoPlaceholder = () => (
  <div className="w-12 h-12 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center text-white">
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="20" fill="url(#logoGradient)" />

  <g transform="translate(8, 12)">
    <path d="M2 0h16c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2h-6l-4 4v-4H2c-1.1 0-2-.9-2-2V2C0 .9.9 0 2 0z" 
          fill="#ffffff" fillOpacity="0.9" />
    <circle cx="6" cy="6" r="1.5" fill="#4F46E5" />
    <circle cx="12" cy="6" r="1.5" fill="#4F46E5" />
    <circle cx="18" cy="6" r="1.5" fill="#4F46E5" />
  </g>
  
  <defs>
    <linearGradient id="logoGradient" x1="0" y1="0" x2="40" y2="40">
      <stop offset="0%" stopColor="#4F46E5" />
      <stop offset="100%" stopColor="#7C3AED" />
    </linearGradient>
  </defs>
</svg>
  </div>
);

interface BaseLayoutProps {
  children: ReactNode;
}

const BaseLayout = ({ children }: BaseLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 flex flex-col">
      {/* Header with logo */}
      <header className="w-full flex justify-center py-6">
        <LogoPlaceholder />
      </header>

      {/* Main content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full py-4 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-center space-x-4 text-sm text-slate-600">
          <span>© 2025</span>
          <span>•</span>
          <a 
            href="https://vkvdesign.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-blue-600 transition-colors"
          >
            Krishna V
          </a>
          <span>•</span>
          <a 
            href="mailto:krishnaviraj@email.com"
            className="hover:text-blue-600 transition-colors"
          >
            Give feedback
          </a>
        </div>
      </footer>
    </div>
  );
};

export default BaseLayout;