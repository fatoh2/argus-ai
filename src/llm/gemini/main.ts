import { GeminiClient } from './gemini.client';
import { runToolUseLoop } from './tool-use-loop';

// System prompt for the AI assistant
const systemPrompt = "You are an AI assistant for infrastructure operations. Your goal is to help manage Kubernetes clusters. You can execute tools to get information or perform actions.";

// Example usage:
async function main() {
  const apiKey = process.env.GEMINI_API_KEY; // Ensure this is set in your environment
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set.');
    process.exit(1);
  }

  const userQuery = "What is the status of the pods in the default namespace?"; // Example query
  console.log();

  try {
    const response = await runToolUseLoop(apiKey, userQuery, systemPrompt);
    console.log();
  } catch (error) {
    console.error('Error running tool use loop:', error);
  }
}

main();
