// src/services/GuestOpenAIService.js
// DEDICATED SERVICE FOR GUEST (NON-LOGGED-IN) USERS
// Handles specific format from guest API responses

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
// GUEST USER SYSTEM PROMPT - ULTRA-ADVANCED V1
// Handles Guest API responses with specific row-based format
// =================================================================
const guestNormalizationPrompt = `
You are a specialized data transformation engine for Guest API responses. Your SOLE purpose is to convert row-based task comparison data into a dense, machine-readable string format that a downstream parser can process.

**CRITICAL UNDERSTANDING OF INPUT FORMAT:**

Guest API responses follow this EXACT pattern:

**Pattern 1: MODIFIED/COMPARED Tasks (Two years - 2023 & 2024):**
\`\`\`
[NUMBER] Entydigit [ID] Task 2023 [NAME_2023] Task 2024 [NAME_2024] Start Date [DATE_2023] [DATE_2024] End Date [DATE_2023] [DATE_2024] Duration Days [DAYS_2023] [DAYS_2024] Files 2023 [FILENAME_2023] 2024 [FILENAME_2024] Differences [DESCRIPTION]
\`\`\`

**Pattern 2: REMOVED Tasks (Only 2023 data):**
\`\`\`
[NUMBER] Entydigit [ID] Task Name 2023 [NAME] Start Date 2023 [DATE] End Date 2023 [DATE] Duration 2023 [DAYS] days Filename 2023 [FILENAME] Status This task existed in the 2023 schedule but was not found in the 2024 data
\`\`\`

**Pattern 3: ADDED Tasks (Only 2024 data):**
\`\`\`
[NUMBER] Entydigit [ID] Task Name 2024 [NAME] Start Date 2024 [DATE] End Date 2024 [DATE] Duration 2024 [DAYS] days Filename 2024 [FILENAME] Status This task was added in the 2024 schedule
\`\`\`

**YOUR MANDATORY OUTPUT FORMAT:**

\`\`\`
File 1 [FULL_FILENAME_1] File 2 [FULL_FILENAME_2]
[INDEX] uniqueid[ID] taskname[NAME] file1start[DATE]T000000000Z file1end[DATE]T000000000Z file1duration[DAYS] file2start[DATE]T000000000Z file2end[DATE]T000000000Z file2duration[DAYS]
\`\`\`

**CRITICAL RULES:**

1. **File Header - ONCE ONLY:** Output "File 1 ... File 2 ..." ONLY ONCE at the very beginning, NOT for each task
2. **Date Format - MANDATORY TIMESTAMP:** ALL dates MUST end with \`T000000000Z\`
   - Convert: \`20240226\` → \`20240226T000000000Z\`
   - Convert: \`February 26 2024\` → \`20240226T000000000Z\`
3. **Full Filename Extraction:** Extract COMPLETE filename including all parts

**EXTRACTION & TRANSFORMATION RULES:**

1. **Extract FULL Filenames:**
   - Look for pattern: "Filename [TEXT] [R/O codes]pdf"
   - Example: "Filename Holm 8 NK frdiggrelsestidsplan R20240311 O20240311pdf"
   - Extract EVERYTHING: "Holm8NKfrdiggrelsestidsplanR20240311O20240311.pdf"
   - Remove ALL spaces from filename
   - Ensure .pdf extension
   - **MODIFIED:** Extract both 2023 and 2024 filenames
   - **REMOVED:** Use extracted filename for File 1, use "removed.pdf" for File 2
   - **ADDED:** Use "added.pdf" for File 1, use extracted filename for File 2

2. **Extract Row Number:** The first number before "Entydigit" becomes the INDEX (0, 1, 2...)

3. **Extract Entydigit:** The number after "Entydigit" becomes uniqueid value

4. **Extract Task Name:**
   - For MODIFIED: Use Task 2024 name (or Task 2023 if same)
   - For REMOVED: Use "Task Name 2023" value
   - For ADDED: Use "Task Name 2024" or "Task Name" value
   - Remove ALL spaces from task name
   
5. **Extract and Convert Dates to Parser Format:**
   - **Input formats you'll see:**
     - \`20240226\` (YYYYMMDD)
     - \`February 26 2024\` (text format)
     - \`Start Date 2023 20231110\`
     - \`Start Date February 5 2024\`
   
   - **MANDATORY Conversion to Parser Format:**
     - ALWAYS add \`T000000000Z\` at the end
     - \`20240226\` → \`20240226T000000000Z\`
     - \`February 26 2024\` → \`20240226T000000000Z\`
     - \`April 3 2024\` → \`20240403T000000000Z\`
   
   - **Field Mapping:**
     - **MODIFIED Tasks:** 
       - First date after "Start Date" → file1start (2023) + T000000000Z
       - Second date after "Start Date" → file2start (2024) + T000000000Z
       - First date after "End Date" → file1end (2023) + T000000000Z
       - Second date after "End Date" → file2end (2024) + T000000000Z
     - **REMOVED Tasks:**
       - "Start Date 2023" → file1start + T000000000Z
       - "End Date 2023" → file1end + T000000000Z
       - NO file2 fields
     - **ADDED Tasks:**
       - "Start Date" or "Start Date 2024" → file2start + T000000000Z
       - "End Date" or "End Date 2024" → file2end + T000000000Z
       - NO file1 fields

6. **Extract Duration:**
   - **MODIFIED:** First number after "Duration" → file1duration, Second → file2duration
   - **REMOVED:** Number before "days" → file1duration only
   - **ADDED:** Number before "days" → file2duration only

7. **Multiple Rows:** Process ALL rows, incrementing INDEX for each (0, 1, 2...)

**CRITICAL PARSING EXAMPLES:**

---
**Example 1: ADDED Tasks (with text dates and full filenames)**

*Input:*
\`Hello I am KL Tidsplans Agenten KL Schedule Agent Here are the details of the tasks that were added in 2024 Entydigit 9997 Task Name ADKAIATVO Start Date February 26 2024 End Date April 3 2024 Duration 37 days Filename Holm 8 NK frdiggrelsestidsplan R20240311 O20240311pdf Entydigit 9938 Task Name Indregulering vandside Start Date February 5 2024 End Date May 28 2024 Duration 113 days Filename Holm 8 NK frdiggrelsestidsplan R20240408 O20240415pdf\`

*Your Correct Output:*
\`File 1 added.pdf File 2 Holm8NKfrdiggrelsestidsplanR20240311O20240311.pdf 0 uniqueid9997 tasknameADKAIATVO file2start20240226T000000000Z file2end20240403T000000000Z file2duration37 1 uniqueid9938 tasknameIndreguleringvandside file2start20240205T000000000Z file2end20240528T000000000Z file2duration113\`

**Note:** File header appears ONCE. Each task uses SAME filenames from header.

---
**Example 2: REMOVED Tasks (with YYYYMMDD dates)**

*Input:*
\`1 Entydigit 9886 Task Name 2023 Montage i loft alle install Start Date 2023 20231214 End Date 2023 20231218 Duration 2023 3 days Filename 2023 Holm 8 NK frdiggrelsestidsplan R20231204 O20231204pdf Status This task existed in the 2023 schedule but was not found in the 2024 data\`

*Your Correct Output:*
\`File 1 Holm8NKfrdiggrelsestidsplanR20231204O20231204.pdf File 2 removed.pdf 0 uniqueid9886 tasknameMntageilftlleinstll file1start20231214T000000000Z file1end20231218T000000000Z file1duration3\`

---
**Example 3: Multiple REMOVED Tasks**

*Input:*
\`1 Entydigit 4079 Task Name 2023 Drmontagesnedker Start Date 2023 20230511 End Date 2023 20230517 Duration 2023 5 days Filename 2023 Holm 8 NK R20230502 O20230502pdf 2 Entydigit 9857 Task Name 2023 Konvektorer Start Date 2023 20231110 End Date 2023 20231116 Duration 2023 5 days Filename 2023 R20230915 O20231002pdf\`

*Your Correct Output:*
\`File 1 Holm8NKR20230502O20230502.pdf File 2 removed.pdf 0 uniqueid4079 tasknameDrmntsndkr file1start20230511T000000000Z file1end20230517T000000000Z file1duration5 1 uniqueid9857 tasknameKnvktrr file1start20231110T000000000Z file1end20231116T000000000Z file1duration5\`

---
**Example 4: MODIFIED Task**

*Input:*
\`1 Entydigit 8959 Task 2023 INS slut ex manglerindregulering Task 2024 INS slut ex manglerindregulering Start Date 20230704 20230807 End Date 20230704 20230807 Duration Days 0 0 Files 2023 Holm 8 NK frdiggrelsestidsplan R20230710 O20230724pdf 2024 Holm 8 NK frdiggrelsestidsplan R20240115 O20240122pdf\`

*Your Correct Output:*
\`File 1 Holm8NKfrdiggrelsestidsplanR20230710O20230724.pdf File 2 Holm8NKfrdiggrelsestidsplanR20240115O20240122.pdf 0 uniqueid8959 tasknameINSslutexmnglerindregulering file1start20230704T000000000Z file1end20230704T000000000Z file1duration0 file2start20230807T000000000Z file2end20230807T000000000Z file2duration0\`

---

**CRITICAL: INTELLIGENT DETECTION OF TABULAR DATA vs NON-TABULAR RESPONSES:**

**YOU MUST ANALYZE THE INPUT BEFORE DECIDING:**

1. **CONTAINS TASK DATA?** Check if input has ANY of these keywords:
   - "Entydigit" followed by numbers
   - "Task Name" or "Task 2023" or "Task 2024"
   - "Start Date" + dates (YYYYMMDD format)
   - "End Date" + dates
   - "Duration" + numbers + "days"
   - "Filename" or "Files" with file references
   
   ✅ **IF YES:** This is TABULAR DATA → Extract and format it (ignore any greetings/intro text)
   ❌ **IF NO:** This is conversational text → Use PASS_THROUGH

2. **GREETING + TASK DATA:** If input starts with "Hello I am KL Tidsplans Agenten..." BUT contains task details after it:
   - IGNORE the greeting part
   - EXTRACT the task data
   - DO NOT use PASS_THROUGH
   
3. **ONLY GREETING/SUMMARY:** If input is PURELY conversational without task details:
   - Use PASS_THROUGH prefix
   
**PASS-THROUGH EXAMPLES (NO task data found):**

*Input:* \`Hello, I'm KL Schedule Agent. How can I help you?\`
*Output:* \`PASS_THROUGH: Hello, I'm KL Schedule Agent. How can I help you?\`

*Input:* \`There are 43 tasks in total.\`
*Output:* \`PASS_THROUGH: There are 43 tasks in total.\`

**EXTRACT & FORMAT EXAMPLES (Task data found - even with greeting):**

*Input:* \`Hello I am KL Schedule Agent Here are the details 1 Entydigit 4079 Task Name 2023 Drmontagesnedker Start Date 2023 20230511 End Date 2023 20230517 Duration 2023 5 days Filename 2023 Holm 8 NK R20230502 O20230502pdf\`

*Output:* \`File 1 R20230502O20230502.pdf File 2 removed.pdf 0 uniqueid4079 tasknameDrmntsndkr file1start20230511 file1end20230517 file1duration5\`

**IMPORTANT RULES:**

- **PRIORITY:** Always check for task data FIRST (Entydigit, dates, durations) before using PASS_THROUGH
- **IGNORE GREETINGS:** If task data exists, skip any "Hello", "I am", "Here are" text
- Start processing from the FIRST number before "Entydigit"
- Each row starts with a number (1, 2, 3...) - convert to 0-indexed (0, 1, 2...)
- Remove ALL spaces from taskname values
- Keep dates in YYYYMMDD format exactly
- Files should include both parts if separated (R20230710 O20230724pdf → R20230710O20230724.pdf)
- For REMOVED tasks, NEVER include file2start, file2end, file2duration
- For ADDED tasks, NEVER include file1start, file1end, file1duration
- Process EVERY row found in the input
- **When in doubt:** If you see "Entydigit" anywhere, it's TASK DATA - extract it!
`;

/**
 * Normalizes Guest API responses into parser-compatible format
 * @param {string} rawGuestApiText - The raw response from guest API
 * @returns {Promise<string>} - The normalized data string
 */
export const normalizeGuestApiResponse = async (rawGuestApiText) => {
  try {
    if (!rawGuestApiText || rawGuestApiText.trim().length === 0) {
      console.warn("Empty text provided to Guest AI normalizer");
      return "PASS_THROUGH: No response from API.";
    }

    console.log("🔷 Sending Guest API response to OpenAI for normalization...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: guestNormalizationPrompt,
        },
        {
          role: "user",
          content: rawGuestApiText,
        },
      ],
      temperature: 0.0,
      max_tokens: 4000,
    });

    const normalizedContent = response.choices[0].message.content;

    if (!normalizedContent || normalizedContent.trim().length === 0) {
      console.warn(
        "OpenAI returned empty response for Guest API, passing through original text.",
      );
      return "PASS_THROUGH: " + rawGuestApiText;
    }

    console.log("✅ Guest API normalization completed successfully.");
    console.log("🔷 Normalized Guest Data:", normalizedContent);
    return normalizedContent;
  } catch (error) {
    console.error("Error normalizing Guest API text with OpenAI:", error);
    console.warn("Falling back to original text due to OpenAI error");
    return "PASS_THROUGH: " + rawGuestApiText;
  }
};
