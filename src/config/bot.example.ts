abstract class BotConfig {
  abstract prefixes: string[];
  abstract developers: string[];
  abstract rooms: string[];
  abstract username: string;
  abstract password: string;
}

class Config extends BotConfig {
  username = "Unreal Bot";
  password = "SIX_SEVEN";
  prefixes = ["."];
  developers = ["p9"];
  rooms = ["botdevelopment"];
  lockedRooms = [""];

  status = "I'm as real as you are";
  commandsDir = "src/commands";

  discordToken = "";
  discordAppId = "";
  discordPublicKey = "";
  discordOwnerId = "";

  // gemini chat AI
  geminiAPIKey = "";
  geminiMaxContext = 20;
  geminiEnabledRooms = ["botdevelopment"];
}

export default new Config();
