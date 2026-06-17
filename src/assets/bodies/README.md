# Body Textures

These textures are stylized derivatives of NASA source imagery. The target look is recognizable and natural, but simplified enough to match the game's approximate simulation style.

## Regeneration

Run:

```sh
npm run generate:body-textures
```

The script downloads source files into `tmp/body-texture-sources/` and writes committed derivatives into this directory.

## Sources

- Earth source page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
- Earth source file: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/august/world.200408.3x5400x2700.jpg
- Moon source page: https://svs.gsfc.nasa.gov/4720/
- Moon source file: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg

Credit: NASA Blue Marble: Next Generation and NASA's Scientific Visualization Studio CGI Moon Kit.

NASA imagery/media usage guidance: https://www.nasa.gov/nasa-brand-center/images-and-media/

## Processing Notes

- Output projection: equirectangular latitude-longitude map, 2:1 aspect ratio.
- Output size: `2048x1024`.
- Runtime material: diffuse/base color only, high roughness, no normal/displacement/specular/cloud map stack.
- Earth processing softens satellite detail, reduces contrast and saturation, and keeps oceans/continents readable.
- Moon processing desaturates and warms the map, raises midtone readability, and softens harsh crater contrast.

Use `scripts/generateBodyTextures.mjs` as the source of truth for exact ImageMagick commands.
