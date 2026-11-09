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
    cookieHeart: "Bánh tim",
    cookieStar: "Bánh sao",
    cookieBear: "Bánh gấu",
    cookieJam: "Bánh hoa mứt",
    cookieBiscuit: "Bánh quy viền",
    cookieHeartLeft: "Nửa bánh tim",
    cookieHeartRight: "Nửa bánh tim",
    cookieStarLeft: "Nửa bánh sao",
    cookieStarRight: "Nửa bánh sao",
    syrupCandy: "Kẹo siro đường",
    pastryBox: "Hộp bánh đập",
    hammer: "Búa đập hộp",
    oven: "Lò mini",
    ovenOpen: "Lò đang mở"
  };
  const chapters = [
    ["Mẻ bánh đầu tiên", "Chọn bánh khớp hình ở hàng viền vàng. Bánh dành cho hàng sau sẽ nằm ở một trong 5 ô chờ. Lấp đủ hàng để xoay trụ.", "Ghép đúng hình ở hàng viền vàng."],
    ["Ô bọc giấy bạc", "Ghép một chiếc bánh vào ô ngay bên trái hoặc bên phải lớp giấy bạc để lộ hình cần ghép bên dưới.", "Ghép ô kế bên để bóc giấy bạc."],
    ["Kẹo siro đường", "Chạm viên kẹo nâu để kẹo tan ra và bám vào những chiếc bánh lộ ra gần nhất. Bánh dính siro không thể chọn trong 10 giây.", "Bánh dính siro không thể chọn trong 10 giây."],
    ["Hộp bánh đập", "Nhặt búa trong khay. Búa sẽ đập vỡ hộp bánh có biểu tượng búa và làm rơi bánh bên trong ra khay.", "Nhặt búa để đập hộp bánh."],
    ["Bánh hai nửa", "Nhặt hai nửa trái và phải của cùng một hình theo bất kỳ thứ tự nào. Nửa đầu nằm ở ô chờ. Khi nhặt nửa còn lại, cả hai bay vào giữa để ráp lại. Bánh ráp xong sẽ bay vào khuôn nếu hàng hiện tại cần nó.", "Nhặt hai nửa cùng hình để ráp bánh."],
    ["Lò mini", "Lò bắt đầu ở số 3. Mỗi chiếc bánh ghép đúng làm lò giảm 1. Khi về 0, cửa mở và bánh trong lò rơi xuống khay.", "Ghép đúng 3 chiếc bánh để mở lò."]
  ];

  // Cell references use two digits: one-based row, then one-based column.
  const layouts = [
    { rows: "hsbh sbhs bhsh hbsb", time: 125 },
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
