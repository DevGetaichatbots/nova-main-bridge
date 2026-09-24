import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthLayout from "./auth/AuthLayout";
import FormAlert from "./auth/FormAlert";
import { useTranslation } from 'react-i18next';

const VerifyOTP = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    const user = localStorage.getItem("user");
    
    if (user) {
      navigate("/", { replace: true });
      return;
    }

    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  const handleChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Clear error when user types
    if (errors.otp) {
      setErrors((prev) => ({ ...prev, otp: "" }));
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = pastedData.split('');
    while (newOtp.length < 6) {
      newOtp.push('');
    }
    setOtp(newOtp.slice(0, 6));
    
    // Focus last filled input
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const validateForm = () => {
    const newErrors = {};
    const otpString = otp.join('');

    if (otpString.length !== 6) {
      newErrors.otp = t('verifyOTP.incompleteCode');
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

      const response = await fetch(`${apiUrl}/api/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email,
          otp: otp.join('')
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(t('verifyOTP.success'));
        // Navigate to reset password page with resetToken from response
        setTimeout(() => {
          navigate('/reset-password', { 
            state: { 
              email, 
              resetToken: data.data?.resetToken || data.resetToken 
            } 
          });
        }, 1500);
      } else {
        setErrors({ general: data.error || data.message || t('verifyOTP.invalidCode') });
        // Clear OTP on error
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      setErrors({ general: t('verifyOTP.networkError') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={t("verifyOTP.title")} description={`${t("verifyOTP.subtitle")} ${email}`}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {successMessage && <FormAlert tone="success">{successMessage}</FormAlert>}
        {errors.general && <FormAlert>{errors.general}</FormAlert>}
        <div className={`auth-field ${errors.otp ? "has-error" : ""}`}>
          <label htmlFor="auth-otp-0">{t("verifyOTP.enterCode")}</label>
          <div className="auth-otp-inputs">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`auth-otp-${index}`}
                ref={(node) => { inputRefs.current[index] = node; }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                aria-label={`${t("verifyOTP.code")} ${index + 1}`}
                aria-invalid={Boolean(errors.otp || errors.general)}
                maxLength={1}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={index === 0 ? handlePaste : undefined}
                disabled={isLoading}
              />
            ))}
          </div>
          {errors.otp && <p className="auth-field__error">{errors.otp}</p>}
        </div>
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading && <span className="auth-spinner" aria-hidden="true" />}
          {isLoading ? t("verifyOTP.submitting") : t("verifyOTP.submit")}
        </button>
        <div className="auth-form__meta">
          <Link to="/forgot-password">{t("verifyOTP.back")}</Link>
          <button type="button" onClick={() => navigate("/forgot-password", { state: { email } })} disabled={isLoading}>
            {t("verifyOTP.resend")}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
};

export default VerifyOTP;
