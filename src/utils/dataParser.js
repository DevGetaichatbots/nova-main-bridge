// src/services/DataParser.js

// =================================================================
// HELPER FUNCTIONS (Essential utility functions)
// =================================================================

/**
 * Converts an ISO-like date string (e.g., "20240613T000000000Z" or "20240613") to a readable format "DD-MM-YYYY".
 * @param {string} isoDate - The date string from the API.
 * @returns {string} - The formatted date or 'N/A'.
 */
const formatISODateToReadable = (isoDate) => {
  if (!isoDate || isoDate.trim() === "") return "N/A";
  try {
    // Extract just the date portion (YYYYMMDD) - works for both formats
    const dateStr = isoDate.includes("T") ? isoDate.substring(0, 8) : isoDate.substring(0, 8);
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error("Error formatting ISO date:", isoDate, error);
    return "N/A";
  }
};

/**
 * Parses a date string in "DD-MM-YYYY" format into a JavaScript Date object.
 * @param {string} dateStr - The date string to parse.
 * @returns {Date|null} - The parsed Date object or null if invalid.
 */
const parseReadableDate = (dateStr) => {
  if (!dateStr || dateStr === "N/A") return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const date = new Date(parts[2], parts[1] - 1, parts[0]);
  if (isNaN(date.getTime()) || date.getDate() !== parseInt(parts[0])) {
    return null;
  }
  return date;
};

/**
 * Calculates the difference in business days (excluding Sundays only) between two dates.
 * @param {string} startDateStr1 - The first start date in "DD-MM-YYYY" format.
 * @param {string} startDateStr2 - The second start date in "DD-MM-YYYY" format.
 * @returns {string} - The formatted difference string (e.g., "+677 business days").
 */
const calculateBusinessDaysDifference = (startDateStr1, startDateStr2) => {
  const date1 = parseReadableDate(startDateStr1);
  const date2 = parseReadableDate(startDateStr2);

  if (!date1 || !date2) return "N/A";
  if (date1.getTime() === date2.getTime()) return "No change";

  let startDate = date1 > date2 ? new Date(date2) : new Date(date1);
  const endDate = date1 > date2 ? new Date(date1) : new Date(date2);
  let businessDays = 0;

  while (startDate < endDate) {
    const dayOfWeek = startDate.getDay();
    if (dayOfWeek !== 0) { // 0 = Sunday, exclude only Sunday
      businessDays++;
    }
    startDate.setDate(startDate.getDate() + 1);
  }

  const isPositive = date2.getTime() > date1.getTime();
  return isPositive
    ? `+${businessDays} business days`
    : `-${businessDays} business days`;
};

/**
 * Enhanced date parsing function that handles multiple formats
 * @param {string} dateStr - The date string to parse
 * @returns {string} - Formatted date string or "Invalid Date" if parsing fails
 */
const parseDate = (dateStr) => {
  if (!dateStr || dateStr === "N/A" || dateStr.trim() === "") {
    return "N/A";
  }

  // Remove any extra whitespace
  const cleanStr = dateStr.trim();

  try {
    // Try different date formats
    const formats = [
      // ISO format with time
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      // Standard formats
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}-\d{2}-\d{4}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{4}\/\d{2}\/\d{2}$/,
      // European format
      /^\d{2}\.\d{2}\.\d{4}$/,
    ];

    let parsedDate = null;

    // Try parsing with different approaches
    if (formats[0].test(cleanStr)) {
      // ISO format
      parsedDate = new Date(cleanStr);
    } else if (formats[1].test(cleanStr)) {
      // YYYY-MM-DD
      parsedDate = new Date(cleanStr);
    } else if (formats[2].test(cleanStr)) {
      // DD-MM-YYYY
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    } else if (formats[3].test(cleanStr)) {
      // DD/MM/YYYY
      const parts = cleanStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    } else if (formats[4].test(cleanStr)) {
      // YYYY/MM/DD
      parsedDate = new Date(cleanStr.replace(/\//g, '-'));
    } else if (formats[5].test(cleanStr)) {
      // DD.MM.YYYY
      const parts = cleanStr.split('.');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    } else {
      // Try direct parsing as fallback
      parsedDate = new Date(cleanStr);
    }

    // Validate the parsed date
    if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
      // Format as DD-MM-YYYY
      const day = String(parsedDate.getDate()).padStart(2, '0');
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const year = parsedDate.getFullYear();
      return `${day}-${month}-${year}`;
    }

    // If all parsing attempts fail, return the original string
    return cleanStr;
  } catch (error) {
    console.warn(`Date parsing failed for: "${dateStr}"`, error);
    return cleanStr; // Return original string instead of throwing error
  }
};

// =================================================================
// THE NEW, INTELLIGENT & FINAL PARSER
// This function handles the swapped data issue and all other cases correctly.
// =================================================================
const parseDenseApiResponse = (rawData) => {
  console.log("🚀 Running Intelligent Dense API Response Parser...");
  if (!rawData || typeof rawData !== "string") return [];

  const tasks = [];

  // Step 1: Extract file names and determine the overall status from the header
  const fileNamesMatch = rawData.match(/File 1\s+([^\s]+)\s+File 2\s+([^\s]+)/);
  const file1Name = fileNamesMatch ? fileNamesMatch[1] : "File 1";
  const file2Name = fileNamesMatch ? fileNamesMatch[2] : "File 2";
  const combinedFilename = `${file1Name} | ${file2Name}`;

  let overallStatus = "Modified"; // Default
  if (rawData.toLowerCase().includes("removed in the second file")) {
    overallStatus = "Removed";
  } else if (rawData.toLowerCase().includes("added in the new file")) {
    overallStatus = "Added";
  }

  // FIXED: Use matchAll for robust iteration. This will find ALL task blocks correctly.
  const taskPattern =
    /\d+\s+uniqueid(\d+)\s+taskname(.*?)(?=\s+\d+\s+uniqueid|$)/gs;
  const taskChunks = [...rawData.matchAll(taskPattern)];

  for (const chunkMatch of taskChunks) {
    const chunk = chunkMatch[0];
    const uniqueId = chunkMatch[1];
    const taskName = chunkMatch[2]
      .match(/(.*?)(?=\s+file1|\s+file2|\s+startdate|$)/)[1]
      .trim();

    let dataForFile1 = { startDate: "N/A", endDate: "N/A", duration: "N/A" };
    let dataForFile2 = { startDate: "N/A", endDate: "N/A", duration: "N/A" };

    // FIXED: Intelligent data assignment based on filename found within the data block
    const file1DataBlock = chunk.match(/file1(.*?)(?=\s+file2|$)/);
    const file2DataBlock = chunk.match(/file2(.*?)(?=\s+startdiffdays|$)/);

    const processBlock = (block) => {
      if (!block) return { startDate: "N/A", endDate: "N/A", duration: "N/A" };
      const start = block[1].match(/start(\d{8}(?:T\d{9}Z)?)/);
      const end = block[1].match(/end(\d{8}(?:T\d{9}Z)?)/);
      const dur = block[1].match(/duration(\d+)/);
      return {
        startDate: start ? formatISODateToReadable(start[1]) : "N/A",
        endDate: end ? formatISODateToReadable(end[1]) : "N/A",
        duration: dur ? `${dur[1]} days` : "N/A",
      };
    };

    // FIXED: Always assign file1 data to file1 and file2 data to file2
    if (file1DataBlock) {
      dataForFile1 = processBlock(file1DataBlock);
    }

    if (file2DataBlock) {
      dataForFile2 = processBlock(file2DataBlock);
    }

    // Handle "Removed" tasks format (which has no file1/file2 keywords)
    if (!file1DataBlock && !file2DataBlock) {
      const start = chunk.match(/startdate(\d{8}(?:T\d{9}Z)?)/);
      const end = chunk.match(/enddate(\d{8}(?:T\d{9}Z)?)/);
      const dur = chunk.match(/durationdays(\d+)/);
      if (start) dataForFile1.startDate = formatISODateToReadable(start[1]);
      if (end) dataForFile1.endDate = formatISODateToReadable(end[1]);
      if (dur) dataForFile1.duration = `${dur[1]} days`;
    }

    // Determine final status for the row
    const hasFile1Data =
      dataForFile1.startDate !== "N/A" || dataForFile1.endDate !== "N/A";
    const hasFile2Data =
      dataForFile2.startDate !== "N/A" || dataForFile2.endDate !== "N/A";
    let status = "N/A";
    if (hasFile1Data && hasFile2Data) status = "Modified";
    else if (!hasFile1Data && hasFile2Data) status = "Added";
    else if (hasFile1Data && !hasFile2Data) status = "Removed";

    tasks.push({
      id: uniqueId,
      taskName: taskName,
      status: status,
      startDate2023: dataForFile1.startDate, // CORRECTED: File1 data goes to first column
      endDate2023: dataForFile1.endDate,     // CORRECTED: File1 data goes to first column
      duration2023: dataForFile1.duration,   // CORRECTED: File1 data goes to first column
      startDate2024: dataForFile2.startDate, // CORRECTED: File2 data goes to second column
      endDate2024: dataForFile2.endDate,     // CORRECTED: File2 data goes to second column
      duration2024: dataForFile2.duration,   // CORRECTED: File2 data goes to second column
      startDateDifference: calculateBusinessDaysDifference(
        dataForFile1.startDate, // CORRECTED: Using File1 as base for calculation
        dataForFile2.startDate, // CORRECTED: Using File2 for comparison
      ),
      filename: combinedFilename,
    });
  }

  console.log(`✅ Intelligent parser finished. Found ${tasks.length} tasks.`);
  return tasks;
};

// =================================================================
// ENHANCED DENSE API PARSER - FOR NEW FORMAT
// =================================================================
const parseEnhancedDenseApiResponse = (rawData) => {
  console.log("🚀 Running Enhanced Dense API Response Parser...");
  if (!rawData || typeof rawData !== "string") return [];

  const tasks = [];
  
  // Step 1: Extract file names from the header
  const fileNamesMatch = rawData.match(/File 1\s+([^\s]+)\s+File 2\s+([^\s]+)/);
  const file1Name = fileNamesMatch ? fileNamesMatch[1] : "File 1";
  const file2Name = fileNamesMatch ? fileNamesMatch[2] : "File 2";
  const combinedFilename = `${file1Name} | ${file2Name}`;

  // Step 2: Split by uniqueid to get individual task blocks
  const taskBlocks = rawData.split(/(?=\d+\s+uniqueid)/);
  
  for (const block of taskBlocks) {
    if (!block.trim() || !block.includes("uniqueid")) continue;

    try {
      // Extract unique ID
      const uniqueIdMatch = block.match(/uniqueid(\d+)/);
      if (!uniqueIdMatch) continue;
      const uniqueId = uniqueIdMatch[1];

      // Extract task name
      const taskNameMatch = block.match(/taskname([^\s]+(?:\s+[^\s]+)*?)(?=\s+file1|\s+file2|\s*$)/);
      if (!taskNameMatch) continue;
      const taskName = taskNameMatch[1].trim();

      // Initialize data objects
      let dataForFile1 = { startDate: "N/A", endDate: "N/A", duration: "N/A" };
      let dataForFile2 = { startDate: "N/A", endDate: "N/A", duration: "N/A" };

      // Extract File 1 data (supports both YYYYMMDD and YYYYMMDDTHHHMMSSSSSZ formats)
      const file1StartMatch = block.match(/file1start(\d{8}(?:T\d{9}Z)?)/);
      const file1EndMatch = block.match(/file1end(\d{8}(?:T\d{9}Z)?)/);
      const file1DurationMatch = block.match(/file1duration(\d+)/);

      if (file1StartMatch) {
        dataForFile1.startDate = formatISODateToReadable(file1StartMatch[1]);
      }
      if (file1EndMatch) {
        dataForFile1.endDate = formatISODateToReadable(file1EndMatch[1]);
      }
      if (file1DurationMatch) {
        dataForFile1.duration = `${file1DurationMatch[1]} days`;
      }

      // Extract File 2 data (supports both YYYYMMDD and YYYYMMDDTHHHMMSSSSSZ formats)
      const file2StartMatch = block.match(/file2start(\d{8}(?:T\d{9}Z)?)/);
      const file2EndMatch = block.match(/file2end(\d{8}(?:T\d{9}Z)?)/);
      const file2DurationMatch = block.match(/file2duration(\d+)/);

      if (file2StartMatch) {
        dataForFile2.startDate = formatISODateToReadable(file2StartMatch[1]);
      }
      if (file2EndMatch) {
        dataForFile2.endDate = formatISODateToReadable(file2EndMatch[1]);
      }
      if (file2DurationMatch) {
        dataForFile2.duration = `${file2DurationMatch[1]} days`;
      }

      // Determine status
      const hasFile1Data = dataForFile1.startDate !== "N/A" || dataForFile1.endDate !== "N/A";
      const hasFile2Data = dataForFile2.startDate !== "N/A" || dataForFile2.endDate !== "N/A";
      
      let status = "N/A";
      if (hasFile1Data && hasFile2Data) {
        status = "Modified";
      } else if (!hasFile1Data && hasFile2Data) {
        status = "Added";
      } else if (hasFile1Data && !hasFile2Data) {
        status = "Removed";
      }

      // Add to tasks array
      tasks.push({
        id: uniqueId,
        taskName: taskName,
        status: status,
        startDate2023: dataForFile1.startDate,
        endDate2023: dataForFile1.endDate,
        duration2023: dataForFile1.duration,
        startDate2024: dataForFile2.startDate,
        endDate2024: dataForFile2.endDate,
        duration2024: dataForFile2.duration,
        startDateDifference: calculateBusinessDaysDifference(
          dataForFile1.startDate,
          dataForFile2.startDate
        ),
        filename: combinedFilename,
      });

    } catch (error) {
      console.error("Error parsing task block:", error, block);
      continue;
    }
  }

  console.log(`✅ Enhanced parser finished. Found ${tasks.length} tasks.`);
  return tasks;
};

// =================================================================
// PARSER FOR CHANGED TASKS FORMAT
// =================================================================
const parseChangedTasksFormat = (rawData) => {
  console.log("🚀 Running Changed Tasks Format Parser...");
  if (!rawData || typeof rawData !== "string") return [];

  const tasks = [];
  
  // Extract file names from the header
  const fileNamesMatch = rawData.match(/File 1\s+([^\s]+)\s+File 2\s+([^\s]+)/);
  const file1Name = fileNamesMatch ? fileNamesMatch[1] : "File 1";
  const file2Name = fileNamesMatch ? fileNamesMatch[2] : "File 2";
  const combinedFilename = `${file1Name} | ${file2Name}`;

  // Look for "Changed tasks" pattern
  const changedTasksMatch = rawData.match(/Changed tasks\s+(\d+)/);
  if (!changedTasksMatch) return [];

  // Parse individual task entries
  const taskPattern = /(\d+)\s+taskname\s+([^\s]+(?:\s+[^\s]+)*?)\s+file1end\s+(\d{8}T\d{9}Z)\s+file2end\s+(\d{8}T\d{9}Z)\s+diffdays\s+(\d+)/g;
  
  let match;
  while ((match = taskPattern.exec(rawData)) !== null) {
    const [, id, taskName, file1End, file2End, diffDays] = match;
    
    tasks.push({
      id: id,
      taskName: taskName.trim(),
      status: "Modified",
      startDate2023: "N/A",
      endDate2023: formatISODateToReadable(file1End),
      duration2023: "N/A",
      startDate2024: "N/A", 
      endDate2024: formatISODateToReadable(file2End),
      duration2024: "N/A",
      startDateDifference: calculateBusinessDaysDifference(
        formatISODateToReadable(file1End),
        formatISODateToReadable(file2End)
      ),
      filename: combinedFilename,
    });
  }

  console.log(`✅ Changed tasks parser finished. Found ${tasks.length} tasks.`);
  return tasks;
};

// =================================================================
// MASTER EXPORT FUNCTION
// =================================================================
export const parseGeneralTaskData = (rawData) => {
  if (!rawData || typeof rawData !== "string") return [];
  console.log("🔍 Starting master parser (parseGeneralTaskData)...");

  // Check for "Changed tasks" format first
  if (rawData.includes("Changed tasks") && rawData.includes("file1end") && rawData.includes("file2end")) {
    const changedTasksData = parseChangedTasksFormat(rawData);
    if (changedTasksData.length > 0) {
      console.log("📊 Success! Used Changed Tasks Format Parser.");
      return changedTasksData;
    }
  }

  // Check for new enhanced format
  if (rawData.includes("uniqueid") && rawData.includes("file1start") && rawData.includes("file2start")) {
    const enhancedData = parseEnhancedDenseApiResponse(rawData);
    if (enhancedData.length > 0) {
      console.log("📊 Success! Used Enhanced Dense API Parser.");
      return enhancedData;
    }
  }

  // Fallback to original dense format
  if (
    rawData.includes("uniqueid") &&
    (rawData.includes("taskname") || rawData.includes("startdate"))
  ) {
    const denseData = parseDenseApiResponse(rawData);
    if (denseData.length > 0) {
      console.log("📊 Success! Used the original Intelligent Dense API Parser.");
      return denseData;
    }
  }

  console.log(
    "⚠️ Dense format not detected or failed to parse. No fallback parsers configured.",
  );
  return [];
};