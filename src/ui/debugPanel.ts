export type DebugPanel = {
  element: HTMLElement;
  setJson(payload: unknown | null): void;
  setText(text: string): void;
};

const stopEventPropagation = (event: Event) => {
  event.stopPropagation();
};

export const createDebugPanel = (parent: HTMLElement): DebugPanel => {
  const element = document.createElement("div");
  element.className = "debug-panel";

  let latestJson = "";
  const textElement = document.createElement("pre");
  textElement.className = "debug-panel-text";
  const jsonElement = document.createElement("pre");
  jsonElement.className = "debug-panel-text debug-panel-json";
  jsonElement.style.display = "none";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "debug-panel-copy";
  copyButton.textContent = "Copy debug JSON";
  copyButton.style.display = "none";

  element.append(textElement, jsonElement, copyButton);
  parent.appendChild(element);

  for (const eventName of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "auxclick", "dblclick", "wheel"]) {
    element.addEventListener(eventName, stopEventPropagation);
  }

  copyButton.addEventListener("click", async (event) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(latestJson);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy debug JSON";
      }, 1_200);
    } catch {
      copyButton.textContent = "Copy failed";
      window.setTimeout(() => {
        copyButton.textContent = "Copy debug JSON";
      }, 1_800);
    }
  });

  return {
    element,
    setJson(payload) {
      latestJson = payload === null ? "" : JSON.stringify(payload, null, 2);
      jsonElement.style.display = latestJson ? "block" : "none";
      jsonElement.textContent = latestJson ? `\ndebug json:\n${latestJson}` : "";
      copyButton.style.display = latestJson ? "block" : "none";
    },
    setText(text) {
      textElement.textContent = text;
    },
  };
};
