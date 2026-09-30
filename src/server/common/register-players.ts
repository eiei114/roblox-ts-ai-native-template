import { Players } from "@rbxts/services";
import { GAME_NAME } from "shared/settings";

export function registerPlayers(role: "lobby" | "game"): void {
	print(`${GAME_NAME}: ${role} server ready`);
	Players.PlayerAdded.Connect((player) => {
		print(`${player.Name} joined ${role}`);
	});
}
