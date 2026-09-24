import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../LanguageSwitcher";
import BrandMark from "../ui/BrandMark";
import "../../auth.css";

const AuthLayout = ({ eyebrow, title, description, children, size = "default" }) => {
  const { t } = useTranslation();

  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link to="/" className="auth-header__brand" aria-label={t("auth.homeLabel")}>
          <BrandMark />
        </Link>
        <div className="auth-header__actions">
          <Link to="/" className="auth-header__home">{t("auth.backHome")}</Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="auth-shell">
        <aside className="auth-story" aria-label={t("auth.storyLabel")}>
          <div className="auth-story__backdrop" aria-hidden="true" />
          <div className="auth-story__content">
            <p className="auth-story__eyebrow">{t("auth.eyebrow")}</p>
            <h2>{t("auth.storyTitle")}</h2>
            <p>{t("auth.storyDescription")}</p>
            <ul>
              <li>{t("auth.benefitChanges")}</li>
              <li>{t("auth.benefitRisks")}</li>
              <li>{t("auth.benefitReports")}</li>
            </ul>
            <div className="auth-story__trust">
              <span>{t("auth.secure")}</span>
              <span>{t("auth.azure")}</span>
              <span>{t("auth.gdpr")}</span>
            </div>
          </div>
        </aside>

        <section className="auth-workspace">
          <div className={`auth-card auth-card--${size}`}>
            <div className="auth-card__heading">
              {eyebrow && <p className="auth-card__eyebrow">{eyebrow}</p>}
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AuthLayout;
