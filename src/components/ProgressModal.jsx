import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const ProgressModal = ({ 
  isOpen, 
  onCancel, 
  error, 
  isFinished, 
  progress = 0, 
  progressMessage = "", 
  totalRowsExtracted = 0 
}) => {
  const { t } = useTranslation();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  // Effect to start the completion animation
  useEffect(() => {
    if (isFinished) {
      setIsCompleting(true);
    }
  }, [isFinished]);

  // Update display progress from real-time API data
  useEffect(() => {
    if (isOpen) {
      setDisplayProgress(progress);
    } else {
      // Reset state when modal is closed
      setTimeout(() => {
        setDisplayProgress(0);
        setIsCompleting(false);
      }, 300);
    }
  }, [isOpen, progress]);

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${remainingSeconds}s`;
  };

  if (!isOpen) return null;

  const modalRoot = document.getElementById("modal-root") || document.body;

  return createPortal(
    // FIXED: Increased z-index from 70 to 10000 to ensure it appears above the FileComparisonModal
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* Enhanced Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-md animate-fade-in"
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 100%)",
        }}
      ></div>

      {/* Enhanced Progress Modal */}
      <div
        className="relative rounded-3xl shadow-2xl border w-full max-w-lg mx-4 animate-modal-in overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(0, 214, 214, 0.15) 0%, rgba(112, 211, 213, 0.1) 100%)",
          backdropFilter: "blur(10px)",
          borderColor: "rgba(0, 214, 214, 0.3)",
        }}
      >
        {/* Enhanced Header */}
        <div
          className="px-8 py-6 border-b relative overflow-hidden"
          style={{
            background: error ? "#dc2626" : "#00D6D6",
            borderColor: "rgba(0, 214, 214, 0.3)",
          }}
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 left-4 w-2 h-2 bg-white rounded-full animate-twinkle"></div>
            <div className="absolute top-4 right-6 w-1.5 h-1.5 bg-white rounded-full animate-twinkle delay-300"></div>
            <div className="absolute bottom-3 left-8 w-1 h-1 bg-white rounded-full animate-twinkle delay-500"></div>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30 animate-glow">
                {error ? (
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-7 h-7 text-white animate-spin-slow"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {error ? t('progressModal.uploadFailed') : t('progressModal.processingFile')}
                </h3>
                <p className="text-white/80 text-sm">
                  {error
                    ? t('progressModal.somethingWentWrong')
                    : t('progressModal.pleaseWait')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Content */}
        <div className="p-8" style={{backgroundColor: "#eafafa"}}>
          {error ? (
            /* Error State */
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 animate-pulse" style={{backgroundColor: "rgba(220, 38, 38, 0.1)"}}>
                <svg
                  className="w-10 h-10"
                  style={{color: "#dc2626"}}
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
              </div>
              <p className="font-semibold text-lg mb-2" style={{color: "#991b1b"}}>
                {t('progressModal.uploadFailed')}
              </p>
              <p className="text-sm mb-6" style={{color: "#64748b"}}>
                {error || t('progressModal.fileCouldNotBeUploaded')}
              </p>
              <button
                onClick={onCancel}
                className="w-full px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105"
                style={{
                  background: "#dc2626",
                }}
              >
                {t('progressModal.close')}
              </button>
            </div>
          ) : (
            /* Enhanced Progress State */
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4" style={{borderColor: "rgba(0, 214, 214, 0.2)"}}></div>
                <div
                  className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
                  style={{ animationDuration: "2s", borderTopColor: "#00D6D6" }}
                ></div>
                <div
                  className="absolute inset-2 rounded-full border-4 border-transparent animate-spin"
                  style={{
                    animationDuration: "3s",
                    animationDirection: "reverse",
                    borderRightColor: "#00D6D6"
                  }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full animate-pulse flex items-center justify-center" style={{backgroundColor: "#00D6D6"}}>
                    <svg
                      className="w-4 h-4 text-white"
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
                </div>
              </div>

              <div className="mb-6">
                <p className="font-semibold text-lg mb-2" style={{color: "#00D6D6"}}>
                  {progressMessage || t('progressModal.processing')}
                </p>
                {totalRowsExtracted > 0 && (
                  <div className="flex justify-between items-center text-sm mb-4" style={{color: "#64748b"}}>
                    <span>
                      {t('progressModal.totalRowsExtracted')}: {totalRowsExtracted}</span>
                  </div>
                )}
              </div>

              <div className="relative mb-6">
                <div className="rounded-full h-4 overflow-hidden mb-2 relative" style={{backgroundColor: "#e2e8f0"}}>
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                    style={{
                      width: `${Math.round(displayProgress)}%`,
                      background: "#00D6D6",
                    }}
                  >
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                      style={{
                        animation: "shimmer 2s infinite",
                        transform: "translateX(-100%)",
                      }}
                    ></div>
                  </div>
                  <div className="absolute top-0 left-0 w-full h-full flex justify-between items-center px-1">
                    {[25, 50, 75].map((marker) => (
                      <div
                        key={marker}
                        className="w-0.5 h-2 rounded-full"
                        style={{backgroundColor: displayProgress >= marker ? "rgba(255, 255, 255, 0.6)" : "#cbd5e1"}}
                      ></div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold" style={{color: "#00D6D6"}}>
                    {Math.round(displayProgress)}%
                  </span>
                  {displayProgress >= 90 && (
                    <span className="text-sm font-medium animate-pulse" style={{color: "#00D6D6"}}>
                      {t('progressModal.almostDone')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center mb-6 px-2">
                {/* {stages.slice(0, 5).map((stage, index) => (
                  <div
                    key={index}
                    className={`flex flex-col items-center ${
                      currentStage >= index
                        ? "text-emerald-400"
                        : "text-slate-500"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full mb-1 ${
                        currentStage >= index
                          ? "bg-emerald-400 animate-pulse"
                          : "bg-slate-600"
                      }`}
                    ></div>
                    <span className="text-xs text-center">{index + 1}</span>
                  </div>
                ))} */}
              </div>

              {/* {showWarning && (
                <div className="mb-6 p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <div className="text-orange-300">
                      <p className="font-medium text-sm mb-1">
                        Vær venligst tålmodig
                      </p>
                      <p className="text-xs">
                        Store filer tager længere tid at analysere. Dette er
                        normalt.
                      </p>
                    </div>
                  </div>
                </div>
              )} */}

              <button
                onClick={onCancel}
                className="w-full px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden group"
                style={{
                  color: "#64748b",
                  backgroundColor: "#e2e8f0",
                  border: "1px solid #cbd5e1"
                }}
              >
                <span className="relative z-10">{t('progressModal.cancel')}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Animations */}
      <style>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 20px rgba(255,255,255,0.5); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { translateX(100%); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-modal-in {
          animation: modal-in 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-twinkle {
          animation: twinkle 2s ease-in-out infinite;
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>,
    modalRoot,
  );
};

export default ProgressModal;
