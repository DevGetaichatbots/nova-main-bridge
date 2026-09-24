import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandMark from "../ui/BrandMark";
import Button from "../ui/Button";
import Container from "../ui/Container";
import LanguageSwitcher from "../LanguageSwitcher";

const navItems = ["features", "pricing", "security", "faq", "contact"];

const MarketingHeader = ({ user, loginState }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [t]);

  const productPath = user ? "/comparison" : "/login";
  const productState = user ? undefined : loginState;

  return (
    <header className={`marketing-header ${isScrolled ? "is-scrolled" : ""}`}>
      <Container className="marketing-header__inner">
        <a href="#top" className="marketing-header__brand" aria-label={t("landing.nav.homeLabel")}>
          <BrandMark />
        </a>

        <nav className="marketing-header__desktop-nav" aria-label={t("landing.nav.primaryLabel")}>
          {navItems.map((item) => (
            <a key={item} href={`#${item}`}>{t(`landing.nav.${item}`)}</a>
          ))}
        </nav>

        <div className="marketing-header__actions">
          <LanguageSwitcher />
          {!user && (
            <Link to="/login" state={loginState} className="marketing-header__login">
              {t("landing.nav.login")}
            </Link>
          )}
          <Button to={productPath} state={productState} className="marketing-header__cta">
            {user ? t("landing.nav.dashboard") : t("landing.nav.getStarted")}
          </Button>
          <button
            type="button"
            className="marketing-header__menu-button"
            aria-expanded={isOpen}
            aria-controls="marketing-mobile-nav"
            aria-label={t("landing.nav.menuLabel")}
            onClick={() => setIsOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </Container>

      <div id="marketing-mobile-nav" className={`marketing-mobile-nav ${isOpen ? "is-open" : ""}`}>
        <Container className="marketing-mobile-nav__top">
          <BrandMark />
          <button
            type="button"
            className="marketing-mobile-nav__close"
            aria-label={t("common.close")}
            onClick={() => setIsOpen(false)}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </Container>
        <Container as="nav" aria-label={t("landing.nav.mobileLabel")}>
          {navItems.map((item) => (
            <a key={item} href={`#${item}`} onClick={() => setIsOpen(false)}>
              {t(`landing.nav.${item}`)}
            </a>
          ))}
          {!user && <Link to="/login" state={loginState}>{t("landing.nav.login")}</Link>}
          <Button to={productPath} state={productState} onClick={() => setIsOpen(false)}>
            {user ? t("landing.nav.dashboard") : t("landing.nav.getStarted")}
          </Button>
        </Container>
      </div>
    </header>
  );
};

export default MarketingHeader;
