import React from "react";
import { useTranslation } from "react-i18next";
import Container from "../ui/Container";
import CheckItem from "../ui/CheckItem";
import ScheduleUploadGateway from "./ScheduleUploadGateway";
import { heroBenefitKeys } from "../../data/landingContent";

const HeroSection = ({ onEnterProduct }) => {
  const { t } = useTranslation();

  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div className="landing-hero__backdrop" aria-hidden="true" />
      <Container className="landing-hero__grid">
        <div className="landing-hero__copy">
          <p className="landing-hero__eyebrow">{t("landing.hero.eyebrow")}</p>
          <h1 id="landing-hero-title">
            {t("landing.hero.titleStart")}{" "}
            <span>{t("landing.hero.titleAccent")}</span>
          </h1>
          <p className="landing-hero__lede">{t("landing.hero.description")}</p>
          <ul className="landing-hero__benefits">
            {heroBenefitKeys.map((key) => (
              <CheckItem key={key} inverse>
                {t(`landing.hero.benefits.${key}`)}
              </CheckItem>
            ))}
          </ul>
        </div>
        <ScheduleUploadGateway onEnterProduct={onEnterProduct} />
      </Container>
    </section>
  );
};

export default HeroSection;
