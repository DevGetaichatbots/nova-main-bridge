import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";
import { chatService } from "./services/chatService";
import { putWithAuth, postWithAuth } from "./utils/authApi";

// Always-eager: rendered on every page or needed for auth gating
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import CompanyOwnerRoute from "./components/CompanyOwnerRoute";
import SuperAdminRoute from "./components/SuperAdminRoute";
import Login from "./components/Login";

// Lazy-loaded: only downloaded when user actually navigates to that route
const ChatWidget = lazy(() => import("./components/ChatWidget"));
const FileComparisonModal = lazy(() => import("./components/FileComparisonModal"));
const ScheduleAnalysis = lazy(() => import("./components/ScheduleAnalysis"));
const AdminPortal = lazy(() => import("./components/AdminPortal"));
const CompanyPortal = lazy(() => import("./components/CompanyPortal"));
const SuperAdminPortal = lazy(() => import("./components/SuperAdminPortal"));
const UpdateProfile = lazy(() => import("./components/UpdateProfile"));
const Support = lazy(() => import("./components/Support"));
const Signup = lazy(() => import("./components/Signup"));
const CompanySignup = lazy(() => import("./components/CompanySignup"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const VerifyOTP = lazy(() => import("./components/VerifyOTP"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));
const SecurityGDPR = lazy(() => import("./components/SecurityGDPR"));
const ContactPage = lazy(() => import("./components/ContactPage"));
const AboutPage = lazy(() => import("./components/AboutPage"));
const PrivacyPolicyPage = lazy(() => import("./components/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./components/TermsOfServicePage"));
const NotFound = lazy(() => import("./components/NotFound"));

// Kick off background downloads for the two most-used routes.
// Called once (idleCallback / setTimeout) so the JS chunks are warm
// before the user ever clicks the nav links.
const preloadCriticalRoutes = () => {
  import("./components/ChatWidget");
  import("./components/ScheduleAnalysis");
};

// Suspense fallback — matches the existing cyan theme
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-cyan-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-cyan-200 border-t-cyan-500 animate-spin" />
      <span className="text-sm text-slate-400 font-medium">Loading...</span>
    </div>
  </div>
);

// Floating Background Elements Component for File Comparison Theme
const FloatingElements = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating Code-like Elements - Flat colors */}
      <div
        className="absolute top-1/4 left-1/4 w-24 h-24 rounded-lg opacity-5 animate-float-1"
        style={{
          background: "#e3f6f7",
        }}
      ></div>
      <div
        className="absolute top-3/4 right-1/4 w-20 h-20 rounded-xl opacity-5 animate-float-2"
        style={{
          background: "#e9ebec",
        }}
      ></div>
      <div
        className="absolute top-1/2 right-1/3 w-16 h-16 rounded-full opacity-8 animate-float-3"
        style={{
          background: "#e3f6f7",
        }}
      ></div>
      <div
        className="absolute bottom-1/4 left-1/3 w-18 h-18 rounded-2xl opacity-6 animate-float-reverse"
        style={{
          background: "#e9ebec",
        }}
      ></div>
    </div>
  );
};

// Advanced Drag & Drop File Upload Component
const AdvancedFileUpload = ({
  sessionId,
  onFileUploadSuccess,
  user,
  getSessionFileCount,
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rippleEffect, setRippleEffect] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showFileLimitModal, setShowFileLimitModal] = useState(false);
  const fileInputRef = useRef(null); // Ref for the hidden file input

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!user || !sessionId) {
      setShowLoginPrompt(true);
      return;
    }

    // Read-only users cannot upload files
    if (user.role === 'read_only_user') {
      return;
    }

    // Check if session file limit is reached
    if (getSessionFileCount() >= 2) {
      setShowFileLimitModal(true);
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFile(files); // Store all files instead of just first one
      setRippleEffect(true);
      setTimeout(() => {
        setRippleEffect(false);
        setIsModalOpen(true);
      }, 300);
    }
  };

  const handleFileSelect = (e) => {
    if (!user || !sessionId) {
      setShowLoginPrompt(true);
      return;
    }

    // Read-only users cannot upload files
    if (user.role === 'read_only_user') {
      return;
    }

    // Check if session file limit is reached
    if (getSessionFileCount() >= 2) {
      setShowFileLimitModal(true);
      e.target.value = "";
      return;
    }

    const files = Array.from(e.target.files);
    if (files.length > 0) {
      console.log(
        "Files selected:",
        files.map((f) => f.name),
      );
      setSelectedFile(files); // Store all files instead of just first one
      setRippleEffect(true);
      setTimeout(() => {
        setRippleEffect(false);
        setIsModalOpen(true);
      }, 300);
    }
    // Reset input value to allow selecting the same files again
    e.target.value = "";
  };

  const handleModalClose = (result) => {
    setIsModalOpen(false);
    setSelectedFile(null);
    if (result && result.success && onFileUploadSuccess) {
      // Handle successful upload result
      console.log("Upload completed:", result);
      // Trigger chatbot opening and success message
      onFileUploadSuccess(result);
    }
  };

  // New handler for the button click to open the file input
  const handleEndSession = () => {
    // This should call the parent's end session handler
    if (window.handleEndSession) {
      window.handleEndSession();
    }
  };

  const handleButtonClick = () => {
    // Check if user is not logged in (even with active session)
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    // Check if no session exists
    if (!sessionId) {
      setShowLoginPrompt(true);
      return;
    }

    // Check if session file limit is reached
    if (getSessionFileCount() >= 2) {
      setShowFileLimitModal(true);
      return;
    }

    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (isModalOpen || showLoginPrompt) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen, showLoginPrompt]);

  return (
    <>
      <div className="w-full max-w-6xl mx-auto mb-8 relative">
        <div
          className={`relative overflow-hidden rounded-2xl shadow-2xl border-2 transition-all duration-500 ${
            user && sessionId
              ? "cursor-pointer"
              : "cursor-not-allowed opacity-75"
          } ${
            isDragging
              ? "border-[#00D6D6] bg-[#00D6D6]/20 scale-105"
              : isHovering && user && sessionId
                ? "border-[#70d3d5]/60 bg-[#70d3d5]/10"
                : "border-slate-700/50"
          } ${rippleEffect ? "animate-bounce" : ""}`}
          style={{
            background: isDragging
              ? "linear-gradient(145deg, rgba(0, 214, 214, 0.2) 0%, rgba(112, 211, 213, 0.15) 100%)"
              : "linear-gradient(145deg, rgba(0, 214, 214, 0.08) 0%, rgba(112, 211, 213, 0.05) 100%)",
            minHeight: "200px",
            borderColor: isDragging ? "#00D6D6" : "rgba(0, 214, 214, 0.3)",
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onMouseEnter={() => user && sessionId && setIsHovering(true)}
          onMouseLeave={() => user && sessionId && setIsHovering(false)}
        >
          {/* Background Animation */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-4 left-4 w-3 h-3 bg-[#00D6D6] rounded-full animate-ping"></div>
            <div className="absolute top-8 right-8 w-2 h-2 bg-[#70d3d5] rounded-full animate-bounce delay-300"></div>
            <div className="absolute bottom-6 left-8 w-2.5 h-2.5 bg-[#00D6D6] rounded-full animate-pulse delay-500"></div>
            <div className="absolute bottom-4 right-4 w-3 h-3 bg-[#29dd6b] rounded-full animate-ping delay-700"></div>
          </div>

          {/* Ripple Effect */}
          {rippleEffect && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-32 h-32 rounded-full animate-ping opacity-30"
                style={{
                  background:
                    "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
                }}
              ></div>
            </div>
          )}

          {/* Content */}
          <div className="relative z-10 p-8 text-center">
            <div className="flex flex-col items-center space-y-6">
              {/* Upload Icon */}
              <div
                className={`relative w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                  isDragging ? "scale-110 animate-pulse" : ""
                }`}
                style={{
                  background: isDragging
                    ? "linear-gradient(135deg, #00D6D6 0%, #70d3d5 100%)"
                    : "linear-gradient(135deg, rgba(0, 214, 214, 0.3) 0%, rgba(112, 211, 213, 0.3) 100%)",
                }}
              >
                <svg
                  className={`w-10 h-10 transition-all duration-500 ${
                    isDragging ? "text-white animate-bounce" : "text-[#00D6D6]"
                  }`}
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

              {/* Main Text */}
              <div className="space-y-2">
                <h3
                  className={`text-2xl font-bold transition-all duration-500 ${
                    isDragging ? "animate-pulse" : ""
                  }`}
                  style={{
                    color: isDragging ? "#70d3d5" : "#00D6D6",
                  }}
                >
                  {isDragging ? t('home.dropFileHere') : t('home.quickUpload')}
                </h3>
                <p
                  className={`text-base transition-all duration-500 ${
                    isDragging
                      ? "text-[#70d3d5] animate-pulse"
                      : "text-slate-600"
                  }`}
                >
                  {isDragging
                    ? t('home.dropToUpload')
                    : t('home.dragDropMultiple')}
                </p>
              </div>

              {/* File Types */}
              <div className="flex flex-wrap gap-2 justify-center">
                {["PDF", "DOC", "DOCX", "TXT"].map((type, index) => (
                  <span
                    key={type}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 ${
                      isDragging ? "animate-pulse" : ""
                    }`}
                    style={{
                      background: isDragging
                        ? "rgba(0, 214, 214, 0.3)"
                        : "#e0f7f7",
                      color: isDragging ? "#70d3d5" : "#1c2631",
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    {type}
                  </span>
                ))}
              </div>

              {/* Browse Button */}
              <button
                onClick={handleButtonClick}
                disabled={!sessionId}
                className={`group relative px-8 py-4 rounded-xl font-semibold transition-all duration-500 transform hover:scale-105 ${
                  !sessionId ? "opacity-60 cursor-not-allowed" : ""
                } ${
                  isHovering && sessionId
                    ? "scale-105 shadow-2xl"
                    : sessionId
                      ? "hover:shadow-xl"
                      : ""
                }`}
                style={{
                  background: sessionId
                    ? "linear-gradient(135deg, #00D6D6 0%, #70d3d5 100%)"
                    : "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)",
                  boxShadow: sessionId
                    ? "0 8px 30px rgba(0, 214, 214, 0.4)"
                    : "0 8px 30px rgba(107, 114, 128, 0.4)",
                }}
                onMouseEnter={() => sessionId && setIsHovering(true)}
                onMouseLeave={() => sessionId && setIsHovering(false)}
              >
                <div className="flex items-center gap-2 text-white">
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
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>{t('home.uploadHere')}</span>
                </div>
              </button>

              {/* Session Status */}
              {!sessionId && (
                <div className="flex items-center gap-2 text-orange-400 text-sm animate-pulse">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.312 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <span>{t('home.startSessionToUpload')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Modal */}
      {isModalOpen && (
        <Suspense fallback={null}>
          <FileComparisonModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            selectedFiles={selectedFile}
            sessionId={sessionId}
            user={user}
            onFileUploadSuccess={onFileUploadSuccess}
            getSessionFileCount={getSessionFileCount}
          />
        </Suspense>
      )}

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.6)" }}
          onClick={() => setShowLoginPrompt(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: "slideIn 0.3s ease-out",
            }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, #00D6D6 0%, #00b8b8 100%)",
                }}
              >
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-center mb-4 text-[#1c2631]">
              {t('home.loginRequired')}
            </h3>

            {/* Message */}
            <div className="text-center mb-6 text-slate-600 space-y-3">
              <p className="text-base leading-relaxed">
                For at bruge{" "}
                <strong className="text-[#00D6D6]">
                  {t('home.loginRequiredDesc').split(',')[0]}
                </strong>
                , skal du være logget ind.
              </p>
              <p className="text-sm leading-relaxed">
                Dette sikrer, at dine filer og sammenligninger gemmes sikkert
                til din konto.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <a
                href="/login"
                className="w-full py-3 rounded-xl text-white font-semibold text-center transition-all duration-300 transform hover:scale-105"
                style={{
                  background:
                    "linear-gradient(135deg, #00D6D6 0%, #00b8b8 100%)",
                  boxShadow: "0 4px 15px rgba(0, 214, 214, 0.3)",
                }}
              >
                Log ind
              </a>
              <a
                href="/signup"
                className="w-full py-3 rounded-xl font-semibold text-center transition-all duration-300 border-2 hover:bg-slate-50"
                style={{
                  borderColor: "#00D6D6",
                  color: "#00D6D6",
                }}
              >
                Tilmeld dig
              </a>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-700 transition-colors duration-200"
              >
                Annuller
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Limit Modal */}
      {showFileLimitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="relative max-w-md w-full mx-4 rounded-3xl shadow-2xl border border-slate-700/50 p-8"
            style={{
              background:
                "linear-gradient(145deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.312 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                {t('home.sessionLimitReached')}
              </h3>

              <p className="text-slate-600 mb-6 leading-relaxed">
                Du har allerede uploadet 2 filer i denne session. For at uploade
                nye filer skal du afslutte den aktuelle session og starte en ny.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowFileLimitModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl bg-slate-700/50 text-slate-600 hover:bg-slate-600/50 transition-all duration-300"
                >
                  OK
                </button>

                <button
                  onClick={() => {
                    setShowFileLimitModal(false);
                    handleEndSession();
                  }}
                  className="flex-1 px-6 py-3 rounded-xl text-white font-semibold transition-all duration-300"
                  style={{
                    background:
                      "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  }}
                >
                  Afslut Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        id="file-input"
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        ref={fileInputRef} // Attach the ref to the input element
        onChange={handleFileSelect}
        disabled={!user}
      />
    </>
  );
};

// Enhanced Session Control Panel Component
const SessionControl = ({ sessionId, onStart, onEnd, user }) => {
  const { t } = useTranslation();
  const statusText = sessionId ? t('home.activeSession') : t('home.noActiveSession');
  const [ripple, setRipple] = useState(false);

  const handleStartClick = () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
    onStart();
    setTimeout(() => {
      const chatButton = document.querySelector('[data-chat-toggle]');
      if (chatButton) chatButton.click();
    }, 100);
  };

  const handleEndClick = () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
    onEnd();
  };

  return (
    <div className="w-full max-w-6xl mx-auto mb-8 relative">
      {/* Main Panel */}
      <div
        className="relative p-6 rounded-2xl shadow-md border border-gray-200 transition-all duration-300"
        style={{
          background: "#d0f4f4",
        }}
      >
        <div className="relative z-10">
          {/* Status Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    sessionId ? "animate-pulse" : ""
                  }`}
                  style={{
                    background: sessionId ? "#00D6D6" : "#f59e0b",
                  }}
                >
                  {sessionId && (
                    <div
                      className="absolute inset-0 rounded-full animate-ping opacity-40"
                      style={{
                        background: "#00D6D6",
                      }}
                    ></div>
                  )}
                  <div className="w-1.5 h-1.5 bg-white rounded-full relative z-10"></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {statusText}
                </h3>
                <p className="text-gray-600 text-xs">
                  Session ID:{" "}
                  <span className="font-mono text-[#00D6D6] px-2 py-0.5 rounded bg-gray-100 text-xs">
                    {sessionId
                      ? sessionId.substring(0, 8) + "..."
                      : t('home.notCreated')}
                  </span>
                </p>
              </div>
            </div>

            {/* File Comparison Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center animate-spin-slow"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(6, 182, 212, 0.3) 100%)",
              }}
            >
              <svg
                className="w-5 h-5 text-cyan-400"
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

          {/* Action Buttons */}
          <div className="w-full">
            {!sessionId ? (
              <button
                onClick={() => {
                  if (user?.role === 'read_only_user') return;
                  if (!user) {
                    onStart();
                  } else {
                    handleStartClick();
                  }
                }}
                disabled={user?.role === 'read_only_user'}
                className={`group relative overflow-hidden w-full p-5 rounded-xl font-bold text-lg transition-all duration-500 transform shadow-lg ${
                  user?.role === 'read_only_user' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'
                } ${ripple ? "animate-pulse" : ""}`}
                style={{
                  background:
                    "linear-gradient(135deg, #00D6D6 0%, #00b8b8 100%)",
                  boxShadow: "0 6px 20px rgba(0, 214, 214, 0.4)",
                }}
                title={user?.role === 'read_only_user' ? t('home.readOnlyNoAccess') : ''}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

                <div className="relative flex items-center justify-center gap-3 text-white">
                  <svg
                    className="w-6 h-6 transition-transform duration-300 group-hover:scale-110"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span className="transition-all duration-300 tracking-wide">
                    {t('home.startChat')}
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => {
                  const chatButton = document.querySelector('[data-chat-toggle]');
                  if (chatButton) chatButton.click();
                }}
                className={`group relative overflow-hidden w-full p-5 rounded-xl font-bold text-lg transition-all duration-500 transform hover:scale-[1.02] cursor-pointer shadow-lg ${
                  ripple ? "animate-pulse" : ""
                }`}
                style={{
                  background:
                    "linear-gradient(135deg, #00D6D6 0%, #00b8b8 100%)",
                  boxShadow: "0 6px 20px rgba(0, 214, 214, 0.4)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

                <div className="relative flex items-center justify-center gap-3 text-white">
                  <svg
                    className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span className="transition-all duration-300 tracking-wide">
                    {t('home.goToChat')}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Login Required Info Card - Only shown for logged-out users */}
      {!user && (
        <div
          className="relative mt-6 p-6 rounded-2xl shadow-xl border border-[#00D6D6]/30 transition-all duration-500 transform hover:scale-[1.01] animate-fadeIn"
          style={{
            background:
              "linear-gradient(145deg, rgba(0, 214, 214, 0.15) 0%, rgba(112, 211, 213, 0.1) 100%)",
            backdropFilter: "blur(10px)",
          }}
        >
          {/* Icon and Title */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0, 214, 214, 0.3) 0%, rgba(112, 211, 213, 0.3) 100%)",
                border: "2px solid rgba(0, 214, 214, 0.4)",
              }}
            >
              <svg
                className="w-6 h-6 text-[#00D6D6]"
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
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1c2631] mb-2">
                {t('home.loginRequiredForUpload')}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                For at bruge{" "}
                <span className="font-semibold text-cyan-400">
                  Filuploadfuntionen with u
                </span>
                , skal du være logget ind. Dette sikrer, at dine filer og
                sammenligninger gemmes sikkert til din konto.
              </p>
            </div>
          </div>

          {/* Guidelines List */}
          <div className="space-y-3 ml-16">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D6D6] mt-2 flex-shrink-0"></div>
              <p className="text-slate-500 text-sm">
                <span className="font-semibold text-slate-600">{t('navbar.login')}</span>{" "}
                eller{" "}
                <span className="font-semibold text-slate-600">
                  tilmeld dig
                </span>{" "}
                {t('home.loginOrSignup').split(' ').slice(-4).join(' ')}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D6D6] mt-2 flex-shrink-0"></div>
              <p className="text-slate-500 text-sm">
                {t('home.filesStoredSecurely')}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D6D6] mt-2 flex-shrink-0"></div>
              <p className="text-slate-500 text-sm">
                Nova kan sammenligne op til 2 filer ad gangen.
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-6 pt-6 border-t border-[#00D6D6]/20">
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-sm">
                {t('home.readyToStart')}
              </p>
              <div className="flex gap-3">
                <a
                  href="/login"
                  className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all duration-300 transform hover:scale-105"
                  style={{
                    background:
                      "linear-gradient(135deg, #00D6D6 0%, #70d3d5 100%)",
                    boxShadow: "0 4px 14px 0 rgba(0, 214, 214, 0.4)",
                  }}
                >
                  Log ind
                </a>
                <a
                  href="/signup"
                  className="px-4 py-2 rounded-lg font-semibold text-sm bg-slate-700 text-white hover:bg-slate-600 transition-all duration-300 transform hover:scale-105"
                >
                  Tilmeld dig
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Placeholder for SavedFilesSection component
const SavedFilesSection = ({ sessionId }) => {
  const { t } = useTranslation();
  const [savedFiles, setSavedFiles] = useState([]);

  // Function to save file details to local storage
  const saveFile = (fileData) => {
    setSavedFiles((prevFiles) => {
      // Check if file already exists to prevent duplicates
      const fileExists = prevFiles.some(
        (existingFile) =>
          existingFile.name === fileData.name &&
          existingFile.uploadedAt === fileData.uploadedAt &&
          existingFile.source === fileData.source,
      );

      if (fileExists) {
        console.log("File already exists, skipping save:", fileData.name);
        return prevFiles; // Don't add duplicate
      }

      const newFiles = [...prevFiles, { ...fileData, id: uuidv4() }];
      const storageKey = `savedFiles_${sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify(newFiles));
      return newFiles;
    });
  };

  // Function to delete a file from local storage
  const deleteFile = (fileId) => {
    setSavedFiles((prevFiles) => {
      const newFiles = prevFiles.filter((file) => file.id !== fileId);
      const storageKey = `savedFiles_${sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify(newFiles));
      return newFiles;
    });
  };

  // Expose saveFile function to the global scope for external access
  useEffect(() => {
    window.saveFileToSession = saveFile;
    // Load files from storage when component mounts or sessionId changes
    const storageKey = `savedFiles_${sessionId}`;
    const storedFiles = localStorage.getItem(storageKey);
    if (storedFiles) {
      setSavedFiles(JSON.parse(storedFiles));
    }

    // Cleanup function to remove the global function
    return () => {
      delete window.saveFileToSession;
      // No need to clear localStorage here as it's tied to the session ID
    };
  }, [sessionId]); // Re-run if sessionId changes

  if (!sessionId) return null; // Don't render if no session is active

  return (
    <div
      className="w-full max-w-6xl mx-auto mb-8 p-6 rounded-2xl shadow-xl border"
      style={{
        background:
          "linear-gradient(145deg, rgba(0, 214, 214, 0.08) 0%, rgba(112, 211, 213, 0.05) 100%)",
        borderColor: "rgba(0, 214, 214, 0.3)",
      }}
    >
      <h3 className="text-xl font-bold mb-4" style={{ color: "#1c2631" }}>
        {t('home.savedFilesTitle')}
      </h3>
      {savedFiles.length === 0 ? (
        <p style={{ color: "#64748b" }}>
          {t('home.noFilesYet')}
        </p>
      ) : (
        <ul className="space-y-3">
          {savedFiles.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between p-3 rounded-lg border transition-all duration-300"
              style={{
                background: "#ffffff",
                borderColor: "rgba(0, 214, 214, 0.2)",
              }}
            >
              <div>
                <p className="font-medium text-sm" style={{ color: "#1c2631" }}>
                  {file.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                  {file.uploadedAt}
                </p>
              </div>
              {/* <button
                onClick={() => deleteFile(file.id)}
                className="text-red-500 hover:text-red-400 transition-colors duration-300 ml-4"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button> */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  // Initialize sessionId and isChatWidgetOpen from localStorage for persistence across refreshes
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem('currentChatSessionId');
    return saved || null;
  });
  const [chatWidgetKey, setChatWidgetKey] = useState(0);
  const [pendingUploadResult, setPendingUploadResult] = useState(null);
  const [user, setUser] = useState(null);
  const [isChatWidgetOpen, setIsChatWidgetOpen] = useState(() => {
    return localStorage.getItem('isChatWidgetOpen') === 'true';
  });
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [uploadedFileNames, setUploadedFileNames] = useState({ old: null, new: null });
  const [hasAutoOpenedModal, setHasAutoOpenedModal] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [filesUploaded, setFilesUploaded] = useState(false);
  const [tableSessionIds, setTableSessionIds] = useState({ oldSessionId: null, newSessionId: null });
  
  // Preload Chat and Schedule Risk chunks in the background after mount.
  // requestIdleCallback fires when the browser is idle; setTimeout is the fallback.
  useEffect(() => {
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(preloadCriticalRoutes);
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(preloadCriticalRoutes, 1500);
      return () => clearTimeout(id);
    }
  }, []);

  // Persist chat state to localStorage for browser refresh persistence
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('currentChatSessionId', sessionId);
    }
  }, [sessionId]);
  
  useEffect(() => {
    localStorage.setItem('isChatWidgetOpen', isChatWidgetOpen.toString());
  }, [isChatWidgetOpen]);

  const handleStartChat = async () => {
    // Save previous session if user has one and it has content
    if (sessionId && user) {
      try {
        const now = new Date();
        const timestamp = now.toLocaleString('da-DK', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const sessionTitle = uploadedFileNames.old && uploadedFileNames.new 
          ? `${uploadedFileNames.old.slice(0, 15)} vs ${uploadedFileNames.new.slice(0, 15)}`
          : `Chat ${timestamp}`;
        
        // Try to update existing session, or create if it doesn't exist
        try {
          await putWithAuth(`/api/chat/sessions/${sessionId}`, {
            title: sessionTitle
          });
          console.log('📝 Previous session updated:', sessionId, sessionTitle);
        } catch (putError) {
          // If session doesn't exist, create it
          if (putError.status === 404) {
            await postWithAuth('/api/chat/sessions', {
              sessionId: sessionId,
              title: sessionTitle
            });
            console.log('📝 Previous session created:', sessionId, sessionTitle);
          }
        }
      } catch (error) {
        console.error('Error saving previous session:', error);
      }
    }
    
    // Create new session
    const newSessionId = chatService.generateSessionId();
    console.log("🚀 Starting new chat with session ID:", newSessionId);
    
    // Create the new session in database if user is logged in
    if (user) {
      try {
        const now = new Date();
        const timestamp = now.toLocaleString('da-DK', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        await postWithAuth('/api/chat/sessions', {
          sessionId: newSessionId,
          title: `Chat ${timestamp}`
        });
        console.log('📝 New session created in database:', newSessionId);
      } catch (error) {
        console.error('Error creating new session:', error);
      }
    }
    
    // Clear localStorage for the new session to prevent stale data
    localStorage.removeItem(`filesUploaded_${newSessionId}`);
    localStorage.removeItem(`uploadedFileNames_${newSessionId}`);
    localStorage.removeItem(`chatMessages_${newSessionId}`);
    localStorage.removeItem(`tableSessionIds_${newSessionId}`);
    
    setSessionId(newSessionId);
    setFilesUploaded(false);
    setUploadedFileNames({ old: null, new: null });
    setTableSessionIds({ oldSessionId: null, newSessionId: null });
    localStorage.setItem("chatSessionId", newSessionId);
    
    if (user) {
      const userSessionKey = `chatSessionId_user_${user.id}`;
      localStorage.setItem(userSessionKey, newSessionId);
    }
    
    // Open the chat widget after creating session
    setTimeout(() => {
      const chatToggle = document.querySelector('[data-chat-toggle]');
      if (chatToggle) {
        chatToggle.click();
      }
    }, 100);
  };
  
  // Handle opening existing chats
  const handleGoToChats = () => {
    const chatToggle = document.querySelector('[data-chat-toggle]');
    if (chatToggle) {
      chatToggle.click();
    }
  };

  const handleFilesUploaded = (result) => {
    if (!result) return;
    
    console.log("📤 Files uploaded successfully:", result);
    if (result.oldFileName && result.newFileName) {
      const fileNames = { old: result.oldFileName, new: result.newFileName };
      setUploadedFileNames(fileNames);
      // Persist to localStorage
      if (sessionId) {
        localStorage.setItem(`filesUploaded_${sessionId}`, 'true');
        localStorage.setItem(`uploadedFileNames_${sessionId}`, JSON.stringify(fileNames));
      }
    }
    
    if (result.oldSessionId && result.newSessionId) {
      const tableIds = { oldSessionId: result.oldSessionId, newSessionId: result.newSessionId };
      setTableSessionIds(tableIds);
      console.log("🔑 Table Session IDs stored:", tableIds);
      if (sessionId) {
        localStorage.setItem(`tableSessionIds_${sessionId}`, JSON.stringify(tableIds));
      }
    }
    
    setFilesUploaded(true);
    setIsFileModalOpen(false);
    setIsChatWidgetOpen(true);
    // Note: Do NOT increment chatWidgetKey here - it causes ChatWidget to remount and lose state
  };

  // Function to update user state from localStorage
  const updateUserFromStorage = () => {
    const loggedInUser = localStorage.getItem("user");

    if (loggedInUser) {
      try {
        const userData = JSON.parse(loggedInUser);
        setUser(userData);
        console.log(
          "✅ User restored from localStorage:",
          userData.firstName,
          userData.lastName,
        );
      } catch (error) {
        console.error("Error parsing user data:", error);
        localStorage.removeItem("user");
        setUser(null);
      }
    } else {
      setUser(null);
      console.log("🔓 No user found in localStorage");
    }
  };

  // Handle user state changes (login/logout)
  const handleUserStateChange = () => {
    const loggedInUser = localStorage.getItem("user");

    if (loggedInUser) {
      try {
        const userData = JSON.parse(loggedInUser);
        setUser(userData);

        const userSessionKey = `chatSessionId_user_${userData.id}`;
        const userSession = localStorage.getItem(userSessionKey);

        if (userSession) {
          setSessionId(userSession);
          localStorage.setItem("chatSessionId", userSession);
          console.log(
            `🔑 Login detected - restored user session: ${userSession}`,
          );
          
          // Restore file state and tableSessionIds from localStorage
          const storedFilesUploaded = localStorage.getItem(`filesUploaded_${userSession}`);
          const storedFileNames = localStorage.getItem(`uploadedFileNames_${userSession}`);
          const storedTableSessionIds = localStorage.getItem(`tableSessionIds_${userSession}`);
          
          if (storedFilesUploaded === 'true') {
            setFilesUploaded(true);
            if (storedFileNames) {
              try {
                setUploadedFileNames(JSON.parse(storedFileNames));
              } catch (e) {
                console.error("Error parsing stored file names:", e);
              }
            }
          }
          
          if (storedTableSessionIds) {
            try {
              const tableIds = JSON.parse(storedTableSessionIds);
              setTableSessionIds(tableIds);
              console.log(`🔑 Login - restored table session IDs:`, tableIds);
            } catch (e) {
              console.error("Error parsing stored table session IDs:", e);
            }
          }
        } else {
          // Clear any existing session for fresh login
          setSessionId(null);
          setTableSessionIds({ oldSessionId: null, newSessionId: null });
          localStorage.removeItem("chatSessionId");
          console.log(`👤 Login detected - no previous session found`);
        }

        setChatWidgetKey((prev) => prev + 1);
      } catch (error) {
        console.error("Error handling login session:", error);
        setUser(null);
        setSessionId(null);
        localStorage.removeItem("chatSessionId");
      }
    } else {
      // User just logged out - save current session for user and clear immediately
      const previousUser = user;

      if (previousUser && sessionId) {
        // Save current session for the logged out user before clearing (only if not manually ended)
        const userSessionKey = `chatSessionId_user_${previousUser.id}`;
        const sessionEndedKey = `sessionEnded_user_${previousUser.id}`;
        const wasSessionEnded =
          localStorage.getItem(sessionEndedKey) === "true";

        if (!wasSessionEnded) {
          // Only save if session wasn't manually ended
          localStorage.setItem(userSessionKey, sessionId);
          console.log(
            `💾 Logout - saved user session: ${sessionId} for user ${previousUser.id}`,
          );
        } else {
          console.log(
            `🗑️ Logout - session was manually ended, not saving: ${sessionId}`,
          );
        }
      }

      // IMMEDIATELY clear current state and set guest mode
      setUser(null);
      setSessionId(null);
      setTableSessionIds({ oldSessionId: null, newSessionId: null });
      setFilesUploaded(false);
      setUploadedFileNames({ oldFile: null, newFile: null });
      localStorage.removeItem("chatSessionId");

      // Force ChatWidget to reset
      setChatWidgetKey((prev) => prev + 1);

      console.log(
        `🚪 Logout detected - cleared active session immediately, user now in guest mode`,
      );
    }
  };

  // Helper function to get current session file count
  const getSessionFileCount = () => {
    if (!sessionId) return 0;

    try {
      const storageKey = `savedFiles_${sessionId}`;
      const filesData = localStorage.getItem(storageKey);
      return filesData ? JSON.parse(filesData).length : 0;
    } catch (error) {
      console.error("Error getting session file count:", error);
      return 0;
    }
  };

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const loggedInUser = localStorage.getItem("user");
        if (loggedInUser) {
          try {
            const userData = JSON.parse(loggedInUser);
            setUser(userData);
            console.log(
              "✅ User restored from localStorage:",
              userData.firstName,
            );

            // Restore user-specific session if exists and wasn't manually ended
            const userSessionKey = `chatSessionId_user_${userData.id}`;
            const sessionEndedKey = `sessionEnded_user_${userData.id}`;
            const userSession = localStorage.getItem(userSessionKey);
            const wasSessionEnded =
              localStorage.getItem(sessionEndedKey) === "true";

            if (userSession && !wasSessionEnded) {
              setSessionId(userSession);
              localStorage.setItem("chatSessionId", userSession);
              // Restore file state from localStorage
              const storedFilesUploaded = localStorage.getItem(`filesUploaded_${userSession}`);
              const storedFileNames = localStorage.getItem(`uploadedFileNames_${userSession}`);
              const storedTableSessionIds = localStorage.getItem(`tableSessionIds_${userSession}`);
              if (storedFilesUploaded === 'true') {
                setFilesUploaded(true);
                if (storedFileNames) {
                  try {
                    setUploadedFileNames(JSON.parse(storedFileNames));
                  } catch (e) {
                    console.error("Error parsing stored file names:", e);
                  }
                }
                if (storedTableSessionIds) {
                  try {
                    setTableSessionIds(JSON.parse(storedTableSessionIds));
                    console.log(`🔑 App init - restored table session IDs for session: ${userSession}`);
                  } catch (e) {
                    console.error("Error parsing stored table session IDs:", e);
                  }
                }
                console.log(`📁 App init - restored file state for session: ${userSession}`);
              }
              console.log(
                `🔑 App init - restored user session: ${userSession}`,
              );
            } else {
              // Check if there's a current session from previous activity
              updateUserFromStorage(); // Simplified for clarity

              const currentSession = localStorage.getItem("chatSessionId");
              if (
                currentSession &&
                currentSession.includes(`user_${userData.id}_`) &&
                !wasSessionEnded
              ) {
                // Current session belongs to this user and wasn't ended, keep it
                setSessionId(currentSession);
                localStorage.setItem(userSessionKey, currentSession);
                // Restore file state from localStorage for this session
                const storedFilesUploaded = localStorage.getItem(`filesUploaded_${currentSession}`);
                const storedFileNames = localStorage.getItem(`uploadedFileNames_${currentSession}`);
                const storedTableSessionIds = localStorage.getItem(`tableSessionIds_${currentSession}`);
                if (storedFilesUploaded === 'true') {
                  setFilesUploaded(true);
                  if (storedFileNames) {
                    try {
                      setUploadedFileNames(JSON.parse(storedFileNames));
                    } catch (e) {
                      console.error("Error parsing stored file names:", e);
                    }
                  }
                  if (storedTableSessionIds) {
                    try {
                      setTableSessionIds(JSON.parse(storedTableSessionIds));
                      console.log(`🔑 App init - restored table session IDs for session: ${currentSession}`);
                    } catch (e) {
                      console.error("Error parsing stored table session IDs:", e);
                    }
                  }
                  console.log(`📁 App init - restored file state for session: ${currentSession}`);
                }
                console.log(
                  `🔄 App init - kept existing user session: ${currentSession}`,
                );
              } else {
                // No valid session for this user or session was manually ended
                setSessionId(null);
                localStorage.removeItem("chatSessionId");
                if (wasSessionEnded) {
                  console.log(
                    "👤 User found but previous session was manually ended",
                  );
                } else {
                  console.log("👤 User found but no saved session");
                }
              }
            }
          } catch (parseError) {
            console.error("Error parsing stored user data:", parseError);
            localStorage.removeItem("user");
            localStorage.removeItem("chatSessionId");
            setUser(null);
            setSessionId(null);
            console.log("🗑️ Cleared invalid authentication data");
          }
        } else {
          // No user data, ensure clean state
          setUser(null);
          setSessionId(null);
          localStorage.removeItem("chatSessionId");
          console.log("🔓 No user authentication found");
        }
      } catch (error) {
        console.error("App initialization error:", error);
        // Fallback to clear state
        setUser(null);
        setSessionId(null);
        localStorage.removeItem("chatSessionId");
        console.log("🔓 Error in app initialization");
      } finally {
        setIsLoaded(true);
      }
    };

    initializeSession();

    // Listen for auth changes from other components
    const handleAuthChange = () => {
      handleUserStateChange();
    };

    window.addEventListener("authChange", handleAuthChange);

    return () => {
      window.removeEventListener("authChange", handleAuthChange);
    };
  }, []);


  const handleStartSession = () => {
    let newSessionId;

    if (user) {
      // Check if user already has a saved session AND it wasn't manually ended
      const userSessionKey = `chatSessionId_user_${user.id}`;
      const sessionEndedKey = `sessionEnded_user_${user.id}`;
      const existingUserSession = localStorage.getItem(userSessionKey);
      const wasSessionEnded = localStorage.getItem(sessionEndedKey) === "true";

      if (existingUserSession && !wasSessionEnded) {
        // Restore existing session only if it wasn't manually ended
        newSessionId = existingUserSession;
        localStorage.setItem("chatSessionId", newSessionId);
        console.log(`🔄 Restored existing user session: ${newSessionId}`);
      } else {
        // Create new session for user (either no session exists or previous was manually ended)
        newSessionId = `user_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(userSessionKey, newSessionId);
        localStorage.setItem("chatSessionId", newSessionId);
        // Clear the session ended flag since we're creating a new session
        localStorage.removeItem(sessionEndedKey);
        console.log(`👤 Created new user session: ${newSessionId}`);
      }
    } else {
      // Guest user - always create new session
      newSessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      localStorage.setItem("chatSessionId", newSessionId);
      console.log(`🔓 Created guest session: ${newSessionId}`);
    }

    setSessionId(newSessionId);
    setChatWidgetKey((prev) => prev + 1);
    setIsChatWidgetOpen(true); // Open ChatWidget when starting session
  };

  const handleEndSession = () => {
    if (sessionId) {
      setIsChatWidgetOpen(false);
      setShowEndSessionModal(true);
    }
  };

  const confirmEndSession = async () => {
    if (!sessionId) {
      setShowEndSessionModal(false);
      return;
    }

    setIsEndingSession(true);

    if (user && sessionId) {
      const userSessionKey = `chatSessionId_user_${user.id}`;
      const sessionEndedKey = `sessionEnded_user_${user.id}`;

      localStorage.removeItem(userSessionKey);
      localStorage.removeItem(sessionEndedKey);

      const savedFilesKey = `savedFiles_${sessionId}`;
      localStorage.removeItem(savedFilesKey);

      const chatStorageKey = `chatMessages_${sessionId}`;
      localStorage.removeItem(chatStorageKey);
      
      // Clear file upload state
      localStorage.removeItem(`filesUploaded_${sessionId}`);
      localStorage.removeItem(`uploadedFileNames_${sessionId}`);
      localStorage.removeItem(`tableSessionIds_${sessionId}`);

      console.log(
        `🗑️ Cleared all session data for user ${user.id}, session: ${sessionId}`,
      );
    } else if (sessionId) {
      const savedFilesKey = `savedFiles_${sessionId}`;
      localStorage.removeItem(savedFilesKey);

      const chatStorageKey = `chatMessages_${sessionId}`;
      localStorage.removeItem(chatStorageKey);
      
      // Clear file upload state
      localStorage.removeItem(`filesUploaded_${sessionId}`);
      localStorage.removeItem(`uploadedFileNames_${sessionId}`);
      localStorage.removeItem(`tableSessionIds_${sessionId}`);

      console.log(`🔓 Guest session ended: ${sessionId}`);
    }

    localStorage.removeItem("chatSessionId");

    setSessionId(null);
    setUploadedFileNames({ old: null, new: null });
    setTableSessionIds({ oldSessionId: null, newSessionId: null });
    setFilesUploaded(false);
    setIsChatWidgetOpen(false);
    setChatWidgetKey((prev) => prev + 1);
    setIsEndingSession(false);
    setShowEndSessionModal(false);
    setHasAutoOpenedModal(false);
    console.log("🔚 Session ended successfully - fully reset");
  };

  const handleSessionChange = (newSessionId, newTableIds) => {
    if (newSessionId === null) {
      setSessionId(null);
      setTableSessionIds({ oldSessionId: null, newSessionId: null });
      setFilesUploaded(false);
      setUploadedFileNames({ old: null, new: null });
      console.log("🔄 Session cleared for new chat");
    } else {
      setSessionId(newSessionId);
      if (newTableIds) {
        setTableSessionIds(newTableIds);
      }
      setFilesUploaded(true);
      // IMPORTANT: Keep chat widget open during session switching
      setIsChatWidgetOpen(true);
      console.log("🔄 Session changed to:", newSessionId);
    }
  };

  // Expose handleEndSession globally for child components
  useEffect(() => {
    window.handleEndSession = handleEndSession;
    return () => {
      delete window.handleEndSession;
    };
  }, [handleEndSession]);

  const handleFileUploadSuccess = (result) => {
    // Prevent duplicate calls with same result
    if (result._processed) {
      console.log("⚠️ Upload result already processed, skipping");
      return;
    }
    result._processed = true;

    console.log("📁 File upload success from main page:", result);
    // ✅ YE CHECK ADD KARO - Modal se upload ko skip karo
    if (result.isSecondFile || result.source === "modal-upload") {
      console.log("🚫 Skipping save - file already saved in modal");
      // Only set pending result for chat, don't save file again
      const uploadId = Date.now();
      result.timestamp = uploadId;
      result.uploadSource = "modal";
      setPendingUploadResult({ ...result });
      return; // ⚠️ RETURN karke baqi code skip karo
    }
    // Create unique identifiers to prevent duplicates
    const uploadId = Date.now();
    const sessionKey = `upload-${uploadId}`;

    // Add unique markers to result
    result.timestamp = uploadId;
    result.uploadSource = "main-page";
    result.sessionKey = sessionKey;

    // Set pending upload result for ChatWidget (only once)
    if (!pendingUploadResult || pendingUploadResult.timestamp !== uploadId) {
      setPendingUploadResult({ ...result });
    }

    // Save file(s) to SavedFilesSection with strict duplicate prevention
    if (window.saveFileToSession && result.success) {
      const timestamp = new Date().toISOString();
      const batchId = `main-${uploadId}-${Math.floor(Math.random() * 100000)}`;

      // Single delayed save operation to prevent duplicates
      setTimeout(() => {
        if (result.fileCount > 1 && result.fileNames) {
          // Multiple files
          result.fileNames.forEach((fileName, index) => {
            const fileData = {
              name: fileName,
              uploadedAt: timestamp,
              fileCount: 1,
              fileNames: [fileName],
              size: result.fileSize
                ? Array.isArray(result.fileSize)
                  ? result.fileSize[index]
                  : result.fileSize
                : null,
              source: "main-page",
              uniqueId: `${batchId}-file-${index}`,
              uploadBatch: batchId,
              timestamp: uploadId,
              uploadTimestamp: uploadId,
              sessionKey: sessionKey,
              _originalBatch: uploadId,
              _preventDuplicates: true,
            };

            console.log(
              "💾 Saving individual file from main page:",
              fileName,
              "uniqueId:",
              fileData.uniqueId,
            );
            window.saveFileToSession(fileData);
          });
        } else {
          // Single file
          const fileData = {
            name: result.fileName || result.fileNames?.[0] || "Unknown file",
            uploadedAt: timestamp,
            fileCount: 1,
            fileNames: result.fileNames || [result.fileName],
            size: result.fileSize,
            source: "main-page",
            uniqueId: `${batchId}-single`,
            uploadBatch: batchId,
            timestamp: uploadId,
            uploadTimestamp: uploadId,
            sessionKey: sessionKey,
            _originalBatch: uploadId,
            _preventDuplicates: true,
          };

          console.log(
            "💾 Saving single file from main page:",
            fileData.name,
            "uniqueId:",
            fileData.uniqueId,
          );
          window.saveFileToSession(fileData);
        }
      }, 300); // Single delay
    }
  };

  // Home Page Component
  const HomePage = () => {
    const { t } = useTranslation();
    return (
    <div
      className="min-h-screen pt-20"
      style={{
        background: "#ffffff",
      }}
    >
      <FloatingElements />

      <div className="relative z-10 w-full px-6 py-8">
        {/* Header Section */}
        <div
          className={`text-center mb-10 transform transition-all duration-1200 ${
            isLoaded ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0"
          }`}
        >
          <div className="relative inline-block"></div>
          {/* Main Title - Nova Insights */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl tracking-tight"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              lineHeight: "1.1",
            }}
          >
            <span className="inline-block" style={{ color: "#00d6d6" }}>
              NOVA
            </span>
            <span className="ml-3" style={{ color: "#1c2631" }}>
              INSIGHT
            </span>
          </h1>

          {/* Tagline */}
          <p
            className="text-base md:text-lg mt-4 font-medium tracking-widest uppercase"
            style={{
              color: "#64748b",
              letterSpacing: "0.1em",
            }}
          >
            Understand Every Change
          </p>

          {/* Azure Badge - Just Image */}
          <div className="flex items-center  justify-center mt-6">
            <img
              src="/azure-badge.jpg"
              alt="Microsoft Azure"
              className="h-8 object-contain border  border-gray-200 px-4 pb-1 rounded-full"
            />
          </div>
        </div>

        {/* <p
          className="text-base md:text-lg mt-6 max-w-2xl mx-auto leading-relaxed"
          style={{ color: "#475569" }}
        >
          Din intelligente assistent til fil- og dokumentsammenligning
        </p> */}

        {/* System Status Header */}
        <div
          className="relative mb-6 p-4 w-full max-w-6xl mx-auto rounded-xl shadow-sm border border-gray-200"
          style={{
            background: "#d0f4f4",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{
                  background: "#22c55e",
                }}
              ></div>
              <span className="text-gray-900 text-sm font-semibold">
                {t('home.systemOnline')}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-gray-700">
              <svg
                className="w-3.5 h-3.5 animate-spin-slow"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-sm">{t('home.autoScheduleAnalysis')}</span>
            </div>
          </div>
        </div>

        {/* Start Chat Button */}
        <div
          className={`transform transition-all duration-1200 delay-300 w-full max-w-6xl mx-auto mb-8 ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          <div
            className="relative p-6 rounded-2xl shadow-md border border-gray-200 transition-all duration-300"
            style={{ background: "#b8efef" }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "#00D6D6" }}
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full relative z-10"></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {t('home.readyToCompare')}
                  </h3>
                  <p className="text-gray-600 text-xs">
                    {t('home.clickStartChatToBegin')}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                {user?.role === 'read_only_user' ? (
                  <button
                    disabled
                    className="px-6 py-3 rounded-xl font-bold text-white opacity-50 cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, #00D6D6, #00b8b8)",
                      boxShadow: "0 8px 25px rgba(0, 214, 214, 0.3)",
                    }}
                    title={t('home.readOnlyNoAccess')}
                  >
                    {t('home.startChat')}
                  </button>
                ) : (
                  <Link
                    to="/chat"
                    className="px-6 py-3 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105"
                    style={{
                      background: "linear-gradient(135deg, #00D6D6, #00b8b8)",
                      boxShadow: "0 8px 25px rgba(0, 214, 214, 0.3)",
                    }}
                  >
                    {t('home.startChat')}
                  </Link>
                )}
                <Link
                  to="/chat"
                  className="px-6 py-3 rounded-xl font-bold text-[#00D6D6] border-2 border-[#00D6D6] transition-all duration-300 transform hover:scale-105 hover:bg-[#00D6D6]/10"
                  style={{
                    background: "transparent",
                  }}
                >
                  {t('home.goToChats')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Section */}
        <div
          className={`w-full max-w-6xl mx-auto transform transition-all duration-1200 delay-400 ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          {/* Main Title Card */}
          <div
            className="relative mb-6 p-6 rounded-2xl shadow-xl border border-[#00D6D6]/30 text-center"
            style={{
              background: "#d0f4f4",
            }}
          >
            <div className="flex items-center justify-center mb-3">
              <span className="text-2xl mr-2 animate-bounce">📄</span>
              <h2
                className="text-xl md:text-2xl font-bold text-[#1c2631]  bg-clip-text"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
                }}
              >
                {t('home.compareInstantly')}
              </h2>
            </div>
            <p className="text-slate-600 text-base max-w-full mx-auto">
              {t('home.aiAssistant')}
            </p>
          </div>

          {/* Security & Compliance Section */}
          <div className="mb-16">
            {/* Section Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D6D6] to-cyan-600 mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1c2631] mb-2">
                {t('home.security.title')}
              </h2>
              <p className="text-2xl md:text-3xl font-bold text-[#00D6D6] mb-4">
                {t('home.security.titleHighlight')}
              </p>
              <p className="text-slate-600 text-lg max-w-3xl mx-auto">
                {t('home.security.subtitle')}
              </p>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              {/* Security Features Card */}
              <div
                className="relative p-8 rounded-2xl border border-[#00D6D6]/30 shadow-lg"
                style={{
                  background: "linear-gradient(145deg, #eafafa 0%, #d0f4f4 100%)",
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00D6D6]/20 to-cyan-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-[#1c2631]">{t('home.security.securityTitle')}</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    t('home.security.feature1'),
                    t('home.security.feature2'),
                    t('home.security.feature3'),
                    t('home.security.feature4'),
                    t('home.security.feature5'),
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00D6D6]/20 flex items-center justify-center mt-0.5">
                        <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Azure Card */}
              <div
                className="relative p-8 rounded-2xl border border-[#00D6D6]/30 shadow-lg flex flex-col"
                style={{
                  background: "linear-gradient(145deg, #eafafa 0%, #d0f4f4 100%)",
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-slate-700 uppercase tracking-wider mb-4">
                    {t('home.security.poweredBy')}
                  </div>
                  <div className="mb-6 flex justify-center">
                    <div className="bg-white rounded-full px-6 py-3 shadow-md inline-flex items-center justify-center">
                      <img
                        src="/azure-badge.jpg"
                        alt="Microsoft Azure"
                        className="h-10 object-contain"
                      />
                    </div>
                  </div>
                  <p className="text-slate-800 leading-relaxed mb-6">
                    {t('home.security.azureDescription')}
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-300">
                  <p className="text-sm text-slate-700 italic font-medium">
                    {t('home.security.azureTagline')}
                  </p>
                </div>
              </div>
            </div>

            {/* Compliance Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: (
                    <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: t('home.security.compliance.uptime'),
                  description: t('home.security.compliance.uptimeDesc'),
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ),
                  title: t('home.security.compliance.speed'),
                  description: t('home.security.compliance.speedDesc'),
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ),
                  title: t('home.security.compliance.standards'),
                  description: t('home.security.compliance.standardsDesc'),
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  ),
                  title: t('home.security.compliance.scalability'),
                  description: t('home.security.compliance.scalabilityDesc'),
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ),
                  title: t('home.security.compliance.encryption'),
                  description: t('home.security.compliance.encryptionDesc'),
                },
                {
                  icon: (
                    <svg className="w-6 h-6 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  ),
                  title: t('home.security.compliance.enterprise'),
                  description: t('home.security.compliance.enterpriseDesc'),
                },
              ].map((card, index) => (
                <div
                  key={index}
                  className="relative p-6 rounded-xl border border-[#00D6D6]/20 transition-all duration-300 hover:shadow-lg hover:border-[#00D6D6]/40"
                  style={{
                    background: "#d0f4f4",
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00D6D6]/10 flex items-center justify-center">
                      {card.icon}
                    </div>
                    <h4 className="font-bold text-[#1c2631]">{card.title}</h4>
                  </div>
                  <p className="text-slate-700 text-sm">{card.description}</p>
                </div>
              ))}
            </div>

            {/* Bottom Trust Banner */}
            <div className="mt-12 text-center">
              <div
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-[#00D6D6]/30"
                style={{ background: "#b8efef" }}
              >
                <div className="w-3 h-3 rounded-full bg-[#00D6D6] animate-pulse"></div>
                <span className="text-slate-700 font-medium">{t('home.security.trustBanner')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes text-shimmer {
            0%,
            100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }

          @keyframes fade-in-up {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fade-in {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes float-1 {
            0%,
            100% {
              transform: translateY(0px) translateX(0px) rotate(0deg);
            }
            25% {
              transform: translateY(-10px) translateX(5px) rotate(90deg);
            }
            50% {
              transform: translateY(-5px) translateX(-5px) rotate(180deg);
            }
            75% {
              transform: translateY(-15px) translateX(3px) rotate(270deg);
            }
          }

          @keyframes float-2 {
            0%,
            100% {
              transform: translateY(0px) translateX(0px) rotate(0deg);
            }
            33% {
              transform: translateY(-8px) translateX(-4px) rotate(120deg);
            }
            66% {
              transform: translateY(-12px) translateX(6px) rotate(240deg);
            }
          }

          @keyframes float-3 {
            0%,
            100% {
              transform: translateY(0px) translateX(0px) rotate(0deg);
            }
            20% {
              transform: translateY(-6px) translateX(8px) rotate(72deg);
            }
            40% {
              transform: translateY(-14px) translateX(-3px) rotate(144deg);
            }
            60% {
              transform: translateY(-8px) translateX(5px) rotate(216deg);
            }
            80% {
              transform: translateY(-18px) translateX(-6px) rotate(288deg);
            }
          }

          @keyframes float-reverse {
            0%,
            100% {
              transform: translateY(0px) rotate(0deg);
            }
            50% {
              transform: translateY(15px) rotate(-180deg);
            }
          }

          @keyframes spin-slow {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          .animate-text-shimmer {
            animation: text-shimmer 3s ease-in-out infinite;
          }


          .animate-float-1 {
            animation: float-1 4s ease-in-out infinite;
          }
          .animate-float-2 {
            animation: float-2 3.5s ease-in-out infinite;
          }
          .animate-float-3 {
            animation: float-3 5s ease-in-out infinite;
          }
          .animate-float-reverse {
            animation: float-reverse 4s ease-in-out infinite;
          }
          .animate-spin-slow {
            animation: spin-slow 8s linear infinite;
          }

          button {
              cursor: pointer;
          }
        `}</style>

      {/* Floating Chat Button - Redirects to /chat page */}
      <Link
        to="/chat"
        className="fixed bottom-6 right-6 z-50 group"
        title={t('home.startChat')}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transform transition-all duration-300 hover:scale-110 hover:shadow-xl"
          style={{
            background: "linear-gradient(135deg, #00D6D6 0%, #00B4B4 100%)",
          }}
        >
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap">
            {t('home.startChat')}
          </div>
        </div>
        {/* Pulse animation ring */}
        <div
          className="absolute inset-0 w-16 h-16 rounded-full animate-ping opacity-30"
          style={{ background: "#00D6D6" }}
        />
      </Link>
    </div>
  );
  };

  return (
    <Router>
      <div className="App">
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Protected Routes - Only accessible when logged in */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div className="min-h-screen flex flex-col">
                  <Navbar user={user} setUser={setUser} />
                  <div className="flex-1">
                    <HomePage />
                  </div>
                  <Footer />
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <div className="min-h-screen flex flex-col">
                  <Navbar user={user} setUser={setUser} />
                  <div className="flex-1">
                    <UpdateProfile />
                  </div>
                  <Footer />
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <div className="min-h-screen flex flex-col">
                  <Navbar user={user} setUser={setUser} />
                  <div className="flex-1">
                    <Support />
                  </div>
                  <Footer />
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <div className="h-screen flex flex-col overflow-hidden">
                  <Navbar user={user} setUser={setUser} />
                  <div className="flex-1 overflow-hidden pt-20">
                    <ChatWidget
                      key={chatWidgetKey}
                      sessionId={sessionId}
                      user={user}
                      getSessionFileCount={getSessionFileCount}
                      onEndSession={handleEndSession}
                      pendingUploadResult={pendingUploadResult}
                      onUploadResultProcessed={() => setPendingUploadResult(null)}
                      shouldAutoOpen={true}
                      tableSessionIds={tableSessionIds}
                      onFilesUploaded={handleFilesUploaded}
                      onSessionChange={handleSessionChange}
                      isFullPage={true}
                    />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule-analysis"
            element={
              <ProtectedRoute>
                <div className="h-screen flex flex-col overflow-hidden">
                  <Navbar user={user} setUser={setUser} />
                  <div className="flex-1 overflow-hidden pt-20">
                    <ScheduleAnalysis user={user} />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          {/* Admin Route - Protected and only accessible to admin users */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div className="min-h-screen flex flex-col">
                  <Navbar user={user} setUser={setUser} />
                  <div className="flex-1">
                    <AdminPortal />
                  </div>
                  <Footer />
                </div>
              </AdminRoute>
            }
          />

          {/* Public Route - Only Login is accessible to guests */}
          <Route path="/login" element={<Login setUser={setUser} />} />

          {/* Protected Routes - Only accessible when logged in */}
          <Route
            path="/signup"
            element={
              <ProtectedRoute>
                <Signup setUser={setUser} />
              </ProtectedRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/security-gdpr" element={<SecurityGDPR user={user} setUser={setUser} />} />
          <Route path="/contact" element={<ContactPage user={user} setUser={setUser} />} />
          <Route path="/about" element={<AboutPage user={user} setUser={setUser} />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage user={user} setUser={setUser} />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage user={user} setUser={setUser} />} />
          
          {/* Company Registration - Public Route */}
          <Route path="/company-signup" element={<CompanySignup setUser={setUser} />} />
          
          {/* Company Portal - Only accessible to company owners */}
          <Route
            path="/company-portal"
            element={
              <CompanyOwnerRoute>
                <div className="min-h-screen flex flex-col">
                  <Navbar user={user} setUser={setUser} />
                  <div className="flex-1">
                    <CompanyPortal />
                  </div>
                  <Footer />
                </div>
              </CompanyOwnerRoute>
            }
          />
          
          {/* Super Admin Portal - Only accessible to super admins */}
          <Route
            path="/super-admin"
            element={
              <SuperAdminRoute>
                <div className="min-h-screen flex flex-col">
                  <Navbar user={user} setUser={setUser} />
                  <div className="flex-1">
                    <SuperAdminPortal />
                  </div>
                  <Footer />
                </div>
              </SuperAdminRoute>
            }
          />
          
          {/* 404 Not Found - Catch all unmatched routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
