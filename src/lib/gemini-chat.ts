import axios from "axios";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PSGeminiOptions {
  apiKey: string;
  maxContext?: number; // number of chat messages to keep
  model?: string;
}

/**
 * Safety + Behavior Prompt
 * This ensures:
 * - No adult content (PG-13 safe)
 * - No impersonation of users
 * - Friendly, respectful tone
 * - Avoids hate, violence, bullying, etc.
 * - Good for public chatrooms
 * - Prompt itself is generated fro chatGPT
 */
const PRE_PROMPT = `
You are a casual, funny, slightly chaotic chat bot inside a Pokémon Showdown room.
You speak like a normal teenager or gamer: short, goofy, sarcastic, and very casual.

Rules:
- Responses must be PG-13.
- No sexual content, slurs, hate, violence, or bullying.
- Do not impersonate real users in the room.
- No NSFW chat
- You can say things like “idk lol”, “gee I dunno”, “bro that’s wild”, “lol what”.
- You can be playful, silly, unserious, mildly sarcastic, a bit sassy, but still friendly.
- If someone asks something inappropriate, refuse casually (e.g. “nah bro that’s weird 💀”).
- Keep responses short unless asked otherwise.
- No formal tone. No “As an AI…” or “I cannot…” or robotic disclaimers.
- You have a personality. You’re here to vibe, not lecture.
- Do NOT include emojis in responses, only use emoticons.
- If you are not provided enough chat messages then simply say idk i just got here lol.

Your vibe:
- Meme energy.
- PS chat energy.
- Light trolling allowed.
- Friendly + fun.
`;

export class PSGeminiChat {
  private apiKey: string;
  private model: string;
  private messages: ChatMessage[] = [];
  private maxContext: number;

  constructor(options: PSGeminiOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || "gemini-1.5-flash-latest";
    this.maxContext = options.maxContext || 20;

    // Load system prompt
    this.messages.push({ role: "system", content: PRE_PROMPT });
  }

  /**
   * Add room logs from PS rooms
   * @example p9 says hello everyone
   */
  ingestPSLogLine(line: string) {
    // Match: [21:03:03] username: message
    const chatMatch = line.match(/^\[\d\d:\d\d:\d\d\] ([^:]+): (.+)$/);

    if (chatMatch) {
      const username = chatMatch[1].trim();
      const text = chatMatch[2].trim();

      this.messages.push({
        role: "user",
        content: `${username} says: ${text}`,
      });

      this.trimContext();
    }
    // IGNORE join/leave or unrecognized lines
  }

  /**
   * Add room logs from PS rooms
   * @example p9 says hello everyone
   */
  addUserMessage(text: string) {
    this.messages.push({ role: "user", content: text });
    this.trimContext();
  }

  /**
   * Ensures the context doesn't grow too large.
   * We keep all system messages + last N chat messages.
   */
  private trimContext() {
    const systemMessages = this.messages.filter((m) => m.role === "system");
    const normalMessages = this.messages.filter((m) => m.role !== "system");

    if (normalMessages.length > this.maxContext) {
      normalMessages.splice(0, normalMessages.length - this.maxContext);
    }

    this.messages = [...systemMessages, ...normalMessages];
  }

  private buildPrompt(): string {
    return this.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
  }

  /**
   * Sends context to Gemini and gets a reply.
   */
  async getBotReply(question?: string): Promise<string> {
    if (question) this.addUserMessage(question);
    const prompt = this.buildPrompt();
const url =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    const res = await axios.post(url, body);
    const reply =
      res.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "i dont feel like responding.";
    this.messages.push({ role: "assistant", content: reply });
    this.trimContext();

    return reply;
  }

  /**
   * Resets conversation context.
   */
  reset() {
    this.messages = [{ role: "system", content: PRE_PROMPT }];
  }

  /**
   * Useful for debugging.
   */
  getContextDump() {
    return [...this.messages];
  }
}
