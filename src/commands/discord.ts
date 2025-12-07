import { Command } from "../commands";
import { PSMessage } from "../message";

export const commands: Record<string, Command> = {
    'dcid': {
        name: 'dcid',
        help: 'Use it to update your discord information on bot\'s storage',
        syntax: '!dcid [set | remove | get] id',
        async execute(args: string[], message: PSMessage) {    
            if (!args[1]) return message.respond(`Usage: ${this.syntax}`);
            const subcmd = toId(args[0]);
            const dcid = args[1].trim();
            const userid = message.from?.id;
            if (subcmd === 'set') {
                const dcusers = Db.file('discord/users.json').data;
                if (!dcusers[userid]) dcusers[userid] = {};
                dcusers[userid].id = dcid;
                message.respond("Added discord id");
                return;
            } else if (subcmd === 'remove') {
                const dcusers = Db.file('discord/users.json').data;
                if (!dcusers[userid]) dcusers[userid] = {};
                dcusers[userid].id = dcid;
                message.respond("Removed discord id");
                return
            } else if (subcmd === 'get') {
                const dcusers = Db.file('discord/users.json').data;
                if (!dcusers[userid]?.id) return message.respond('You havent set your discord id yet');
                message.respond(dcusers[userid].id);
            } else {
                message.respond(`Usage: ${this.syntax}`);
            }
            message.respond('test');
            return;
        }
    }
}