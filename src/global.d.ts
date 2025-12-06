import type { Commands } from "./commands";

declare global {
    var Commands: Commands;
    var Config: import("./config/bot").default;
    var toId: (text: string) => string;

    var Users: import("./user").Users;
    var Rooms: import("./room").Rooms;
}

export {};
