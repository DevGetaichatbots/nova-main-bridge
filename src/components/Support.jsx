import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Toast from "./Toast";
import { handleApiError } from "../utils/errorHandler";

const ALLOWED_SUPPORT_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALLOWED_SUPPORT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];

const validateSupportFileType = (file, t) => {
  if (!file) return { valid: false, error: t ? t('support.noFileSelected') : "Ingen fil valgt" };
  
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_SUPPORT_EXTENSIONS.some(ext => fileName.endsWith(ext));
  const hasValidMimeType = ALLOWED_SUPPORT_FILE_TYPES.includes(file.type);
  
  if (!hasValidExtension && !hasValidMimeType) {
    const errorMsg = t ? t('support.fileTypeError') : 'Only images (JPG, PNG, GIF, WEBP) and documents (PDF, DOC, DOCX) are allowed';
    return { 
      valid: false, 
      error: `${file.name}: ${errorMsg}`
    };
  }
  
  return { valid: true, error: null };
};

const validatePhoneNumber = (phone, t) => {
  if (!phone) return { valid: true, error: null };
  const phoneRegex = /^[\d\s\-+()]*$/;
  if (!phoneRegex.test(phone)) {
    return { valid: false, error: t ? t('support.phoneError') : "Phone number can only contain numbers, spaces, hyphens and parentheses" };
  }
  return { valid: true, error: null };
};

const Support = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    issue: "",
    priority: "",
    files: [],
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [fileError, setFileError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileUrls, setUploadedFileUrls] = useState([]);
  const [toast, setToast] = useState({
    isVisible: false,
    message: "",
    type: "success",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      const phoneValidation = validatePhoneNumber(value, t);
      if (!phoneValidation.valid) {
        setErrors((prev) => ({
          ...prev,
          phone: phoneValidation.error,
        }));
        return;
      }
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = [];
    const invalidFiles = [];
    
    selectedFiles.forEach(file => {
      const validation = validateSupportFileType(file, t);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });
    
    if (invalidFiles.length > 0) {
      setFileError(`${t('support.invalidFiles')}: ${invalidFiles.join(', ')}. ${t('support.invalidFilesMessage')}`);
    } else {
      setFileError("");
    }
    
    if (validFiles.length > 0) {
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...validFiles],
      }));
    }
    
    e.target.value = "";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = [];
    const invalidFiles = [];
    
    droppedFiles.forEach(file => {
      const validation = validateSupportFileType(file, t);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });
    
    if (invalidFiles.length > 0) {
      setFileError(`${t('support.invalidFiles')}: ${invalidFiles.join(', ')}. ${t('support.invalidFilesMessage')}`);
    } else {
      setFileError("");
    }
    
    if (validFiles.length > 0) {
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...validFiles],
      }));
    }
  };

  // Cache object URLs for local file previews (prevents memory leak)
  const localPreviewUrls = useMemo(() => {
    return formData.files.map((file) => {
      if (file instanceof File && file.type?.startsWith("image/")) {
        return URL.createObjectURL(file);
      }
      return null;
    });
  }, [formData.files]);

  // Cleanup object URLs when component unmounts or files change
  useEffect(() => {
    return () => {
      localPreviewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [localPreviewUrls]);

  const removeFile = (index) => {
    // Revoke object URL if exists
    if (localPreviewUrls[index]) {
      URL.revokeObjectURL(localPreviewUrls[index]);
    }

    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));

    // Also remove from uploaded URLs if exists
    setUploadedFileUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Get preview URL for a file (environment-aware, cached)
  const getPreviewUrl = (file, index) => {
    // If file has been uploaded and we have a URL from backend, use it
    if (uploadedFileUrls[index]) {
      // Backend already returns full URL (production or dev)
      return uploadedFileUrls[index];
    }

    // For local files not yet uploaded, use cached object URL
    return localPreviewUrls[index];
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('support.nameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('support.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('support.emailInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      let fileUrls = [];

      // Step 1: Upload files first if any
      if (formData.files.length > 0) {
        const fileFormData = new FormData();
        formData.files.forEach((file, index) => {
          fileFormData.append(`file_${index}`, file);
        });

        const { getApiBaseUrl } = await import('../utils/apiConfig.js');
        const apiUrl = getApiBaseUrl();
        const uploadResponse = await fetch(`${apiUrl}/api/upload-files`, {
          method: "POST",
          body: fileFormData,
        });

        const uploadData = await uploadResponse.json();

        if (uploadData.success) {
          fileUrls = uploadData.fileUrls;
          // Save uploaded URLs for preview
          setUploadedFileUrls(fileUrls);
        } else {
          throw new Error("File upload failed");
        }
      }

      // Step 2: Prepare WhatsApp message with file URLs
      let attachmentText = "";
      if (fileUrls.length > 0) {
        attachmentText = `\n\n*📎 Attachments:*\n`;
        fileUrls.forEach((url, index) => {
          attachmentText += `${index + 1}. ${url}\n`;
        });
      }

      const whatsappMessage = `🔔 *New Support Request*

*Name:* ${formData.name || "N/A"}
*Phone:* ${formData.phone || "N/A"}
*Email:* ${formData.email || "N/A"}

*Issue:* ${formData.issue || "N/A"}
*Priority:* ${formData.priority || "N/A"}

*Description:*
${formData.description || "N/A"}${attachmentText}`;

      // Step 3: Call both APIs in parallel
      const waapiPromise = fetch(
        "https://waapi.app/api/v1/instances/58129/client/action/send-message",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${import.meta.env.VITE_WAAPI_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: "120363404767563066@g.us",
            message: whatsappMessage,
          }),
        },
      );

      const sheetsPromise = fetch(
        "https://n8n.getaichatbots.marketing/webhook/b0f3b100-cebe-49c1-bd9b-34e88467adc5",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            issue: formData.issue,
            priority: formData.priority,
            description: formData.description,
            file_0: fileUrls[0] || "",
            file_1: fileUrls[1] || "",
          }),
        },
      );

      const [waapiResponse, sheetsResponse] = await Promise.allSettled([
        waapiPromise,
        sheetsPromise,
      ]);

      const waapiSuccess =
        waapiResponse.status === "fulfilled" && waapiResponse.value.ok;
      const sheetsSuccess =
        sheetsResponse.status === "fulfilled" && sheetsResponse.value.ok;

      // Step 4: Show appropriate message
      if (waapiSuccess && sheetsSuccess) {
        setToast({
          isVisible: true,
          message: `✅ ${t('support.successWhatsAppAndSheets')}`,
          type: "success",
        });
      } else if (waapiSuccess) {
        setToast({
          isVisible: true,
          message: `✅ ${t('support.successWhatsAppOnly')}`,
          type: "success",
        });
      } else if (sheetsSuccess) {
        setToast({
          isVisible: true,
          message: `✅ ${t('support.successSheetsOnly')}`,
          type: "success",
        });
      } else {
        throw new Error("Both API calls failed");
      }

      // Clear form on any success
      if (waapiSuccess || sheetsSuccess) {
        setFormData({
          name: "",
          phone: "",
          email: "",
          issue: "",
          priority: "",
          files: [],
          description: "",
        });
        setUploadedFileUrls([]); // Clear uploaded URLs
      }
    } catch (error) {
      setToast({
        isVisible: true,
        message: error.message || t('support.errorSubmit'),
        type: "error",
      });

      // Send error alert to WhatsApp (for support form submission errors)
      await handleApiError(error, {
        endpoint: "/support-form-submission",
        method: "POST",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div
      className="min-h-screen w-full py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{
        background: "#ffffff",
      }}
    >
      {/* <button
        onClick={handleBack}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 87, 60, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%)',
          boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
        }}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        <span>Back</span>
      </button> */}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-cyan-400/10 to-cyan-500/10 rounded-full animate-float-1"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-cyan-300/10 to-cyan-400/10 rounded-full animate-float-2"></div>
        <div className="absolute bottom-32 left-20 w-20 h-20 bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 rounded-full animate-float-3"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl pt-16  pb-4"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              color: "#1c2631",
              lineHeight: "1.2",
            }}
          >
            {t('support.titleSmile')}
          </h1>
          <div
            className="h-1.5 rounded-full mx-auto"
            style={{
              width: "60%",
              background: "#00D6D6",
            }}
          />
          <p
            className="text-lg mt-6 max-w-2xl mx-auto leading-relaxed"
            style={{
              color: "#1c2631",
              animationDelay: "0.5s",
              animationFillMode: "both",
            }}
          >
            {t('support.description')}
          </p>
        </div>

        <div
          className="relative rounded-3xl shadow-2xl border p-8"
          style={{
            background:
              "linear-gradient(145deg, rgba(0, 214, 214, 0.15) 0%, rgba(112, 211, 213, 0.1) 100%)",
            backdropFilter: "blur(10px)",
            borderColor: "rgba(0, 214, 214, 0.3)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "#1c2631" }}
                >
                  {t('support.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all duration-300"
                  style={{
                    borderColor: "rgba(0, 214, 214, 0.3)",
                    color: "#1c2631",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#00D6D6";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(0, 214, 214, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                    e.target.style.boxShadow = "none";
                  }}
                  placeholder={t('support.namePlaceholder')}
                />
                {errors.name && (
                  <p className="text-red-400 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "#1c2631" }}
                >
                  {t('support.phone')}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all duration-300"
                  style={{
                    borderColor: "rgba(0, 214, 214, 0.3)",
                    color: "#1c2631",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#00D6D6";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(0, 214, 214, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                    e.target.style.boxShadow = "none";
                  }}
                  placeholder={t('support.phonePlaceholder')}
                />
                {errors.phone && (
                  <div className="flex items-center gap-2 mt-1">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400 text-sm">{errors.phone}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "#1c2631" }}
              >
                {t('support.email')} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all duration-300 ${
                  errors.email ? "border-red-500 focus:ring-red-200" : ""
                }`}
                style={{
                  borderColor: errors.email ? "#ef4444" : "rgba(0, 214, 214, 0.3)",
                  color: "#1c2631",
                }}
                onFocus={(e) => {
                  if (!errors.email) {
                    e.target.style.borderColor = "#00D6D6";
                    e.target.style.boxShadow = "0 0 0 3px rgba(0, 214, 214, 0.1)";
                  } else {
                    e.target.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
                  }
                }}
                onBlur={(e) => {
                  const emailValue = e.target.value.trim();
                  if (emailValue && !/\S+@\S+\.\S+/.test(emailValue)) {
                    setErrors((prev) => ({
                      ...prev,
                      email: t('support.emailInvalid'),
                    }));
                    e.target.style.borderColor = "#ef4444";
                  } else if (!emailValue) {
                    e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                  } else {
                    setErrors((prev) => ({
                      ...prev,
                      email: "",
                    }));
                    e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                  }
                  e.target.style.boxShadow = "none";
                }}
                placeholder={t('support.emailPlaceholder')}
              />
              {errors.email && (
                <div className="flex items-center gap-2 mt-1">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 text-sm">{errors.email}</p>
                </div>
              )}
            </div>

            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "#1c2631" }}
              >
                {t('support.issueSummary')}
              </label>
              <input
                type="text"
                name="issue"
                value={formData.issue}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all duration-300"
                style={{
                  borderColor: "rgba(0, 214, 214, 0.3)",
                  color: "#1c2631",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#00D6D6";
                  e.target.style.boxShadow = "0 0 0 3px rgba(0, 214, 214, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                  e.target.style.boxShadow = "none";
                }}
                placeholder={t('support.issuePlaceholder')}
              />
            </div>

            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "#1c2631" }}
              >
                {t('support.priority')}
              </label>
              <div className="relative">
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all duration-300 appearance-none cursor-pointer"
                  style={{
                    borderColor: "rgba(0, 214, 214, 0.3)",
                    color: "#1c2631",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2300D6D6'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 1rem center",
                    backgroundSize: "1.5em 1.5em",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#00D6D6";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(0, 214, 214, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                    e.target.style.boxShadow = "none";
                  }}
                >
                  <option value="">{t('support.priorityPlaceholder')}</option>
                  <option value="low">{t('support.priorityLow')}</option>
                  <option value="medium">{t('support.priorityMedium')}</option>
                  <option value="high">{t('support.priorityHigh')}</option>
                </select>
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "#1c2631" }}
              >
                {t('support.attachments')}
                <span className="text-xs ml-2" style={{ color: "#64748b" }}>
                  {t('support.attachmentsHint')}
                </span>
              </label>
              <div
                className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
                  isDragging ? "scale-[1.02]" : "hover:bg-white/50"
                }`}
                style={{
                  borderColor: isDragging
                    ? "#00D6D6"
                    : "rgba(0, 214, 214, 0.3)",
                  background: isDragging
                    ? "rgba(0, 214, 214, 0.1)"
                    : "rgba(255, 255, 255, 0.3)",
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*,.pdf,.doc,.docx"
                />
                <div className="text-center">
                  <div
                    className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                      isDragging ? "animate-bounce" : ""
                    }`}
                    style={{
                      background: isDragging
                        ? "rgba(0, 214, 214, 0.3)"
                        : "rgba(0, 214, 214, 0.1)",
                    }}
                  >
                    <svg
                      className={`w-8 h-8`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ color: isDragging ? "#00D6D6" : "#64748b" }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="mb-2" style={{ color: "#475569" }}>
                    {t('support.dragDrop')}
                  </p>
                  <p className="text-sm" style={{ color: "#64748b" }}>
                    {t('support.supportedFormats')}
                  </p>
                </div>
              </div>

              {fileError && (
                <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-600">{fileError}</p>
                </div>
              )}

              {formData.files.length > 0 && (
                <div className="mt-4 space-y-3">
                  {formData.files.map((file, index) => {
                    const isImage = file.type?.startsWith("image/");
                    const previewUrl = getPreviewUrl(file, index);

                    return (
                      <div
                        key={index}
                        className="rounded-xl border overflow-hidden"
                        style={{
                          background: "rgba(255, 255, 255, 0.5)",
                          borderColor: "rgba(0, 214, 214, 0.3)",
                        }}
                      >
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 flex-1">
                            {isImage && previewUrl ? (
                              <div
                                className="w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
                                style={{ background: "rgba(0, 214, 214, 0.1)" }}
                              >
                                <img
                                  src={previewUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Show fallback icon instead of blank space
                                    e.target.style.display = "none";
                                    const fallbackIcon =
                                      document.createElement("div");
                                    fallbackIcon.className =
                                      "flex items-center justify-center w-full h-full";
                                    fallbackIcon.innerHTML =
                                      '<svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
                                    e.target.parentElement.appendChild(
                                      fallbackIcon,
                                    );
                                  }}
                                />
                              </div>
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: "rgba(0, 214, 214, 0.2)" }}
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  style={{ color: "#00D6D6" }}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium truncate"
                                style={{ color: "#1c2631" }}
                              >
                                {file.name}
                              </p>
                              <p
                                className="text-xs"
                                style={{ color: "#64748b" }}
                              >
                                {(file.size / 1024).toFixed(2)} KB
                                {uploadedFileUrls[index] && (
                                  <span
                                    className="ml-2"
                                    style={{ color: "#00D6D6" }}
                                  >
                                    ✓ {t('support.uploaded')}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all duration-200 flex-shrink-0 ml-2"
                          >
                            <svg
                              className="w-4 h-4 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                        {isImage && previewUrl && (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs px-3 pb-2 truncate transition-colors"
                            style={{ color: "#64748b" }}
                            onMouseEnter={(e) =>
                              (e.target.style.color = "#00D6D6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.color = "#64748b")
                            }
                          >
                            🔗{" "}
                            {uploadedFileUrls[index]
                              ? t('support.viewUploadedFile')
                              : t('support.preview')}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "#1c2631" }}
              >
                {t('support.description_label')}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="6"
                className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all duration-300 resize-none"
                style={{
                  borderColor: "rgba(0, 214, 214, 0.3)",
                  color: "#1c2631",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#00D6D6";
                  e.target.style.boxShadow = "0 0 0 3px rgba(0, 214, 214, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(0, 214, 214, 0.3)";
                  e.target.style.boxShadow = "none";
                }}
                placeholder={t('support.descriptionPlaceholder')}
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <p className="text-sm" style={{ color: "#64748b" }}>
                <span className="text-red-500">*</span> {t('support.requiredFields')}
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: "#00D6D6",
                  boxShadow: "0 8px 25px rgba(0, 214, 214, 0.3)",
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t('support.submitting')}
                  </span>
                ) : (
                  t('support.submit')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
        duration={5000}
      />

      <style>{`
        /* Placeholder Colors */
        input::placeholder,
        textarea::placeholder,
        select::placeholder {
          color: #94a3b8 !important;
          opacity: 1;
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes float-1 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-20px) translateX(10px); }
          66% { transform: translateY(-10px) translateX(-10px); }
        }

        @keyframes float-2 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(15px) translateX(-15px); }
          66% { transform: translateY(5px) translateX(5px); }
        }

        @keyframes float-3 {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-15px) translateX(-5px); }
          66% { transform: translateY(-5px) translateX(15px); }
        }

        .animate-float-1 {
          animation: float-1 6s ease-in-out infinite;
        }

        .animate-float-2 {
          animation: float-2 8s ease-in-out infinite;
        }

        .animate-float-3 {
          animation: float-3 7s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Support;
