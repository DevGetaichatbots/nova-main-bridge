import React from "react";
import { useTranslation } from "react-i18next";
import BrandMark from "../ui/BrandMark";

const metricKeys = ["changed", "added", "removed", "critical"];
const rowKeys = ["foundation", "steel", "facade", "mep", "commissioning"];

const ComparisonResultPreview = () => {
  const { t } = useTranslation();

  return (
    <div className="result-preview" aria-label={t("landing.preview.ariaLabel")}>
      <div className="result-preview__topbar">
        <BrandMark />
        <span>{t("landing.preview.dashboard")}</span>
        <span>{t("landing.preview.comparisons")}</span>
        <span aria-hidden="true" className="result-preview__avatar">JD</span>
      </div>
      <div className="result-preview__body">
        <div className="result-preview__title-row">
          <h3>{t("landing.preview.title")}</h3>
          <span>{t("landing.preview.report")}</span>
        </div>
        <div className="result-preview__metrics">
          {metricKeys.map((key) => (
            <div key={key} className={`result-preview__metric result-preview__metric--${key}`}>
              <strong>{t(`landing.preview.metrics.${key}.value`)}</strong>
              <span>{t(`landing.preview.metrics.${key}.label`)}</span>
            </div>
          ))}
        </div>
        <div className="result-preview__table" role="table">
          <div className="result-preview__table-head" role="row">
            <span role="columnheader">ID</span>
            <span role="columnheader">{t("landing.preview.table.activity")}</span>
            <span role="columnheader">{t("landing.preview.table.change")}</span>
            <span role="columnheader">{t("landing.preview.table.impact")}</span>
          </div>
          {rowKeys.map((key, index) => (
            <div className="result-preview__table-row" role="row" key={key}>
              <span role="cell">A{1040 + index * 990}</span>
              <span role="cell">{t(`landing.preview.rows.${key}.activity`)}</span>
              <span role="cell" className={`status status--${t(`landing.preview.rows.${key}.tone`)}`}>
                {t(`landing.preview.rows.${key}.change`)}
              </span>
              <span role="cell">{t(`landing.preview.rows.${key}.impact`)}</span>
            </div>
          ))}
        </div>
        <div className="result-preview__tabs" aria-hidden="true">
          <span className="is-active">{t("landing.preview.tabs.summary")}</span>
          <span>{t("landing.preview.tabs.changed")}</span>
          <span>{t("landing.preview.tabs.added")}</span>
          <span>{t("landing.preview.tabs.critical")}</span>
        </div>
      </div>
    </div>
  );
};

export default ComparisonResultPreview;
