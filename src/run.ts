import { Client } from "./";
import { CommandsList } from "./commands";
import Config from "./config/bot";
import { toId } from "./utils";

global.Commands = new CommandsList();
global.Config = Config;
global.toId = toId

const bot = new Client({
  name: Config.username,
  prefix: Config.prefixes,
  pass: Config.password,
  rooms: Config.rooms,
  avatar: "youngcouple",
});

global.Users = bot.users;
global.Rooms = bot.rooms;

bot.on("error", (args) => {
  console.log("PSError: ", args);
});
bot.on("popup", (msg) => {
  console.log("PSPopup: " + msg);
})
bot.on("raw", (msg) => {
  console.log(msg.slice(0, 100));
});
bot.on("message", (msg) => {
  if (msg.noReply) return console.log("Attempted to reply to a room init message");
    if (msg.isCommand()) {
      Commands.parseCommand(msg);
  }
});
bot.connect("sim3.psim.us", 8000);
