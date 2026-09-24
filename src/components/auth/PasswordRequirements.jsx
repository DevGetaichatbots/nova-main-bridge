import React from "react";
import { useTranslation } from "react-i18next";

const PasswordRequirements = ({ password }) => {
  const { t } = useTranslation();
  const requirements = [
    ["requirementLength", password.length >= 8],
    ["requirementLowercase", /[a-z]/.test(password)],
    ["requirementUppercase", /[A-Z]/.test(password)],
    ["requirementNumber", /\d/.test(password)],
  ];

  return (
    <div className="password-requirements" aria-live="polite">
      <p>{t("signup.passwordRequirementsTitle")}</p>
      <ul>
        {requirements.map(([key, met]) => (
          <li key={key} className={met ? "is-met" : ""}>
            <span aria-hidden="true">{met ? "✓" : "○"}</span>
            {t(`signup.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordRequirements;
