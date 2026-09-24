import React from "react";
import { Link } from "react-router-dom";

const Button = ({
  to,
  state,
  variant = "primary",
  className = "",
  children,
  ...props
}) => {
  const classes = `landing-button landing-button--${variant} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} state={state} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};

export default Button;
