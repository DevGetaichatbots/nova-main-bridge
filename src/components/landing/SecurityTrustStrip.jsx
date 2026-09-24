import React from "react";
import { useTranslation } from "react-i18next";
import Container from "../ui/Container";

const SecurityTrustStrip = () => {
  const { t } = useTranslation();

  return (
    <section id="security" className="security-strip">
      <Container className="security-strip__inner">
        <div className="security-strip__intro">
          <span className="security-strip__shield">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.8 8.5 7 10 4.2-1.5 7-5.2 7-10V6l-7-3Zm-3 9 2 2 4-5" /></svg>
          </span>
          <div>
            <h2>{t("landing.security.title")}</h2>
            <p>{t("landing.security.description")}</p>
          </div>
        </div>
        <div className="security-strip__marks">
          <div className="security-strip__azure">
            <img src="/azure-badge.jpg" alt="Microsoft Azure" />
          </div>
          <div>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" /></svg>
            <span><strong>GDPR</strong>{t("landing.security.compliant")}</span>
          </div>
          <div>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.8 8.5 7 10 4.2-1.5 7-5.2 7-10V6l-7-3Zm-3 9 2 2 4-5" /></svg>
            <span><strong>ISO 27001</strong>{t("landing.security.ready")}</span>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default SecurityTrustStrip;
