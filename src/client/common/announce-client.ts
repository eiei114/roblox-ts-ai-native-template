import { GAME_NAME } from "shared/settings";

export function announceClient(role: "lobby" | "game"): void {
	print(`${GAME_NAME}: ${role} client ready`);
}
