import React from "react";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 flex flex-col">
            <div className="flex flex-col gap-3 mb-1">
              <img
                src="/NordicLogo3-nobg.png"
                alt="Nordic AI Group ApS"
                className="h-16 w-auto object-contain object-left"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <img
                src="/azure-badge.jpg"
                alt={t('home.poweredByAzure')}
                className="h-7 w-auto object-contain object-left rounded-full"
              />
            </div>
            
            <p className="text-gray-800 font-medium mb-2 mt-4">Nordic AI Group</p>
            
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              {t('footer.companyDescription')}
            </p>
            
            <div className="flex items-center gap-5 mb-5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00D6D6]"></div>
                <span className="text-xs text-gray-500">100% GDPR-compliant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs text-gray-500">ISO 27001 Certified</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a 
                href="tel:+4553721659" 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-[#00D6D6] hover:text-white hover:scale-110 hover:shadow-lg transition-all duration-300"
                title="Phone"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
              <a 
                href="https://www.facebook.com/Nordicaigroup/" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-[#00D6D6] hover:text-white hover:scale-110 hover:shadow-lg transition-all duration-300"
                title="Facebook"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a 
                href="https://www.instagram.com/nordicaigroup/" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-[#00D6D6] hover:text-white hover:scale-110 hover:shadow-lg transition-all duration-300"
                title="Instagram"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>

          <div className="md:col-span-4 flex flex-col items-center">
            <nav className="flex flex-col gap-2">
              <a href="/security-gdpr" className="text-sm text-gray-500 hover:text-[#00D6D6] hover:translate-x-1 transition-all duration-200">
                Security & GDPR
              </a>
              <a href="/contact" className="text-sm text-gray-500 hover:text-[#00D6D6] hover:translate-x-1 transition-all duration-200">
                Contact
              </a>
              <a href="/about" className="text-sm text-gray-500 hover:text-[#00D6D6] hover:translate-x-1 transition-all duration-200">
                About Us
              </a>
              <a href="/privacy-policy" className="text-sm text-gray-500 hover:text-[#00D6D6] hover:translate-x-1 transition-all duration-200">
                Privacy Policy
              </a>
              <a href="/terms-of-service" className="text-sm text-gray-500 hover:text-[#00D6D6] hover:translate-x-1 transition-all duration-200">
                Terms of Service
              </a>
            </nav>
          </div>

          <div className="md:col-span-3 flex flex-col items-end">
            <div className="flex flex-col gap-2.5 text-right">
              <a 
                href="mailto:info@nordicaigroup.com" 
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#00D6D6] transition-colors flex-row-reverse"
              >
                info@nordicaigroup.com
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
              <a 
                href="tel:+4553721659" 
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#00D6D6] transition-colors flex-row-reverse"
              >
                +45 53 72 16 59
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-8 pt-5">
          <div className="text-sm text-gray-400 text-center md:text-left">
            © 2026 Nordic AI Group ApS · CVR 44368266
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
