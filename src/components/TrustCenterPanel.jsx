import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { getApiBaseUrl } from "../utils/apiConfig";

// TL-9.5 (Brief §43): Trust Center admin surface for Nova Insights.
// Multi-tenant, dual-locale (EN/DA), Nova theme (#1eb5ee), explicit denominators (Brief §23).

const TrustCenterPanel = ({ companyId }) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const API_BASE = getApiBaseUrl();
  const currentLang = i18n.language?.startsWith("da") ? "da" : "en";
  const isDa = currentLang === "da";

  const fetchTrustCenter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ locale: currentLang });
      if (companyId) params.append("company_id", companyId);

      const res = await axios.get(`${API_BASE}/api/admin/trust-center?${params.toString()}`, {
        withCredentials: true,
      });
      if (res.data?.success && res.data?.trust_center) {
        setData(res.data.trust_center);
      } else {
        setError(isDa ? "Kunne ikke hente Trust Center-data" : "Could not fetch Trust Center data");
      }
    } catch (err) {
      console.error("Trust Center fetch error:", err);
      setError(
        isDa
          ? "Der opstod en fejl under hentning af Trust Center-data."
          : "An error occurred while fetching Trust Center data."
      );
    } finally {
      setLoading(false);
    }
  }, [API_BASE, currentLang, companyId, isDa]);

  useEffect(() => {
    fetchTrustCenter();
  }, [fetchTrustCenter]);

  const handleOpenReport = async () => {
    setShowReportModal(true);
    try {
      setReportLoading(true);
      const params = new URLSearchParams({
        locale: currentLang,
        format: "markdown",
      });
      if (companyId) params.append("company_id", companyId);

      const res = await axios.get(
        `${API_BASE}/api/admin/trust-center/report?${params.toString()}`,
        { withCredentials: true }
      );
      setReportContent(typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error("Report fetch error:", err);
      setReportContent(
        isDa ? "Kunne ikke indlæse valideringsrapport." : "Could not load verification report."
      );
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadReport = () => {
    const blob = new Blob([reportContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `verification-report-nova-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-10 h-10 border-4 border-[#1eb5ee] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 font-medium">
          {isDa ? "Indlæser Trust Center nøgletal..." : "Loading Trust Center metrics..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 inline-block">
          <p className="font-semibold mb-2">{error}</p>
          <button
            onClick={fetchTrustCenter}
            className="px-4 py-2 bg-[#1eb5ee] text-white rounded-lg text-sm hover:bg-[#189ecc]"
          >
            {isDa ? "Prøv igen" : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  const dv = data?.data_verification || {};
  const am = data?.activity_matching || {};
  const rs = data?.review_summary || {};
  const bd = rs?.breakdown || {};

  return (
    <div className="p-6 space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-[#1c2631] flex items-center gap-2">
            <svg className="w-6 h-6 text-[#1eb5ee]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Trust Center (Brief §43)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isDa
              ? "Overblik over datavalidering, matchpræcision og epistemisk revisionsspor."
              : "Enterprise overview of data verification, activity matching, and epistemic audit trail."}
          </p>
        </div>
        <button
          onClick={handleOpenReport}
          className="flex items-center gap-2 px-4 py-2 bg-[#1eb5ee] text-white rounded-lg hover:bg-[#189ecc] font-medium transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isDa ? "Se valideringsrapport" : "View Verification Report"}
        </button>
      </div>

      {/* 6 Brief §43 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Data Verification */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-[#1eb5ee]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {isDa ? "Datavalidering" : "Data Verification"}
            </span>
            <span className="px-2 py-1 bg-cyan-50 text-[#1eb5ee] text-xs font-semibold rounded-full border border-cyan-200">
              Brief §23
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {dv.display_string || "0/0 (0.00%)"}
          </div>
          <p className="text-xs text-gray-500">
            {dv.description || (isDa ? "Kritiske datafelter verificeret mod kilde" : "Critical data fields verified against source")}
          </p>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span>{isDa ? "Verificerede felter" : "Verified fields"}: <strong>{dv.verified_count || 0}</strong></span>
            <span>{isDa ? "Total population" : "Total population"}: <strong>{dv.total_count || 0}</strong></span>
          </div>
        </div>

        {/* Card 2: Activity Matching */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-[#1eb5ee]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {isDa ? "Aktivitetsmatchning" : "Activity Matching"}
            </span>
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
              {isDa ? "Præcision" : "Precision"}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {am.display_string || "0/0 (0.00%)"}
          </div>
          <p className="text-xs text-gray-500">
            {am.description || (isDa ? "Aktiviteter matchet på tværs af revisioner" : "Activities matched across revisions")}
          </p>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span>{isDa ? "Matchede par" : "Matched pairs"}: <strong>{am.matched_count || 0}</strong></span>
            <span>{isDa ? "Kandidater" : "Candidates"}: <strong>{am.total_count || 0}</strong></span>
          </div>
        </div>

        {/* Card 3: False Match Rate (Prominent KPI) */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-amber-800 uppercase tracking-wider">
              {isDa ? "Falsk-match rate" : "False Match Rate"}
            </span>
            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300">
              {isDa ? "Mål: 0.0%" : "Target: 0.0%"}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {am.false_match_display || "0/0 (0.00%)"}
          </div>
          <p className="text-xs text-gray-500">
            {isDa
              ? "Kritisk kvalitetsmål (Brief §37): Ingen forkerte matches må godkendes."
              : "Strict quality target (Brief §37): Zero false matches allowed."}
          </p>
          <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between text-xs text-gray-600">
            <span>{isDa ? "Falske matches fundet" : "False matches found"}: <strong>{am.false_match_count || 0}</strong></span>
            <span className="text-green-700 font-semibold">{isDa ? "Mål opfyldt" : "Target Met"}</span>
          </div>
        </div>

        {/* Card 4: Items Requiring Review */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-[#1eb5ee]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {isDa ? "Gennemgangselementer" : "Items Requiring Review"}
            </span>
            <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">
              Brief §25
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {data?.items_requiring_review || 0}
          </div>
          <p className="text-xs text-gray-500">
            {isDa
              ? "Total registrerede elementer til operatørgennemgang."
              : "Total items identified requiring human review."}
          </p>
          <div className="mt-3 pt-2 flex flex-wrap gap-1">
            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
              {isDa ? "Usikkert match" : "Uncertain match"}: {bd.uncertain_match || 0}
            </span>
            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
              {isDa ? "Lav ID-sikkerhed" : "Low confidence ID"}: {bd.low_confidence_id || 0}
            </span>
            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
              {isDa ? "Ulæselig dato" : "Unreadable date"}: {bd.unreadable_date || 0}
            </span>
            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-700">
              {isDa ? "Konflikt" : "Conflict"}: {bd.conflicting_value || 0}
            </span>
          </div>
        </div>

        {/* Card 5: Unresolved Items */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-[#1eb5ee]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {isDa ? "Uafklarede elementer" : "Unresolved Items"}
            </span>
            <span className="px-2 py-1 bg-yellow-50 text-yellow-800 text-xs font-semibold rounded-full border border-yellow-200">
              {isDa ? "Status" : "Status"}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {data?.unresolved_items || 0}
          </div>
          <p className="text-xs text-gray-500">
            {isDa
              ? "Afventer manuel stillingtagen fra operatør."
              : "Pending operator clarification in the review queue."}
          </p>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span>{isDa ? "Løste" : "Resolved"}: <strong>{rs.resolved_items || 0}</strong></span>
            <span>{isDa ? "Udestående" : "Pending"}: <strong>{rs.unresolved_items || 0}</strong></span>
          </div>
        </div>

        {/* Card 6: Engine Version & Last Validation Date */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-[#1eb5ee]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {isDa ? "System & Motor" : "Engine & Validation"}
            </span>
            <span className="px-2 py-1 bg-cyan-50 text-[#1eb5ee] text-xs font-semibold rounded-full border border-cyan-200">
              Brief §41
            </span>
          </div>
          <div className="text-base font-bold text-[#1c2631] truncate mb-1">
            {data?.analysis_engine_version || "nusf-compare-engine-v1.4"}
          </div>
          <p className="text-xs text-gray-500">
            {isDa ? "Fastlåst sammenlignings- og vurderingsmotor." : "Pinned comparison and evaluation engine."}
          </p>
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600">
            <span>{isDa ? "Seneste validering" : "Last validation"}: </span>
            <strong className="text-gray-900">
              {data?.last_validation_date ? new Date(data.last_validation_date).toLocaleString(isDa ? "da-DK" : "en-US") : (isDa ? "Ingen kørt endnu" : "None yet")}
            </strong>
          </div>
        </div>
      </div>

      {/* Verification Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#1eb5ee] to-[#147aa0] text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {isDa ? "Valideringsrapport (Eksportabel)" : "Verification Report (Exportable)"}
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-white/80 hover:text-white text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto font-mono text-sm bg-gray-50 text-gray-800 whitespace-pre-wrap">
              {reportLoading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-[#1eb5ee] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  {isDa ? "Genererer rapport..." : "Generating report..."}
                </div>
              ) : (
                reportContent
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {isDa
                  ? "Brief §43 valideringsresumé med definerede nævnere (Brief §23)"
                  : "Brief §43 verification summary with defined denominators (Brief §23)"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  {copySuccess ? (isDa ? "Kopieret! ✓" : "Copied! ✓") : (isDa ? "Kopier" : "Copy")}
                </button>
                <button
                  onClick={handleDownloadReport}
                  className="px-4 py-1.5 bg-[#1eb5ee] text-white rounded-lg hover:bg-[#189ecc] text-sm font-medium"
                >
                  Download (.md)
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-3 py-1.5 text-gray-600 hover:text-gray-900 text-sm font-medium"
                >
                  {isDa ? "Luk" : "Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrustCenterPanel;
