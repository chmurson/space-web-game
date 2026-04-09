import { defineConfig, type Plugin } from "vite";
import { parse } from "yaml";

const yamlConfigPlugin = (): Plugin => ({
  name: "space-game-yaml-config",
  enforce: "pre",
  transform(source, id) {
    if (!id.endsWith(".yml") && !id.endsWith(".yaml")) {
      return null;
    }

    return {
      code: `export default ${JSON.stringify(parse(source) ?? {})};`,
      map: null,
    };
  },
});

export default defineConfig({
  plugins: [yamlConfigPlugin()],
});
