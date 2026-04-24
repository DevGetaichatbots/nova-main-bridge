import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

const Navbar = ({ setUser: setAppUser }) => {
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Handle body overflow when logout dialog is open
  useEffect(() => {
    if (showLogoutDialog) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
    };
  }, [showLogoutDialog]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest(".user-menu-container")) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserMenu]);

  useEffect(() => {
    // Check for logged in user on component mount and location change
    const checkUserAuth = async () => {
      const userData = localStorage.getItem("user");

      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          console.log(
            "👤 Navbar: User authenticated:",
            parsedUser.firstName,
          );
        } catch (error) {
          console.error("Error parsing stored user data:", error);
          localStorage.removeItem("user");
          localStorage.removeItem("chatSessionId");
          setUser(null);
          window.dispatchEvent(new Event("authChange"));
        }
      } else {
        setUser(null);
      }
    };

    // Check on mount
    checkUserAuth();

    // Listen for custom auth events
    const handleAuthChange = () => {
      checkUserAuth();
    };

    window.addEventListener("authChange", handleAuthChange);

    // Also listen for page visibility changes to re-check auth
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkUserAuth();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("authChange", handleAuthChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [location.pathname]); // Re-run when route changes

  const handleLogout = async () => {
    try {
      const { getApiBaseUrl } = await import("../utils/apiConfig.js");
      const apiUrl = getApiBaseUrl();

      await fetch(`${apiUrl}/api/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");

      // Clear current active session (user-specific sessions are preserved automatically)
      localStorage.removeItem("chatSessionId");

      // Clear any chat-opened flags and chat messages
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("chatOpened_") || key.startsWith("chatMessages_")) {
          localStorage.removeItem(key);
        }
      });

      console.log("🗑️ Chat messages cleared on logout");

      // Reset component state IMMEDIATELY
      setUser(null);
      setShowUserMenu(false);

      // Update app state immediately
      if (setAppUser) {
        setAppUser(null);
      }

      // Dispatch custom event to notify other components IMMEDIATELY
      window.dispatchEvent(new Event("authChange"));

      console.log(
        "🚪 User logged out - session cleared immediately, switching to guest mode",
      );

      // Navigate immediately without delay
      navigate("/");
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const getDisplayName = (user) => {
    if (user.role === 'company_owner' || user.role === 'super_admin') {
      return user.companyName || user.displayName || user.email?.split('@')[0] || '';
    }
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email?.split('@')[0] || '';
  };

  const isCompanyOwner = user?.role === 'company_owner';
  const isSuperAdmin = user?.role === 'super_admin';

  const isActive = (path) => location.pathname === path;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled ? "shadow-md border-b border-gray-200" : ""
      }`}
      style={{
        background: "#ffffff",
      }}
    >
      <div className="w-full mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo Section - Logo Only */}
          <Link to="/" className="group flex items-center">
            <div className="relative transition-all duration-300 group-hover:scale-105">
              <img
                src="/NordicLogo2.png"
                alt="Nordic AI Group Logo"
                className="h-12 w-auto object-contain"
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            {/* Home Link */}
            <Link
              to="/"
              className={`px-4 py-2 text-base font-medium transition-all duration-300 flex items-center gap-2 ${
                isActive("/")
                  ? "text-[#00D6D6]"
                  : "text-gray-700 hover:text-[#00D6D6]"
              }`}
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              {t('navbar.home')}
            </Link>

            {/* Chat Link - Only visible to logged in users - Navigates to chat page */}
            {user && (
              <Link
                to="/chat"
                onMouseEnter={() => import("./ChatWidget")}
                className={`px-4 py-2 text-base font-medium transition-all duration-300 flex items-center gap-2 ${
                  isActive("/chat")
                    ? "text-[#00D6D6]"
                    : "text-gray-700 hover:text-[#00D6D6]"
                }`}
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {t('navbar.chat')}
              </Link>
            )}

            {/* Schedule Analysis Link - Only visible to logged in users */}
            {user && (
              <Link
                to="/schedule-analysis"
                onMouseEnter={() => import("./ScheduleAnalysis")}
                className={`px-4 py-2 text-base font-medium transition-all duration-300 flex items-center gap-2 ${
                  isActive("/schedule-analysis")
                    ? "text-[#00D6D6]"
                    : "text-gray-700 hover:text-[#00D6D6]"
                }`}
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
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {t('navbar.scheduleAnalysis')}
              </Link>
            )}

            {/* Admin Portal Link - Only visible to admin users */}
            {user && user.role === "admin" && (
              <Link
                to="/admin"
                className={`px-4 py-2 text-base font-medium transition-all duration-300 flex items-center gap-2 ${
                  isActive("/admin")
                    ? "text-[#00D6D6]"
                    : "text-gray-700 hover:text-[#00D6D6]"
                }`}
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                {t('navbar.admin')}
              </Link>
            )}

            {/* Company Portal Link - Visible to company owners and super admins */}
            {user && (user.role === "company_owner" || user.role === "super_admin") && (
              <Link
                to="/company-portal"
                className={`px-4 py-2 text-base font-medium transition-all duration-300 flex items-center gap-2 ${
                  isActive("/company-portal")
                    ? "text-[#00D6D6]"
                    : "text-gray-700 hover:text-[#00D6D6]"
                }`}
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                {t('navbar.companyPortal')}
              </Link>
            )}

            {/* Super Admin Portal Link - Only visible to super admins */}
            {user && user.role === "super_admin" && (
              <Link
                to="/super-admin"
                className={`px-4 py-2 text-base font-medium transition-all duration-300 flex items-center gap-2 ${
                  isActive("/super-admin")
                    ? "text-[#00D6D6]"
                    : "text-gray-700 hover:text-[#00D6D6]"
                }`}
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
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                {t('navbar.superAdmin')}
              </Link>
            )}

            {/* Support Link - At the end with headset icon */}
            <Link
              to="/support"
              className={`px-4 py-2 text-base font-medium transition-all duration-300 flex items-center gap-2 ${
                isActive("/support")
                  ? "text-[#00D6D6]"
                  : "text-gray-700 hover:text-[#00D6D6]"
              }`}
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
                  d="M12 18h.01M8 21h8a2 2 0 002-2v-2H6v2a2 2 0 002 2zM12 2C6.48 2 2 5.58 2 10v2c0 1.1.9 2 2 2h1v-4c0-3.31 3.13-6 7-6s7 2.69 7 6v4h1c1.1 0 2-.9 2-2v-2c0-4.42-4.48-8-10-8zM6 14h-.5a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5H6v4zm12 0h.5a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5H18v4z"
                />
              </svg>
              {t('navbar.support')}
            </Link>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {user ? (
              /* User Profile Dropdown */
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="group flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-all duration-300 border border-[#00D6D6] hover:border-[#00D6D6]/80"
                  style={{
                    background: "#e0f7f7",
                  }}
                >
                  {/* User Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{
                      background: "#00D6D6",
                    }}
                  >
                    {isSuperAdmin ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    ) : isCompanyOwner ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    ) : (
                      getInitials(user.firstName, user.lastName)
                    )}
                  </div>
                  <span className="text-sm text-gray-900 max-w-32 truncate">
                    {getDisplayName(user)}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      showUserMenu ? "rotate-180" : ""
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

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg border border-gray-200 z-50"
                    style={{
                      background: "#ffffff",
                    }}
                  >
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{
                            background: "#00D6D6",
                          }}
                        >
                          {isCompanyOwner ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          ) : (
                            getInitials(user.firstName, user.lastName)
                          )}
                        </div>
                        <div>
                          <p className="text-gray-900 font-semibold">
                            {getDisplayName(user)}
                          </p>
                          <p className="text-gray-500 w-40 truncate text-sm">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate("/profile");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:text-[#00D6D6] hover:bg-gray-50 transition-all duration-200"
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
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        {t('navbar.profile')}
                      </button>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowLogoutDialog(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
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
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        {t('navbar.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Login Button */}
                <Link
                  to="/login"
                  className="px-6 py-2 rounded-lg text-base font-medium transition-all duration-300 border border-gray-200 hover:border-gray-300"
                  style={{
                    background: "#ffffff",
                    color: "#1c2631",
                  }}
                >
                  {t('navbar.login')}
                </Link>

                {/* Signup Button */}
                <Link
                  to="/signup"
                  className="px-6 py-2 rounded-lg text-base font-medium transition-all duration-300 text-white hover:opacity-90"
                  style={{
                    background: "#00D6D6",
                  }}
                >
                  {t('navbar.signup')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden group p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-300"
            style={{ background: "#ffffff" }}
          >
            <div className="w-6 h-6 relative">
              <span
                className={`absolute top-1 left-0 w-6 h-0.5 bg-gray-900 transition-all duration-300 ${
                  isMobileMenuOpen ? "rotate-45 top-3" : ""
                }`}
              ></span>
              <span
                className={`absolute top-3 left-0 w-6 h-0.5 bg-gray-900 transition-all duration-300 ${
                  isMobileMenuOpen ? "opacity-0" : ""
                }`}
              ></span>
              <span
                className={`absolute top-5 left-0 w-6 h-0.5 bg-gray-900 transition-all duration-300 ${
                  isMobileMenuOpen ? "-rotate-45 top-3" : ""
                }`}
              ></span>
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-500 overflow-hidden ${
            isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="py-6 space-y-4">
            {/* Home Link - Mobile */}
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-all duration-300"
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              {t('navbar.home')}
            </Link>

            {/* Chat Link - Mobile - Only visible to logged in users - Navigates to chat page */}
            {user && (
              <Link
                to="/chat"
                onClick={() => setIsMobileMenuOpen(false)}
                onMouseEnter={() => import("./ChatWidget")}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-all duration-300"
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {t('navbar.chat')}
              </Link>
            )}

            {/* Schedule Analysis Link - Mobile - Only visible to logged in users */}
            {user && (
              <Link
                to="/schedule-analysis"
                onClick={() => setIsMobileMenuOpen(false)}
                onMouseEnter={() => import("./ScheduleAnalysis")}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-all duration-300"
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
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {t('navbar.scheduleAnalysis')}
              </Link>
            )}

            {/* Admin Portal Link - Mobile - Only visible to admin users */}
            {user && user.role === "admin" && (
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-all duration-300"
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                {t('navbar.admin')}
              </Link>
            )}

            {/* Company Portal Link - Mobile - Visible to company owners and super admins */}
            {user && (user.role === "company_owner" || user.role === "super_admin") && (
              <Link
                to="/company-portal"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-all duration-300"
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                {t('navbar.companyPortal')}
              </Link>
            )}

            {/* Super Admin Portal Link - Mobile - Only visible to super admins */}
            {user && user.role === "super_admin" && (
              <Link
                to="/super-admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-all duration-300"
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
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                {t('navbar.superAdmin')}
              </Link>
            )}

            {/* Support Link - Mobile - At the end with headset icon */}
            <Link
              to="/support"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition-all duration-300"
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
                  d="M12 18h.01M8 21h8a2 2 0 002-2v-2H6v2a2 2 0 002 2zM12 2C6.48 2 2 5.58 2 10v2c0 1.1.9 2 2 2h1v-4c0-3.31 3.13-6 7-6s7 2.69 7 6v4h1c1.1 0 2-.9 2-2v-2c0-4.42-4.48-8-10-8zM6 14h-.5a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5H6v4zm12 0h.5a.5.5 0 00.5-.5v-3a.5.5 0 00-.5-.5H18v4z"
                />
              </svg>
              {t('navbar.support')}
            </Link>

            {/* Language Switcher - Mobile */}
            <div className="px-6 py-3">
              <LanguageSwitcher />
            </div>

            {user ? (
              <>
                <div className="px-6 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{
                        background: "#00D6D6",
                      }}
                    >
                      {(isCompanyOwner || isSuperAdmin) ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      ) : (
                        getInitials(user.firstName, user.lastName)
                      )}
                    </div>
                    <div>
                      <p className="text-gray-900 font-semibold">
                        {getDisplayName(user)}
                      </p>
                      <p className="text-gray-500 text-sm">{user.email}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setShowLogoutDialog(true);
                  }}
                  className="block w-full text-left px-6 py-3 rounded-xl text-red-400 font-semibold hover:bg-red-500/10 transition-all duration-300"
                >
                  {t('navbar.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-6 py-3 rounded-lg text-gray-900 font-medium border border-gray-200 hover:bg-gray-50 transition-all duration-300"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('navbar.login')}
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-6 py-3 rounded-lg text-white font-medium transition-all duration-300"
                  style={{
                    background: "#00D6D6",
                  }}
                >
                  {t('navbar.signup')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog - Using React Portal for top-level rendering */}
      {showLogoutDialog &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
              className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 animate-scaleIn"
              style={{
                background:
                  "linear-gradient(145deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                boxShadow:
                  "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(16, 185, 129, 0.1)",
              }}
            >
              {/* Header with Icon */}
              <div className="p-6 pb-4">
                <div className="flex items-center justify-center mb-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)",
                      border: "2px solid rgba(239, 68, 68, 0.3)",
                    }}
                  >
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
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-white text-center mb-2">
                  {t('navbar.logoutConfirmTitle')}
                </h3>

                {/* Message */}
                <p className="text-slate-400 text-center">
                  {t('navbar.logoutConfirmMessage')}
                </p>
              </div>

              {/* Buttons */}
              <div className="p-6 pt-2 flex gap-3">
                {/* Cancel Button */}
                <button
                  onClick={() => setShowLogoutDialog(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all duration-200 transform hover:scale-105"
                >
                  {t('navbar.cancel')}
                </button>

                {/* Confirm Logout Button */}
                <button
                  onClick={() => {
                    setShowLogoutDialog(false);
                    handleLogout();
                  }}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105"
                  style={{
                    background:
                      "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    boxShadow: "0 4px 14px 0 rgba(239, 68, 68, 0.4)",
                  }}
                >
                  {t('navbar.confirm')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
          50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.6); }
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </nav>
  );
};

export default Navbar;
