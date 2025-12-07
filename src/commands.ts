import path from "path";
import fs from "fs/promises";
import { toID } from "./lib";
import type { Room } from "./room";
import type { User } from ".";
import type { PSMessage } from "./message";
import type { Perms } from "./permissions";
import { compileSingleTS } from "./utils/esbuild";

export interface CommandContext {
  room: Room | null;
  from: string;
  message: string;
}

export interface CommandModule {
  name: string;
  description: string;
  commands?: Record<string, Partial<Command>>;
  perms?: Perms;
  sourcePath?: string;
}

export interface CommandHistoryEntry {
  timestamp: number;
  context: CommandContext;
}

export interface Command {
  name: string;
  help: string;
  syntax: string;
  prefix?: string;
  aliases?: string[];
  perms?: Perms;
  overridePerms?: boolean;
  isLocked?: boolean;

  cooldown?: number;
  cooldownMessage?: string;
  cooldownMs?: number;

  history?: CommandHistoryEntry[];
  sourcePath?: string;
  module?: string;

  execute: (
    args: string[],
    message: PSMessage
  ) => Promise<void | string> | void | string | undefined;
}

export class CommandsList {
  private commands = new Map<string, Command>();
  private commandDirs = [path.join(__dirname, "commands")];
  private sortedCommands: Record<string, CommandModule> = {};

  constructor() {
    this.loadAll();
  }

  private async loadAll() {
    for (const dir of this.commandDirs) {
      await this.loadDirectory(dir);
    }
  }

  private async loadDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.loadDirectory(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".js") &&
        !entry.name.endsWith(".example.js")
      ) {
        const mod = require(full);
        const moduleName = toId(mod.info?.name);
        if (!mod.commands) continue;
        if (moduleName) {
          this.sortedCommands[moduleName] = mod.info;
          this.sortedCommands[moduleName].sourcePath = full;
        }
        for (const key of Object.keys(mod.commands)) {
          const command = mod.commands[key] as Command;
          command.syntax = `\`\`${command.syntax.replace(
            "!",
            global.Config.prefixes[0]
          )}\`\``;
          command.prefix = global.Config.prefixes[0];
          if (mod?.info?.perms && !command.overridePerms)
            command.perms = mod.info.perms;
          if (moduleName) command.module = moduleName;
          command.sourcePath = full;
          this.commands.set(toID(command.name), command);
          if (moduleName) {
            if (this.sortedCommands[moduleName].commands === undefined) {
              this.sortedCommands[moduleName].commands = {};
            }
            if (!this.sortedCommands[moduleName].commands![command.name]) {
              this.sortedCommands[moduleName].commands![command.name] = {
                help: command.help,
                syntax: command.syntax,
              } as any;
            }
          }
          if (command.aliases) {
            for (const alias of command.aliases) {
              this.commands.set(alias, command);
            }
          }
        }
      }
    }
  }

  async reload(filePath: string) {
    try {
      let jsPath = filePath;
      const tsEquivalent = filePath
        .replace("dist", "src")
        .replace(/\.js$/, ".ts");
      try {
        await fs.access(tsEquivalent);
        console.log(`Compiling TS before reload: ${tsEquivalent}`);
        const updatedJS = await compileSingleTS(tsEquivalent);
        if (!updatedJS) {
          console.log("Compilation failed. Aborting hotpatch.");
          return false;
        }
        jsPath = updatedJS;
      } catch {}

      const resolved = require.resolve(jsPath);
      delete require.cache[resolved];

      const mod = require(resolved);
      for (const [key, cmd] of this.commands.entries()) {
        if (cmd.sourcePath === resolved) {
          this.commands.delete(key);
        }
      }

      if (mod.commands) {
        for (const cmdName of Object.keys(mod.commands)) {
          const cmd = mod.commands[cmdName] as Command;

          cmd.syntax = `\`\`${cmd.syntax.replace(
            "!",
            global.Config.prefixes[0]
          )}\`\``;

          cmd.prefix = global.Config.prefixes[0];
          cmd.sourcePath = resolved;

          if (mod?.info?.perms && !cmd.overridePerms) {
            cmd.perms = mod.info.perms;
          }
          if (mod?.info?.name) cmd.module = mod.info.name;
          this.commands.set(toID(cmd.name), cmd);

          if (cmd.aliases) {
            for (const alias of cmd.aliases) {
              this.commands.set(toID(alias), cmd);
            }
          }
        }
      }
      console.log(`Hotpatched: ${jsPath}`);
      return true;
    } catch (err) {
      console.error(`Hotpatch failed for ${filePath}:`, err);
      return false;
    }
  }

  parseCommand(message: PSMessage): Command | null {
    const text = message.text;
    const cmd = text.split(" ")[0].replace(message.prefix!, "");
    const command = this.commands.get(toID(cmd));
    if (command?.perms) {
      if (command.perms === "dev" && !(message.from && message.from.isDev())) {
        message.respond("You do not have permission to use this command.");
        return null;
      } else {
        if (!message.isRank(command.perms)) {
          message.respond("You do not have permission to use this command.");
          return null;
        }
      }
    }
    try {
      command?.execute(text.split(" ").slice(1), message);
    } catch (e) {
      message.respond(
        `An error occurred while executing the command: ${(e as Error).message}`
      );
    }

    return command || null;
  }

  get(name: string) {
    return this.commands.get(name);
  }
  getCommands() {
    return this.sortedCommands;
  }
  getModuleIds() {
    return Object.keys(this.sortedCommands);
  }
}
