import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Footer from "./Footer";
import Navbar from "./Navbar";

const ContactPage = ({ user, setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <Navbar user={user} setUser={setUser} />
      
      <div className="bg-gradient-to-br from-[#1c2631] via-[#2a3a4a] to-[#1c2631] text-white py-16 px-6 mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00D6D6]/20 mb-6">
            <svg className="w-8 h-8 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('contact.title')}
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            {t('contact.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <a 
            href="mailto:info@nordicaigroup.com"
            className="bg-white rounded-2xl border border-gray-100 p-8 text-center hover:shadow-xl hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 group"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00D6D6]/10 mb-4 group-hover:bg-[#00D6D6]/20 transition-colors">
              <svg className="w-7 h-7 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{t('contact.email')}</h3>
            <p className="text-[#00D6D6] group-hover:underline">info@nordicaigroup.com</p>
          </a>

          <a 
            href="tel:+4553721659"
            className="bg-white rounded-2xl border border-gray-100 p-8 text-center hover:shadow-xl hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 group"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00D6D6]/10 mb-4 group-hover:bg-[#00D6D6]/20 transition-colors">
              <svg className="w-7 h-7 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{t('contact.phone')}</h3>
            <p className="text-[#00D6D6] group-hover:underline">+45 53 72 16 59</p>
          </a>

          <a 
            href="https://www.nordicaigroup.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl border border-gray-100 p-8 text-center hover:shadow-xl hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 group"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00D6D6]/10 mb-4 group-hover:bg-[#00D6D6]/20 transition-colors">
              <svg className="w-7 h-7 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{t('contact.website')}</h3>
            <p className="text-[#00D6D6] group-hover:underline">www.nordicaigroup.com</p>
          </a>
        </div>

        <div className="bg-gradient-to-br from-[#d0f4f4] to-white rounded-2xl border border-[#00D6D6]/20 p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('contact.whyChooseUs')}</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#00D6D6]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-700">{t('contact.benefit1')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#00D6D6]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-700">{t('contact.benefit2')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#00D6D6]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-700">{t('contact.benefit3')}</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button 
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00D6D6] text-white font-semibold rounded-xl hover:bg-[#00C4C4] hover:scale-105 transition-all duration-300 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('contact.backToHome')}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ContactPage;
