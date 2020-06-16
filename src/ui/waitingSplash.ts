import { document } from "../util/globals.js";
import { Game } from "../Game.js";

const elem = document.getElementById("waiting-splash")!;

export const initSplashListeners = (game: Game): void => {
	game.addNetworkListener("init", ({ connections }) => {
		if (connections !== 0) elem.style.visibility = "visible";
	});

	game.addNetworkListener("state", () => {
		elem.style.visibility = "hidden";
	});
};
