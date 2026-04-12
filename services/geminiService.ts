import { ChatMessage } from '../types';

// ==========================================
// CONFIGURATION
// ==========================================
const PROVIDERS = {
  // Provider for LongCat
  LONGCAT: {
    BASE_URL: 'https://api.longcat.chat/openai/v1',
    API_KEY: 'ak_2zM3d753H9mC79I7Je0so8dl56U6E', // 请在此处填入您的 LongCat API Key
  }
};

const DEFAULT_MODEL = 'LongCat-Flash-Chat';

// System instruction updated to Chinese
const SYSTEM_INSTRUCTION = "你是一个集成在个人导航页中的智能助手。请始终使用中文回答用户的问题。回答要简洁、友好、高效。";

/**
 * Sends a message history to an OpenAI-compatible API and yields streaming text chunks.
 */
export const sendMessageStream = async function* (messages: ChatMessage[], model: string = DEFAULT_MODEL) {
  
  // Select Provider based on Model
  let activeProvider = PROVIDERS.LONGCAT; // Default to LongCat
  
  // Check if the model name starts with 'LongCat' to switch provider
  if (model.startsWith('LongCat')) {
    activeProvider = PROVIDERS.LONGCAT;
  }

  const apiKey = activeProvider.API_KEY; 
  
  // Ensure no trailing slash in base URL
  const baseUrl = activeProvider.BASE_URL.replace(/\/+$/, '');

  if (!apiKey) {
    throw new Error(`未配置 API Key (LongCat)。请在 services/geminiService.ts 中配置。`);
  }

  // Convert internal ChatMessage format to OpenAI format
  const apiMessages = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant', // Map 'model' to 'assistant'
      content: msg.text
    }))
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: apiMessages,
        stream: true,
        // Increased max_tokens or removed it to allow model default, especially for Thinking models
        // max_tokens: model === 'LongCat-Flash-Chat' ? 1000 : undefined 
      })
    });

    if (!response.ok) {
      let errorText = await response.text();
      try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error.message) {
              errorText = errorJson.error.message;
          }
      } catch (e) {
          // ignore json parse error
      }
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("No response body received");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last line in the buffer as it might be incomplete
      buffer = lines.pop() || ""; 

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // OpenAI SSE format starts with "data: " or "data:"
        // Some providers (like LongCat) might not send a space after the colon
        if (trimmed.startsWith("data:")) {
          const data = trimmed.slice(5).trim();
          
          if (data === "[DONE]") return;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            console.warn("Failed to parse SSE JSON chunk:", e);
          }
        }
      }
    }
  } catch (error) {
    console.error("Stream error:", error);
    throw error;
  }
};