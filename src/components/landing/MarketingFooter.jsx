import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandMark from "../ui/BrandMark";
import Container from "../ui/Container";
import LanguageSwitcher from "../LanguageSwitcher";

const socials = [
  {
    label: "Phone",
    href: "tel:+4553721659",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/Nordicaigroup/",
    icon: (
      <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/nordicaigroup/",
    icon: (
      <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
];

const MarketingFooter = () => {
  const { t } = useTranslation();

  return (
    <footer id="contact" className="marketing-footer">
      <Container>
        <div className="marketing-footer__grid">
          <div className="marketing-footer__brand">
            <BrandMark inverse />
            <p>{t("landing.footer.description")}</p>
            <div className="marketing-footer__meta">
              <LanguageSwitcher />
              <div className="marketing-footer__social">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    title={s.label}
                    {...(s.href.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <nav aria-label={t("landing.footer.productLabel")}>
            <h2>{t("landing.footer.product")}</h2>
            <a href="/#features">{t("landing.nav.features")}</a>
            <a href="/#pricing">{t("landing.nav.pricing")}</a>
            <a href="/#security">{t("landing.nav.security")}</a>
            <a href="/#faq">{t("landing.nav.faq")}</a>
          </nav>
          <nav aria-label={t("landing.footer.companyLabel")}>
            <h2>{t("landing.footer.company")}</h2>
            <Link to="/about">{t("footer.aboutUs")}</Link>
            <Link to="/contact">{t("footer.contact")}</Link>
          </nav>
          <nav aria-label={t("landing.footer.legalLabel")}>
            <h2>{t("landing.footer.legal")}</h2>
            <Link to="/security-gdpr">{t("footer.securityGDPR")}</Link>
            <Link to="/privacy-policy">{t("footer.privacyPolicy")}</Link>
            <Link to="/terms-of-service">{t("footer.termsOfService")}</Link>
          </nav>
          <div>
            <h2>{t("landing.footer.contact")}</h2>
            <a href="mailto:info@nordicaigroup.com">info@nordicaigroup.com</a>
            <a href="tel:+4553721659">+45 53 72 16 59</a>
            <span>{t("landing.footer.location")}</span>
          </div>
        </div>
        <div className="marketing-footer__bottom">
          <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
          <span>
            {t("footer.gdprCompliant")} · {t("footer.isoCertified")} · {t("landing.footer.azure")}
          </span>
        </div>
      </Container>
    </footer>
  );
};

export default MarketingFooter;
