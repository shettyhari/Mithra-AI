import { db } from "@workspace/db";
import { aiKeysTable, aiConfigTable, tasksTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  imageUrl?: string;
}

const REASONING_INSTRUCTION =
  "Before answering, think through the problem step by step inside <think></think> tags. " +
  "After the closing </think> tag, give your final answer as normal — do not repeat the reasoning there. " +
  "Always include both the <think>...</think> block and the final answer.";

function isVisionCapable(modelId: string): boolean {
  return /^(gpt-4o|gpt-4-turbo|claude-3-5|claude-3-opus|gemini-1\.5)/.test(modelId);
}

// Build the provider-specific "content" value for a message, embedding an
// image as a multi-part payload when present and the model supports vision.
function buildOpenAiContent(msg: ChatMessage, modelId: string): string | Array<Record<string, unknown>> {
  if (!msg.imageUrl || !isVisionCapable(modelId)) return msg.content;
  return [
    { type: "text", text: msg.content || "What's in this image?" },
    { type: "image_url", image_url: { url: msg.imageUrl } },
  ];
}

function dataUrlToAnthropicSource(dataUrl: string): { type: "base64"; media_type: string; data: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { type: "base64", media_type: match[1], data: match[2] };
}

export interface AiResponse {
  content: string;
  tokensUsed: number;
  model: string;
  toolCalls?: ToolCallResult[];
}

export interface ToolCallResult {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

// Available models definition
export const AVAILABLE_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", contextWindow: 128000, description: "Most capable OpenAI model" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", contextWindow: 128000, description: "Fast and affordable OpenAI model" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", contextWindow: 16385, description: "Fast OpenAI model" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "anthropic", contextWindow: 200000, description: "Anthropic's best model" },
  { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", provider: "anthropic", contextWindow: 200000, description: "Fast Anthropic model" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "gemini", contextWindow: 1000000, description: "Google's most capable model" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "gemini", contextWindow: 1000000, description: "Fast Google model" },
  { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", provider: "groq", contextWindow: 131072, description: "Fast open-source model via Groq" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "groq", contextWindow: 32768, description: "Mixtral model via Groq" },
];

// Agent tools definition (OpenAI function calling format)
export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task for the user. Use when the user asks to add a task, reminder, or to-do.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Optional task description" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
          dueDate: { type: "string", description: "Due date in YYYY-MM-DD format, optional" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information. Use for facts, news, or anything that needs up-to-date data.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a notification/reminder for the user.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Reminder title" },
          body: { type: "string", description: "Reminder details" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_and_summarize",
      description: "Analyze a topic in depth and provide a structured summary with key points.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Topic to analyze" },
          format: { type: "string", enum: ["bullet_points", "paragraphs", "numbered_list"], description: "Output format" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_plan",
      description: "Generate a step-by-step action plan for achieving a goal.",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string", description: "The goal to plan for" },
          timeframe: { type: "string", description: "Optional timeframe (e.g., '1 week', '3 months')" },
        },
        required: ["goal"],
      },
    },
  },
];

export function getProviderForModel(modelId: string): string {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId);
  return model?.provider ?? "openai";
}

export async function getDecryptedKey(provider: string): Promise<string | null> {
  const [row] = await db.select().from(aiKeysTable).where(eq(aiKeysTable.provider, provider));
  if (!row || !row.encryptedKey) return null;
  try {
    return Buffer.from(row.encryptedKey, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

// Execute agent tool calls server-side
async function executeTool(name: string, args: Record<string, unknown>, userId: number): Promise<string> {
  switch (name) {
    case "create_task": {
      const [task] = await db.insert(tasksTable).values({
        userId,
        title: args.title as string,
        description: args.description as string | undefined,
        priority: (args.priority as string) || "medium",
        dueDate: args.dueDate as string | undefined,
        status: "todo",
      }).returning();
      return `Task created successfully: "${task.title}" (ID: ${task.id}, priority: ${task.priority})`;
    }

    case "web_search": {
      const query = args.query as string;
      try {
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json() as {
          Abstract?: string;
          AbstractText?: string;
          RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        };
        const abstract = data.Abstract || data.AbstractText || "";
        const related = data.RelatedTopics?.slice(0, 3).map((t) => t.Text || "").filter(Boolean).join("; ") || "";
        if (abstract) return `Search results for "${query}": ${abstract}. Related: ${related}`;
        if (related) return `Search results for "${query}": ${related}`;
        return `No direct results found for "${query}". The query may need more specificity.`;
      } catch {
        return `Web search for "${query}" encountered an error. Please try rephrasing.`;
      }
    }

    case "create_reminder": {
      const [notif] = await db.insert(notificationsTable).values({
        userId,
        type: "system",
        title: args.title as string,
        body: args.body as string | undefined,
        fromUserId: null,
        isRead: false,
      }).returning();
      return `Reminder created: "${notif.title}"`;
    }

    case "analyze_and_summarize": {
      // This tool is handled by the AI itself — return a signal
      return `Analyzing topic: "${args.topic}". Format: ${args.format || "paragraphs"}.`;
    }

    case "generate_plan": {
      return `Generating action plan for: "${args.goal}"${args.timeframe ? ` (timeframe: ${args.timeframe})` : ""}.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export async function callAi(
  messages: ChatMessage[],
  modelId: string,
  temperature: number,
  maxTokens: number,
  systemPrompt?: string | null,
  agentMode = false,
  userId?: number,
  reasoningMode = false,
): Promise<AiResponse> {
  const provider = getProviderForModel(modelId);
  const apiKey = await getDecryptedKey(provider);

  const effectiveSystemPrompt = [systemPrompt, reasoningMode ? REASONING_INSTRUCTION : null]
    .filter(Boolean)
    .join("\n\n");

  const allMessages: ChatMessage[] = [];
  if (effectiveSystemPrompt) {
    allMessages.push({ role: "system", content: effectiveSystemPrompt });
  }
  allMessages.push(...messages);

  const toolCalls: ToolCallResult[] = [];

  // OpenAI-compatible providers (openai, groq, openrouter)
  if (provider === "openai" || provider === "groq" || provider === "openrouter") {
    const baseURL = provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : "https://api.openai.com/v1";

    // Fall back to Replit's managed AI Integrations proxy for OpenAI when no
    // admin-configured key exists, so chat works out of the box without
    // requiring the user to bring their own API key.
    const useManagedOpenAi = provider === "openai" && !apiKey && !process.env.OPENAI_API_KEY
      && !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const effectiveBaseURL = useManagedOpenAi ? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL! : baseURL;
    const key = useManagedOpenAi ? process.env.AI_INTEGRATIONS_OPENAI_API_KEY! : (apiKey || process.env.OPENAI_API_KEY);
    if (!key) {
      return {
        content: "No API key configured for this provider. Please ask your admin to set up AI keys in the admin panel.",
        tokensUsed: 0,
        model: modelId,
      };
    }

    const body: Record<string, unknown> = {
      model: modelId,
      messages: allMessages.map(m => ({ role: m.role, content: buildOpenAiContent(m, modelId) })),
      temperature,
      max_tokens: maxTokens,
    };

    // Add tools for agent mode (only OpenAI supports this well)
    if (agentMode && provider === "openai" && userId) {
      body.tools = AGENT_TOOLS;
      body.tool_choice = "auto";
    }

    const response = await fetch(`${effectiveBaseURL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage?: { total_tokens?: number };
    };

    let finalContent = data.choices[0]?.message?.content ?? "";
    let totalTokens = data.usage?.total_tokens ?? 0;

    // Handle tool calls (agentic loop — max 3 iterations)
    if (agentMode && userId && data.choices[0]?.message?.tool_calls?.length) {
      let currentMessages = [...allMessages];
      let iterations = 0;
      let currentData = data;

      while (currentData.choices[0]?.message?.tool_calls?.length && iterations < 3) {
        const assistantMsg = currentData.choices[0].message;
        currentMessages.push({ role: "assistant", content: assistantMsg.content ?? "" });

        // Execute all tool calls in this turn
        for (const tc of assistantMsg.tool_calls ?? []) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch {}

          const result = await executeTool(tc.function.name, args, userId);
          toolCalls.push({ name: tc.function.name, args, result });

          currentMessages.push({
            role: "tool" as const,
            tool_call_id: tc.id,
            name: tc.function.name,
            content: result,
          });
        }

        // Get next response
        const nextResponse = await fetch(`${effectiveBaseURL}/chat/completions`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            messages: currentMessages,
            temperature,
            max_tokens: maxTokens,
            tools: AGENT_TOOLS,
            tool_choice: "auto",
          }),
        });

        if (!nextResponse.ok) break;
        currentData = await nextResponse.json() as typeof data;
        totalTokens += currentData.usage?.total_tokens ?? 0;
        iterations++;
      }

      finalContent = currentData.choices[0]?.message?.content ?? finalContent;
    }

    return { content: finalContent, tokensUsed: totalTokens, model: modelId, toolCalls };
  }

  // Anthropic
  if (provider === "anthropic") {
    const key = apiKey;
    if (!key) {
      return { content: "No Anthropic API key configured.", tokensUsed: 0, model: modelId };
    }

    const systemMsg = allMessages.find(m => m.role === "system");
    const chatMessages = allMessages.filter(m => m.role !== "system").map(m => {
      if (m.imageUrl && isVisionCapable(modelId)) {
        const source = dataUrlToAnthropicSource(m.imageUrl);
        if (source) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content || "What's in this image?" },
              { type: "image", source },
            ],
          };
        }
      }
      return { role: m.role, content: m.content };
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, system: systemMsg?.content, messages: chatMessages }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    return {
      content: data.content[0]?.text ?? "",
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      model: modelId,
    };
  }

  // Gemini
  if (provider === "gemini") {
    const key = apiKey;
    if (!key) {
      return { content: "No Gemini API key configured.", tokensUsed: 0, model: modelId };
    }

    const geminiMessages = allMessages
      .filter(m => m.role !== "system")
      .map(m => {
        const parts: Array<Record<string, unknown>> = [{ text: m.content }];
        if (m.imageUrl && isVisionCapable(modelId)) {
          const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(m.imageUrl);
          if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
        return { role: m.role === "assistant" ? "model" : "user", parts };
      });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: geminiMessages }) }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata?: { totalTokenCount?: number };
    };

    return {
      content: data.candidates[0]?.content?.parts[0]?.text ?? "",
      tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
      model: modelId,
    };
  }

  return { content: "Unknown provider.", tokensUsed: 0, model: modelId };
}

// Streaming variant used by the SSE chat endpoint. OpenAI-compatible
// providers (openai/groq/openrouter) stream token-by-token via SSE deltas;
// Anthropic/Gemini fall back to a single non-streamed chunk (still delivered
// through the same onDelta callback so the caller doesn't need to branch).
export async function callAiStream(
  messages: ChatMessage[],
  modelId: string,
  temperature: number,
  maxTokens: number,
  systemPrompt: string | null | undefined,
  reasoningMode: boolean,
  onDelta: (delta: string) => void,
): Promise<{ content: string; tokensUsed: number }> {
  const provider = getProviderForModel(modelId);
  const apiKey = await getDecryptedKey(provider);

  const effectiveSystemPrompt = [systemPrompt, reasoningMode ? REASONING_INSTRUCTION : null]
    .filter(Boolean)
    .join("\n\n");

  const allMessages: ChatMessage[] = [];
  if (effectiveSystemPrompt) {
    allMessages.push({ role: "system", content: effectiveSystemPrompt });
  }
  allMessages.push(...messages);

  if (provider === "openai" || provider === "groq" || provider === "openrouter") {
    const baseURL = provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : "https://api.openai.com/v1";
    const useManagedOpenAi = provider === "openai" && !apiKey && !process.env.OPENAI_API_KEY
      && !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const effectiveBaseURL = useManagedOpenAi ? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL! : baseURL;
    const key = useManagedOpenAi ? process.env.AI_INTEGRATIONS_OPENAI_API_KEY! : (apiKey || process.env.OPENAI_API_KEY);
    if (!key) {
      const msg = "No API key configured for this provider. Please ask your admin to set up AI keys in the admin panel.";
      onDelta(msg);
      return { content: msg, tokensUsed: 0 };
    }

    const response = await fetch(`${effectiveBaseURL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: allMessages.map(m => ({ role: m.role, content: buildOpenAiContent(m, modelId) })),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = response.body ? await response.text() : "no response body";
      throw new Error(`AI API error: ${response.status} ${errorText}`);
    }

    let fullContent = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            onDelta(delta);
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }

    // Rough token estimate since usage isn't reported per-chunk in streaming mode.
    const tokensUsed = Math.ceil(fullContent.length / 4);
    return { content: fullContent, tokensUsed };
  }

  // Anthropic / Gemini: no incremental streaming implemented yet — deliver
  // the full response as a single delta so the UI still renders it.
  const result = await callAi(messages, modelId, temperature, maxTokens, systemPrompt, false, undefined, reasoningMode);
  onDelta(result.content);
  return { content: result.content, tokensUsed: result.tokensUsed };
}
