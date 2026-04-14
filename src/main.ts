import "./style.css";

import { createGameApp } from "./app/createGameApp";
import { gameConfig } from "./config/gameConfig";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
	throw new Error("Missing #app element");
}

const tabTitleSuffix = gameConfig.tabTitleSuffix?.trim();

if (tabTitleSuffix) {
	document.title = `${document.title} ${tabTitleSuffix}`;
}

createGameApp(app);
