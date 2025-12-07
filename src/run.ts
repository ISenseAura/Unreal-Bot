import { Client } from "./";
import { CommandsList } from "./commands";
import Config from "./config/bot";
import { toId } from "./utils";
import { DiscordBot } from "./discord";
import { StorageManager } from "./lib/storage";
import path from "path";

global.Commands = new CommandsList();
global.Config = Config;
global.toId = toId;

const storage = new StorageManager(path.resolve(__dirname, "../database"));
global.Db = storage;

const PS = new Client({
  name: Config.username,
  prefix: Config.prefixes,
  pass: Config.password,
  rooms: Config.rooms,
  avatar: "youngcouple",
  status: Config.status,
});

global.Users = PS.users;
global.Rooms = PS.rooms;
global.PS = PS;

PS.on("error", (args) => {
  console.log("PSError: ", args);
});
PS.on("popup", (msg) => {
  console.log("PSPopup: " + msg);
});
PS.on("raw", (msg) => {
  console.log(msg.slice(0, 100));
});
PS.on("message", (msg) => {
  if (msg.noReply)
    return console.log("Attempted to reply to a room init message");
  if (/\bp9\b[.,!?]?/i.test(msg.text)) {
    Discord.sendDM(
      Config.discordOwnerId,
      `<${msg.to.id}>${msg.from.name}: ${msg.text}`
    );
  }

  if (msg.isCommand()) {
    Commands.parseCommand(msg);
  }
});
PS.connect("sim3.psim.us", 8000);

// discord bot
const Discord = new DiscordBot({
  token: Config.discordToken,
  ownerId: Config.discordOwnerId,
  prefix: "!",
});

global.Discord = Discord;
