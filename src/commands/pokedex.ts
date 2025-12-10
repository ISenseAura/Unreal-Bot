import { Command, CommandModule } from "../commands";
import { PSMessage } from "../message";
import axios from "axios";

export const info: CommandModule = {
  name: "Pokedex",
  description: "Commands to fetch information about a pokemon",
  perms: "dev",
};

export const commands: Record<string, Command | string> = {
  dexentry: {
    name: "dexentry",
    help: "Provides PokeDex entry of given pokemon.",
    syntax: "!dexentry pokemon",
    aliases: ["pokedexentry", "entry"],
    async execute(args: string[], message: PSMessage) {
      if (!args[0]) return message.respond("Please provide a pokemon name.");
      const target = global.toId(args[0]);
      try {
        const response = await axios.get(
          "https://pokeapi.co/api/v2/pokemon-species/" + target
        );
        const entries = response.data.flavor_text_entries.filter(
          (entry: any) => entry.language.name === "en"
        );
        message.respond(
          `**${response.data.name}:** ${entries[0].flavor_text
            .split("\n")
            .join(" ")}`
        );
      } catch (e) {
        message.respond("Could not find Pokedex entry for that pokemon.");
      }
    },
  },
};
