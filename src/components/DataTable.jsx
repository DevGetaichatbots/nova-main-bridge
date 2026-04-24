// src/components/DataTable.jsx

import React from "react";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";

const DataTable = ({ title, data, icon }) => {
  const { t } = useTranslation();
  if (!data || data.length === 0) return null;

  // Extract dynamic filenames from current session
  const getFileNames = () => {
    // Get files from current session localStorage
    const getCurrentSessionFileNames = () => {
      try {
        // Try to determine current session ID from multiple sources
        let currentSessionId = null;

        // Check for active session ID
        if (typeof window !== "undefined") {
          currentSessionId = localStorage.getItem("chatSessionId");

          // If not found, try user-specific session
          if (!currentSessionId) {
            const userKeys = Object.keys(localStorage).filter((key) =>
              key.startsWith("chatSessionId_user_"),
            );
            if (userKeys.length > 0) {
              currentSessionId = localStorage.getItem(userKeys[0]);
            }
          }
        }

        if (!currentSessionId) {
          console.log("No current session ID found");
          return null;
        }

        // Get files for current session
        const storageKey = `savedFiles_${currentSessionId}`;
        const filesData = localStorage.getItem(storageKey);

        if (!filesData) {
          console.log("No files found for session:", currentSessionId);
          return null;
        }

        const sessionFiles = JSON.parse(filesData);
        console.log(
          "📁 Found session files:",
          sessionFiles.length,
          "files for session:",
          currentSessionId,
        );

        if (sessionFiles.length >= 2) {
          const cleanFileName = (filename) => {
            // Remove file extension and clean up the name
            return filename.replace(/\.(pdf|doc|docx|txt)$/i, "").trim();
          };

          // Sort by upload time to ensure consistent ordering
          sessionFiles.sort((a, b) => {
            const timeA = new Date(a.uploadedAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.uploadedAt || b.timestamp || 0).getTime();
            return timeA - timeB;
          });

          return {
            file2023: cleanFileName(sessionFiles[0].name),
            file2024: cleanFileName(sessionFiles[1].name),
          };
        } else if (sessionFiles.length === 1) {
          const cleanFileName = (filename) => {
            return filename.replace(/\.(pdf|doc|docx|txt)$/i, "").trim();
          };

          return {
            file2023: cleanFileName(sessionFiles[0].name),
            file2024: t('dataTable.secondFileUploadPending'),
          };
        }
      } catch (error) {
        console.error("Error getting current session file names:", error);
      }
      return null;
    };

    // Try current session storage first
    const sessionNames = getCurrentSessionFileNames();
    if (sessionNames) {
      return sessionNames;
    }

    // Fallback to data extraction if no session data
    if (!data || data.length === 0)
      return { file2023: t('dataTable.firstFile'), file2024: t('dataTable.secondFile') };

    // Look for filename patterns in the data
    const sampleFilename = data[0]?.filename || "";

    // Parse filename with format "File 1 [name1] File 2 [name2]"
    const filePattern = /File 1\s+([^\s]+)\s+File 2\s+([^\s]+)/;
    const fileMatch = sampleFilename.match(filePattern);

    if (fileMatch) {
      const file1Name = fileMatch[1].trim();
      const file2Name = fileMatch[2].trim();

      // Extract short names and remove file extensions
      const extractShortName = (filename) => {
        const cleaned = filename.replace(/\.(pdf|doc|docx|txt)$/i, "");
        const match = cleaned.match(/([A-Za-z\s\d]+(?:NK|nk)?)/);
        return match ? match[1].trim() : cleaned;
      };

      return {
        file2023: extractShortName(file1Name), // First file (file1)
        file2024: extractShortName(file2Name), // Second file (file2)
      };
    }

    if (sampleFilename.includes("2023:") || sampleFilename.includes("F1:")) {
      // Extract F1 and F2 filenames
      const f1Match = sampleFilename.match(/F1:\s*(.+?)\s*\|/);
      const f2Match = sampleFilename.match(/F2:\s*(.+?)$/);

      if (f1Match && f2Match) {
        const f1Name = f1Match[1].trim();
        const f2Name = f2Match[1].trim();

        // Extract short names and remove file extensions
        const extractShortName = (filename) => {
          const cleaned = filename.replace(/\.(pdf|doc|docx|txt)$/i, "");
          const match = cleaned.match(/([A-Za-z\s\d]+(?:NK|nk)?)/);
          return match ? match[1].trim() : cleaned;
        };

        return {
          file2023: extractShortName(f1Name),
          file2024: extractShortName(f2Name),
        };
      }
    }

    // Fallback: try to extract from combined filenames
    if (sampleFilename.includes("2023") && sampleFilename.includes("2024")) {
      const parts = sampleFilename.split(/2024|2023/);
      if (parts.length > 0) {
        const baseName = parts[0].replace(/[:\|]/g, "").trim();
        return {
          file2023: baseName + " (2023)",
          file2024: baseName + " (2024)",
        };
      }
    }

    return { file2023: t('dataTable.firstFile'), file2024: t('dataTable.secondFile') };
  };

  const { file2023, file2024 } = getFileNames();

  const getStatusStyle = (status) => {
    if (!status) return "bg-slate-600/50 text-slate-300 border-slate-500/30";
    const lowerStatus = status.toLowerCase();
    // FIXED: Yahan N/A ke liye ek specific condition add ki hai.
    if (lowerStatus === "n/a") {
      return "bg-slate-600/50 text-slate-300 border-slate-500/30";
    }
    if (lowerStatus.includes("new") || lowerStatus.includes("added")) {
      return "bg-emerald-500 text-[#1c2631] border-emerald-500/30";
    }
    if (lowerStatus.includes("removed")) {
      return "bg-red-500 text-[#1c2631] border-red-500/30";
    }
    if (lowerStatus.includes("modified")) {
      return "bg-amber-500 text-[#1c2631] border-amber-500/30";
    }
    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  };

  const calculateStartDateDifference = (startDate2023, startDate2024) => {
    if (
      !startDate2023 ||
      !startDate2024 ||
      startDate2023 === "N/A" ||
      startDate2024 === "N/A"
    ) {
      return "N/A";
    }

    try {
      // Enhanced date parsing function to handle multiple formats
      const parseDate = (dateStr) => {
        if (!dateStr || dateStr === "N/A" || dateStr === "-") return null;

        // Clean the date string
        let cleanDate = dateStr.toString().trim();

        // Handle different date formats
        let day, month, year;

        // Format 1: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
          const parts = cleanDate.split("-");
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1; // 0-indexed
          day = parseInt(parts[2]);
        }
        // Format 2: DD-MM-YYYY
        else if (/^\d{2}-\d{2}-\d{4}$/.test(cleanDate)) {
          const parts = cleanDate.split("-");
          day = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1; // 0-indexed
          year = parseInt(parts[2]);
        }
        // Format 3: DD/MM/YYYY
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
          const parts = cleanDate.split("/");
          day = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1; // 0-indexed
          year = parseInt(parts[2]);
        }
        // Format 4: MM/DD/YYYY
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
          const parts = cleanDate.split("/");
          month = parseInt(parts[0]) - 1; // 0-indexed
          day = parseInt(parts[1]);
          year = parseInt(parts[2]);
        }
        // Format 5: YYYYMMDD
        else if (/^\d{8}$/.test(cleanDate)) {
          year = parseInt(cleanDate.substring(0, 4));
          month = parseInt(cleanDate.substring(4, 6)) - 1; // 0-indexed
          day = parseInt(cleanDate.substring(6, 8));
        }
        // Format 6: DD Month YYYY (e.g., "15 May 2023")
        else if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(cleanDate)) {
          const parts = cleanDate.split(/\s+/);
          day = parseInt(parts[0]);
          year = parseInt(parts[2]);

          const months = {
            january: 0,
            jan: 0,
            februar: 1,
            feb: 1,
            march: 2,
            mar: 2,
            april: 3,
            apr: 3,
            may: 4,
            maj: 4,
            june: 5,
            jun: 5,
            july: 6,
            jul: 6,
            august: 7,
            aug: 7,
            september: 8,
            sep: 8,
            october: 9,
            oct: 9,
            november: 10,
            nov: 10,
            december: 11,
            dec: 11,
          };

          const monthName = parts[1].toLowerCase();
          month =
            months[monthName] !== undefined
              ? months[monthName]
              : parseInt(parts[1]) - 1;
        }
        // Format 7: Month DD YYYY (e.g., "May 15 2023")
        else if (/^\w+\s+\d{1,2}\s+\d{4}$/.test(cleanDate)) {
          const parts = cleanDate.split(/\s+/);
          day = parseInt(parts[1]);
          year = parseInt(parts[2]);

          const months = {
            january: 0,
            jan: 0,
            februar: 1,
            feb: 1,
            march: 2,
            mar: 2,
            april: 3,
            apr: 3,
            may: 4,
            maj: 4,
            june: 5,
            jun: 5,
            july: 6,
            jul: 6,
            august: 7,
            aug: 7,
            september: 8,
            sep: 8,
            october: 9,
            oct: 9,
            november: 10,
            nov: 10,
            december: 11,
            dec: 11,
          };

          const monthName = parts[0].toLowerCase();
          month = months[monthName] !== undefined ? months[monthName] : 0;
        }
        // Format 8: D Month YYYY (e.g., "6 December 2022")
        else if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(cleanDate)) {
          const parts = cleanDate.split(/\s+/);
          day = parseInt(parts[0]);
          year = parseInt(parts[2]);

          const months = {
            january: 0,
            jan: 0,
            februar: 1,
            feb: 1,
            march: 2,
            mar: 2,
            april: 3,
            apr: 3,
            may: 4,
            maj: 4,
            june: 5,
            jun: 5,
            july: 6,
            jul: 6,
            august: 7,
            aug: 7,
            september: 8,
            sep: 8,
            october: 9,
            oct: 9,
            november: 10,
            nov: 10,
            december: 11,
            dec: 11,
          };

          const monthName = parts[1].toLowerCase();
          month = months[monthName] !== undefined ? months[monthName] : 0;
        } else {
          // Try to parse as a regular date
          const testDate = new Date(cleanDate);
          if (!isNaN(testDate.getTime())) {
            return testDate;
          }
          return null;
        }

        // Create and validate the date
        const dateObj = new Date(year, month, day);

        // Validate that the date is reasonable (between 1900 and 2100)
        if (dateObj.getFullYear() < 1900 || dateObj.getFullYear() > 2100) {
          return null;
        }

        // Validate that the constructed date matches our input
        if (
          dateObj.getDate() !== day ||
          dateObj.getMonth() !== month ||
          dateObj.getFullYear() !== year
        ) {
          return null;
        }

        return dateObj;
      };

      // Function to calculate business days (excluding Sundays)
      const calculateBusinessDays = (startDate, endDate) => {
        if (!startDate || !endDate) return 0;

        let businessDays = 0;
        let currentDate = new Date(startDate);
        let finalDate = new Date(endDate);

        // Ensure we're working with the correct date order
        if (currentDate > finalDate) {
          const tempDate = new Date(currentDate);
          currentDate = new Date(finalDate);
          finalDate = tempDate;
        }

        while (currentDate < finalDate) {
          // Check if the current day is NOT Sunday (0 = Sunday)
          if (currentDate.getDay() !== 0) {
            businessDays++;
          }

          // Move to the next day
          currentDate.setDate(currentDate.getDate() + 1);
        }

        return businessDays;
      };

      const date2023 = parseDate(startDate2023);
      const date2024 = parseDate(startDate2024);

      if (
        !date2023 ||
        !date2024 ||
        isNaN(date2023.getTime()) ||
        isNaN(date2024.getTime())
      ) {
        return "N/A";
      }

      // Calculate business days difference (excluding Sundays)
      const actualDiff = date2024.getTime() - date2023.getTime();
      const isPositive = actualDiff >= 0;

      let absoluteBusinessDays;
      if (isPositive) {
        absoluteBusinessDays = calculateBusinessDays(date2023, date2024);
      } else {
        absoluteBusinessDays = calculateBusinessDays(date2024, date2023);
      }

      if (date2023.getTime() === date2024.getTime()) {
        return "No change";
      } else if (isPositive) {
        return `+${absoluteBusinessDays} business days`;
      } else {
        return `-${absoluteBusinessDays} business days`;
      }
    } catch (error) {
      console.error(
        "Date parsing error:",
        error,
        "Dates:",
        startDate2023,
        startDate2024,
      );
      return "N/A";
    }
  };

  const exportToExcel = () => {
    try {
      // Prepare data for Excel export
      const excelData = data.map((row, index) => ({
        ID: row.id || "N/A",
        "Task Name": row.taskName || "N/A",
        Status: row.status || "Unknown",
        "2023 Start Date": row.startDate2023 || "N/A",
        "2023 End Date": row.endDate2023 || "N/A",
        "2023 Duration": row.duration2023 || "N/A",
        "2024 Start Date": row.startDate2024 || "N/A",
        "2024 End Date": row.endDate2024 || "N/A",
        "2024 Duration": row.duration2024 || "N/A",
        "Start Date Difference": calculateStartDateDifference(
          row.startDate2023,
          row.startDate2024,
        ),
        Filename: row.filename || "N/A",
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 8 }, // ID
        { wch: 25 }, // Task Name
        { wch: 15 }, // Status
        { wch: 15 }, // 2023 Start Date
        { wch: 15 }, // 2023 End Date
        { wch: 15 }, // 2023 Duration
        { wch: 15 }, // 2024 Start Date
        { wch: 15 }, // 2024 End Date
        { wch: 15 }, // 2024 Duration
        { wch: 20 }, // Start Date Difference
        { wch: 20 }, // Filename
      ];
      worksheet["!cols"] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Task Comparison");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `Task_Comparison_${currentDate}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      console.log(`Excel file exported: ${filename}`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Error exporting to Excel. Please try again.");
    }
  };

  const headerGradient = "from-cyan-500 to-cyan-600";

  return (
    <div className=" animate-fade-in">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-r ${headerGradient} shadow-lg`}
          >
            <span className="text-xl">{icon}</span>
          </div>
          <h3 className="text-xl font-bold" style={{ color: "#1c2631" }}>
            {title}
          </h3>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium`}
            style={{ background: "#e0f7f7", color: "#1c2631" }}
          >
            {data.length} {data.length === 1 ? "task" : "tasks"}
          </div>
        </div>

        {/* Excel Export Button */}
        <button
          onClick={exportToExcel}
          className="group flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 cursor-pointer"
          style={{
            background: "#00D6D6",
          }}
        >
          <svg
            className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>Export to Excel (.xlsx)</span>
        </button>
      </div>

      {/* Advanced Table Container */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl border border-[#00D6D6]/30"
        style={{ background: "#ffffff" }}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-r ${headerGradient} opacity-5`}
        ></div>

        <div className="relative overflow-x-auto custom-table-scrollbar">
          <table className="w-full min-w-[1600px]">
            {/* Table Header */}
            <thead>
              <tr className={`bg-gradient-to-r ${headerGradient}`}>
                <th
                  rowSpan="2"
                  className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-b border-white/10 align-middle"
                >
                  ID
                </th>
                <th
                  rowSpan="2"
                  className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-b border-white/10 align-middle"
                >
                  Task Name
                </th>
                <th
                  rowSpan="2"
                  className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-b border-white/10 align-middle"
                >
                  Status
                </th>
                <th
                  colSpan="3"
                  className="px-6 py-3 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-b border-white/10"
                >
                  {file2023}
                </th>
                <th
                  colSpan="3"
                  className="px-6 py-3 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-b border-white/10"
                >
                  {file2024}
                </th>
                <th
                  rowSpan="2"
                  className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-b border-white/10 align-middle"
                >
                  Start Date Difference
                </th>
                <th
                  rowSpan="2"
                  className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 align-middle"
                >
                  Filename
                </th>
              </tr>
              <tr className={`bg-gradient-to-r ${headerGradient}`}>
                <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/10">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/10">
                  End Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/10">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/10">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/10">
                  End Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/10">
                  Duration
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody
              className="divide-y divide-gray-200"
              style={{ background: "rgba(224, 247, 247, 0.3)" }}
            >
              {data.map((row, index) => (
                <tr
                  key={index}
                  className="hover:bg-cyan-50/50 transition-all duration-300 group"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-[#00D6D6] group-hover:text-cyan-600">
                    {row.id || "N/A"}
                  </td>
                  <td
                    className="px-6 py-4 text-sm font-medium group-hover:text-[#1c2631] max-w-xs"
                    style={{ color: "#475569" }}
                  >
                    <div className="truncate" title={row.taskName}>
                      {row.taskName || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`cursor-help px-3 w-fit truncate py-1 rounded-full text-xs font-medium ${getStatusStyle(
                        row.status,
                      )}`}
                    >
                      {row.status || "N/A"}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm font-mono group-hover:text-[#1c2631]"
                    style={{ color: "#64748b" }}
                  >
                    {row.startDate2023 || "N/A"}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm font-mono group-hover:text-[#1c2631]"
                    style={{ color: "#64748b" }}
                  >
                    {row.endDate2023 || "N/A"}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm group-hover:text-[#1c2631]"
                    style={{ color: "#64748b" }}
                  >
                    <span
                      className="px-2 py-1 rounded-md font-medium"
                      style={{ background: "#e0f7f7", color: "#1c2631" }}
                    >
                      {row.duration2023 || "N/A"}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm font-mono group-hover:text-[#1c2631]"
                    style={{ color: "#475569" }}
                  >
                    {row.startDate2024 || "N/A"}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm font-mono group-hover:text-[#1c2631]"
                    style={{ color: "#475569" }}
                  >
                    {row.endDate2024 || "N/A"}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm group-hover:text-[#1c2631]"
                    style={{ color: "#475569" }}
                  >
                    <span
                      className="px-2 py-1 rounded-md font-medium"
                      style={{ background: "#e0f7f7", color: "#1c2631" }}
                    >
                      {row.duration2024 || "N/A"}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm group-hover:text-[#1c2631]"
                    style={{ color: "#475569" }}
                  >
                    <span
                      className={`px-2 py-1 rounded-md font-medium ${
                        calculateStartDateDifference(
                          row.startDate2023,
                          row.startDate2024,
                        ) === "No change"
                          ? "bg-slate-600/50 text-[#1c2631]"
                          : calculateStartDateDifference(
                                row.startDate2023,
                                row.startDate2024,
                              ).startsWith("+")
                            ? "bg-red-400 text-[#1c2631]"
                            : calculateStartDateDifference(
                                  row.startDate2023,
                                  row.startDate2024,
                                ).startsWith("-")
                              ? "bg-green-500 text-[#1c2631]"
                              : "bg-slate-600/50 text-slate-300"
                      }`}
                    >
                      {calculateStartDateDifference(
                        row.startDate2023,
                        row.startDate2024,
                      )}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 text-nowrap text-sm group-hover:text-[#1c2631]"
                    style={{ color: "#64748b" }}
                  >
                    <div title={row.filename}>{row.filename || "N/A"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="px-6 py-3 border-t border-[#00D6D6]/30"
          style={{ background: "rgba(224, 247, 247, 0.5)" }}
        >
          <div
            className="flex items-center justify-between text-sm"
            style={{ color: "#64748b" }}
          >
            <span>
              Total: {data.length} {data.length === 1 ? "entry" : "entries"}
            </span>
            <span className="text-xs opacity-75">
              Last updated: {new Date().toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        /* Custom Table Horizontal Scrollbar */
        .custom-table-scrollbar::-webkit-scrollbar {
          height: 10px;
        }
        .custom-table-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 214, 214, 0.1);
          border-radius: 10px;
        }
        .custom-table-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 214, 214, 0.4);
          border-radius: 10px;
        }
        .custom-table-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 214, 214, 0.6);
        }
      `}</style>
    </div>
  );
};

export default DataTable;
