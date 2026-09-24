import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthField from "./auth/AuthField";
import AuthLayout from "./auth/AuthLayout";
import FormAlert from "./auth/FormAlert";
import PasswordField from "./auth/PasswordField";
import { handleApiError } from "../utils/errorHandler";
import { buildPostAuthNavigation } from "../utils/authRedirect";
import { crossHostRedirect } from "../utils/hostAccess";

const Login = ({ setUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (localStorage.getItem("user")) {
      const postAuth = buildPostAuthNavigation(location.state);
      navigate(postAuth.to, { state: postAuth.state, replace: true });
      return;
    }

    if (localStorage.getItem("auth_redirect_message") === "session_expired") {
      setErrors({ general: t("login.sessionExpired") });
      localStorage.removeItem("auth_redirect_message");
    }

    if (location.state?.message) setSuccessMessage(location.state.message);
    if (location.state?.email) {
      setFormData((current) => ({ ...current, email: location.state.email }));
    }
  }, [location.state, navigate, t]);

  const validateField = (name, value) => {
    if (name === "email") {
      if (!value) return t("login.emailRequired");
      if (!/\S+@\S+\.\S+/.test(value)) return t("login.emailInvalid");
    }
    if (name === "password") {
      if (!value) return t("login.passwordRequired");
      if (value.length < 6) return t("login.passwordMinLength");
    }
    return "";
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };

  const validateOnBlur = (event) => {
    const { name, value } = event.target;
    setErrors((current) => ({ ...current, [name]: validateField(name, value) }));
  };

  const validateForm = () => {
    const nextErrors = {
      email: validateField("email", formData.email),
      password: validateField("password", formData.password),
    };
    const invalidField = Object.keys(nextErrors).find((key) => nextErrors[key]);
    setErrors((current) => ({ ...current, ...nextErrors }));
    if (invalidField === "email") emailRef.current?.focus();
    if (invalidField === "password") passwordRef.current?.focus();
    return !invalidField;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors((current) => ({ ...current, general: "" }));

    try {
      const { getApiBaseUrl, testApiConnection } = await import("../utils/apiConfig.js");
      const connectionTest = await testApiConnection();
      if (!connectionTest.success) {
        throw new Error(`Backend not accessible: ${connectionTest.error}`);
      }

      const response = await fetch(`${getApiBaseUrl()}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!data.success) {
        const message = data.error || data.message || t("login.loginError");
        setErrors((current) => ({ ...current, general: message }));
        if (response.status !== 401) {
          await handleApiError(
            { message, status: response.status },
            { endpoint: "/api/login", method: "POST" },
          );
        }
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.access_token) localStorage.setItem("accessToken", data.access_token);
      setUser?.(data.user);
      window.dispatchEvent(new Event("authChange"));
      if (crossHostRedirect(data.redirectUrl)) return;
      const postAuth = buildPostAuthNavigation(location.state);
      navigate(postAuth.to, { state: postAuth.state });
    } catch (error) {
      setErrors((current) => ({ ...current, general: t("login.networkError") }));
      await handleApiError(error, { endpoint: "/api/login", method: "POST" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow={t("login.title")}
      title={t("login.welcomeBack")}
      description={t("login.subtitle")}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {successMessage && <FormAlert tone="success">{successMessage}</FormAlert>}
        {errors.general && <FormAlert>{errors.general}</FormAlert>}

        <AuthField
          ref={emailRef}
          label={t("login.email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={formData.email}
          error={errors.email}
          placeholder={t("login.emailPlaceholder")}
          required
          onChange={updateField}
          onBlur={validateOnBlur}
        />
        <PasswordField
          ref={passwordRef}
          label={t("login.password")}
          name="password"
          autoComplete="current-password"
          value={formData.password}
          error={errors.password}
          placeholder={t("login.passwordPlaceholder")}
          required
          onChange={updateField}
          onBlur={validateOnBlur}
        />

        <div className="auth-form__meta">
          <span />
          <Link to="/forgot-password">{t("login.forgotPassword")}</Link>
        </div>

        <button className="auth-submit" type="submit" disabled={isLoading}>
          {isLoading && <span className="auth-spinner" aria-hidden="true" />}
          {isLoading ? t("login.submitting") : t("login.submit")}
        </button>

        <p className="auth-form__footer">
          <span>{t("login.noAccount")}</span>
          <Link to="/signup" state={location.state}>{t("login.signupLink")}</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
