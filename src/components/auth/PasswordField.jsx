import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const PasswordField = React.forwardRef(({
  label,
  name,
  error,
  required = false,
  className = "",
  ...inputProps
}, ref) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const inputId = `auth-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <div className={`auth-field ${error ? "has-error" : ""} ${className}`.trim()}>
      <label htmlFor={inputId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <div className="auth-password">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        <button
          type="button"
          className="auth-password__toggle"
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            {visible ? (
              <path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.6 10.6 0 0 1 12 4c5 0 8.5 4 9.5 8a12.5 12.5 0 0 1-2 4.1M6.6 6.6A12.1 12.1 0 0 0 2.5 12c1 4 4.5 8 9.5 8 1.4 0 2.6-.3 3.8-.8" />
            ) : (
              <><path d="M2.5 12c1-4 4.5-8 9.5-8s8.5 4 9.5 8c-1 4-4.5 8-9.5 8s-8.5-4-9.5-8Z" /><circle cx="12" cy="12" r="3" /></>
            )}
          </svg>
        </button>
      </div>
      {error && <p id={errorId} className="auth-field__error">{error}</p>}
    </div>
  );
});

PasswordField.displayName = "PasswordField";

export default PasswordField;
