const WAAPI_CONFIG = {
  url: 'https://waapi.app/api/v1/instances/58129/client/action/send-message',
  token: import.meta.env.VITE_WAAPI_BEARER_TOKEN,
  chatId: '120363212064732206@g.us'
};

export const sendErrorAlert = async (errorDetails) => {
  try {
    const {
      endpoint = 'Unknown Endpoint',
      method = 'Unknown',
      statusCode = 'Unknown',
      errorMessage = 'No error message provided',
      errorCode = 'UNKNOWN_ERROR',
      requestId = `req_${Date.now()}`
    } = errorDetails;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const message = `🔔 *File Comparison Error Alert*

*Project:* File Comparison
*API Endpoint:* ${method} ${endpoint}
*Status Code:* ${statusCode}
*Method:* ${method}

*Error Details:*
${errorMessage}

*Error Code:* ${errorCode}
*Timestamp:* ${timestamp}
*Request ID:* ${requestId}

_Please check logs for more details_`;

    const response = await fetch(WAAPI_CONFIG.url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${WAAPI_CONFIG.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: WAAPI_CONFIG.chatId,
        message: message
      })
    });

    if (!response.ok) {
      console.error('Failed to send WAAPI error alert:', response.status);
    } else {
      console.log('✅ Error alert sent to WhatsApp');
    }
  } catch (error) {
    console.error('Error sending WAAPI alert:', error);
  }
};

export const handleApiError = async (error, apiConfig) => {
  const errorDetails = {
    endpoint: apiConfig.endpoint || 'Unknown',
    method: apiConfig.method || 'Unknown',
    statusCode: error?.response?.status || error?.status || 'Unknown',
    errorMessage: error?.response?.data?.message || error?.message || 'An unexpected error occurred',
    errorCode: error?.response?.data?.error_code || error?.code || 'UNKNOWN_ERROR',
    requestId: error?.response?.headers?.['x-request-id'] || `req_${Date.now()}`
  };

  await sendErrorAlert(errorDetails);

  return errorDetails;
};
