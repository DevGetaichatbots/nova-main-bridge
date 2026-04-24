import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ForgotPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const user = localStorage.getItem("user");
    
    if (user) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const validateForm = () => {
    const newErrors = {};

    if (!email) {
      newErrors.email = t('forgotPassword.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('forgotPassword.emailInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const { getApiBaseUrl } = await import('../utils/apiConfig.js');
      const apiUrl = getApiBaseUrl();

      const response = await fetch(`${apiUrl}/api/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(t('forgotPassword.success'));
        // Navigate to OTP verification page with email
        setTimeout(() => {
          navigate('/verify-otp', { state: { email } });
        }, 2000);
      } else {
        setErrors({ general: data.error || data.message || t('forgotPassword.error') });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setErrors({ general: t('forgotPassword.networkError') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/login');
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{
        background: "#ffffff",
      }}
    >
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105"
        style={{
          background: "#00D6D6",
          boxShadow: "0 8px 25px rgba(0, 214, 214, 0.3)",
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{t('forgotPassword.backToLogin')}</span>
      </button>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full opacity-10 animate-pulse bg-gradient-to-r from-cyan-400 to-cyan-500"></div>
        <div className="absolute top-3/4 right-1/4 w-24 h-24 rounded-xl opacity-10 animate-bounce bg-gradient-to-r from-cyan-300 to-cyan-400"></div>
        <div className="absolute top-1/2 right-1/3 w-20 h-20 rounded-full opacity-10 animate-ping bg-gradient-to-r from-cyan-500 to-cyan-600"></div>
        <div className="absolute bottom-1/4 left-1/3 w-28 h-28 rounded-2xl opacity-10 animate-pulse bg-gradient-to-r from-cyan-400 to-cyan-500"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center animate-pulse-glow"
              style={{
                background: "#00D6D6",
                boxShadow: "0 0 40px rgba(0, 214, 214, 0.4)",
              }}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          </div>

          <h2
            className="text-4xl font-bold mb-2"
            style={{
              color: "#1c2631",
            }}
          >
            {t('forgotPassword.title')}
          </h2>
          <p className="text-lg" style={{color: "#475569"}}>
            {t('forgotPassword.subtitle')}
          </p>
        </div>

        {/* Form */}
        <div
          className="relative rounded-3xl shadow-2xl border p-8"
          style={{
            background: "linear-gradient(145deg, rgba(0, 214, 214, 0.15) 0%, rgba(112, 211, 213, 0.1) 100%)",
            backdropFilter: "blur(10px)",
            borderColor: "rgba(0, 214, 214, 0.3)",
          }}
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Success Message */}
            {successMessage && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-emerald-400 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {successMessage}
                </p>
              </div>
            )}

            {/* General Error Message */}
            {errors.general && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.general}
                </p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{color: "#1c2631"}}>
                {t('forgotPassword.email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5" style={{color: "#64748b"}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((prev) => ({ ...prev, email: "" }));
                    }
                  }}
                  className={`w-full pl-12 pr-4 py-4 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${
                    errors.email
                      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
                      : "focus:ring-[#00D6D6]/50"
                  }`}
                  style={{
                    borderColor: errors.email ? "" : "rgba(0, 214, 214, 0.3)",
                    color: "#1c2631"
                  }}
                  onFocus={(e) => {
                    if (!errors.email) {
                      e.target.style.borderColor = "#00D6D6";
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.email) {
                      e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                    }
                  }}
                  placeholder={t('forgotPassword.emailPlaceholder')}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-sm animate-shake flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-4 px-4 border border-transparent rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
                isLoading ? "animate-pulse" : ""
              }`}
              style={{
                background: "#00D6D6",
                boxShadow: "0 10px 30px rgba(0, 214, 214, 0.4)",
              }}
            >
              {/* Shimmer Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>

              <span className="relative z-10 flex items-center">
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('forgotPassword.submitting')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {t('forgotPassword.submit')}
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-6 text-center">
            <p style={{color: "#64748b"}}>
              {t('forgotPassword.knowPassword')}{" "}
              <Link
                to="/login"
                className="font-medium transition-colors duration-200"
                style={{color: "#00D6D6"}}
                onMouseEnter={(e) => e.target.style.color = "#0ea5e9"}
                onMouseLeave={(e) => e.target.style.color = "#00D6D6"}
              >
                {t('forgotPassword.loginHere')}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        input::placeholder {
          color: #94a3b8 !important;
          opacity: 1;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(0, 214, 214, 0.4); }
          50% { box-shadow: 0 0 60px rgba(0, 214, 214, 0.7); }
        }

        .animate-shake {
          animation: shake 0.5s ease-out;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ForgotPassword;
