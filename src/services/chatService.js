// src/services/chatService.js

import axios from "axios";
import { handleApiError } from "../utils/errorHandler.js";
import { getApiBaseUrl } from "../utils/apiConfig.js";

axios.defaults.timeout = 0;
axios.defaults.maxRedirects = 10;

export const AGENT_BASE_URL = "https://nova-azure-ai-rag-agent-fork.replit.app";

class ChatService {
  generateSessionId() {
    const randomHex = Array.from({ length: 20 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
    const sessionId = `session_${randomHex}`;
    console.log("🔑 Generated session ID:", sessionId);
    return sessionId;
  }

  generateTableSessionId(prefix) {
    const randomHex = Array.from({ length: 10 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
    const timestamp = Date.now().toString(36);
    return `table_${prefix}_${timestamp}_${randomHex}`;
  }

  async uploadFilesWithSession(oldScheduleFile, newScheduleFile, sessionId) {
    const backendUrl = getApiBaseUrl();
    const uploadUrl = `${backendUrl}/api/chat/proxy/upload`;

    try {
      console.log("📤 Uploading files via backend proxy...");
      console.log("📄 Old schedule:", oldScheduleFile.name);
      console.log("📄 New schedule:", newScheduleFile.name);
      console.log("🔑 Main Session ID:", sessionId);

      const oldSessionId = this.generateTableSessionId("old");
      const newSessionId = this.generateTableSessionId("new");

      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("old_session_id", oldSessionId);
      formData.append("old_schedule", oldScheduleFile);
      formData.append("new_session_id", newSessionId);
      formData.append("new_schedule", newScheduleFile);

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("📥 Upload response:", data);

      if (data.upload_id) {
        return {
          success: false,
          isAsyncUpload: true,
          uploadId: data.upload_id,
          sessionId,
          oldSessionId,
          newSessionId,
        };
      }

      return {
        success: true,
        sessionId,
        oldSessionId,
        newSessionId,
        response: data,
      };
    } catch (error) {
      console.error("❌ File upload error:", error);
      await handleApiError(error, {
        endpoint: uploadUrl,
        method: "POST",
      });
      throw new Error(error.message || "Failed to upload files");
    }
  }

  pollUploadProgress(uploadId, onProgress, onComplete, onError, onPollError) {
    const backendUrl = getApiBaseUrl();
    const PROGRESS_URL = `${backendUrl}/api/chat/proxy/upload/progress/${uploadId}`;
    let attempts = 0;
    const maxAttempts = 180; // 6 minutes at 2s intervals
    let consecutiveErrors = 0;
    let timerId = null;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(PROGRESS_URL, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`📊 Poll [${attempts + 1}]:`, JSON.stringify(data));

        consecutiveErrors = 0;
        onProgress(data);

        if (data.status === "complete") {
          onComplete(data);
          return;
        } else if (data.status === "failed" || data.status === "error") {
          onError(new Error(data.message || "Upload processing failed"));
          return;
        }
      } catch (err) {
        consecutiveErrors++;
        console.warn(
          `📊 Poll error [${attempts + 1}] (${consecutiveErrors} consecutive):`,
          err.message,
        );
        if (onPollError) onPollError(err, consecutiveErrors);
      }

      attempts++;
      if (attempts < maxAttempts) {
        timerId = setTimeout(poll, 2000);
      } else {
        onError(new Error("Upload timed out after 6 minutes"));
      }
    };

    // Start first poll immediately — no need to wait
    timerId = setTimeout(poll, 500);
    return () => {
      stopped = true;
      if (timerId) clearTimeout(timerId);
    };
  }

  async sendFollowUpQuery(
    question,
    sessionId,
    tableSessionIds = {},
    language = "da",
  ) {
    const backendUrl = getApiBaseUrl();
    const proxyUrl = `${backendUrl}/api/chat/proxy/query`;

    try {
      console.log(
        `🌐 Sending query via backend proxy (5-min timeout, no retry)...`,
      );
      console.log(`📝 Question: ${question}`);
      console.log(`🔑 Session ID (vs_table): ${sessionId}`);
      console.log(
        `🔑 Old Session ID: ${tableSessionIds.oldSessionId || "not set"}`,
      );
      console.log(
        `🔑 New Session ID: ${tableSessionIds.newSessionId || "not set"}`,
      );
      console.log(`🌍 Language: ${language}`);

      const formData = new FormData();
      formData.append("query", question);
      formData.append("vs_table", sessionId);
      formData.append("language", language);
      formData.append("old_session_id", tableSessionIds.oldSessionId || "none");
      formData.append("new_session_id", tableSessionIds.newSessionId || "none");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 330000);

      const response = await fetch(proxyUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
        credentials: "include",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Query response raw data:", data);
      console.log("✅ data.response exists:", !!data.response);
      console.log("✅ data.format:", data.format);

      const htmlContent = data.response || data.output || "";
      const hasHtmlTags = htmlContent && /<\s*\/?\w+[^>]*>/.test(htmlContent);
      const isHtml =
        data.format === "html" || data.isHtmlTable === true || hasHtmlTags;

      console.log("✅ Mapped htmlContent length:", htmlContent.length);
      console.log("✅ Mapped isHtml:", isHtml);

      const result = {
        output: htmlContent,
        isHtmlTable: isHtml,
        tableCount: data.tableCount || (data.sources ? data.sources.length : 0),
        originalOutput: data.originalOutput || htmlContent,
        sources: data.sources || [],
        contextChunks: data.context_chunks || 0,
        predictiveInsights: data.predictive_insights || null,
        predictiveStatus: data.predictive_status || null,
        _metadata: {
          apiUrl: proxyUrl,
          isFollowUp: true,
          format: data.format || "html",
        },
      };

      console.log("✅ Final mapped result:", {
        ...result,
        output: result.output.substring(0, 100) + "...",
      });
      console.log(
        "🔮 Predictive status:",
        result.predictiveStatus,
        "| Has insights:",
        !!result.predictiveInsights,
      );
      return result;
    } catch (error) {
      console.error(
        "❌ Query error (no retry - prevents duplicate Azure charges):",
        error,
      );

      await handleApiError(error, {
        endpoint: proxyUrl,
        method: "POST",
      });

      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        throw new Error(
          "The query timed out after 5 minutes. The server may still be processing — please wait a moment before trying again.",
        );
      }

      throw new Error(error.message || "Failed to send query");
    }
  }

  async saveMessageToDatabase(
    sessionId,
    senderType,
    content,
    contentType = "text",
    isHtml = false,
    metadata = {},
    retries = 2,
  ) {
    const { getApiBaseUrl } = await import("../utils/apiConfig.js");
    const backendUrl = getApiBaseUrl();

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(
          `${backendUrl}/api/chat/sessions/${sessionId}/messages`,
          {
            senderType,
            content,
            contentType,
            isHtml,
            metadata,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
            withCredentials: true,
          },
        );

        console.log("💾 Message saved to database:", response.data);
        return response.data;
      } catch (error) {
        console.error(
          `❌ Failed to save message (attempt ${attempt + 1}/${retries + 1}):`,
          error?.message || error,
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    console.error(
      "❌ All save attempts failed for message in session:",
      sessionId,
    );
    return null;
  }

  async downloadSessionPdf(sessionId, language = "da") {
    try {
      console.log("📄 Downloading session PDF...", sessionId);

      const backendUrl = getApiBaseUrl();
      console.log("📄 Using backend URL for session PDF:", backendUrl);
      const response = await fetch(
        `${backendUrl}/api/chat/sessions/${sessionId}/pdf?lang=${language}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate PDF: ${errorText}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `chat_${sessionId}.pdf`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log("✅ Session PDF downloaded successfully:", filename);
      return true;
    } catch (error) {
      console.error("❌ Error downloading session PDF:", error);
      throw error;
    }
  }

  async downloadMessagePdf(sessionId, messageId, language = "da") {
    try {
      console.log("📄 Downloading message PDF...", sessionId, messageId);

      const backendUrl = getApiBaseUrl();
      console.log("📄 Using backend URL for message PDF:", backendUrl);
      const response = await fetch(
        `${backendUrl}/api/chat/sessions/${sessionId}/messages/${messageId}/pdf?lang=${language}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate PDF: ${errorText}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `message_${messageId}.pdf`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log("✅ Message PDF downloaded successfully:", filename);
      return true;
    } catch (error) {
      console.error("❌ Error downloading message PDF:", error);
      throw error;
    }
  }
}

export const chatService = new ChatService();
