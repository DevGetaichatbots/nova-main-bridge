import React from "react";

const AuthField = React.forwardRef(({
  label,
  name,
  error,
  hint,
  required = false,
  className = "",
  ...inputProps
}, ref) => {
  const inputId = `auth-${name}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`auth-field ${error ? "has-error" : ""} ${className}`.trim()}>
      <label htmlFor={inputId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        ref={ref}
        id={inputId}
        name={name}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {hint && <p id={hintId} className="auth-field__hint">{hint}</p>}
      {error && <p id={errorId} className="auth-field__error">{error}</p>}
    </div>
  );
});

AuthField.displayName = "AuthField";

export default AuthField;
