import "./style.css";
import { createGameApp } from "./app/createGameApp";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app element");
}

createGameApp(app);
