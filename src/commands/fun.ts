import type { Command, CommandModule } from "../commands";
import { PSMessage } from "../message";
import { Room } from "../room";

export const info: CommandModule = {
  name: "Fun",
  description:
    "Fun commands which can be used to bully people, the bot or yourself.",
};
export const commands: Record<string, Command> = {
  reverse: {
    name: "reverse",
    help: "Reverses the text.",
    syntax: "!reverse text",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);
      const text = args.join(" ");
      const reversed = text.split("").reverse().join("");
      message.respond(reversed);
    },
  },
  owotext: {
    name: "owotext",
    help: "Turns text into OwO style.",
    syntax: "!owotext text",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      let text = args.join(" ");

      const owo = text
        .replace(/r|l/g, "w")
        .replace(/R|L/g, "W")
        .replace(/n([aeiou])/gi, "ny$1")
        .replace(/N([aeiou])/gi, "Ny$1");

      message.respond(owo);
    },
  },
  mock: {
    name: "mock",
    help: "mOcK tExT lIkE sPoNgEbOb",
    syntax: "!mock text",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      const text = args.join(" ");
      let result = "";

      for (let i = 0; i < text.length; i++) {
        result += i % 2 === 0 ? text[i].toLowerCase() : text[i].toUpperCase();
      }

      message.respond(result);
    },
  },

  morse: {
    name: "morse",
    help: "Encodes text into Morse code.",
    syntax: "!morse text",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      const morseMap: Record<string, string> = {
        a: ".-",
        b: "-...",
        c: "-.-.",
        d: "-..",
        e: ".",
        f: "..-.",
        g: "--.",
        h: "....",
        i: "..",
        j: ".---",
        k: "-.-",
        l: ".-..",
        m: "--",
        n: "-.",
        o: "---",
        p: ".--.",
        q: "--.-",
        r: ".-.",
        s: "...",
        t: "-",
        u: "..-",
        v: "...-",
        w: ".--",
        x: "-..-",
        y: "-.--",
        z: "--..",
        "1": ".----",
        "2": "..---",
        "3": "...--",
        "4": "....-",
        "5": ".....",
        "6": "-....",
        "7": "--...",
        "8": "---..",
        "9": "----.",
        "0": "-----",
        " ": "/",
      };

      const text = args.join(" ").toLowerCase();
      const encoded = text
        .split("")
        .map((c) => morseMap[c] || "")
        .join(" ");

      message.respond(encoded);
    },
  },

  unmorse: {
    name: "unmorse",
    help: "Decodes Morse code to text.",
    syntax: "!unmorse morse",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      const morseMap: Record<string, string> = {
        ".-": "a",
        "-...": "b",
        "-.-.": "c",
        "-..": "d",
        ".": "e",
        "..-.": "f",
        "--.": "g",
        "....": "h",
        "..": "i",
        ".---": "j",
        "-.-": "k",
        ".-..": "l",
        "--": "m",
        "-.": "n",
        "---": "o",
        ".--.": "p",
        "--.-": "q",
        ".-.": "r",
        "...": "s",
        "-": "t",
        "..-": "u",
        "...-": "v",
        ".--": "w",
        "-..-": "x",
        "-.--": "y",
        "--..": "z",
        ".----": "1",
        "..---": "2",
        "...--": "3",
        "....-": "4",
        ".....": "5",
        "-....": "6",
        "--...": "7",
        "---..": "8",
        "----.": "9",
        "-----": "0",
        "/": " ",
      };

      const decoded = args
        .join(" ")
        .split(" ")
        .map((m) => morseMap[m] || "")
        .join("");

      message.respond(decoded);
    },
  },

  ub64: {
    name: "ub64",
    help: "Decodes Base64 to text.",
    syntax: "!ub64 base64",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      try {
        const decoded = Buffer.from(args.join(" "), "base64").toString();
        message.respond(decoded);
      } catch {
        message.respond("Invalid Base64.");
      }
    },
  },

  binary: {
    name: "binary",
    help: "Converts text to binary.",
    syntax: "!binary text",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      const text = args.join(" ");
      const binary = text
        .split("")
        .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
        .join(" ");

      message.respond(binary);
    },
  },

  unbinary: {
    name: "unbinary",
    help: "Converts binary to text.",
    syntax: "!unbinary binary",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      try {
        const text = args
          .join(" ")
          .split(" ")
          .map((bin) => String.fromCharCode(parseInt(bin, 2)))
          .join("");

        message.respond(text);
      } catch {
        message.respond("Invalid binary input.");
      }
    },
  },

  hex: {
    name: "hex",
    help: "Converts text to hex.",
    syntax: "!hex text",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      const hex = Buffer.from(args.join(" ")).toString("hex");
      message.respond(hex);
    },
  },

  unhex: {
    name: "unhex",
    help: "Converts hex to text.",
    syntax: "!unhex hexdata",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      try {
        const text = Buffer.from(args.join(" "), "hex").toString();
        message.respond(text);
      } catch {
        message.respond("Invalid hex input.");
      }
    },
  },

  choice: {
    name: "choice",
    help: "Randomly picks one option.",
    syntax: "!choice a,b,c",

    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      const list = args.join(" ").split(",");
      const pick = list[Math.floor(Math.random() * list.length)].trim();

      message.respond(`**Choice:** ${pick}`);
    },
  },

  shuffle: {
    name: "shuffle",
    help: "Shuffles all letters randomly.",
    syntax: "!shuffle text",
    async execute(args, message) {
      if (!args.length) return message.respond("Usage: " + this.syntax);

      const arr = args.join(" ").split(",");

      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }

      message.respond(arr.join(","));
    },
  },
  superpower: {
    name: "superpower",
    help: "Gives you a random superhero ability.",
    syntax: "!superpower",

    async execute(args, message) {
      const powers = [
        "Invisibility for 10 seconds",
        "Super speed (but only when excited)",
        "Teleport 1 meter at a time",
        "Talk to animals",
        "Summon tiny sparkles",
        "Glow in the dark",
        "Jump super high",
        "Create small forcefields",
        "Instantly learn any hobby",
        "Control small breezes of wind",
        "See in the dark like a cat",
      ];

      message.respond(
        "**Your Superpower:** " +
          powers[Math.floor(Math.random() * powers.length)]
      );
    },
  },

  regex: {
    name: "regex",
    help: "Tests regex patterns on text.",
    syntax: "!regex text pattern",

    async execute(args, message) {
      if (args.length < 2) return message.respond("Usage: " + this.syntax);

      const text = args.slice(0, -1).join(" ");
      const pattern = args[args.length - 1];

      try {
        const re = new RegExp(pattern, "g");
        const matches = text.match(re);

        message.respond(
          matches ? `**Matches:** ${matches.join(", ")}` : "No matches found."
        );
      } catch (e) {
        message.respond("Invalid regex pattern.");
      }
    },
  },

  randcat: {
    name: "randcat",
    help: "RANDCATT",
    syntax: "!randcat",
    async execute(args, message) {
      message.respond("_randcat");
    },
  },
  "8ball": {
    name: "8ball",
    aliases: ["ask"],
    help: "Ask the magic 8-ball a question.",
    syntax: "!8ball question",
    perms: "+",

    async execute(args: string[], message: PSMessage) {
      if (!args.length) {
        return message.respond("You must ask a question, mortal.");
      }

      const responses: readonly string[] = [
        "Absolutely yes.",
        "Without a doubt.",
        "The stars say yes.",
        "Arceus himself nodded.",
        "Certified W.",
        "Yes. Screenshot this.",

        "Probably yes.",
        "Looks good to me.",
        "Signs point to yes.",
        "I’d bet my Rare Candy on it.",
        "Momentum is on your side.",

        "Ask again later.",
        "Hard to say… vibes are mixed.",
        "The universe is buffering.",
        "Too early to tell.",
        "My sources went quiet.",
        "Focus… and ask again.",

        "Probably not.",
        "Doesn’t look great.",
        "I wouldn’t count on it.",
        "Chances are slim.",
        "The odds are not in your favor.",

        "No.",
        "Absolutely not.",
        "Yeah… that’s a no.",
        "Not happening.",
        "Even RNG said no.",
        "Pack it up, chief.",

        "Ask your mom.",
        "Try again after touching grass.",
        "Only if you believe hard enough.",
        "The answer is classified.",
        "Skill issue.",
        "Yes, but only in another timeline.",
        "No, but it’d be funny if it worked.",
        "The 8-ball refuses to elaborate.",
      ];

      const choice = responses[Math.floor(Math.random() * responses.length)];

      message.respond(`${choice}`);
    },
  },
  askgemini: {
    name: "askgemini",
    help: "Its simple, isn't it? you ask AI and it says either something wise or stupid.",
    syntax: "!ask text",
    perms: "dev",
    aliases: ["askai"],
    async execute(args: string[], message: PSMessage) {
      const room = message.to as Room;
      if (!room || !room.chatAI)
        return message.respond("This feature isnt enabled in this room");
      const que = `${message.from ? message.from.id + " says" : ""} ${args.join(
        " "
      )}`;
      try {
        const ans = await room.chatAI.getBotReply(que);
        message.respond(ans);
      } catch (e) {
        message.respond("i am busy, do not disturb");
      }
      return;
    },
  },
};
