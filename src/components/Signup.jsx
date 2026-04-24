import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { handleApiError } from '../utils/errorHandler';

const Signup = ({ setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
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

    if (!formData.firstName.trim()) {
      newErrors.firstName = t('signup.firstNameRequired');
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t('signup.lastNameRequired');
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
      
      console.log('🔍 Testing API connection...');
      const connectionTest = await testApiConnection();
      
      if (!connectionTest.success) {
        throw new Error(`Backend not accessible: ${connectionTest.error}`);
      }
      
      const apiUrl = getApiBaseUrl();
      console.log('📡 Attempting signup with API URL:', apiUrl);

      const response = await fetch(`${apiUrl}/api/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
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

        console.log("✅ Registration successful:", data.user.email);
        navigate("/");
      } else {
        const errorMessage = data.error || data.message || t('signup.signupError');
        setErrors({ general: errorMessage });
        
        if (response.status !== 400 && response.status !== 401) {
          await handleApiError(
            { message: errorMessage, status: response.status },
            { endpoint: '/api/signup', method: 'POST' }
          );
        }
      }
    } catch (error) {
      console.error("Signup error:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      if (error.name === "TypeError" && error.message.includes("fetch")) {
        setErrors({
          general: t('signup.connectionError'),
        });
      } else if (error.message.includes("Network") || error.message.includes("Failed to fetch")) {
        setErrors({
          general: t('signup.networkError'),
        });
      } else if (error.message.includes("CORS")) {
        setErrors({
          general: t('signup.corsError'),
        });
      } else {
        setErrors({
          general: `${t('signup.signupError')}: ${error.message}`,
        });
      }
      
      await handleApiError(error, { 
        endpoint: '/api/signup', 
        method: 'POST' 
      });
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

  const getStrengthColor = () => {
    const strength = getPasswordStrength();
    if (strength <= 1) return "bg-red-500";
    if (strength <= 2) return "bg-orange-500";
    if (strength <= 3) return "bg-yellow-500";
    if (strength <= 4) return "bg-emerald-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    const strength = getPasswordStrength();
    if (strength <= 1) return t('signup.strengthWeak');
    if (strength <= 2) return t('signup.strengthFair');
    if (strength <= 3) return t('signup.strengthGood');
    if (strength <= 4) return t('signup.strengthStrong');
    return t('signup.strengthVeryStrong');
  };

  const handleBack = () => {
    navigate("/");
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
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span>{t('signup.backToHome')}</span>
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
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
          </div>

          <h2
            className="text-4xl font-bold mb-2"
            style={{
              color: "#1c2631",
            }}
          >
            {t('signup.title')}
          </h2>
          <p className="text-lg" style={{color: "#475569"}}>
            {t('signup.subtitle')}
          </p>
        </div>

        {/* Signup Form */}
        <div
          className="relative rounded-3xl shadow-2xl border p-8"
          style={{
            background: "linear-gradient(145deg, rgba(0, 214, 214, 0.15) 0%, rgba(112, 211, 213, 0.1) 100%)",
            backdropFilter: "blur(10px)",
            borderColor: "rgba(0, 214, 214, 0.3)",
          }}
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* General Error Message */}
            {errors.general && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {errors.general}
                </p>
              </div>
            )}

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              {/* First Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold" style={{color: "#1c2631"}}>
                  {t('signup.firstName')}
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${
                    errors.firstName
                      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
                      : "focus:ring-[#00D6D6]/50"
                  }`}
                  style={{
                    borderColor: errors.firstName ? "" : "rgba(0, 214, 214, 0.3)",
                    color: "#1c2631"
                  }}
                  onFocus={(e) => {
                    if (!errors.firstName) {
                      e.target.style.borderColor = "#00D6D6";
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.firstName) {
                      e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                    }
                  }}
                  placeholder={t('signup.firstNamePlaceholder')}
                />
                {errors.firstName && (
                  <p className="text-red-400 text-xs animate-shake">
                    {errors.firstName}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold" style={{color: "#1c2631"}}>
                  {t('signup.lastName')}
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${
                    errors.lastName
                      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
                      : "focus:ring-[#00D6D6]/50"
                  }`}
                  style={{
                    borderColor: errors.lastName ? "" : "rgba(0, 214, 214, 0.3)",
                    color: "#1c2631"
                  }}
                  onFocus={(e) => {
                    if (!errors.lastName) {
                      e.target.style.borderColor = "#00D6D6";
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.lastName) {
                      e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                    }
                  }}
                  placeholder={t('signup.lastNamePlaceholder')}
                />
                {errors.lastName && (
                  <p className="text-red-400 text-xs animate-shake">
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{color: "#1c2631"}}>
                {t('signup.email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5"
                    style={{color: "#64748b"}}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
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
                  placeholder={t('signup.emailPlaceholder')}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-sm animate-shake flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{color: "#1c2631"}}>
                {t('signup.password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5"
                    style={{color: "#64748b"}}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full pl-12 pr-12 py-4 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${
                    errors.password
                      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
                      : "focus:ring-[#00D6D6]/50"
                  }`}
                  style={{
                    borderColor: errors.password ? "" : "rgba(0, 214, 214, 0.3)",
                    color: "#1c2631"
                  }}
                  onFocus={(e) => {
                    if (!errors.password) {
                      e.target.style.borderColor = "#00D6D6";
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.password) {
                      e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                    }
                  }}
                  placeholder={t('signup.passwordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors duration-200"
                  style={{color: "#64748b"}}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#00D6D6"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
                >
                  {showPassword ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{color: "#64748b"}}>
                      {t('signup.passwordStrength')}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: getPasswordStrength() <= 2
                          ? "#ef4444"
                          : getPasswordStrength() <= 3
                            ? "#eab308"
                            : "#00D6D6"
                      }}
                    >
                      {getStrengthText()}
                    </span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{backgroundColor: "#e2e8f0"}}>
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(getPasswordStrength() / 5) * 100}%`,
                        backgroundColor: getPasswordStrength() <= 2
                          ? "#ef4444"
                          : getPasswordStrength() <= 3
                            ? "#eab308"
                            : "#00D6D6"
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {errors.password && (
                <p className="text-red-400 text-sm animate-shake flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{color: "#1c2631"}}>
                {t('signup.confirmPassword')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5"
                    style={{color: "#64748b"}}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-12 pr-12 py-4 rounded-xl bg-white border transition-all duration-300 focus:outline-none focus:ring-2 ${
                    errors.confirmPassword
                      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
                      : "focus:ring-[#00D6D6]/50"
                  }`}
                  style={{
                    borderColor: errors.confirmPassword ? "" : "rgba(0, 214, 214, 0.3)",
                    color: "#1c2631"
                  }}
                  onFocus={(e) => {
                    if (!errors.confirmPassword) {
                      e.target.style.borderColor = "#00D6D6";
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.confirmPassword) {
                      e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                    }
                  }}
                  placeholder={t('signup.confirmPasswordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors duration-200"
                  style={{color: "#64748b"}}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#00D6D6"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
                >
                  {showConfirmPassword ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-sm animate-shake flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Terms and Conditions */}
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  id="acceptTerms"
                  name="acceptTerms"
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 focus:ring-[#00D6D6]"
                  style={{accentColor: "#00D6D6"}}
                />
                <label
                  htmlFor="acceptTerms"
                  className="ml-2 block text-sm"
                  style={{color: "#475569"}}
                >
                  {t('signup.termsLabel')}
                </label>
              </div>
              {errors.acceptTerms && (
                <p className="text-red-400 text-sm animate-shake flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {errors.acceptTerms}
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
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {t('signup.submitting')}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                    {t('signup.submit')}
                  </>
                )}
              </span>
            </button>
          </form>

          

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p style={{color: "#64748b"}}>
              {t('signup.hasAccount')}{" "}
              <Link
                to="/login"
                className="font-medium transition-colors duration-200"
                style={{color: "#00D6D6"}}
                onMouseEnter={(e) => e.target.style.color = "#0ea5e9"}
                onMouseLeave={(e) => e.target.style.color = "#00D6D6"}
              >
                {t('signup.loginLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        /* Placeholder Colors */
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

export default Signup;
