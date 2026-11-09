(() => {
  "use strict";

  const cookies = {
    h: "cookieHeart",
    s: "cookieStar",
    b: "cookieBear",
    j: "cookieJam",
    p: "cookieBiscuit"
  };
  const names = {
    cookieHeart: "Heart cookie",
    cookieStar: "Star cookie",
    cookieBear: "Bear cookie",
    cookieJam: "Jam flower cookie",
    cookieBiscuit: "Scalloped biscuit",
    cookieHeartLeft: "Heart cookie half",
    cookieHeartRight: "Heart cookie half",
    cookieStarLeft: "Star cookie half",
    cookieStarRight: "Star cookie half",
    syrupCandy: "Syrup candy",
    pastryBox: "Cookie box",
    hammer: "Hammer",
    oven: "Mini oven",
    ovenOpen: "Open oven"
  };
  const chapters = [
    ["First Batch", "Pick cookies that match the shapes in the gold row. Cookies for later rows go into one of five waiting slots. Fill the row to rotate the drum.", "Match the shapes in the gold row."],
    ["Foil-Wrapped Slots", "Match a cookie in the slot directly to the left or right of the foil to reveal the shape underneath.", "Match an adjacent slot to peel off the foil."],
    ["Syrup Candy", "Avoid tapping the brown candy. It coats the nearest exposed cookies and locks them for 10 seconds.", "Avoid the syrup candy. It locks cookies for 10 seconds."],
    ["Cookie Boxes", "Pick up the hammer in the tray to break open the box marked with a hammer and release the cookie inside.", "Pick up the hammer to break open the box."],
    ["Cookie Halves", "Pick the left and right halves of the same shape in either order. The first half goes into a waiting slot. When you pick the other half, they fly together. The whole cookie fits into the mold if the current row needs it.", "Pick two matching halves to make a whole cookie."],
    ["Mini Oven", "The oven starts at 3 and counts down each time you match a cookie. At 0, the door opens and drops the cookie into the tray.", "Match 3 cookies to open the oven."]
  ];

  // Cell references use two digits: one-based row, then one-based column.
  const layouts = [
    { rows: "hsbh sbhs bhsh hbsb", time: null },
    { rows: "hjsh shbj bjhs jshb hbjs", time: 125 },
    { rows: "sjbh bhjs jhsb hhjb sbbj", time: 115 },
    { rows: "hsbjp pshjb bphsj shjpb jhbps", time: 120 },
    { rows: "hjbps shspb bpjhj jshbs pjhsp bshjp", time: 120 },

    { rows: "hsbjp jhspb bsjhp phhjs shbpj", foil: [12], time: 125 },
    { rows: "shpjb pjhbs jbsph hsbbj bhpjs", foil: [13, 25], time: 120 },
    { rows: "bjpsh hsbhj spjbh phjsb hbspp jhspb", foil: [12, 14, 33], time: 125 },
    { rows: "pjsbh bshpj jjhbs spbph hjsbh bphsj", foil: [12, 13, 24, 42], time: 120 },
    { rows: "jhbsp sphbj bhpsj pbjhs hjssp spbhj bshjp", foil: [11, 14, 23, 34, 35, 52], time: 125 },

    { rows: "bhjps jsbhp hbpsj pbhjs sjpbh", syrup: [3], time: 135 },
    { rows: "hpjsb bsphj shjbp jhbps bjpbh phsjh", syrup: [3], time: 130 },
    { rows: "jphbs pshbj hbbjp sbpjs phsbh bjhps", syrup: [3, 3], time: 135 },
    { rows: "sbhjp jpbhh pshbj hjsbp jbshp bhpps", foil: [13, 34], syrup: [4], time: 125 },
    { rows: "psjhb hjbps bbshj shpjp jhpsb hsbhp spjbh", foil: [23, 43, 44], syrup: [4, 4], time: 135 },

    { rows: "hsjbp bhbjs bsjhb shbsj jsshb", box: [15, 22, 33], time: 125 },
    { rows: "jhbps shpbj hbsjp jpbhh bhpsj sphpb", box: [13, 21, 44], time: 125 },
    { rows: "phjbs jpshb sbhjp bhpss hhjbp psjbh", box: [12, 23, 34, 53], time: 125 },
    { rows: "sbhjp phshb hbjsp jsbph bjjhs hsppb jphbs", foil: [15, 23, 42], box: [14, 24, 45, 55], time: 135 },
    { rows: "bjpsh jhbsb psbhj sjhbp hbpjs phhbs sbsjp", syrup: [4], box: [11, 15, 33, 52], time: 140 },

    { rows: "hjbsp psbpj sjjpb bppsj jpsbs", halves: [11], time: 125 },
    { rows: "spjbh bhsjp jpbhh hsbbp psjhb bhpjs", halves: [11, 22], time: 130 },
    { rows: "bhpjs hsbbj sjhbp jphsb hbspp phjbs", halves: [15, 21, 33], time: 135 },
    { rows: "jhsbp sphbj bhjps hjspb pbjhs hbsjp jphbs", foil: [13, 25, 44], halves: [12, 32, 41], time: 140 },
    { rows: "pshbj hbpsj sjhbp bhjps jpbhh sbhjp phjsb", syrup: [3], box: [11, 24, 44], halves: [12, 21, 33], time: 145 },

    { rows: "hsbjh ppshb bhbps hphsb shbpp", oven: [14, 22], time: 125 },
    { rows: "psbhj jbhps hsppb bjhjs hspjb sphjb", oven: [15, 25, 43], time: 130 },
    { rows: "jhspb spjbh bhjps pbshj shjbp hbpjs pjshb", foil: [14, 33, 54], oven: [15, 21, 43], time: 140 },
    { rows: "bshjp hsjbp psbjh jphbs sbphj hjbsp bphjs", syrup: [4], halves: [12, 21, 54], oven: [15, 24, 44], time: 145 },
    { rows: "hsbjp pshjb bhpsj jphsb sbhjp hjbsp pjshb bshpj", foil: [13, 24, 44, 72], syrup: [4, 5],
      box: [23, 35, 52, 82], halves: [11, 22, 43, 53], oven: [15, 34, 64], time: 155 }
  ];

  const levels = Object.fromEntries(layouts.map(({ rows, ...config }, index) => [index+1, {
    ...config,
    rows: rows.split(" ").map(row => Array.from(row, code => cookies[code])),
    seed: 3977+(index+1)*7919,
    chapter: Math.floor(index/5)
  }]));

  window.Bakery = { levels, chapters, names, cookieKinds:Object.values(cookies) };
})();
