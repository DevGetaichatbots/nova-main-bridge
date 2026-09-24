import React from "react";

const Container = ({ as = "div", className = "", children, ...props }) =>
  React.createElement(
    as,
    { className: `landing-container ${className}`.trim(), ...props },
    children,
  );

export default Container;
