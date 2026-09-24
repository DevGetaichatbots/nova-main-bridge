import React from "react";

const SectionHeading = ({ eyebrow, title, description, align = "left" }) => (
  <div className={`section-heading section-heading--${align}`}>
    {eyebrow && <p className="section-heading__eyebrow">{eyebrow}</p>}
    <h2>{title}</h2>
    {description && <p>{description}</p>}
  </div>
);

export default SectionHeading;
