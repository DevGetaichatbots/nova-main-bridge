import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import ProgressModal from "./ProgressModal";
import { chatService } from "../services/chatService";
import { getApiBaseUrl } from "../utils/apiConfig.js";
import { handleApiError } from "../utils/errorHandler";
import { uploadFilesWithAuth } from "../utils/authApi";

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/csv'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.csv'];

const MAX_CSV_ROWS = 3000;

const countCsvRows = (text) => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  return lines.length > 0 ? lines.length - 1 : 0;
};

const validateFileType = (file, t) => {
  if (!file) return { valid: false, error: t('fileComparison.noFileSelected') };
  
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
  const hasValidMimeType = ALLOWED_FILE_TYPES.includes(file.type);
  
  if (!hasValidExtension && !hasValidMimeType) {
    return { 
      valid: false, 
      error: t('fileComparison.invalidFileType', { fileName: file.name })
    };
  }
  
  return { valid: true, error: null };
};

const validateCsvRowCount = (file) => {
  return new Promise((resolve) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      resolve({ valid: true, rowCount: 0 });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const rowCount = countCsvRows(e.target.result);
      resolve({ valid: rowCount <= MAX_CSV_ROWS, rowCount });
    };
    reader.onerror = () => resolve({ valid: true, rowCount: 0 });
    reader.readAsText(file);
  });
};

const FileComparisonModal = ({
  isOpen,
  onClose,
  onFilesUploaded,
  sessionId,
  autoOpened = false,
}) => {
  const { t, i18n } = useTranslation();
  const [oldScheduleFile, setOldScheduleFile] = useState(null);
  const [newScheduleFile, setNewScheduleFile] = useState(null);
  const [error, setError] = useState("");
  const [fileErrors, setFileErrors] = useState({ old: "", new: "" });
  const [isDragging, setIsDragging] = useState({ old: false, new: false });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [uploadProgressData, setUploadProgressData] = useState(null);
  const cancelPollRef = React.useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (cancelPollRef.current) { cancelPollRef.current(); cancelPollRef.current = null; }
      setOldScheduleFile(null);
      setNewScheduleFile(null);
      setError("");
      setFileErrors({ old: "", new: "" });
      setIsUploading(false);
      setUploadProgress(0);
      setProgressMessage("");
      setUploadProgressData(null);
      setIsDragging({ old: false, new: false });
    }
  }, [isOpen]);

  const handleFileChange = async (e, fileSlot) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const file = files[0];
      const validation = validateFileType(file, t);
      
      if (!validation.valid) {
        setFileErrors(prev => ({ ...prev, [fileSlot]: validation.error }));
        e.target.value = "";
        return;
      }

      const csvCheck = await validateCsvRowCount(file);
      if (!csvCheck.valid) {
        setFileErrors(prev => ({ ...prev, [fileSlot]: t('fileComparison.csvRowLimit', { count: csvCheck.rowCount.toLocaleString(), max: MAX_CSV_ROWS.toLocaleString() }) }));
        e.target.value = "";
        return;
      }
      
      setFileErrors(prev => ({ ...prev, [fileSlot]: "" }));
      if (fileSlot === "old") {
        setOldScheduleFile(file);
      } else if (fileSlot === "new") {
        setNewScheduleFile(file);
      }
      setError("");
    }
    e.target.value = "";
  };

  const handleDragEnter = (e, fileSlot) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging((prev) => ({ ...prev, [fileSlot]: true }));
  };

  const handleDragLeave = (e, fileSlot) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging((prev) => ({ ...prev, [fileSlot]: false }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e, fileSlot) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging((prev) => ({ ...prev, [fileSlot]: false }));

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const validation = validateFileType(file, t);
      
      if (!validation.valid) {
        setFileErrors(prev => ({ ...prev, [fileSlot]: validation.error }));
        return;
      }

      const csvCheck = await validateCsvRowCount(file);
      if (!csvCheck.valid) {
        setFileErrors(prev => ({ ...prev, [fileSlot]: t('fileComparison.csvRowLimit', { count: csvCheck.rowCount.toLocaleString(), max: MAX_CSV_ROWS.toLocaleString() }) }));
        return;
      }
      
      setFileErrors(prev => ({ ...prev, [fileSlot]: "" }));
      if (fileSlot === "old") {
        setOldScheduleFile(file);
      } else if (fileSlot === "new") {
        setNewScheduleFile(file);
      }
      setError("");
    }
  };

  const STEP_LABELS = {
    queued:    { en: 'Getting ready…',           da: 'Gør klar…' },
    table:     { en: 'Preparing your file…',     da: 'Forbereder din fil…' },
    ocr:       { en: 'Reading your document…',   da: 'Læser dit dokument…' },
    chunking:  { en: 'Analysing content…',       da: 'Analyserer indhold…' },
    embedding: { en: 'Understanding schedule…',  da: 'Forstår tidsplanen…' },
    storing:   { en: 'Almost done…',             da: 'Næsten færdig…' },
    complete:  { en: 'Ready!',                   da: 'Klar!' },
  };

  const getStepLabel = (step) => {
    const lang = i18n.language?.startsWith('da') ? 'da' : 'en';
    return STEP_LABELS[step]?.[lang] || '';
  };

  const handleUploadBothFiles = async () => {
    if (!oldScheduleFile || !newScheduleFile) {
      setError(t('fileComparison.selectBothFilesError'));
      return;
    }
    if (!sessionId) {
      setError(t('fileComparison.noSessionError'));
      return;
    }

    setIsUploading(true);
    setError("");
    setUploadProgressData({
      overall_progress: 0,
      old_filename: oldScheduleFile.name,
      new_filename: newScheduleFile.name,
      old_schedule: { step: 'queued', progress: 0, detail: '' },
      new_schedule: { step: 'queued', progress: 0, detail: '' },
    });

    try {
      const result = await chatService.uploadFilesWithSession(oldScheduleFile, newScheduleFile, sessionId);

      const finishUpload = async () => {
        try {
          const fd = new FormData();
          fd.append('old_schedule', oldScheduleFile);
          fd.append('new_schedule', newScheduleFile);
          await uploadFilesWithAuth(`/api/chat/sessions/${sessionId}/files`, fd);
        } catch (e) {
          console.error('Backend file storage error:', e);
        }
        setUploadProgressData({ overall_progress: 100 });
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgressData(null);
          if (onFilesUploaded) {
            onFilesUploaded({
              oldFileName: oldScheduleFile.name,
              newFileName: newScheduleFile.name,
              oldSessionId: result.oldSessionId,
              newSessionId: result.newSessionId,
            });
          }
        }, 600);
      };

      if (result.isAsyncUpload) {
        const proxyBase = getApiBaseUrl();
        const pollInterval = setInterval(async () => {
          try {
            const res = await fetch(
              `${proxyBase}/api/chat/proxy/upload/progress/${result.uploadId}`,
              { credentials: 'include' }
            );
            if (!res.ok) {
              console.warn('Poll response not ok:', res.status);
              return;
            }
            const data = await res.json();
            console.log('Poll data:', data);

            setUploadProgressData(prev => ({
              ...prev,
              overall_progress: data.overall_progress ?? prev?.overall_progress ?? 0,
              old_filename:  data.old_filename  || prev?.old_filename,
              new_filename:  data.new_filename  || prev?.new_filename,
              old_schedule:  data.old_schedule  ?? prev?.old_schedule,
              new_schedule:  data.new_schedule  ?? prev?.new_schedule,
            }));

            if (data.status === 'complete') {
              clearInterval(pollInterval);
              cancelPollRef.current = null;
              await finishUpload();
            } else if (data.status === 'error' || data.status === 'failed') {
              clearInterval(pollInterval);
              cancelPollRef.current = null;
              setError(data.message || t('fileComparison.uploadFailedRetry'));
              setIsUploading(false);
              setUploadProgressData(null);
            }
          } catch (err) {
            console.warn('Poll error (will retry):', err.message);
          }
        }, 2000);

        cancelPollRef.current = () => clearInterval(pollInterval);

      } else {
        await finishUpload();
      }
    } catch (error) {
      if (cancelPollRef.current) { cancelPollRef.current(); cancelPollRef.current = null; }
      console.error('Upload error:', error);
      const isDanish = i18n.language?.startsWith('da');
      let userErrorMessage = error.message || t('fileComparison.uploadFailedRetry');
      if (userErrorMessage.includes('context length') || userErrorMessage.includes('token')) {
        userErrorMessage = isDanish
          ? 'Filerne er for store til at behandle. Prøv venligst med mindre filer eller kontakt support.'
          : 'The uploaded files are too large to process. Please try with smaller files or contact support.';
      } else if (userErrorMessage.includes('HTTP 500') || userErrorMessage.includes('500')) {
        userErrorMessage = isDanish
          ? 'Der opstod en serverfejl under behandling af filerne. Prøv venligst igen.'
          : 'A server error occurred while processing the files. Please try again.';
      }
      setError(userErrorMessage);
      setIsUploading(false);
      setUploadProgressData(null);
      await handleApiError(error, { endpoint: "file-upload-webhook", method: "POST" });
    }
  };

  const handleClose = () => {
    if (autoOpened && !oldScheduleFile && !newScheduleFile) {
      return;
    }
    onClose(null);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const canUpload = oldScheduleFile && newScheduleFile && !isUploading;

  if (!isOpen) return null;

  const modalRoot = document.getElementById("modal-root") || document.body;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        onClick={handleOverlayClick}
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          className="relative w-full max-w-5xl max-h-[95vh] rounded-3xl shadow-2xl border animate-modal-in overflow-hidden flex flex-col"
          style={{
            background:
              "linear-gradient(145deg, rgba(0, 214, 214, 0.15) 0%, rgba(112, 211, 213, 0.1) 100%)",
            backdropFilter: "blur(10px)",
            borderColor: "rgba(0, 214, 214, 0.3)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-8 py-6 text-white"
            style={{ background: "#00D6D6" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center border border-white/20">
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {t('fileComparison.title')}
                  </h3>
                  <p className="text-white/80 text-sm mt-1">
                    {t('fileComparison.subtitle')}
                  </p>
                </div>
              </div>
              {!autoOpened && (
                <button
                  onClick={handleClose}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300 group"
                >
                  <svg
                    className="w-6 h-6 text-white group-hover:scale-110 transition-transform"
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
              )}
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto custom-scrollbar"
            style={{
              maxHeight: "calc(95vh - 200px)",
              backgroundColor: "#eafafa",
            }}
          >
            <div className="p-8 space-y-8">
              {error && (
                <div
                  className="p-4 rounded-xl border animate-shake"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderColor: "rgba(239, 68, 68, 0.3)",
                    color: "#991b1b",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: "#dc2626" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="font-medium">{error}</span>
                  </div>
                </div>
              )}

              {autoOpened && (
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    borderColor: "rgba(59, 130, 246, 0.3)",
                    color: "#1e40af",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: "#3b82f6" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="font-medium">
                      {t('fileComparison.uploadBothFilesPrompt')}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label
                    className="flex items-center gap-2 text-lg font-semibold"
                    style={{ color: "#1c2631" }}
                  >
                    <svg
                      className="w-5 h-5"
                      style={{ color: "#00D6D6" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    {t('fileComparison.firstFile')} <span className="text-red-400">*</span>
                  </label>
                  <div
                    className="relative border-2 border-dashed rounded-2xl p-8 transition-all duration-500 flex flex-col justify-center"
                    style={{
                      minHeight: "220px",
                      cursor: isUploading ? "not-allowed" : "pointer",
                      borderColor: isDragging.old
                        ? "#00D6D6"
                        : oldScheduleFile
                          ? "rgba(0, 214, 214, 0.6)"
                          : "rgba(0, 214, 214, 0.3)",
                      backgroundColor: isDragging.old
                        ? "rgba(0, 214, 214, 0.2)"
                        : oldScheduleFile
                          ? "rgba(0, 214, 214, 0.15)"
                          : "rgba(255, 255, 255, 0.5)",
                      transform: isDragging.old ? "scale(1.02)" : "scale(1)",
                      opacity: isUploading ? 0.6 : 1,
                    }}
                    onDragEnter={(e) => !isUploading && handleDragEnter(e, "old")}
                    onDragLeave={(e) => !isUploading && handleDragLeave(e, "old")}
                    onDragOver={!isUploading ? handleDragOver : undefined}
                    onDrop={(e) => !isUploading && handleDrop(e, "old")}
                  >
                    <input
                      type="file"
                      onChange={(e) => handleFileChange(e, "old")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.doc,.docx,.txt,.csv"
                      disabled={isUploading}
                    />
                    <div className="text-center flex-1 flex flex-col justify-center">
                      <div
                        className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-all duration-500"
                        style={{
                          backgroundColor: isDragging.old
                            ? "rgba(0, 214, 214, 0.3)"
                            : oldScheduleFile
                              ? "rgba(0, 214, 214, 0.25)"
                              : "rgba(0, 214, 214, 0.1)",
                        }}
                      >
                        <svg
                          className="w-8 h-8 transition-all duration-500"
                          style={{
                            color: isDragging.old || oldScheduleFile
                              ? "#00D6D6"
                              : "#64748b",
                          }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <p
                        className="font-semibold text-lg mb-3 max-w-full truncate px-2"
                        style={{ color: "#1c2631" }}
                        title={oldScheduleFile ? oldScheduleFile.name : ""}
                      >
                        {oldScheduleFile
                          ? oldScheduleFile.name
                          : t('fileComparison.dragDrop')}
                      </p>
                      <p className="text-sm" style={{ color: "#64748b" }}>
                        {t('fileComparison.fileTypesSupported')}
                      </p>
                    </div>
                  </div>
                  {fileErrors.old && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-600">{fileErrors.old}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label
                    className="flex items-center gap-2 text-lg font-semibold"
                    style={{ color: "#1c2631" }}
                  >
                    <svg
                      className="w-5 h-5"
                      style={{ color: "#00D6D6" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    {t('fileComparison.secondFile')} <span className="text-red-400">*</span>
                  </label>
                  <div
                    className="relative border-2 border-dashed rounded-2xl p-8 transition-all duration-500 flex flex-col justify-center"
                    style={{
                      minHeight: "220px",
                      cursor: isUploading ? "not-allowed" : "pointer",
                      borderColor: isDragging.new
                        ? "#00D6D6"
                        : newScheduleFile
                          ? "rgba(0, 214, 214, 0.6)"
                          : "rgba(0, 214, 214, 0.3)",
                      backgroundColor: isDragging.new
                        ? "rgba(0, 214, 214, 0.2)"
                        : newScheduleFile
                          ? "rgba(0, 214, 214, 0.15)"
                          : "rgba(255, 255, 255, 0.5)",
                      transform: isDragging.new ? "scale(1.02)" : "scale(1)",
                      opacity: isUploading ? 0.6 : 1,
                    }}
                    onDragEnter={(e) => !isUploading && handleDragEnter(e, "new")}
                    onDragLeave={(e) => !isUploading && handleDragLeave(e, "new")}
                    onDragOver={!isUploading ? handleDragOver : undefined}
                    onDrop={(e) => !isUploading && handleDrop(e, "new")}
                  >
                    <input
                      type="file"
                      onChange={(e) => handleFileChange(e, "new")}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.doc,.docx,.txt,.csv"
                      disabled={isUploading}
                    />
                    <div className="text-center flex-1 flex flex-col justify-center">
                      <div
                        className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-all duration-500"
                        style={{
                          backgroundColor: isDragging.new
                            ? "rgba(0, 214, 214, 0.3)"
                            : newScheduleFile
                              ? "rgba(0, 214, 214, 0.25)"
                              : "rgba(0, 214, 214, 0.1)",
                        }}
                      >
                        <svg
                          className="w-8 h-8 transition-all duration-500"
                          style={{
                            color: isDragging.new || newScheduleFile
                              ? "#00D6D6"
                              : "#64748b",
                          }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <p
                        className="font-semibold text-lg mb-3 max-w-full truncate px-2"
                        style={{ color: "#1c2631" }}
                        title={newScheduleFile ? newScheduleFile.name : ""}
                      >
                        {newScheduleFile
                          ? newScheduleFile.name
                          : t('fileComparison.dragDropSecond')}
                      </p>
                      <p className="text-sm" style={{ color: "#64748b" }}>
                        {t('fileComparison.fileTypesSupported')}
                      </p>
                    </div>
                  </div>
                  {fileErrors.new && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-600">{fileErrors.new}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Live upload progress */}
              {isUploading && uploadProgressData && (
                <div className="space-y-4 p-5 rounded-2xl border" style={{ backgroundColor: "rgba(0,214,214,0.06)", borderColor: "rgba(0,214,214,0.25)" }}>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-2" style={{ color: "#1c2631" }}>
                      {uploadProgressData.overall_progress >= 100 ? (
                        <svg className="w-4 h-4" style={{ color: "#00D6D6" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 animate-spin" style={{ color: "#00D6D6" }} fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {uploadProgressData.overall_progress >= 100
                        ? (i18n.language?.startsWith('da') ? 'Filerne er klar!' : 'Your files are ready!')
                        : (i18n.language?.startsWith('da') ? 'Behandler dine filer…' : 'Processing your files…')}
                    </span>
                    <span className="text-sm font-bold" style={{ color: "#00D6D6" }}>
                      {Math.round(uploadProgressData.overall_progress || 0)}%
                    </span>
                  </div>

                  {/* Overall progress bar */}
                  <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${uploadProgressData.overall_progress || 0}%`, background: "linear-gradient(90deg, #00D6D6, #70d3d5)" }}
                    />
                  </div>

                  {/* Per-file cards */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'old_schedule', label: uploadProgressData.old_filename || oldScheduleFile?.name || 'Schedule A', data: uploadProgressData.old_schedule },
                      { key: 'new_schedule', label: uploadProgressData.new_filename || newScheduleFile?.name || 'Schedule B', data: uploadProgressData.new_schedule },
                    ].map(({ key, label, data }) => (
                      <div key={key} className="rounded-xl p-4 border space-y-2" style={{ backgroundColor: "rgba(255,255,255,0.7)", borderColor: "rgba(0,214,214,0.2)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold truncate" style={{ color: "#1c2631", maxWidth: "70%" }} title={label}>{label}</p>
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: "#00D6D6" }}>{Math.round(data?.progress || 0)}%</span>
                        </div>
                        {/* Show server's detail text if available, otherwise fall back to step label */}
                        {(data?.detail || (data?.step && getStepLabel(data.step))) && (
                          <p className="text-[12px] font-medium" style={{ color: "#007a7a" }}>
                            {data?.detail || getStepLabel(data.step)}
                          </p>
                        )}
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${data?.progress || 0}%`, background: data?.step === 'complete' ? '#00D6D6' : 'linear-gradient(90deg, #00D6D6, #70d3d5)' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {oldScheduleFile && newScheduleFile && !isUploading && (
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    backgroundColor: "rgba(0, 214, 214, 0.1)",
                    borderColor: "rgba(0, 214, 214, 0.3)",
                    color: "#00a0a0",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: "#00D6D6" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-medium">
                      {t('fileComparison.bothFilesSelected')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-6" style={{ backgroundColor: "#eafafa" }}>
            <div className="flex gap-4">
              {!autoOpened && (
                <button
                  onClick={handleClose}
                  disabled={isUploading}
                  className="flex-1 px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
                  style={{
                    color: "#64748b",
                    backgroundColor: "#e2e8f0",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  {t('fileComparison.cancel')}
                </button>
              )}
              <button
                onClick={handleUploadBothFiles}
                disabled={!canUpload}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: canUpload
                    ? "linear-gradient(135deg, #00D6D6, #00b8b8)"
                    : "#94a3b8",
                  boxShadow: canUpload
                    ? "0 8px 25px rgba(0, 214, 214, 0.3)"
                    : "none",
                }}
              >
                {isUploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('fileComparison.processing')}
                  </div>
                ) : (
                  t('fileComparison.startComparison')
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-in {
          animation: modal-in 0.3s ease-out;
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background-color: rgba(30, 41, 59, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #00d6d6 0%, #00d6d6 100%);
          border-radius: 10px;
          border: 2px solid rgba(30, 41, 59, 0.5);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #00d6d6 rgb(234, 250, 250);
        }
      `}</style>
    </>,
    modalRoot
  );
};

export default FileComparisonModal;
