// =================================================================
// N8N CODE NODE: SIMPLE PASSTHROUGH
// Just passes raw markdown to frontend - all rendering done in React
// =================================================================

const agentOutput = $input.first().json.output || $input.first().json.text || "";

// Check if this is a comparison response (has tables or structured sections)
const isComparison = agentOutput.includes('|') || 
  agentOutput.includes('## SUMMARY_OF_CHANGES') || 
  agentOutput.includes('## OPSUMMERING_AF_ÆNDRINGER') ||
  agentOutput.includes('## PROJECT_HEALTH') ||
  agentOutput.includes('## PROJEKTSUNDHED');

return [{
  json: {
    output: agentOutput,
    isComparison: isComparison,
    isHtmlTable: false  // Frontend will handle all rendering
  }
}];
