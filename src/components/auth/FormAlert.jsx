import React from "react";

const FormAlert = ({ children, tone = "error" }) => (
  <div
    className={`auth-alert auth-alert--${tone}`}
    role={tone === "error" ? "alert" : "status"}
    aria-live="polite"
  >
    <span aria-hidden="true">{tone === "error" ? "!" : "✓"}</span>
    <p>{children}</p>
  </div>
);

export default FormAlert;
