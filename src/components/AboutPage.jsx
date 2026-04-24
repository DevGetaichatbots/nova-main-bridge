import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Footer from "./Footer";
import Navbar from "./Navbar";

const AboutPage = ({ user, setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <Navbar user={user} setUser={setUser} />
      
      <div className="bg-gradient-to-br from-[#1c2631] via-[#2a3a4a] to-[#1c2631] text-white py-16 px-6 mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00D6D6]/20 mb-6">
            <svg className="w-8 h-8 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('about.title')}
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            {t('about.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 hover:shadow-xl hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 group">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#00D6D6]/10 mb-4 group-hover:bg-[#00D6D6]/20 transition-colors">
              <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gray-700 leading-relaxed">
              {t('about.companyDesc1')} <span className="font-semibold text-gray-900">Nordic AI Group ApS</span>{t('about.companyDesc2')}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-8 hover:shadow-xl hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 group">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#00D6D6]/10 mb-4 group-hover:bg-[#00D6D6]/20 transition-colors">
              <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-700 leading-relaxed">
              {t('about.focusDesc1')} <span className="font-semibold text-gray-900">{t('about.focusHighlight')}</span>.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#d0f4f4] to-white rounded-2xl border border-[#00D6D6]/20 p-10 mb-12 text-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00D6D6] to-[#00D6D6]/30"></div>
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00D6D6]/30 to-[#00D6D6]"></div>
          
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00D6D6]/10 mb-4">
            <svg className="w-7 h-7 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          
          <p className="text-[#00D6D6] font-semibold text-sm uppercase tracking-wider mb-3">{t('about.missionLabel')}</p>
          <p className="text-xl md:text-2xl font-medium text-gray-800 max-w-3xl mx-auto leading-relaxed">
            {t('about.missionText')}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-12 hover:shadow-xl hover:border-[#00D6D6]/30 transition-all duration-300">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D6D6]/20 to-[#00D6D6]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-[#00D6D6] font-semibold text-sm uppercase tracking-wider mb-2">{t('about.founderLabel')}</p>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Kasper Skovgaard Rasmussen</h3>
              <p className="text-gray-600 leading-relaxed">
                {t('about.founderDesc')}
              </p>
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
            {t('about.backToHome')}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AboutPage;
