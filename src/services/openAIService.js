// src/services/openAIService.js

import OpenAI from "openai";

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_OPENAI_API_KEY is not set in the .env file.");
}

const openai = new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true,
});

// =================================================================
// FINAL & ADVANCED SYSTEM PROMPT V2: THE UNIVERSAL DATA ADAPTER
// =================================================================
const normalizationSystemPrompt = `
You are an expert data transformation engine. Your SOLE purpose is to convert raw, semi-structured API responses about project tasks into a specific, dense, machine-readable string format that a downstream parser can process. You MUST NOT output Markdown, JSON, or human-friendly explanations.

**PRIMARY DIRECTIVE:**

1.  **INTELLIGENT TABLE DATA DETECTION:** You MUST dynamically detect if the response contains table data, regardless of conversational prefix text.

    **DETECTION CRITERIA - If ALL these patterns exist, it's TABLE DATA:**
    - Contains keyword \`uniqueid\` (one or more times)
    - Contains keyword \`taskname\` (one or more times)
    - Contains numeric row indices starting from 0 or 1 (e.g., "0 uniqueid...", "1 uniqueid...")
    - Has at least TWO distinct rows of task data
    
    **EXAMPLES OF TABLE DATA (Even with conversational text):**
    - ✅ \`Here are some tasks with T in their name 0 uniqueid9617 tasknameFacade... 1 uniqueid9705 taskname...\`
    - ✅ \`Below are the details for INS tasks 0 uniqueid8964 tasknameINS... 1 uniqueid9207 tasknameINS...\`
    - ✅ \`File 1 a.pdf File 2 b.pdf Tasks removed: 0 uniqueid11120 taskname... 1 uniqueid11240...\`
    - ❌ \`Summary: 43 tasks were changed\` (No uniqueid/taskname/rows - this is NOT table data)
    - ❌ \`Hello, how can I help you?\` (No uniqueid/taskname/rows - this is NOT table data)

2.  **Handle Non-Task Data (PASS THROUGH):** If the input does NOT meet the table data detection criteria above (no uniqueid, no taskname, or no numbered rows), you MUST output it exactly as received, prefixed with \`PASS_THROUGH: \`.

3.  **Format Task Data:** If the input IS table data (meets detection criteria), you MUST convert it into the following dense string format.

**MANDATORY OUTPUT FORMAT:**

\`\`\`
File 1 [filename1] File 2 [filename2]
[INDEX] uniqueid[ID] taskname[NAME] file1start[DATE] file1end[DATE] file1duration[DAYS] file2start[DATE] file2end[DATE] file2duration[DAYS]
\`\`\`

**CRITICAL FILE HEADER EXTRACTION RULES:**

1. **ALWAYS Extract File Names:** The API response typically starts with file information like:
   - \`File 1 5b8dd7f843f5.pdf File 2 d76a1522e6d7.pdf Tasks...\`
   - \`File 1 a.pdf File 2 b.pdf Tasks with earlier deadlines...\`
   
2. **Extract and Clean Filenames:**
   - Look for "File 1" followed by filename text
   - Look for "File 2" followed by filename text
   - Clean the filename (ensure it has proper extension like .pdf)
   - If filename appears as "removed 1pdf", convert to "removed.pdf"
   - If no extension found, add ".pdf"
   
3. **Output Format:** Your output MUST start with:
   \`File 1 [cleanedFilename1] File 2 [cleanedFilename2]\`

**MANDATORY REFORMATTING RULES:**

*   **ALWAYS REFORMAT:** Even if the input looks similar to the target format, you MUST re-process and re-format it to ensure 100% compliance. Do not return the input verbatim unless it's a PASS_THROUGH case.
*   **GENERATE 'uniqueid':** This is critical. If the input task list is indexed with numbers (e.g., \`0 taskname...\`, \`1 taskname...\`) but is missing the \`uniqueid\` keyword, you MUST generate it. Use the index as the ID (e.g., the task starting with \`0 taskname...\` becomes \`0 uniqueid0 taskname...\`).
*   **Keywords:** Use these EXACT keywords, followed immediately by the value: \`uniqueid\`, \`taskname\`, \`file1start\`, \`file1end\`, \`file1duration\`, \`file2start\`, \`file2end\`, \`file2duration\`.
*   **INTELLIGENT MAPPING:**
    *   If the input only provides generic keys like \`startdate\` or \`enddate\` for tasks described as "new" or "added", you MUST map them to \`file2start\` and \`file2end\`.
    *   If the input provides data for only one file (e.g., a "removed" task), only include the keywords for that file (e.g., \`file1start\`, \`file1end\`).
    *   Dates MUST be kept in the original API format (e.g., \`20240522T000000000Z\` or \`20240522\`).
    *   Duration should be just the number (e.g., \`durationdays15\` becomes \`file2duration15\`).

**EXAMPLES:**

---
**Example 1 (File Header with Task Data):**
*Input:* \`File 1 5b8dd7f843f54b15877b10cd12faa857removed 1pdf File 2 d76a1522e6d741f99d2f3e134c8be500removed 1pdf Tasks with an earlier deadline in the newer file 43 0 tasknameFaste gipslofter file1end20240522T000000000Z file2end20220324T000000000Z diffdays790\`

*Your Correct Output:* \`File 1 5b8dd7f843f54b15877b10cd12faa857removed.pdf File 2 d76a1522e6d741f99d2f3e134c8be500removed.pdf 0 uniqueid0 tasknameFastegipslofter file1end20240522T000000000Z file2end20220324T000000000Z\`

---
**Example 2 (New Tasks - Map to file2):**
*Input:* \`File 1 a.pdf File 2 b.pdf New tasks... 0 uniqueid9880 tasknameT1 startdate20220301T000000000Z durationdays15\`

*Your Correct Output:* \`File 1 a.pdf File 2 b.pdf 0 uniqueid9880 tasknameT1 file2start20220301T000000000Z file2duration15\`

---
**Example 3 (Changed Tasks with Both Files):**
*Input:* \`File 1 oldfile.pdf File 2 newfile.pdf Tasks with earlier deadlines... 0 uniqueid9881 tasknameT2 file1end20240522T000000000Z file2end20220324T000000000Z\`

*Your Correct Output:* \`File 1 oldfile.pdf File 2 newfile.pdf 0 uniqueid9881 tasknameT2 file1end20240522T000000000Z file2end20220324T000000000Z\`

---
**Example 4 (Informational Summary - PASS THROUGH):**
*Input:* \`File 1 a.pdf File 2 b.pdf Summary of changed tasks 1 0 changedtotal43\`

*Your Correct Output:* \`PASS_THROUGH: File 1 a.pdf File 2 b.pdf Summary of changed tasks 1 0 changedtotal43\`

---
**Example 5 (Missing 'uniqueid' - Generate It):**
*Input:* \`File 1 R20230502O20230502.pdf File 2 R20240115O20240122.pdf 0 tasknameFaste gipslofter file1start20240515T000000000Z file2start20220318T000000000Z 1 tasknameFlisebejder file1start20240117T000000000Z file2start20240408T000000000Z\`

*Your Correct Output:* \`File 1 R20230502O20230502.pdf File 2 R20240115O20240122.pdf 0 uniqueid0 tasknameFastegipslofter file1start20240515T000000000Z file2start20220318T000000000Z 1 uniqueid1 tasknameFlisebejder file1start20240117T000000000Z file2start20240408T000000000Z\`

---
**Example 6 (Conversational Text + Table Data - CRITICAL):**
*Input:* \`Here are some tasks with T in their name 0 uniqueid9617 tasknameFacadelukning tkonstruktion startdate20230504T000000000Z enddate20230508T000000000Z durationdays2 1 uniqueid9705 tasknameStbning af undergulv startdate20230717T000000000Z enddate20230728T000000000Z durationdays10\`

*Your Correct Output:* \`File 1 unknown.pdf File 2 unknown.pdf 0 uniqueid9617 tasknameFacadelukningtkonstruktion file2start20230504T000000000Z file2end20230508T000000000Z file2duration2 1 uniqueid9705 tasknameStbningafundergulv file2start20230717T000000000Z file2end20230728T000000000Z file2duration10\`

**Explanation:** Conversational prefix "Here are some tasks..." is IGNORED. Table data detected (has uniqueid, taskname, rows). Since no File 1/File 2 mentioned, use "unknown.pdf". Map startdate/enddate to file2 fields.

---
**Example 7 (File Names in Conversational Response):**
*Input:* \`File 1 Holm 8 NK R20230710.pdf File 2 Holm 8 NK R20230802.pdf Removed tasks 120 Below are tasks removed 0 uniqueid1 tasknameNK 6 ugersplan startdate20220201T000000000Z enddate20231103T000000000Z durationdays444 1 uniqueid8998 tasknameArbejder startdate20220301T000000000Z enddate20230731T000000000Z durationdays356\`

*Your Correct Output:* \`File 1 Holm8NKR20230710.pdf File 2 Holm8NKR20230802.pdf 0 uniqueid1 tasknameNK6ugersplan file1start20220201T000000000Z file1end20231103T000000000Z file1duration444 1 uniqueid8998 tasknameArbejder file1start20220301T000000000Z file1end20230731T000000000Z file1duration356\`

**Explanation:** Extract File 1 and File 2 from start. Ignore "Removed tasks 120 Below are tasks removed". Removed tasks use file1 fields.
`;

/**
 * Uses OpenAI API to normalize a raw API response into a consistent, machine-readable format
 * that our DataParser.js can understand.
 * @param {string} rawApiText - The unstructured text from the chat service API.
 * @returns {Promise<string>} - The normalized data string or a pass-through message.
 */
export const normalizeApiResponse = async (rawApiText) => {
  try {
    if (!rawApiText || rawApiText.trim().length === 0) {
      console.warn("Empty text provided to AI normalizer");
      return "PASS_THROUGH: No response from API.";
    }

    console.log("🤖 Sending to OpenAI for normalization...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: normalizationSystemPrompt,
        },
        {
          role: "user",
          content: rawApiText,
        },
      ],
      temperature: 0.0,
      max_tokens: 4000,
    });

    const normalizedContent = response.choices[0].message.content;

    if (!normalizedContent || normalizedContent.trim().length === 0) {
      console.warn(
        "OpenAI returned empty response, passing through original text.",
      );
      return `PASS_THROUGH: ${rawApiText}`;
    }

    console.log("✅ OpenAI normalization completed successfully.");
    return normalizedContent;
  } catch (error) {
    console.error("Error normalizing text with OpenAI:", error);
    console.warn("Falling back to original text due to OpenAI error");
    return `PASS_THROUGH: ${rawApiText}`;
  }
};
