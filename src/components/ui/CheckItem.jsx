import React from "react";

const CheckItem = ({ children, inverse = false }) => (
  <li className={`check-item ${inverse ? "check-item--inverse" : ""}`}>
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6.5 12.5 3.4 3.4 7.6-8" />
    </svg>
    <span>{children}</span>
  </li>
);

export default CheckItem;
