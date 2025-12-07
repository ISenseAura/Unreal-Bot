import { Command, CommandModule } from "../commands";
import { PSMessage } from "../message";

export const commands: Record<string, Command> = {
  commands: {
    name: "commands",
    help: "Provides information about all bot commands.",
    syntax: "!commands",
    execute: async (args: string[], message: PSMessage) => {
      const sortedCommands = Commands.getCommands() as Record<
        string,
        CommandModule
      >;
      let html = `  <div class="infobox" style="max-height:300px;overflow-y:scroll;border:0.4px solid white;padding: 12px;">
      <strong> All Commands: </strong> <br/>
    `;
      for (const [key, data] of Object.entries(sortedCommands)) {
        html += `
<details style="margin:4px 0; font-family:sans-serif; font-size:12px;">
  <summary style="font-weight:600; cursor:pointer; color:#3b6fa6;">
    ${data.name}
  </summary>

  <div style="margin:3px 0 5px 0; color:#777;">
    ${data.description || ""}
  </div>

  <div style="margin-left:10px; line-height:1.3;">
    ${Object.entries(data.commands || {})
      .map(
        ([cmdName, cmd]) => `
      <div style="margin:2px 0;">
        • <b style="color:#6a5acd;">${cmdName}</b>
        <span style="color:#777;">${cmd.help ? " — " + cmd.help : ""}</span>
        <div style="color:#3a8f8b; margin-left:12px;">
          <b>Usage:</b> ${cmd.syntax || ""}
        </div>
      </div>`
      )
      .join("")}
  </div>
</details>
`;
      }
      html += `</div>`;
      message.respond("/adduhtml mycommands, " + html);
      return;
    },
  },
  help: {
    name: "help",
    help: "Provides description and syntax of a command",
    syntax: "!help command",
    async execute(args, message) {
      if (!args[0]) return message.respond(`Usage: \`\`${this.syntax}\`\``);
      
    },
  },
};
