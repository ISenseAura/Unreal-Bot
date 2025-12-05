import {Client} from './';

const bot = new Client({
    name: 'my3amthoughts',prefix: 'sudo ',  pass: '',rooms: ['botdevelopment'], avatar: 'youngcouple'
});
bot.on('error', (args) => {
    console.log(args);
})
bot.on('raw', msg => {
//console.log(msg);
});
bot.on('message', msg => {
   console.log(msg.line);
const text = msg.text;
if (text.startsWith(bot.settings.prefix)) {
//console.log(text);
const cmd = text.split(' ')[1];
const value = text.split(' ').slice(2).join(" ");
if (cmd === 'eval') {
if (msg.from.id !== 'p9') return msg.privateRespond('eval access denied.');
try {
const result = eval(value);
msg.respond(`${result}`);
}
catch (e: any) {
msg.privateRespond(`!code ${e.message}`);
}
}
}
});
bot.connect('sim3.psim.us', 8000);

