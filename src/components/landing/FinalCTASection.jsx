import React from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import Container from "../ui/Container";

const FinalCTASection = ({ productPath, loginState }) => {
  const { t } = useTranslation();

  return (
    <section className="final-cta">
      <div className="final-cta__backdrop" aria-hidden="true" />
      <Container className="final-cta__content">
        <p>{t("landing.finalCta.eyebrow")}</p>
        <h2>{t("landing.finalCta.title")}</h2>
        <span>{t("landing.finalCta.description")}</span>
        <Button to={productPath} state={loginState}>
          {t("landing.finalCta.button")} <span aria-hidden="true">→</span>
        </Button>
        <small>{t("landing.finalCta.note")}</small>
      </Container>
    </section>
  );
};

export default FinalCTASection;
