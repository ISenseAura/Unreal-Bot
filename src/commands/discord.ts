import type { User } from "..";
import { Command, CommandModule } from "../commands";
import { PSMessage } from "../message";

export const info: CommandModule = {
  name: "Discord",
  description: "bunch of discord related commands",
  perms: "dev",
};

export const commands: Record<string, Command> = {
  dcid: {
    name: "dcid",
    help: "Use it to update your discord information on bot's storage",
    syntax: "!dcid [set | remove | get] id",
    perms: 'dev',
    async execute(args: string[], message: PSMessage) {
      if (!args[1] && args[0] === "set")
        return message.respond(`Usage: ${this.syntax}`);
      const subcmd = toId(args[0]);
      const dcid = args[1]?.trim();
      const userid = message.from?.id;
      const file = Db.file("discord/users.json");
      const dcusers = file.data;

      if (subcmd === "set") {
        const exists = await Discord.getUser(dcid);
        if (!exists) return message.respond("Discord ID is invalid");
        if (!dcusers[userid]) dcusers[userid] = {};
        dcusers[userid].id = dcid;
        file.save();
        message.respond("Added discord id");
        message.from?.setDiscordId(dcid);
        return;
      } else if (subcmd === "remove") {
        if (!dcusers[userid]) dcusers[userid] = {};
        dcusers[userid].id = null;
        file.save();
        message.respond("Removed discord id");
        return;
      } else if (subcmd === "get") {
        if (!dcusers[userid]?.id)
          return message.respond("You havent set your discord id yet");
        message.respond(dcusers[userid].id);
        return;
      }
      message.respond(`Usage: ${this.syntax}`);
      return;
    },
  },
  senddm: {
    name: "senddm",
    help: "Send discord DM to an user",
    syntax: "!senddm userid, message",
    perms: 'dev',
    async execute(args, message) {
      args = args.join(" ").split(",");
      if (!args[1]) return message.respond(`Usage: \`\`${this.syntax}\`\``);
      const userid = toId(args[0]);
      const rest = args.slice(1).join(",");
      const user = (await Users.get(userid)) as User;
      if (!user) return message.respond("User not found");
      if (!user.discordId)
        return message.respond("User does not have a discord id set.");
      const result = user.sendDm(rest);
      if (!result)
        return message.respond(
          "Failed to send message due to unknown reasons."
        );
      message.respond("Sent.");
    },
  },
};
