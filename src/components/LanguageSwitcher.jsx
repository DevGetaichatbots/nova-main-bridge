import React from "react";
import { useTranslation } from "react-i18next";

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || "da";
  const isEnglish = currentLang === "en";

  const toggleLanguage = () => {
    const newLang = currentLang === "da" ? "en" : "da";
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="relative flex items-center w-16 h-8 rounded-full p-1 transition-all duration-300 hover:scale-105"
      style={{
        background: "linear-gradient(135deg, #00D6D6, #00b8b8)",
        boxShadow: "0 2px 10px rgba(0, 214, 214, 0.3)"
      }}
      title={currentLang === "da" ? "Switch to English" : "Skift til dansk"}
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
        style={{
          transform: isEnglish ? "translateX(32px)" : "translateX(0)",
          background: "#ffffff",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
          color: "#00D6D6"
        }}
      >
        {isEnglish ? "EN" : "DA"}
      </div>
    </button>
  );
};

export default LanguageSwitcher;
