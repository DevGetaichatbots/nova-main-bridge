import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { handleApiError } from '../utils/errorHandler';

const CompanySignup = ({ setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const user = localStorage.getItem("user");
    
    if (user) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = t('companySignup.companyNameRequired');
    }
    if (!formData.email) {
      newErrors.email = t('signup.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('signup.emailInvalid');
    }
    if (!formData.password) {
      newErrors.password = t('signup.passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = t('signup.passwordMinLength');
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = t('signup.passwordComplexity');
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('signup.confirmPasswordRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('signup.passwordMismatch');
    }
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = t('signup.acceptTerms');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { getApiBaseUrl, testApiConnection } = await import('../utils/apiConfig.js');
      
      const connectionTest = await testApiConnection();
      if (!connectionTest.success) {
        throw new Error(`Backend not accessible: ${connectionTest.error}`);
      }
      
      const apiUrl = getApiBaseUrl();

      const response = await fetch(`${apiUrl}/api/company/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          companyName: formData.companyName,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));

        if (setUser) {
          setUser(data.user);
        }

        window.dispatchEvent(new Event("authChange"));
        navigate("/company-portal");
      } else {
        const errorMessage = data.error || data.message || t('companySignup.signupError');
        setErrors({ general: errorMessage });
        
        if (response.status !== 400 && response.status !== 401) {
          await handleApiError(
            { message: errorMessage, status: response.status },
            { endpoint: '/api/company/register', method: 'POST' }
          );
        }
      }
    } catch (error) {
      console.error("Company signup error:", error);
      if (error.message.includes("fetch")) {
        setErrors({ general: t('signup.connectionError') });
      } else {
        setErrors({ general: `${t('companySignup.signupError')}: ${error.message}` });
      }
      await handleApiError(error, { endpoint: '/api/company/register', method: 'POST' });
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return strength;
  };

  const getStrengthText = () => {
    const strength = getPasswordStrength();
    if (strength <= 1) return t('signup.strengthWeak');
    if (strength <= 2) return t('signup.strengthFair');
    if (strength <= 3) return t('signup.strengthGood');
    if (strength <= 4) return t('signup.strengthStrong');
    return t('signup.strengthVeryStrong');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-white">
      <button
        onClick={() => navigate("/")}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105"
        style={{
          background: "#00D6D6",
          boxShadow: "0 8px 25px rgba(0, 214, 214, 0.3)",
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{t('signup.backToHome')}</span>
      </button>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full opacity-10 animate-pulse bg-gradient-to-r from-cyan-400 to-cyan-500"></div>
        <div className="absolute top-3/4 right-1/4 w-24 h-24 rounded-xl opacity-10 animate-bounce bg-gradient-to-r from-cyan-300 to-cyan-400"></div>
      </div>

      <div className="max-w-lg w-full space-y-8 relative z-10">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{
                background: "#00D6D6",
                boxShadow: "0 0 40px rgba(0, 214, 214, 0.4)",
              }}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-2" style={{ color: "#1c2631" }}>
            {t('companySignup.title')}
          </h2>
          <p className="text-lg" style={{ color: "#475569" }}>
            {t('companySignup.subtitle')}
          </p>
        </div>

        <div
          className="relative rounded-3xl shadow-2xl border p-8"
          style={{
            background: "linear-gradient(145deg, rgba(0, 214, 214, 0.15) 0%, rgba(112, 211, 213, 0.1) 100%)",
            backdropFilter: "blur(10px)",
            borderColor: "rgba(0, 214, 214, 0.3)",
          }}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
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

            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{ color: "#1c2631" }}>
                {t('companySignup.companyName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${errors.companyName ? 'border-red-500/50' : ''}`}
                style={{ borderColor: errors.companyName ? '' : 'rgba(0, 214, 214, 0.3)', color: '#1c2631' }}
                placeholder={t('companySignup.companyNamePlaceholder')}
              />
              {errors.companyName && <p className="text-red-400 text-xs">{errors.companyName}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{ color: "#1c2631" }}>
                {t('signup.email')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5" style={{ color: "#64748b" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-12 pr-4 py-3 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${errors.email ? 'border-red-500/50' : ''}`}
                  style={{ borderColor: errors.email ? '' : 'rgba(0, 214, 214, 0.3)', color: '#1c2631' }}
                  placeholder={t('signup.emailPlaceholder')}
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{ color: "#1c2631" }}>
                {t('signup.password')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5" style={{ color: "#64748b" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full pl-12 pr-12 py-3 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${errors.password ? 'border-red-500/50' : ''}`}
                  style={{ borderColor: errors.password ? '' : 'rgba(0, 214, 214, 0.3)', color: '#1c2631' }}
                  placeholder={t('signup.passwordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  style={{ color: "#64748b" }}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: "#64748b" }}>{t('signup.passwordStrength')}</span>
                    <span className="text-xs font-medium" style={{ color: getPasswordStrength() <= 2 ? "#ef4444" : getPasswordStrength() <= 3 ? "#eab308" : "#00D6D6" }}>
                      {getStrengthText()}
                    </span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: "#e2e8f0" }}>
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(getPasswordStrength() / 5) * 100}%`,
                        backgroundColor: getPasswordStrength() <= 2 ? "#ef4444" : getPasswordStrength() <= 3 ? "#eab308" : "#00D6D6"
                      }}
                    ></div>
                  </div>
                </div>
              )}
              {errors.password && <p className="text-red-400 text-xs">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{ color: "#1c2631" }}>
                {t('signup.confirmPassword')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5" style={{ color: "#64748b" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-12 pr-12 py-3 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${errors.confirmPassword ? 'border-red-500/50' : ''}`}
                  style={{ borderColor: errors.confirmPassword ? '' : 'rgba(0, 214, 214, 0.3)', color: '#1c2631' }}
                  placeholder={t('signup.confirmPasswordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  style={{ color: "#64748b" }}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword}</p>}
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleInputChange}
                className="w-5 h-5 mt-0.5 rounded border-gray-300 text-[#00D6D6] focus:ring-[#00D6D6]"
              />
              <label className="text-sm" style={{ color: "#475569" }}>
                {t('signup.termsLabel')}
              </label>
            </div>
            {errors.acceptTerms && <p className="text-red-400 text-xs">{errors.acceptTerms}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "#00D6D6",
                boxShadow: "0 8px 25px rgba(0, 214, 214, 0.4)",
              }}
            >
              {isLoading ? t('companySignup.submitting') : t('companySignup.submit')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: "#64748b" }}>
              {t('signup.hasAccount')}{" "}
              <Link to="/login" className="font-semibold hover:underline" style={{ color: "#00D6D6" }}>
                {t('signup.loginLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanySignup;
