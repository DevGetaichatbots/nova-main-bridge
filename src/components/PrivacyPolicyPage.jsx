import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Footer from "./Footer";
import Navbar from "./Navbar";

const PrivacyPolicyPage = ({ user, setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <Navbar user={user} setUser={setUser} />
      
      <div className="bg-gradient-to-br from-[#1c2631] via-[#2a3a4a] to-[#1c2631] text-white py-16 px-6 mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00D6D6]/20 mb-6">
            <svg className="w-8 h-8 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('privacy.title')}
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-3">
            {t('privacy.subtitle')}
          </p>
          <p className="text-sm text-gray-400">{t('privacy.lastUpdated')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 flex-1">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm">
          <p className="text-gray-700 leading-relaxed">
            {t('privacy.intro1')} <span className="font-semibold text-gray-900">Nordic AI Group ApS</span> (CVR: 44368266) {t('privacy.intro2')}
          </p>
          <p className="text-gray-600 mt-4 leading-relaxed">
            {t('privacy.intro3')}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('privacy.section1Title')}</h2>
              <p className="text-gray-600 mt-2">{t('privacy.section1Intro')}</p>
            </div>
          </div>
          
          <div className="space-y-4 ml-14">
            {['contact', 'project', 'technical', 'usage'].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#00D6D6]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{t(`privacy.collect${item.charAt(0).toUpperCase() + item.slice(1)}Title`)}</p>
                  <p className="text-gray-600 text-sm">{t(`privacy.collect${item.charAt(0).toUpperCase() + item.slice(1)}Desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('privacy.section2Title')}</h2>
              <p className="text-gray-600 mt-2">{t('privacy.section2Intro')}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-14">
            {['service', 'communication', 'security', 'analysis'].map((item) => (
              <div key={item} className="bg-gray-50 rounded-xl p-4 border-l-4 border-[#00D6D6]/30">
                <p className="font-semibold text-gray-800">{t(`privacy.use${item.charAt(0).toUpperCase() + item.slice(1)}Title`)}</p>
                <p className="text-gray-600 text-sm mt-1">{t(`privacy.use${item.charAt(0).toUpperCase() + item.slice(1)}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('privacy.section3Title')}</h2>
            </div>
          </div>
          
          <div className="space-y-3 ml-14">
            <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('privacy.storageAuto')}</span> {t('privacy.storageAutoDesc')}</p>
            <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('privacy.storagePersonal')}</span> {t('privacy.storagePersonalDesc')}</p>
            <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('privacy.storageCustomer')}</span> {t('privacy.storageCustomerDesc')}</p>
            <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('privacy.storageInactive')}</span> {t('privacy.storageInactiveDesc')}</p>
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
              <h2 className="text-xl font-bold text-gray-800">{t('privacy.section4Title')}</h2>
              <p className="text-gray-600 mt-2">{t('privacy.section4Intro')}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-14">
            {[
              { icon: '📋', key: 'access' },
              { icon: '✏️', key: 'rectification' },
              { icon: '🗑️', key: 'erasure' },
              { icon: '📦', key: 'portability' },
              { icon: '🚫', key: 'object' },
              { icon: '⏸️', key: 'restriction' }
            ].map((item) => (
              <div key={item.key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{t(`privacy.right${item.key.charAt(0).toUpperCase() + item.key.slice(1)}Title`)}</p>
                  <p className="text-gray-600 text-xs">{t(`privacy.right${item.key.charAt(0).toUpperCase() + item.key.slice(1)}Desc`)}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 ml-14 p-4 bg-[#d0f4f4] rounded-xl border border-[#00D6D6]/20">
            <p className="text-gray-700 text-sm">{t('privacy.contactRights')}</p>
            <a href="mailto:info@nordicaigroup.com" className="text-[#00D6D6] font-semibold hover:underline">info@nordicaigroup.com</a>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('privacy.section5Title')}</h2>
              <p className="text-gray-600 mt-2">{t('privacy.section5Intro')}</p>
            </div>
          </div>
          
          <div className="space-y-2 ml-14">
            <p className="text-gray-600">• {t('privacy.thirdPartyCloud')}</p>
            <p className="text-gray-600">• {t('privacy.thirdPartyAnalytics')}</p>
            <p className="text-gray-600">• {t('privacy.thirdPartyComm')}</p>
            <p className="text-gray-600">• {t('privacy.thirdPartyPayment')}</p>
          </div>
          <p className="mt-4 ml-14 text-gray-700 font-medium">{t('privacy.noSell')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-8 shadow-sm hover:shadow-lg hover:border-[#00D6D6]/20 transition-all duration-300">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t('privacy.section6Title')}</h2>
              <p className="text-gray-600 mt-2">{t('privacy.section6Intro')}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-14">
            {['ssl', 'access', 'hosting', 'backup'].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00D6D6]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{t(`privacy.security${item.charAt(0).toUpperCase() + item.slice(1)}Title`)}</p>
                  <p className="text-gray-500 text-xs">{t(`privacy.security${item.charAt(0).toUpperCase() + item.slice(1)}Desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#d0f4f4] to-white rounded-2xl border border-[#00D6D6]/20 p-8 mb-8 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-2">{t('privacy.questionsTitle')}</h3>
          <p className="text-gray-600 mb-4">{t('privacy.questionsDesc')}</p>
          <a 
            href="mailto:info@nordicaigroup.com" 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00D6D6] text-white font-semibold rounded-xl hover:bg-[#00C4C4] transition-all duration-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            info@nordicaigroup.com
          </a>
        </div>

        <div className="text-center">
          <button 
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00D6D6] text-white font-semibold rounded-xl hover:bg-[#00C4C4] hover:scale-105 transition-all duration-300 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('privacy.backToHome')}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
