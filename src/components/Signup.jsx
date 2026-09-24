import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthField from "./auth/AuthField";
import AuthLayout from "./auth/AuthLayout";
import FormAlert from "./auth/FormAlert";
import PasswordField from "./auth/PasswordField";
import PasswordRequirements from "./auth/PasswordRequirements";
import { resolvePostAuthRoute } from "../utils/authRedirect";
import { handleApiError } from "../utils/errorHandler";

const Signup = ({ setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const fieldRefs = useRef({});
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("user")) {
      navigate(resolvePostAuthRoute(location.state), { replace: true });
    }
  }, [location.state, navigate]);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };

  const validateField = (name, value) => {
    if (name === "companyName" && !value.trim()) {
      return t("companySignup.companyNameRequired");
    }
    if (name === "email") {
      if (!value) return t("signup.emailRequired");
      if (!/\S+@\S+\.\S+/.test(value)) return t("signup.emailInvalid");
    }
    if (name === "password") {
      if (!value) return t("signup.passwordRequired");
      if (value.length < 8) return t("signup.passwordMinLength");
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return t("signup.passwordComplexity");
      }
    }
    if (name === "confirmPassword") {
      if (!value) return t("signup.confirmPasswordRequired");
      if (value !== formData.password) return t("signup.passwordMismatch");
    }
    return "";
  };

  const validateOnBlur = (event) => {
    const { name, value } = event.target;
    setErrors((current) => ({ ...current, [name]: validateField(name, value) }));
  };

  const validateForm = () => {
    const fieldOrder = ["companyName", "email", "password", "confirmPassword"];
    const nextErrors = Object.fromEntries(
      fieldOrder.map((name) => [name, validateField(name, formData[name])]),
    );
    if (!formData.acceptTerms) nextErrors.acceptTerms = t("signup.acceptTerms");

    setErrors(nextErrors);
    const firstInvalid = [...fieldOrder, "acceptTerms"].find((name) => nextErrors[name]);
    if (firstInvalid) fieldRefs.current[firstInvalid]?.focus();
    return !firstInvalid;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors((current) => ({ ...current, general: "" }));
    // Nova only has company accounts: the owner registers the company here.
    const endpoint = "/api/company/register";

    try {
      const { getApiBaseUrl, testApiConnection } = await import("../utils/apiConfig.js");
      const connectionTest = await testApiConnection();
      if (!connectionTest.success) {
        throw new Error(`Backend not accessible: ${connectionTest.error}`);
      }

      const payload = {
        companyName: formData.companyName,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      };

      const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!data.success) {
        const message = data.error || data.message || t("companySignup.signupError");
        setErrors((current) => ({ ...current, general: message }));
        if (response.status !== 400 && response.status !== 401) {
          await handleApiError(
            { message, status: response.status },
            { endpoint, method: "POST" },
          );
        }
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.access_token) localStorage.setItem("accessToken", data.access_token);
      setUser?.(data.user);
      window.dispatchEvent(new Event("authChange"));

      navigate("/company-portal");
    } catch (error) {
      const message = error.message?.includes("fetch")
        ? t("signup.connectionError")
        : t("companySignup.signupError");
      setErrors((current) => ({ ...current, general: message }));
      await handleApiError(error, { endpoint, method: "POST" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("companySignup.title")}
      description={t("companySignup.subtitle")}
      size="wide"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {errors.general && <FormAlert>{errors.general}</FormAlert>}

        <AuthField
          ref={(node) => { fieldRefs.current.companyName = node; }}
          label={t("companySignup.companyName")}
          name="companyName"
          type="text"
          autoComplete="organization"
          value={formData.companyName}
          error={errors.companyName}
          placeholder={t("companySignup.companyNamePlaceholder")}
          required
          onChange={updateField}
          onBlur={validateOnBlur}
        />

        <AuthField
          ref={(node) => { fieldRefs.current.email = node; }}
          label={t("signup.ownerEmail")}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={formData.email}
          error={errors.email}
          hint={t("signup.ownerEmailHint")}
          placeholder={t("signup.emailPlaceholder")}
          required
          onChange={updateField}
          onBlur={validateOnBlur}
        />

        <PasswordField
          ref={(node) => { fieldRefs.current.password = node; }}
          label={t("signup.password")}
          name="password"
          autoComplete="new-password"
          value={formData.password}
          error={errors.password}
          placeholder={t("signup.passwordPlaceholder")}
          required
          onChange={updateField}
          onBlur={validateOnBlur}
        />
        <PasswordRequirements password={formData.password} />
        <PasswordField
          ref={(node) => { fieldRefs.current.confirmPassword = node; }}
          label={t("signup.confirmPassword")}
          name="confirmPassword"
          autoComplete="new-password"
          value={formData.confirmPassword}
          error={errors.confirmPassword}
          placeholder={t("signup.confirmPasswordPlaceholder")}
          required
          onChange={updateField}
          onBlur={validateOnBlur}
        />

        <label className={`auth-terms ${errors.acceptTerms ? "has-error" : ""}`}>
          <input
            ref={(node) => { fieldRefs.current.acceptTerms = node; }}
            type="checkbox"
            name="acceptTerms"
            checked={formData.acceptTerms}
            aria-invalid={Boolean(errors.acceptTerms)}
            onChange={updateField}
          />
          <span>
            {t("signup.termsPrefix")} <Link to="/terms-of-service">{t("signup.termsLink")}</Link>{" "}
            {t("signup.termsAnd")} <Link to="/privacy-policy">{t("signup.privacyLink")}</Link>.
            {errors.acceptTerms && <span className="auth-field__error"> {errors.acceptTerms}</span>}
          </span>
        </label>

        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading && <span className="auth-spinner" aria-hidden="true" />}
          {isLoading ? t("companySignup.submitting") : t("companySignup.submit")}
        </button>

        <p className="auth-form__footer">
          <span>{t("signup.hasAccount")}</span>
          <Link to="/login" state={location.state}>{t("signup.loginLink")}</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Signup;
