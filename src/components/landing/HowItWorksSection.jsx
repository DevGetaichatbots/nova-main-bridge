import React from "react";
import { useTranslation } from "react-i18next";
import Container from "../ui/Container";
import SectionHeading from "../ui/SectionHeading";
import { processStepKeys } from "../../data/landingContent";

const stepIcons = {
  upload: "M7 3h7l4 4v14H7V3Zm7 0v5h5",
  analyze: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 5 5",
  insights: "M5 20v-6m7 6V9m7 11V4",
};

const HowItWorksSection = () => {
  const { t } = useTranslation();

  return (
    <section id="features" className="landing-section how-it-works">
      <Container>
        <SectionHeading
          align="center"
          title={t("landing.howItWorks.title")}
          description={t("landing.howItWorks.description")}
        />
        <ol className="process-steps">
          {processStepKeys.map((key, index) => (
            <li key={key}>
              <span className="process-steps__number">{index + 1}</span>
              <span className="process-steps__icon">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d={stepIcons[key]} /></svg>
              </span>
              <div>
                <h3>{t(`landing.howItWorks.steps.${key}.title`)}</h3>
                <p>{t(`landing.howItWorks.steps.${key}.description`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
};

export default HowItWorksSection;
