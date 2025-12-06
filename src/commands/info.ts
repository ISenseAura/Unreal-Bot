import { Command, CommandModule } from "../commands";
import { PSMessage } from "../message";
import { TIMEZONE_MAP } from "../data/timezones";

export const info: CommandModule = {
  name: "Informational Commands",
  description: "You are not gonna read this",
};

export const commands: Record<string, Command> = {
  info: {
    name: "info",
    help: "Provides information about the bot.",
    syntax: "!info",
    async execute(args: string[], message: PSMessage) {
      message.respond("test");
      return;
    },
  },
  git: {
    name: "git",
    help: "Provides the git repository link of the bot.",
    syntax: "!git",
    async execute(args: string[], message: PSMessage) {
      message.respond(
        "You can find my source code at: https://github.com/ISenseAura/Unreal-Bot.git"
      );
    },
  },
  uptime: {
    name: "uptime",
    help: "Provides the uptime of the bot.",
    syntax: "!uptime",
    async execute(args: string[], message: PSMessage) {
      const u = process.uptime();

      const mo = Math.floor(u / 2592000);
      const d = Math.floor((u % 2592000) / 86400);
      const h = Math.floor((u % 86400) / 3600);
      const m = Math.floor((u % 3600) / 60);
      const s = Math.floor(u % 60);

      const parts = [];
      if (mo) parts.push(`${mo}mo`);
      if (d) parts.push(`${d}d`);
      if (h) parts.push(`${h}h`);
      if (m) parts.push(`${m}m`);
      parts.push(`${s}s`);

      message.respond(`**Uptime:** ${parts.join(" ")}`);
    },
  },

time: {
  name: "time",
  help: "Shows current time for a city or country.",
  syntax: "!time city/country",
  perms: "dev",
  async execute(args, message) {
    if (!args.length) return message.respond("Usage: " + this.syntax);

    const key = args.join("").toLowerCase();

    const zone = TIMEZONE_MAP[key];
    if (!zone) return message.respond("Unknown city/country.");

    const now = new Date();
    const formatted = now.toLocaleString("en-US", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "medium",
    });

    message.respond(`**${key} (${zone})**: ${formatted}`);
  },
},

comparetime: {
  name: "comparetime",
  help: "Compare current time between two locations.",
  syntax: "!comparetime city1 city2",
  perms: "dev",
  async execute(args, message) {
    if (args.length < 2) return message.respond("Usage: " + this.syntax);

    const key1 = args[0].toLowerCase();
    const key2 = args[1].toLowerCase();

    const z1 = TIMEZONE_MAP[key1];
    const z2 = TIMEZONE_MAP[key2];

    if (!z1 || !z2) return message.respond("Unknown city/country.");

    const now = new Date();

    const time1 = now.toLocaleString("en-US", {
      timeZone: z1,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const time2 = now.toLocaleString("en-US", {
      timeZone: z2,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    message.respond(`!code **${key1} (${z1})** → ${time1}\n**${key2} (${z2})** → ${time2}`);
  },
},


};
