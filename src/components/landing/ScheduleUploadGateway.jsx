import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const ScheduleUploadGateway = ({ onEnterProduct }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const activate = () => onEnterProduct();
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    activate();
  };

  return (
    <div className="upload-gateway-shell">
      <div
        className={`upload-gateway ${isDragging ? "is-dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-describedby="upload-gateway-formats upload-gateway-auth"
        onClick={activate}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <svg className="upload-gateway__icon" aria-hidden="true" viewBox="0 0 64 64">
          <path d="M19 45H15a10 10 0 0 1-1-20 17 17 0 0 1 33-2 11 11 0 0 1 2 22h-5" />
          <path d="M32 49V27m-8 8 8-8 8 8" />
        </svg>
        <h2>{t("landing.upload.title")}</h2>
        <p>{t("landing.upload.instruction")}</p>
        <span className="upload-gateway__button">{t("landing.upload.button")}</span>
        <small id="upload-gateway-formats">{t("landing.upload.formats")}</small>
      </div>
      <p id="upload-gateway-auth" className="upload-gateway__security">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" />
        </svg>
        {t("landing.upload.security")}
      </p>
    </div>
  );
};

export default ScheduleUploadGateway;
