import { Command } from "../commands";
import { PSMessage } from "../message";

export const commands: Record<string, Command> = {
    'info': {
        name: 'info',
        help: 'Provides information about the bot.',
        syntax: '!info',
        async execute(args: string[], message: PSMessage) {    
            console.log(args);
            message.respond('test');
            return;
        }
    }
}