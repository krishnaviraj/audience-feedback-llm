import React, { ReactNode } from 'react';

// Logo placeholder - we can replace this with actual logo later
const LogoPlaceholder = () => (
  <div className="w-12 h-12 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center text-white">
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 12h8m-4-4v8m-8-4a8 8 0 1016 0 8 8 0 00-16 0z" strokeLinecap="round" strokeLinejoin="round"/>
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
            href="https://yourportfolio.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-blue-600 transition-colors"
          >
            Created by Your Name
          </a>
          <span>•</span>
          <a 
            href="mailto:your@email.com"
            className="hover:text-blue-600 transition-colors"
          >
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
};

export default BaseLayout;