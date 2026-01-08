import type { Command, CommandModule } from "../commands";
import type { PSMessage } from "../message";

export const info: CommandModule = {
  name: "Simulator",
  description: "Commands useful to simulate pokemon showdown battles.",
  perms: "",
};
export const commands: Record<string, Command> = {
  rng: {
    name: "RNG",
    help: "",
    syntax: "!rng move, rolls",
    aliases: ["testrng"],
    async execute(args: string[], message: PSMessage) {
      /*
      Inspiration and code taken from: 
      https://github.com/smogon/pokemon-showdown/issues/8491
      */
      if (!args[0]) return message.respond("Usage: " + this.syntax);
      const move = args.join(" ").split(",")[0];
      const rolls = args.join(" ").split(",")[1]
        ? parseInt(args.join(" ").split(",")[1].trim())
        : 999;
        if (rolls >= 1000) return message.respond("Maximum rolls is 999.");
      const { PRNG } = require(psdir + "/dist/sim");
      const common = require(psdir + "/test/common");

      let battle = common.createBattle({
        // Override the default seed used for tests
        // Normally using the same seed for tests is fine, as we want tests to always
        // give the same result for a given seed. However, for this we want to test the hit %
        // so we need to give a different seed each time like an actual battle
        seed: PRNG.generateSeed(),
      });
      battle.setPlayer("p1", {
        team: [
          {
            species: "Gible",
            level: 5,
            ability: "rockhead",
            item: "",
            moves: [move],
          },
        ],
      });
      // Strong target that wont do anything but soak hits
      battle.setPlayer("p2", {
        team: [
          {
            species: "Chansey",
            ability: "naturalcure",
            item: "eviolite",
            moves: ["splash"],
          },
        ],
      });

      // Number of times the move has hit
      let hits = 0;
      // Number of turns to play, max is 999

      // Repeat the following block of code (the area indented more than this line) 999 times
      for (let i = 1; i <= rolls; i++) {
        try {
        // Auto will choose the only options available: use the selected move for p1, and splash for p2
        battle.makeChoices(move ? "move " + move : "auto", "auto");
        // After the turn completes, check if move hit (chansey lost HP)
        if (battle.p2.active[0].hp < battle.p2.active[0].maxhp) {
          // If so increase the hit counter
          hits++;
          // And restore chansey's HP so its not eventually KOed
          battle.p2.active[0].hp = battle.p2.active[0].maxhp;
        } // If the move missed, we do NOT increment the hit counter.

        // Regardless of if the move hit or missed, restore PP for both mon's moves so neither end up struggling
        battle.p2.active[0].moveSlots[0].pp =
          battle.p2.active[0].moveSlots[0].maxpp;
        battle.p1.active[0].moveSlots[0].pp =
          battle.p1.active[0].moveSlots[0].maxpp;
    } catch (e: any) {
        console.log("Error during battle simulation: ", e);
        message.respond("Error during battle simulation: " + e.message);
        break;
    }
      }

      // Number of hits as a percentage
      const hitRatio = hits / rolls;
      // multiply by 100 for proper display
      message.respond(move + " hit " + hitRatio * 100 + "% of the time. | Hit Counter: " + hits + " out of " + rolls);
      // Actual test assertion, test fails if stone edge hits less than 75% of the time or more than 85% of the time
      // The reason for the buffer is simple: 100 uses wont always mean 80 hits and 20 misses, thats not how probability
      // works when the odds do not change each time you perform the check.
    //  message.respond(result.includes("\n") ? `!code ${result}` : result);
      return;
    },
  },
};
