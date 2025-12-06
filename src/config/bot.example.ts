
abstract class BotConfig {
    abstract prefixes: string[];
    abstract developers: string[];
    abstract rooms: string[];
    abstract username: string;
    abstract password: string;
}

class Config extends BotConfig {
    prefixes = ["."];
    developers = ['p9'];
    rooms = ['botdevelopment']
    username = "my3amthoughts";
    password = "SIX_SEVEN";

    commandsDir = 'src/commands';
}

export default new Config();
