import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Footer from "./Footer";
import Navbar from "./Navbar";

const SecurityGDPR = ({ user, setUser }) => {
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
            {t('securityGdpr.title')}
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-4">
            {t('securityGdpr.subtitle')}
          </p>
          <p className="text-sm text-gray-400">
            {t('securityGdpr.lastUpdated')}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">{t('securityGdpr.compliantTitle')}</h2>
          </div>
          <p className="text-gray-600 mb-4">
            <strong>Nordic AI Group ApS</strong> (CVR: 44368266) {t('securityGdpr.compliantDesc1')}
          </p>
          <p className="text-gray-600">
            {t('securityGdpr.compliantDesc2')}
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('securityGdpr.obligationsTitle')}</h2>
          <p className="text-gray-600 mb-6">{t('securityGdpr.obligationsSubtitle')}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.encryptedTitle')}</h3>
              </div>
              <p className="text-sm text-gray-500">{t('securityGdpr.encryptedDesc')}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.euHostingTitle')}</h3>
              </div>
              <p className="text-sm text-gray-500">{t('securityGdpr.euHostingDesc')}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.minimalDataTitle')}</h3>
              </div>
              <p className="text-sm text-gray-500">{t('securityGdpr.minimalDataDesc')}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.accessControlTitle')}</h3>
              </div>
              <p className="text-sm text-gray-500">{t('securityGdpr.accessControlDesc')}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.dpaTitle')}</h3>
              </div>
              <p className="text-sm text-gray-500">{t('securityGdpr.dpaDesc')}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:scale-[1.02] hover:border-[#00D6D6]/30 transition-all duration-300 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.transparencyTitle')}</h3>
              </div>
              <p className="text-sm text-gray-500">{t('securityGdpr.transparencyDesc')}</p>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('securityGdpr.rightsTitle')}</h2>
          <p className="text-gray-600 mb-6">{t('securityGdpr.rightsSubtitle')}</p>
          
          <div className="space-y-4">
            <div className="bg-white rounded-xl border-l-4 border-[#00D6D6] p-6 shadow-sm hover:shadow-lg hover:translate-x-1 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.rightAccess')}</h3>
              </div>
              <p className="text-sm text-gray-500 ml-11">{t('securityGdpr.rightAccessDesc')}</p>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-[#00D6D6] p-6 shadow-sm hover:shadow-lg hover:translate-x-1 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.rightRectification')}</h3>
              </div>
              <p className="text-sm text-gray-500 ml-11">{t('securityGdpr.rightRectificationDesc')}</p>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-[#00D6D6] p-6 shadow-sm hover:shadow-lg hover:translate-x-1 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.rightErasure')}</h3>
              </div>
              <p className="text-sm text-gray-500 ml-11">{t('securityGdpr.rightErasureDesc')}</p>
            </div>

            <div className="bg-white rounded-xl border-l-4 border-[#00D6D6] p-6 shadow-sm hover:shadow-lg hover:translate-x-1 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#00D6D6]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800">{t('securityGdpr.rightPortability')}</h3>
              </div>
              <p className="text-sm text-gray-500 ml-11">{t('securityGdpr.rightPortabilityDesc')}</p>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('securityGdpr.securityMeasuresTitle')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-[#d0f4f4] to-white rounded-xl border border-[#00D6D6]/20 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">{t('securityGdpr.technicalMeasures')}</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('securityGdpr.tech1')}
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('securityGdpr.tech2')}
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('securityGdpr.tech3')}
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('securityGdpr.tech4')}
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-[#d0f4f4] to-white rounded-xl border border-[#00D6D6]/20 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">{t('securityGdpr.orgMeasures')}</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('securityGdpr.org1')}
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('securityGdpr.org2')}
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('securityGdpr.org3')}
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('securityGdpr.org4')}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#1c2631] to-[#2a3a4a] rounded-2xl p-8 text-white mb-8">
          <h2 className="text-2xl font-bold mb-4">{t('securityGdpr.contactTitle')}</h2>
          <p className="text-gray-300 mb-6">{t('securityGdpr.contactDesc')}</p>
          
          <div className="bg-white/10 rounded-xl p-6">
            <p className="font-semibold text-lg mb-2">Nordic AI Group ApS</p>
            <p className="text-gray-300 mb-1">Data Protection Officer</p>
            <div className="flex flex-col gap-2 mt-4">
              <a href="mailto:info@nordicaigroup.com" className="flex items-center gap-2 text-[#00D6D6] hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                info@nordicaigroup.com
              </a>
              <a href="tel:+4553721659" className="flex items-center gap-2 text-[#00D6D6] hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                +45 53 72 16 59
              </a>
            </div>
            <p className="text-gray-400 text-sm mt-4">CVR: 44368266</p>
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
            {t('securityGdpr.backToHome')}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SecurityGDPR;
