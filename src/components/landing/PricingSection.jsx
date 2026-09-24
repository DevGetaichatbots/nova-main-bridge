import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import Container from "../ui/Container";
import SectionHeading from "../ui/SectionHeading";
import { buildLoginState } from "../../utils/authRedirect";
import { getYearlyPrice, pricingPlans } from "../../data/pricingPlans";

const PricingCard = ({ plan, yearly, productPath, user }) => {
  const { t, i18n } = useTranslation();
  const price = yearly ? getYearlyPrice(plan.monthlyPrice) : plan.monthlyPrice;
  const formattedPrice = new Intl.NumberFormat(i18n.language === "da" ? "da-DK" : "en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);

  return (
    <article className={`pricing-card ${plan.featured ? "pricing-card--featured" : ""}`}>
      {plan.featured && <span className="pricing-card__badge">{t("landing.pricing.popular")}</span>}
      <h3>{t(`landing.pricing.plans.${plan.id}.name`)}</h3>
      <p className="pricing-card__audience">{t(`landing.pricing.plans.${plan.id}.audience`)}</p>
      <p className="pricing-card__price">
        <strong>{formattedPrice}</strong>
        {plan.monthlyPrice > 0 && <span>/{yearly ? t("landing.pricing.year") : t("landing.pricing.month")}</span>}
      </p>
      <ul>
        <li>{t("landing.pricing.comparisonCount", { count: plan.comparisons })}</li>
        {plan.featureKeys.map((key) => <li key={key}>{t(`landing.pricing.features.${key}`)}</li>)}
      </ul>
      <Button
        to={productPath}
        state={user ? undefined : buildLoginState(plan.id)}
        variant={plan.featured ? "primary" : "outline"}
      >
        {t("landing.pricing.getStarted")}
      </Button>
      {yearly && plan.monthlyPrice > 0 && <small>{t("landing.pricing.billedYearly")}</small>}
    </article>
  );
};

const PricingSection = ({ user, productPath }) => {
  const { t } = useTranslation();
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="landing-section pricing-section">
      <Container>
        <div className="pricing-section__heading-row">
          <SectionHeading title={t("landing.pricing.title")} description={t("landing.pricing.description")} />
          <div className="billing-switch" aria-label={t("landing.pricing.billingLabel")}>
            <button type="button" className={!yearly ? "is-active" : ""} onClick={() => setYearly(false)}>
              {t("landing.pricing.monthly")}
            </button>
            <button type="button" className={yearly ? "is-active" : ""} onClick={() => setYearly(true)}>
              {t("landing.pricing.yearly")} <span>{t("landing.pricing.save")}</span>
            </button>
          </div>
        </div>
        <div className="pricing-grid">
          {pricingPlans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} yearly={yearly} productPath={productPath} user={user} />
          ))}
        </div>
      </Container>
    </section>
  );
};

export default PricingSection;
