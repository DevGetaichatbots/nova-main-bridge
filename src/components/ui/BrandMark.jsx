import React from "react";

// Same logo as the app Navbar; `inverse` renders it white for dark backgrounds.
const BrandMark = ({ inverse = false }) => (
  <img
    src="/NordicLogo2.png"
    alt="Nordic AI Group"
    className={`brand-mark ${inverse ? "brand-mark--inverse" : ""}`}
  />
);

export default BrandMark;
