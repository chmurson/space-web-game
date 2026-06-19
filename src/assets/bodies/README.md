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
- Earth clouds source page: https://www.shadedrelief.com/natural3/pages/clouds.html
- Earth clouds source file: https://www.shadedrelief.com/natural3/ne3_data/8192/clouds/fair_clouds_8k.jpg
- Moon source page: https://svs.gsfc.nasa.gov/4720/
- Moon source file: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg

Credit: NASA Blue Marble: Next Generation, Natural Earth III cloud maps by Tom Patterson, and NASA's Scientific Visualization Studio CGI Moon Kit.

NASA imagery/media usage guidance: https://www.nasa.gov/nasa-brand-center/images-and-media/

## Processing Notes

- Output projection: equirectangular latitude-longitude map, 2:1 aspect ratio.
- Output sizes: Earth `4096x2048`; Earth clouds `4096x2048`; Moon `2048x1024`.
- Runtime material: diffuse/base color with a slightly raised transparent Earth cloud shell; high roughness, no normal/displacement/specular stack.
- Earth processing softens satellite detail, reduces contrast and saturation, and keeps oceans/continents readable.
- Earth cloud processing converts the black-background cloud map into a white WebP texture with alpha from luminance, then fades cloud alpha near the poles to avoid equirectangular pole-stretch artifacts on the sphere.
- Moon processing desaturates and warms the map, raises midtone readability, and softens harsh crater contrast.

Use `scripts/generateBodyTextures.mjs` as the source of truth for exact ImageMagick commands.
