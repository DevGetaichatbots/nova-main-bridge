import React from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import CheckItem from "../ui/CheckItem";
import Container from "../ui/Container";
import ComparisonResultPreview from "./ComparisonResultPreview";
import { productBenefitKeys } from "../../data/landingContent";

const ProductBenefitsSection = ({ productPath, loginState }) => {
  const { t } = useTranslation();

  return (
    <section className="landing-section product-benefits">
      <Container className="product-benefits__grid">
        <div className="product-benefits__copy">
          <p className="section-heading__eyebrow">{t("landing.benefits.eyebrow")}</p>
          <h2>{t("landing.benefits.titleStart")} <span>{t("landing.benefits.titleAccent")}</span></h2>
          <p>{t("landing.benefits.description")}</p>
          <ul>
            {productBenefitKeys.map((key) => (
              <CheckItem key={key}>{t(`landing.benefits.items.${key}`)}</CheckItem>
            ))}
          </ul>
          <Button to={productPath} state={loginState}>
            {t("landing.benefits.cta")} <span aria-hidden="true">→</span>
          </Button>
          <small>{t("landing.benefits.note")}</small>
        </div>
        <ComparisonResultPreview />
      </Container>
    </section>
  );
};

export default ProductBenefitsSection;
