import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthLayout from "./auth/AuthLayout";
import AuthField from "./auth/AuthField";
import FormAlert from "./auth/FormAlert";

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

  return (
    <AuthLayout title={t("forgotPassword.title")} description={t("forgotPassword.subtitle")}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {successMessage && <FormAlert tone="success">{successMessage}</FormAlert>}
        {errors.general && <FormAlert>{errors.general}</FormAlert>}
        <AuthField
          label={t("forgotPassword.email")}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          placeholder={t("forgotPassword.emailPlaceholder")}
          required
          disabled={isLoading}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((current) => ({ ...current, email: "" }));
          }}
        />
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading && <span className="auth-spinner" aria-hidden="true" />}
          {isLoading ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
        </button>
        <p className="auth-form__footer">
          <span>{t("forgotPassword.knowPassword")}</span>
          <Link to="/login">{t("forgotPassword.loginHere")}</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
