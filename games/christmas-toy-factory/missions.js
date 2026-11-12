/* Authored missions, grouped into a skill curriculum: each block of 3–5 levels trains
   one core skill, then the final block mixes them all.
   Slot reels announce the 1–5 toy types of a level; 4–8 toys ride the belt and each
   toy is missing 1–4 real parts. `speed` is the cruise belt speed in px/s.
   The reveal animates; retries preserve the mission and its missing geometry. */
(() => {
  'use strict';
  // Thin glass (windows and the penguin's sunglasses) stays attached. Preserve catalog
  // slot indices for the baked atlas; only eligible assembly parts may become missing
  // geometry or tray stock.
  const fixedParts=new Set(['carWindow','carWindshield','rocketWindow']);
  const skills={
    shape:{name:'Nhận diện hình dạng',tip:'Nhìn chỗ khuyết trên đồ chơi, tìm mảnh cùng hình trong khay.'},
    precision:{name:'Chính xác & loại trừ',tip:'Mảnh trông giống nhau! Bánh, cánh, tai mỗi đồ chơi một kiểu — so kỹ rồi mới thả.'},
    tray:{name:'Lục khay linh kiện',tip:'Khay đầy mảnh chồng nhau. Xóc hộp để lộ mảnh bị che, bí thì dùng Gợi ý.'},
    priority:{name:'Ưu tiên theo thời gian',tip:'Băng chuyền nhanh! Lắp món gần cửa ra trước, chạm đồ chơi để ghim mục tiêu.'},
    queue:{name:'Quản lý hàng đợi',tip:'Món đầu cần nhiều mảnh. Đừng nhặt trước quá nhiều mảnh của món sau — đầy 5 ô là thua!'},
    speed:{name:'Kiểm soát tốc độ',tip:'Băng chuyền chậm. Giữ TĂNG TỐC khi đã sẵn mảnh, thả ra khi món nhiều mảnh tới gần.'},
    master:{name:'Tổng hợp',tip:'Mọi kỹ năng cùng lúc: nhận hình nhanh, ưu tiên món sắp ra, giữ hàng đợi gọn.'}
  };
  // L(skill, title, speed, 'kind:pieces', ...) — one entry per toy, in belt order.
  const L=(skill,title,speed,...toys)=>({skill,title,speed,toys:toys.map(s=>{const [kind,n]=s.split(':');return {kind,n:Number(n)};})});
  const authored=[
    // 1–5 · Nhận diện hình dạng: ít loại, 1–2 mảnh, băng chậm.
    L('shape','Ba điều ước đầu tiên',24,'car:1','car:1','car:1','car:1'),
    L('shape','Những người bạn máy',24,'robot:1','robot:1','robot:1','robot:1'),
    L('shape','Chuyến bay Bắc Cực',25,'rocket:1','car:1','rocket:1','car:1'),
    L('shape','Gấu bông mùa đông',25,'bear:1','plane:2','bear:2','plane:1'),
    L('shape','Tàu tốc hành Noel',26,'train:1','robot:2','train:2','robot:1'),
    // 6–9 · Chính xác & loại trừ: các loại có mảnh na ná nhau (bánh xe, cánh, tai).
    L('precision','Đội xe giao quà',26,'car:2','train:2','bus:1','car:2','train:2'),
    L('precision','Xe kem mùa tuyết',26,'iceCreamTruck:2','bus:2','car:2','iceCreamTruck:2','bus:2'),
    L('precision','Bầu trời đêm Noel',27,'plane:2','rocket:2','spaceship:2','plane:2','rocket:2','spaceship:2'),
    L('precision','Rừng thú bông',27,'bear:2','koala:2','panda:2','bear:2','koala:2','panda:2'),
    // 10–13 · Lục khay: 18–24 mảnh trong khay, băng chậm để có thời gian xóc và tìm.
    L('tray','Xưởng đêm Giáng sinh',24,'robot:3','bear:3','plane:3','robot:3','bear:3','plane:3'),
    L('tray','Phố đồ ăn Giáng sinh',24,'hotdogCart:3','iceCreamTruck:3','train:3','ambulance:3','hotdogCart:3','train:3'),
    L('tray','Biệt đội robot Noel',25,'robot:3','tiger:3','koala:3','spaceship:3','robot:3','tiger:3','koala:3'),
    L('tray','Góc xếp hình',25,'lego:4','doll:3','discoBall:4','panda:3','lego:4','doll:3'),
    // 14–18 · Ưu tiên theo thời gian: băng nhanh dần, mỗi món ít mảnh.
    L('priority','Đường đua trên tuyết',32,'sportsCar:1','cadillac:1','car:1','sportsCar:2','cadillac:1','car:2'),
    L('priority','Đoàn xe đặc biệt',34,'ambulance:2','tank:1','sportsCar:1','cadillac:2','ambulance:1','tank:1','sportsCar:2'),
    L('priority','Bạn thú mùa đông',35,'polarBear:2','penguin:2','chicken:2','bear:2','polarBear:1','penguin:2','chicken:1'),
    L('priority','Câu lạc bộ bi-a',36,'poolBall:1','billiardBall:2','yoyo:1','easterEgg:1','cactus:2','poolBall:2','billiardBall:1','yoyo:2'),
    L('priority','Ga quà Giáng sinh',38,'train:2','bus:2','plane:2','rocket:2','robot:2','train:1','bus:1','plane:2'),
    // 19–23 · Quản lý hàng đợi: món đầu nặng, sau là nhiều món nhẹ khác loại dễ nhặt trước.
    L('queue','Chuyến hàng mùa đông',28,'robot:4','bear:1','plane:1','train:1','bear:1','plane:1'),
    L('queue','Garage ông già Noel',29,'hotdogCart:4','iceCreamTruck:3','car:1','sportsCar:1','ambulance:1','car:1','sportsCar:1'),
    L('queue','Trạm không gian',30,'spaceship:4','rocket:3','plane:1','rocket:1','plane:1','spaceship:1','tank:1'),
    L('queue','Vườn thú Giáng sinh',31,'tiger:4','koala:4','panda:1','penguin:1','polarBear:1','panda:1','penguin:1','polarBear:1'),
    L('queue','Sàn nhảy Noel',32,'discoBall:4','doll:4','lego:3','chicken:1','cactus:1','lego:1','chicken:1','cactus:1'),
    // 24–27 · Kiểm soát tốc độ: băng chậm, xen kẽ món nhẹ (nên tăng tốc) và món nặng (nên thả).
    L('speed','Chuyến quà thong thả',22,'car:1','bus:1','train:4','car:1','bus:1','train:4'),
    L('speed','Xe buýt đón Giáng sinh',22,'bus:1','iceCreamTruck:4','ambulance:1','hotdogCart:4','bus:1','ambulance:1','iceCreamTruck:4'),
    L('speed','Gấu và chuyến bay',23,'bear:1','plane:1','bear:4','plane:1','koala:1','panda:4','koala:1'),
    L('speed','Chuyến quà của ông Noel',24,'robot:1','rocket:1','robot:4','train:1','rocket:1','plane:4','train:1','plane:1'),
    // 28–38 · Tổng hợp: 5 loại, 8 món, tới 4 mảnh, băng 34–38 px/s.
    L('master','Đội cứu hộ tuyết',34,'ambulance:3','sportsCar:2','iceCreamTruck:3','bus:2','train:3','ambulance:2','sportsCar:3','bus:1'),
    L('master','Căn cứ đồ chơi',34,'tank:1','spaceship:3','hotdogCart:4','cadillac:2','sportsCar:2','spaceship:2','hotdogCart:2','tank:1'),
    L('master','Bữa tiệc kính râm',35,'penguin:3','doll:3','tiger:4','polarBear:2','panda:3','penguin:1','doll:2','tiger:2'),
    L('master','Trang trại sa mạc',35,'chicken:3','cactus:4','doll:2','penguin:2','tiger:3','chicken:2','cactus:1','doll:4'),
    L('master','Góc đồ chơi xếp hình',36,'lego:4','yoyo:2','cactus:3','chicken:4','doll:1','lego:2','yoyo:1','cactus:2'),
    L('master','Đêm disco Giáng sinh',36,'discoBall:4','yoyo:2','lego:3','cactus:2','chicken:3','discoBall:2','lego:1','yoyo:1'),
    L('master','Đêm bi-a Giáng sinh',37,'poolBall:3','billiardBall:2','discoBall:3','yoyo:2','lego:4','poolBall:1','billiardBall:3','discoBall:1'),
    L('master','Giỏ quà lò sưởi',37,'easterEgg:1','billiardBall:3','poolBall:2','discoBall:4','yoyo:2','easterEgg:1','poolBall:3','discoBall:2'),
    L('master','Đoàn hộ tống ông Noel',38,'ambulance:4','tank:1','spaceship:4','easterEgg:1','billiardBall:3','ambulance:2','spaceship:2','tank:1'),
    L('master','Đêm hội thú bông',38,'panda:4','penguin:3','tiger:4','easterEgg:1','billiardBall:2','panda:2','tiger:3','penguin:1'),
    L('master','Đại tiệc xưởng đồ chơi',38,'hotdogCart:3','doll:3','discoBall:3','robot:3','plane:3','hotdogCart:2','doll:2','discoBall:1')
  ];
  const catalog=window.ToyCatalog.toys;
  const names=Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.name.toLowerCase()]));
  // Gifts to pack per level (6–12). Extra toys repeat the level's authored belt pattern,
  // so each skill block keeps its rhythm over a longer run.
  const giftTargets=[
    6,6,6,7,7,        // 1–5 shape
    7,8,8,8,          // 6–9 precision
    8,8,9,9,          // 10–13 tray
    9,10,10,11,12,    // 14–18 priority
    9,10,10,11,12,    // 19–23 queue
    9,10,10,11,       // 24–27 speed
    10,10,11,11,11,12,12,12,12,12,12 // 28–38 master
  ];
  // Keep the tray readable: repeated toys drop to one missing part beyond this stock.
  const MAX_STOCK=24;
  const partsOf=kind=>[...new Set(catalog[kind].slots.map(s=>s.kind))].filter(k=>!fixedParts.has(k));
  const missions=authored.map((mission,index)=>{
    const base=mission.toys,total=Math.max(giftTargets[index]||base.length,base.length);
    const toys=Array.from({length:total},(_,i)=>({...base[i%base.length]}));
    const pieces=toys.map(({kind,n})=>Math.max(1,Math.min(4,n,partsOf(kind).length)));
    for(let i=total-1,stock=pieces.reduce((a,b)=>a+b,0);i>=base.length&&stock>MAX_STOCK;i--){stock-=pieces[i]-1;pieces[i]=1;}
    const orders=toys.map(({kind},i)=>{
      const parts=partsOf(kind);
      const count=pieces[i];
      // Rotate the starting part so repeated toys miss different parts (head, legs ...).
      const shift=parts.length>count?(i+index)%parts.length:0,order=[...parts.slice(shift),...parts.slice(0,shift)];
      return {kind,missing:order.slice(0,count)};
    });
    const types=[...new Set(orders.map(o=>o.kind))];
    const counts={};for(const o of orders)counts[o.kind]=(counts[o.kind]||0)+1;
    const parts=orders.reduce((n,o)=>n+o.missing.length,0);
    const skill=skills[mission.skill];
    return {title:mission.title,orders,types,slotCount:types.length,toyCount:orders.length,level:index+1,speed:mission.speed,
      skill:mission.skill,skillName:skill.name,tip:skill.tip,
      goal:Object.entries(counts).map(([k,n])=>n+' '+names[k]).join(' · '),parts,stockCount:parts};
  });
  window.FactoryMissions=missions;
})();
