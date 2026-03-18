import OpenAI from "openai";
import { HfInference } from "@huggingface/inference";
import { getSettings } from "../config/loader.js";

let openaiClient = null;
let hfClient = null;

function getOpenAI() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is required");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getHuggingFace() {
  if (!hfClient) {
    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) throw new Error("HF_API_KEY environment variable is required for HuggingFace inference");
    hfClient = new HfInference(apiKey);
  }
  return hfClient;
}

export async function routeLLMRequest(taskType, prompt) {
  const settings = getSettings();
  const { openai: openaiConfig, huggingface: hfConfig } = settings.llm;

  if (openaiConfig.complexTaskTypes.includes(taskType)) {
    return callOpenAI(prompt, openaiConfig.model);
  }

  if (hfConfig.simpleTaskTypes.includes(taskType)) {
    try {
      return await callHuggingFace(prompt, hfConfig.model);
    } catch (error) {
      console.warn(`HuggingFace fallback failed, using OpenAI: ${error.message}`);
      return callOpenAI(prompt, openaiConfig.model);
    }
  }

  // Default to OpenAI for unknown types
  return callOpenAI(prompt, openaiConfig.model);
}

async function callOpenAI(prompt, model) {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 4096,
  });
  return response.choices[0].message.content;
}

async function callHuggingFace(prompt, model) {
  const client = getHuggingFace();
  const response = await client.textGeneration({
    model,
    inputs: prompt,
    parameters: {
      max_new_tokens: 4096,
      temperature: 0.2,
      return_full_text: false,
    },
  });
  return response.generated_text;
}
