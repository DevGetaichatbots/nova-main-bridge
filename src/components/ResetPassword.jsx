import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthLayout from "./auth/AuthLayout";
import PasswordField from "./auth/PasswordField";
import FormAlert from "./auth/FormAlert";
import { useTranslation } from 'react-i18next';

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const resetToken = location.state?.resetToken || "";
  
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const user = localStorage.getItem("user");
    
    if (user) {
      navigate("/", { replace: true });
      return;
    }

    if (!email || !resetToken) {
      navigate('/forgot-password');
    }
  }, [email, resetToken, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = t('resetPassword.passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = t('resetPassword.passwordMinLength');
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = t('resetPassword.passwordComplexity');
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('resetPassword.confirmPasswordRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('resetPassword.passwordMismatch');
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

      const response = await fetch(`${apiUrl}/api/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resetToken}`,
        },
        body: JSON.stringify({
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(t('resetPassword.success'));
        // Navigate to login page
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              email,
              message: t('resetPassword.successLoginMessage') 
            } 
          });
        }, 2000);
      } else {
        setErrors({ general: data.error || data.message || t('resetPassword.error') });
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setErrors({ general: t('resetPassword.networkError') });
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
    if (strength <= 1) return t('resetPassword.strengthWeak');
    if (strength <= 2) return t('resetPassword.strengthFair');
    if (strength <= 3) return t('resetPassword.strengthGood');
    if (strength <= 4) return t('resetPassword.strengthStrong');
    return t('resetPassword.strengthVeryStrong');
  };

  return (
    <AuthLayout title={t("resetPassword.title")} description={t("resetPassword.subtitle")}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {successMessage && <FormAlert tone="success">{successMessage}</FormAlert>}
        {errors.general && <FormAlert>{errors.general}</FormAlert>}
        <PasswordField
          label={t("resetPassword.newPassword")}
          name="password"
          autoComplete="new-password"
          value={formData.password}
          error={errors.password}
          placeholder={t("resetPassword.newPasswordPlaceholder")}
          required
          disabled={isLoading}
          onChange={handleInputChange}
        />
        {formData.password && (
          <div className="auth-password-strength" aria-live="polite">
            <span>{t("resetPassword.passwordStrength")}: {getStrengthText()}</span>
            <progress value={getPasswordStrength()} max="5" />
          </div>
        )}
        <PasswordField
          label={t("resetPassword.confirmPassword")}
          name="confirmPassword"
          autoComplete="new-password"
          value={formData.confirmPassword}
          error={errors.confirmPassword}
          placeholder={t("resetPassword.confirmPasswordPlaceholder")}
          required
          disabled={isLoading}
          onChange={handleInputChange}
        />
        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading && <span className="auth-spinner" aria-hidden="true" />}
          {isLoading ? t("resetPassword.submitting") : t("resetPassword.submit")}
        </button>
        <p className="auth-form__footer">
          <Link to="/forgot-password">{t("resetPassword.back")}</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
