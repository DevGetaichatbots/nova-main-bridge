import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandMark from "../ui/BrandMark";
import Container from "../ui/Container";
import LanguageSwitcher from "../LanguageSwitcher";

const MarketingFooter = () => {
  const { t } = useTranslation();

  return (
    <footer id="contact" className="marketing-footer">
      <Container>
        <div className="marketing-footer__grid">
          <div className="marketing-footer__brand">
            <BrandMark inverse />
            <p>{t("landing.footer.description")}</p>
            <LanguageSwitcher />
          </div>
          <nav aria-label={t("landing.footer.productLabel")}>
            <h2>{t("landing.footer.product")}</h2>
            <a href="#features">{t("landing.nav.features")}</a>
            <a href="#pricing">{t("landing.nav.pricing")}</a>
            <a href="#security">{t("landing.nav.security")}</a>
            <a href="#faq">{t("landing.nav.faq")}</a>
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
          <span>{t("landing.footer.azure")}</span>
        </div>
      </Container>
    </footer>
  );
};

export default MarketingFooter;
