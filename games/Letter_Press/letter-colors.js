(() => {
  "use strict";

  // Each character keeps its base color in the tray, on the drum and in bonus reels.
  // Separate the colors of letters that share a level in word-levels.js.
  const colors = {
    A:"#58d962", B:"#fca4e6", C:"#5f8eff", D:"#35dfa0", E:"#ff6264", F:"#6af5dc",
    G:"#d2fff5", H:"#efbf37", I:"#ffef23", J:"#c5b69f", K:"#53bcd0", L:"#987aff",
    M:"#fcffaf", N:"#35ddfb", O:"#ffa220", P:"#ffe635", Q:"#fa836b", R:"#3bb7ff",
    S:"#f976ed", T:"#fffbf4", U:"#df83ad", V:"#78c955", W:"#c6c5d7", X:"#ffae98",
    Y:"#d884d4", Z:"#ffd0e1"
  };
  const models = window.ShapeModels;
  const templates = [
    ["", "letterTile", 0],
    ["Left", "letterTileLeft", -.34],
    ["Right", "letterTileRight", .34]
  ];
  const letters = Object.keys(colors);
  const names = {};
  for (const letter of letters) {
    for (const [suffix, template, letterOffset] of templates) {
      const kind = letter+suffix;
      models[kind] = { ...models[template], color:colors[letter], letter, letterOffset };
      names[kind] = suffix ? `Letter ${letter}, ${suffix.toLowerCase()} half` : `Letter ${letter}`;
    }
  }
  for (const [, template] of templates) delete models[template];
  window.LetterTiles = { letters, names };
})();
