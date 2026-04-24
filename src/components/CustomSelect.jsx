import React, { useState, useRef, useEffect } from "react";

const CustomSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder = "Vælg...",
  error = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 rounded-lg border text-left flex items-center justify-between ${
          error
            ? "border-red-500"
            : isOpen
            ? "border-[#00D6D6] ring-2 ring-[#00D6D6]"
            : "border-[#00D6D6]/30 hover:border-[#00D6D6]/50"
        } bg-white transition-all duration-200 outline-none`}
      >
        <span className={selectedOption ? "text-[#1c2631]" : "text-[#64748b]"}>
          {selectedOption?.label || placeholder}
        </span>
        <svg
          className={`w-5 h-5 text-[#64748b] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#00D6D6]/30 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left hover:bg-[#00D6D6]/10 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                value === option.value
                  ? "bg-[#00D6D6]/20 text-[#00D6D6] font-medium"
                  : "text-[#1c2631]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
