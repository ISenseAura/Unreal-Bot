/**
 * PSMessage handling.
 */
import { Command } from './commands';
import { toID } from './lib';
import {Client, PLine} from './ps';
import {Room} from './room';
import {User} from './user';


const RANK_ORDER = ['', '+', '%', '@', '*', '#', '&', '~'];

export class PSMessage {
    text!: string;
    group = ' ';
    /** User if it's a pm, Room if it's in a room, null if it's a system message 
     * (from &)
     */
    to!: User | Room | null;
    room?: Room | null;
    from: User | null = null;
    noReply!: boolean;
    isPSCommand = false;
    line!: PLine;
    prefix?: string;
    constructor(public client: Client) {}
    static async getUser(name: string, client: Client) {
        if (name === '&') return null;
        return (await client.users.get(name)) || false;
    }
    static async from(line: PLine, client: Client, noReply = false) {
        const message = new PSMessage(client);
        message.line = line;
        message.noReply = noReply;
        switch (line.type) {
        case 'pm': {
            const [senderName, receiverName, ...rest] = line.args;
            message.group = senderName.charAt(0);
            const sender = await this.getUser(senderName, client);
            if (sender?.toString() === toID(client.settings.name)) return null;
            if (sender === false) return; // ??
            const receiver = await this.getUser(receiverName, client) || null;
            message.from = sender;
            message.to = receiver;
            message.text = rest.join('|');
            break;
        } case 'c:': {
            if (!line.roomid) {
                line.roomid = 'lobby'; // REEE
            }
            const [, senderName, ...rest] = line.args;
            message.group = senderName.charAt(0);
            const sender = await client.users.get(senderName);
            if (sender?.toString() === toID(client.settings.name)) return null;
            const room = await client.rooms.get(line.roomid);
            message.from = sender;
            message.room = room;
            message.to = room;
            message.text = rest.join('|');
            break;
        } case 'c': {
            if (!line.roomid) {
                line.roomid = 'lobby'; // REEE
            }
            const [senderName, ...rest] = line.args;
            message.group = senderName.charAt(0);
            const sender = await client.users.get(senderName);
            if (sender?.toString() === toID(client.settings.name)) return null;
            const room = await client.rooms.get(line.roomid);
            message.from = sender;
            message.to = room;
            message.room = room;
            message.text = rest.join('|');
            break;
        } default: return null;
        }
        message.isPSCommand = message.text.startsWith('!');
        return message;
    }
    /** If the message has a room, sends the response to that room 
     * - else PMs the user that it's from
     **/
    respond(text: string) {
        return (this.room || this.from)?.send(text);
    }
    /** Sends a reply in pms. */
    privateRespond(text: string) {
        return this.from?.send(text);
    }
    isPM() {
        return this.room === undefined;
    }
    isCommand() {
        const prefixes = this.client.settings.prefix;
        let isCommand = false;
        if (Array.isArray(prefixes)) {
            for (const prefix of prefixes) {
                if (this.text.startsWith(prefix)) {
                    isCommand = true;
                    this.prefix = prefix;
                    break;
                }
            }
        } else if (prefixes) {
            isCommand = this.text.startsWith(prefixes);
        }
        return isCommand;
    }

    isRank(rank: string) {
        if (!this.from) return false;
        let auth = this.from.group;
        if (this.room) {
            for (const k in this.room.auth) {
                if (this.room.auth[k].includes(this.from.id)) {
                    if (RANK_ORDER.indexOf(k) > RANK_ORDER.indexOf(rank)) {
                        // higher than global rank
                        auth = k;
                    }
                }
            }
        }
        if (this.group.trim()) {
            auth = this.group;
        }
        return RANK_ORDER.indexOf(auth) >= RANK_ORDER.indexOf(rank);
    }
    clone() {
        const message = new PSMessage(this.client);
        Object.assign(message, this);
        return message;
    }
}