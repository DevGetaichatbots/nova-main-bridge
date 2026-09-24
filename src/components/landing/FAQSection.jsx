import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import Container from "../ui/Container";
import SectionHeading from "../ui/SectionHeading";
import { faqKeys } from "../../data/landingContent";

const FAQSection = () => {
  const { t } = useTranslation();
  const [openItem, setOpenItem] = useState("formats");

  return (
    <section id="faq" className="landing-section faq-section">
      <Container className="faq-section__grid">
        <SectionHeading
          eyebrow={t("landing.faq.eyebrow")}
          title={t("landing.faq.title")}
          description={t("landing.faq.description")}
        />
        <div className="faq-list">
          {faqKeys.map((key) => {
            const isOpen = openItem === key;
            return (
              <article key={key} className={isOpen ? "is-open" : ""}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${key}`}
                    onClick={() => setOpenItem(isOpen ? null : key)}
                  >
                    <span>{t(`landing.faq.items.${key}.question`)}</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </h3>
                <div id={`faq-panel-${key}`} className="faq-list__answer" hidden={!isOpen}>
                  <p>{t(`landing.faq.items.${key}.answer`)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
};

export default FAQSection;
