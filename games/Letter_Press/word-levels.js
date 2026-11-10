(() => {
  "use strict";

  const { letters, names:letterNames } = window.LetterTiles;
  const blocked = null;
  const names = {
    ...letterNames, syrupCandy:"Ink spill", pastryBox:"Type box", hammer:"Mallet",
    oven:"Letter press", ovenOpen:"Open letter press"
  };
  const chapters = ["Animals", "Food & Drink", "Nature", "Around the House", "Ocean", "Space"];
  const howTo = [
    ["Build the word", "Use the clue to pick letters for the gold row. Ignore the × cells. Letters for later words go into the five waiting slots. Finish a word to turn the drum."],
    ["Foil", "Fill the letter immediately to the left or right of a foil cover to uncover that cell."],
    ["Ink spill", "Avoid the brown ink block. Tapping it coats nearby letters and locks them for 10 seconds."],
    ["Type box", "Tap the mallet to crack open the type box and release its letters."],
    ["Split letters", "Pick the two halves of the same letter in either order to join them. The first half uses one waiting slot."],
    ["Letter press", "Match three letters to open the press and release the blocks inside."]
  ];

  const clues = {
    CAT:"A pet that purrs",
    ACT:"A short performance in an animal show",
    SAT:"What a pet did when it obeyed ‘sit’",
    CAST:"The group of performers in a show",
    BEAR:"A large furry animal that can hibernate",
    BEE:"A flying insect that makes honey",
    EAR:"The body part used for hearing",
    RARE:"Unusual or hard to find",
    BARE:"Uncovered, with no fur or feathers",
    FOOT:"The part of a leg that touches the ground",
    FEET:"The irregular plural of foot",
    TOE:"A small digit at the end of a foot",
    FOE:"An enemy or rival",
    FEE:"Money you pay to enter a wildlife park",
    DOG:"A pet that barks",
    GOOSE:"A large water bird that honks",
    DOE:"A female deer",
    GEESE:"The irregular plural of goose",
    EGG:"Something in a shell that a bird lays",
    HARE:"A fast relative of the rabbit",
    SHEAR:"To clip the wool from a sheep",
    REAR:"To raise young animals",
    HEAR:"To sense a sound",
    SHARE:"To let others have some of your food",
    APPLE:"A crisp fruit that grows on trees",
    PEAS:"Small green seeds from pods",
    PEEL:"To remove the skin from a fruit",
    ALE:"A type of beer",
    SALE:"A limited time when items cost less",
    SALT:"White crystals used to season food",
    TEA:"A drink made by steeping leaves",
    TASTE:"The flavor you notice when eating",
    EAT:"To take a bite and swallow",
    SEAT:"A place to sit at a café",
    PEAR:"A fruit with a narrow neck",
    SEAR:"To brown meat quickly over high heat",
    REAP:"To harvest a crop from a field",
    SPARE:"The first word in ‘___ ribs’",
    SPEAR:"One stalk of asparagus",
    TOAST:"Browned slices of bread",
    OATS:"Grains often cooked into porridge",
    PASTA:"Noodles often served with sauce",
    PASTE:"A thick blend, such as mashed tomatoes",
    PLANT:"A living thing that grows roots",
    ANT:"A tiny insect that lives in a colony",
    TALL:"Like a tree that reaches high",
    TAN:"Skin color after time in the sun",
    NAP:"A short sleep, perhaps in the shade",
    STONE:"A small hard piece of rock",
    NEST:"A place where a bird lays eggs",
    TENT:"A portable shelter for camping",
    TONES:"Different shades in a landscape",
    NOTE:"A short written observation",
    NOSE:"The part of the face that senses smells",
    LEAF:"The flat green part of a plant",
    SEA:"A large area of salt water",
    FALL:"The season when leaves drop",
    FLEA:"A tiny jumping insect that can bite",
    SEAL:"A marine mammal with flippers",
    SAFE:"Protected from harm",
    TREE:"A tall plant with a woody trunk",
    REST:"A break to recover your energy",
    STAR:"A point of light in the night sky",
    EAST:"The direction where the Sun rises",
    TART:"A small open pastry filled with fruit",
    TEAR:"To rip a leaf into pieces",
    DEER:"A forest animal with antlers",
    REED:"A tall plant often found by water",
    SEED:"A tiny thing that can sprout",
    STEER:"A male farm animal raised as cattle",
    SET:"Matching items, like plates and bowls",
    TABLE:"A surface with legs for meals or work",
    BELT:"A strap worn around the waist",
    BELL:"It rings when you shake it",
    LABEL:"A tag that identifies what is inside",
    STOOL:"A seat without a back",
    POST:"An upright support for a railing",
    TOP:"The highest part of a piece of furniture",
    STOOP:"A small set of steps by a front door",
    POT:"A container for cooking or growing plants",
    SPOT:"A small stain to clean off",
    SHEET:"A thin layer of fabric on a bed",
    STEEL:"The metal used in many kitchen sinks",
    SHELL:"A hard outer covering left on the beach",
    HEEL:"The back part of a shoe",
    SELL:"To offer something in exchange for money",
    SOAP:"It makes bubbles when you wash",
    POTS:"Deep containers used for cooking",
    STOP:"The button that ends an appliance cycle",
    TAP:"It turns on the water at a sink",
    TOPS:"Lids that cover containers",
    BROOM:"A tool for sweeping floors",
    DOOR:"It swings open to let you in",
    ROOM:"A space inside a home",
    ROD:"A bar that can hold curtains",
    DORM:"A residence for students",
    BOOM:"A sudden loud, deep sound",
    MOOD:"How you feel at a particular time",
    EEL:"A long snake-like fish",
    LASH:"To fasten firmly with a rope",
    REEF:"A shallow ridge under the sea",
    FAR:"A long way away from shore",
    FEAR:"The feeling you get when you sense danger",
    TIDE:"The regular rise and fall of the sea",
    SITE:"A place to go diving",
    TIED:"Fastened to a dock with rope",
    DIET:"The kinds of food an animal usually eats",
    SIDE:"One of the long edges of a boat",
    SAIL:"A sheet that catches the wind to move a boat",
    SILT:"Fine sediment carried by water",
    TAIL:"The back part of a fish that helps it swim",
    ATLAS:"A book of maps",
    LAST:"At the very end of a sequence",
    LIST:"A written series of things to pack",
    COAST:"The land along the sea",
    COAT:"Outer clothing you can wear in sea spray",
    COST:"The amount you pay for something",
    TACO:"A folded tortilla, sometimes filled with fish",
    ERA:"A distinct period in the history of spaceflight",
    TEST:"A trial run to check that equipment works",
    MARS:"The red planet",
    ARM:"A jointed part of a robot",
    SEAM:"A line where two parts of a spacesuit join",
    RAM:"To hit another object head-on",
    SAME:"Identical in type or appearance",
    ORBIT:"The path around a planet or star",
    ROBOT:"A machine that can explore a planet",
    BOOT:"Footwear worn by an astronaut",
    BIT:"A single digit in the rover’s binary data",
    RIB:"A supporting piece inside a spacecraft hull",
    TRIO:"A group of three crew members",
    LASER:"A device that emits a narrow beam of light",
    REAL:"Actually happening, as opposed to simulated",
    ERASE:"To remove text from a mission log",
    LEASE:"An agreement to use property for a period",
    SPACE:"The region beyond our atmosphere",
    PEACE:"Harmony between nations exploring space",
    CAPE:"A coastal headland that can host a launch site",
    CASE:"A protective container for equipment",
    ACE:"An exceptionally skilled pilot",
    PACE:"The speed at which a rover moves",
    SEAS:"Large areas of salt water or dark lunar plains",
    CAP:"A cover that closes a valve or port"
  };

  // Each number in a mechanic list is a one-based row and column (e.g. 23).
  const layouts = [
    ["CAT ACT SAT CAST", null],
    ["BEAR BEE EAR RARE BARE", 125],
    ["FOOT FEET TOE FOE FEE", 115],
    ["DOG GOOSE DOE GEESE EGG", 120],
    ["HARE SHEAR REAR HEAR SHARE RARE", 120],

    ["APPLE PEAS PEEL ALE SALE", 125, {foil:[12]}],
    ["SALT TEA TASTE EAT SEAT", 120, {foil:[13,22]}],
    ["PEAR SEAR PEAS REAP SPARE SPEAR", 125, {foil:[12,14,33]}],
    ["TOAST OATS TEA TASTE SEAT EAT", 120, {foil:[12,13,23,42]}],
    ["PASTA TASTE PASTE SEAT PEAS EAT TEA", 125, {foil:[11,14,23,34,35,52]}],

    ["PLANT ANT TALL TAN NAP", 135, {syrup:[3]}],
    ["STONE NEST TENT TONES NOTE NOSE", 130, {syrup:[3]}],
    ["LEAF SEA FALL FLEA SEAL SAFE", 135, {syrup:[3,3]}],
    ["TREE REST STAR EAST TART TEAR", 125, {foil:[13,34],syrup:[4]}],
    ["DEER REED TREE SEED STEER REST SET", 135, {foil:[23,43,44],syrup:[4,4]}],

    ["TABLE BELT BELL TEA LABEL", 125, {box:[15,22,33]}],
    ["STOOL POST TOP STOOP POT SPOT", 125, {box:[13,21,43]}],
    ["SHEET STEEL SHELL HEEL SET SELL", 125, {box:[12,23,34,53]}],
    ["TOAST PASTA SOAP POTS STOP TAP TOPS", 135, {foil:[13,23,42],box:[14,24,44,54]}],
    ["BROOM DOOR ROOM ROD DORM BOOM MOOD", 140, {syrup:[4],box:[11,14,33,52]}],

    ["SHELL SEA SEAL EEL LASH", 125, {halves:[11]}],
    ["REEF SEA FAR EAR FEAR SAFE", 130, {halves:[11,22]}],
    ["TIDE SITE TIED SET DIET SIDE", 135, {halves:[14,21,33]}],
    ["SAIL SILT SALT TAIL ATLAS LAST LIST", 140, {foil:[13,23,44],halves:[12,32,41]}],
    ["COAST CAST COAT COST TACO CAT SAT", 145, {syrup:[3],box:[11,24,44],halves:[12,21,33]}],

    ["STAR EAST ERA TEST REST", 125, {oven:[14,22]}],
    ["MARS ARM SEAM ERA RAM SAME", 130, {oven:[14,23,43]}],
    ["ORBIT ROBOT BOOT BIT RIB TRIO", 140, {foil:[14,33,53],oven:[21,43,64]}],
    ["LASER SEAL REAL ERA ERASE EAR LEASE", 145, {syrup:[4],halves:[12,21,54],oven:[14,24,43]}],
    ["SPACE PEACE CAPE CASE ACE PACE SEAS CAP", 155, {foil:[13,24,44,72],syrup:[4,5],box:[23,34,52,82],halves:[11,22,43,53],oven:[15,33,64]}]
  ];

  const cellPosition = cell => [Math.floor(cell/10)-1,cell%10-1];
  const levels = Object.fromEntries(layouts.map(([list,time,mechanics = {}], index) => {
    const number = index+1;
    const words = list.split(" ");
    if (new Set(words).size !== words.length) {
      throw new Error(`Level ${number} contains a repeated word`);
    }
    const columns = number <= 3 ? 4 : 5;
    const rows = words.map(word => {
      const characters = [...word];
      if (!characters.length || characters.length > columns || characters.some(letter => !letters.includes(letter)) || !clues[word]) {
        throw new Error(`Invalid word or missing clue in level ${number}: ${word}`);
      }
      return [...characters,...Array(columns-characters.length).fill(blocked)];
    });
    const alphabet = [...new Set(words.join(""))];
    if (alphabet.length > columns) {
      throw new Error(`Level ${number} uses ${alphabet.length} distinct letters with only ${columns} columns`);
    }
    for (const cell of ["foil","box","halves","oven"].flatMap(key => mechanics[key] ?? [])) {
      const [row,column] = cellPosition(cell);
      if (!rows[row]?.[column]) throw new Error(`Level ${number}: mechanic covers an invalid cell (${cell})`);
    }
    return [number, {
      ...mechanics, rows, columns, alphabet, time, chapter:Math.floor(index/5), seed:3977+number*7919,
      clues:words.map(word => clues[word])
    }];
  }));

  window.WordLevels = { levels, chapters, names, howTo, blocked };
})();
