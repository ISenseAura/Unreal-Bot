import {
  Client,
  GatewayIntentBits,
  Partials,
  TextChannel,
  Message,
  User,
  Channel,
  TextBasedChannel,
} from "discord.js";

export interface DiscordBotOptions {
  token: string;
  ownerId?: string;
  prefix?: string;

}

export class DiscordBot {
  client: Client;
  ownerId?: string;
  prefix: string;

  constructor(options: DiscordBotOptions) {
    this.ownerId = options.ownerId;
    this.prefix = options.prefix ?? "!";

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });

    this.client.on("ready", () => {
      console.log(`Logged in as ${this.client.user?.tag}`);
    });

    // Message handler
    this.client.on("messageCreate", async (msg) => {
      if (msg.author.bot) return;

      if (this.ownerId && msg.author.id !== this.ownerId) return;

      if (!msg.content.startsWith(this.prefix)) return;

      const args = msg.content.slice(this.prefix.length).trim().split(" ");
      const cmd = args.shift()?.toLowerCase();

      if (cmd === "ping") {
        return this.reply(msg, "Pong!");
      }

      if (cmd === "hello") {
        return this.reply(msg, `Hello ${msg.author.username}!`);
      }
    });
    this.start(options.token);
  }

  async start(token: string) {
    try {
      await this.client.login(token || "");
      console.log("Started discord bot")
    } catch (err) {
      console.error("Failed to start Discord bot:", err);
    }
  }


  /** Send a message to any text channel by ID */
async sendMessage(channelId: string, text: string) {
  const ch = await this.client.channels.fetch(channelId);

  if (!ch) throw new Error("Channel not found.");

  if (!ch.isTextBased() || !("send" in ch)) {
    throw new Error("Channel cannot send messages.");
  }

  return ch.send(text);
}


  async reply(message: Message, text: string) {
    return message.reply(text);
  }

  async sendDM(userId: string, text: string) {
    const user = await this.getUser(userId);
    if (!user) return false;
    return user.send(text);
  }

  async getUser(id: string): Promise<User | null> {
    try {
      return await this.client.users.fetch(id);
    } catch {
      return null;
    }
  }

  async getChannel(id: string): Promise<Channel | null> {
    try {
      return await this.client.channels.fetch(id);
    } catch {
      return null;
    }
  }

  /** Join a thread by ID */
  async joinThread(threadId: string) {
    try {
      const thread = await this.client.channels.fetch(threadId);
      if (thread?.isThread()) {
        await thread.join();
        return thread;
      }
      throw new Error("Not a valid thread.");
    } catch (e) {
      console.error("Failed to join thread:", e);
      return null;
    }
  }
}
