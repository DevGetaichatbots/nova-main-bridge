import React from "react";
import { useTranslation } from "react-i18next";
import Container from "../ui/Container";
import { integrationLogos } from "../../data/landingContent";

const IntegrationStrip = () => {
  const { t } = useTranslation();

  return (
    <section className="integration-strip" aria-label={t("landing.integrations.label")}>
      <Container className="integration-strip__inner">
        <p>{t("landing.integrations.trusted")}</p>
        <div className="integration-strip__logos">
          {integrationLogos.map((integration) => (
            <div
              key={integration.name}
              className={`integration-logo integration-logo--${integration.variant || "icon"}`}
            >
              <img src={integration.logo} alt={integration.name} loading="lazy" />
              {integration.variant !== "wordmark-only" && (
                <span aria-hidden="true">
                  {integration.parentBrand && <small>{integration.parentBrand}</small>}
                  {integration.name}
                </span>
              )}
            </div>
          ))}
          <span className="integration-strip__more">{t("landing.integrations.more")}</span>
        </div>
      </Container>
    </section>
  );
};

export default IntegrationStrip;
