import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import FAQSection from "../components/landing/FAQSection";
import FinalCTASection from "../components/landing/FinalCTASection";
import HeroSection from "../components/landing/HeroSection";
import HowItWorksSection from "../components/landing/HowItWorksSection";
import IntegrationStrip from "../components/landing/IntegrationStrip";
import MarketingFooter from "../components/landing/MarketingFooter";
import MarketingHeader from "../components/landing/MarketingHeader";
import PricingSection from "../components/landing/PricingSection";
import ProductBenefitsSection from "../components/landing/ProductBenefitsSection";
import SecurityTrustStrip from "../components/landing/SecurityTrustStrip";
import { buildLoginState } from "../utils/authRedirect";
import "../landing.css";

const LandingPage = ({ user }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const productPath = user ? "/comparison" : "/login";
  const loginState = user ? undefined : buildLoginState();

  const enterProduct = () => navigate(productPath, { state: loginState });

  return (
    <div id="top" className="landing-page">
      <a className="skip-link" href="#landing-main">{t("landing.skipLink")}</a>
      <MarketingHeader user={user} loginState={loginState} />
      <main id="landing-main">
        <HeroSection onEnterProduct={enterProduct} />
        <IntegrationStrip />
        <HowItWorksSection />
        <ProductBenefitsSection productPath={productPath} loginState={loginState} />
        <SecurityTrustStrip />
        <PricingSection user={user} productPath={productPath} />
        <FAQSection />
        <FinalCTASection productPath={productPath} loginState={loginState} />
      </main>
      <MarketingFooter />
    </div>
  );
};

export default LandingPage;
