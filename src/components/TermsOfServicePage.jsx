import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Footer from "./Footer";
import Navbar from "./Navbar";

const TermsOfServicePage = ({ user, setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <Navbar user={user} setUser={setUser} />
      
      <div className="bg-gradient-to-br from-[#1c2631] via-[#2a3a4a] to-[#1c2631] text-white py-16 px-6 mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00D6D6]/20 mb-6">
            <svg className="w-8 h-8 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('terms.title')}
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-3">
            {t('terms.subtitle')}
          </p>
          <p className="text-sm text-gray-400">{t('terms.lastUpdated')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 flex-1">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm">
          <p className="text-gray-700 leading-relaxed">
            {t('terms.intro1')} <span className="font-semibold text-gray-900">Nordic AI Group ApS</span> (CVR: 44368266) {t('terms.intro2')}
          </p>
          <p className="text-gray-600 mt-4 leading-relaxed">
            {t('terms.intro3')}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('terms.section1Title')}</h2>
              <p className="text-gray-600 mt-2">{t('terms.section1Intro')}</p>
            </div>
          </div>
          
          <div className="ml-14 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">{t('terms.slaTitle')}</h3>
              <div className="space-y-2">
                {['sla1', 'sla2', 'sla3', 'sla4'].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#00D6D6]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-600 text-sm">{t(`terms.${item}`)}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl">
              <div className="flex items-start gap-2">
                <span className="text-amber-500">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-800">{t('terms.importantTitle')}</p>
                  <p className="text-amber-700 text-sm">{t('terms.importantDesc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('terms.section2Title')}</h2>
              <p className="text-gray-600 mt-2">{t('terms.section2Intro')}</p>
            </div>
          </div>
          
          <div className="ml-14 space-y-4">
            <div className="space-y-2">
              {['resp1', 'resp2', 'resp3', 'resp4'].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#00D6D6]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm">{t(`terms.${item}`)}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-4">
              <h3 className="font-semibold text-gray-800 mb-3">{t('terms.prohibitedTitle')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {['prohibited1', 'prohibited2', 'prohibited3', 'prohibited4', 'prohibited5'].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-red-500">❌</span>
                    <p className="text-gray-600 text-sm">{t(`terms.${item}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('terms.section3Title')}</h2>
              <p className="text-gray-600 mt-2">{t('terms.section3Intro')}</p>
            </div>
          </div>
          
          <div className="ml-14 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3">{t('terms.weOwnTitle')}</h3>
              <div className="space-y-2">
                {['own1', 'own2', 'own3', 'own4', 'own5'].map((item) => (
                  <p key={item} className="text-gray-600 text-sm">• {t(`terms.${item}`)}</p>
                ))}
              </div>
            </div>
            <div className="bg-[#d0f4f4] rounded-xl p-4 border border-[#00D6D6]/20">
              <h3 className="font-semibold text-gray-800 mb-3">{t('terms.youGetTitle')}</h3>
              <div className="space-y-2">
                {['get1', 'get2', 'get3', 'get4', 'get5'].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-[#00D6D6]">✓</span>
                    <p className="text-gray-600 text-sm">{t(`terms.${item}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="ml-14 mt-4 text-gray-600 text-sm italic">{t('terms.licenseNote')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('terms.section4Title')}</h2>
            </div>
          </div>
          
          <div className="ml-14 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['payment1', 'payment2', 'payment3', 'payment4'].map((item) => (
                <div key={item} className="bg-gray-50 rounded-xl p-3 border-l-4 border-[#00D6D6]/30">
                  <p className="text-gray-600 text-sm">{t(`terms.${item}`)}</p>
                </div>
              ))}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('terms.cancellationTitle')}</h3>
              <div className="space-y-1">
                {['cancel1', 'cancel2', 'cancel3', 'cancel4'].map((item) => (
                  <p key={item} className="text-gray-600 text-sm">• {t(`terms.${item}`)}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('terms.section5Title')}</h2>
              <p className="text-gray-600 mt-2">{t('terms.section5Intro')}</p>
            </div>
          </div>
          
          <div className="ml-14 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">{t('terms.notLiableTitle')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {['notLiable1', 'notLiable2', 'notLiable3', 'notLiable4', 'notLiable5', 'notLiable6'].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-red-500">❌</span>
                    <p className="text-gray-600 text-sm">{t(`terms.${item}`)}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-700">{t('terms.maxLiability')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('terms.section6Title')}</h2>
            </div>
          </div>
          
          <div className="ml-14 space-y-3">
            <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('terms.lawChoice')}</span> {t('terms.lawChoiceDesc')}</p>
            <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('terms.jurisdiction')}</span> {t('terms.jurisdictionDesc')}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('terms.section7Title')}</h2>
              <p className="text-gray-600 mt-2">{t('terms.section7Intro')}</p>
            </div>
          </div>
          
          <div className="ml-14 space-y-2">
            {['change1', 'change2', 'change3', 'change4'].map((item) => (
              <p key={item} className="text-gray-600 text-sm">• {t(`terms.${item}`)}</p>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#d0f4f4] to-white rounded-2xl border border-[#00D6D6]/20 p-8 mb-8 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-2">{t('terms.questionsTitle')}</h3>
          <p className="text-gray-600 mb-4">{t('terms.questionsDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a 
              href="mailto:info@nordicaigroup.com" 
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#00D6D6] text-white font-semibold rounded-xl hover:bg-[#00C4C4] transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              info@nordicaigroup.com
            </a>
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
            {t('terms.backToHome')}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TermsOfServicePage;
