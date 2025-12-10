import type { Command, CommandModule } from "../commands";
import type { PSMessage } from "../message";

export const info: CommandModule = {
  name: "Developer",
  description: "Developer commands which are useful during bot development.",
  perms: "dev",
};
export const commands: Record<string, Command> = {
  eval: {
    name: "eval",
    help: "Evaluates an expression in javascript.",
    syntax: "!eval expression",
    aliases: ["js"],
    async execute(args: string[], message: PSMessage) {
      if (!args[0]) return message.respond("Usage: " + this.syntax);
      let result = "";
      try {
        result = `${eval(args.join(" "))}`;
      } catch (e) {
        result = `Error: ${(e as Error).message}`;
      }
      message.respond(result.includes("\n") ? `!code ${result}` : result);
      return;
    },
  },
  serverinfo: {
    name: "serverinfo",
    help: "Shows technical info about the bot's environment.",
    syntax: "!serverinfo",
    async execute(args, message) {
      const mem = process.memoryUsage();
      message.respond(
        `!code • Node: ${process.version}\n` +
          `• Platform: ${process.platform}\n` +
          `• PID: ${process.pid}\n` +
          `• RAM: ${(mem.rss / 1024 / 1024).toFixed(1)} MB RSS\n` +
          `• Uptime: ${(process.uptime() / 60).toFixed(1)} minutes`
      );
    },
  },
  threads: {
    name: "threads",
    help: "Shows active event loop handles.",
    syntax: "!threads",
    async execute(args, message) {
      // @ts-ignore
      const handles = process._getActiveHandles();
      message.respond(`**Active Handles:** ${handles.length}`);
    },
  },
  pinghost: {
    name: "pinghost",
    help: "Attempts a TCP ping to a host.",
    syntax: "!pinghost hostname",
    async execute(args, message) {
      if (!args[0]) return message.respond(`Usage: ${this.syntax}`);

      const host = args[0];
      const start = Date.now();
      const net = await import("net");

      const socket = net.createConnection(80, host);
      socket.setTimeout(3000);

      socket.on("connect", () => {
        const ms = Date.now() - start;
        socket.destroy();
        message.respond(`**Ping** to ${host}: ${ms}ms`);
      });

      socket.on("timeout", () => {
        socket.destroy();
        message.respond(`Oof Timeout pinging ${host}`);
      });

      socket.on("error", () => {
        message.respond(`Err Unable to reach ${host}`);
      });
    },
  },

  dns: {
    name: "dns",
    help: "DNS lookup for a domain.",
    syntax: "!dns domain",
    async execute(args, message) {
      if (!args[0]) return message.respond("Usage: " + this.syntax);

      const dns = await import("node:dns").then((m) => m.promises);

      try {
        const res = await dns.lookup(args[0]);
        message.respond(`**DNS:** ${args[0]} => ${res.address}`);
      } catch {
        message.respond(`DNS lookup failed for ${args[0]}`);
      }
    },
  },

  reload: {
    name: "reload",
    help: "Reloads a command module",
    syntax: "!reload [command name or module name]",
    async execute(args, message) {
      if (!args[0]) return message.respond(`Usage: \`\`${this.syntax}\`\``);
      let success = [] as string[];
      let failed = [] as string[];
      const modules = Commands.getCommands() as Record<string, CommandModule>;
      for (const name of args) {
        const id = toId(name);
        const cmd = Commands.get(toId(name)) as Command;
        const filePath = modules[id]?.sourcePath || cmd?.sourcePath;
        if (!filePath) {
          failed.push(name);
          continue;
        }
        const reloaded = await Commands.reload(filePath);
        if (!reloaded) {
          failed.push(name);
        } else {
          success.push(modules[id] ? modules[id].name : cmd.module || name);
        }
      }
      let output = [];

      if (success.length) {
        output.push(`Successfully reloaded module: ${success.join(", ")}`);
      }
      if (failed.length) {
        output.push(`Failed to reload: ${failed.join(", ")}`);
      }

      message.respond(output.join(" | "));
    },
  },

  say: {
    name: 'say',
    help: 'Says',
    syntax: '!say text',
    async execute(args, message) {
      message.respond(args.join(' '));
    },
  }
};
