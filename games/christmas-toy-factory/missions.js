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
    shape:{name:'Shape recognition',tip:'Match the missing shape on the toy to a part in the tray.'},
    precision:{name:'Spot the difference',tip:'Similar parts can be tricky! Compare wheels, wings and ears before dropping them.'},
    tray:{name:'Search the tray',tip:'Parts overlap in the tray. Shake to uncover them, or use Hint if you get stuck.'},
    priority:{name:'Beat the clock',tip:'Prioritize toys closest to the exit. Tap a toy to focus on it.'},
    queue:{name:'Manage the queue',tip:'The first toy needs several parts. Avoid collecting too many parts for later toys: 5 full slots ends the level!'},
    speed:{name:'Control the speed',tip:'Hold SPEED UP when your parts are ready. Release it when a toy needs more work.'},
    master:{name:'Master all skills',tip:'Use every skill: match shapes quickly, prioritize urgent toys and keep the queue clear.'}
  };
  // L(skill, title, speed, 'kind:pieces', ...) — one entry per toy, in belt order.
  const L=(skill,title,speed,...toys)=>({skill,title,speed,toys:toys.map(s=>{const [kind,n]=s.split(':');return {kind,n:Number(n)};})});
  const authored=[
    // 1–5: recognize shapes with a small set of toys and 1–2 missing parts.
    L('shape','Three First Wishes',24,'car:1','car:1','car:1','car:1'),
    L('shape','Robot Friends',24,'robot:1','robot:1','robot:1','robot:1'),
    L('shape','Arctic Flight',25,'rocket:1','car:1','rocket:1','car:1'),
    L('shape','Winter Teddy Bears',25,'bear:1','plane:2','bear:2','plane:1'),
    L('shape','Christmas Express',26,'train:1','robot:2','train:2','robot:1'),
    // 6–9: distinguish similar wheels, wings and ears.
    L('precision','Gift Delivery Fleet',26,'car:2','train:2','bus:1','car:2','train:2'),
    L('precision','Snowy Ice Cream Trucks',26,'iceCreamTruck:2','bus:2','car:2','iceCreamTruck:2','bus:2'),
    L('precision','Christmas Night Sky',27,'plane:2','rocket:2','spaceship:2','plane:2','rocket:2','spaceship:2'),
    L('precision','Plush Toy Forest',27,'bear:2','koala:2','panda:2','bear:2','koala:2','panda:2'),
    // 10–13: search through overlapping parts in the tray.
    L('tray','Christmas Night Workshop',24,'robot:3','bear:3','plane:3','robot:3','bear:3','plane:3'),
    L('tray','Christmas Food Street',24,'hotdogCart:3','iceCreamTruck:3','train:3','ambulance:3','hotdogCart:3','train:3'),
    L('tray','Christmas Robot Squad',25,'robot:3','tiger:3','koala:3','spaceship:3','robot:3','tiger:3','koala:3'),
    L('tray','Building Block Corner',25,'lego:4','doll:3','discoBall:4','panda:3','lego:4','doll:3'),
    // 14–18: prioritize toys approaching the exit.
    L('priority','Snowy Speedway',32,'sportsCar:1','cadillac:1','car:1','sportsCar:2','cadillac:1','car:2'),
    L('priority','Special Convoy',34,'ambulance:2','tank:1','sportsCar:1','cadillac:2','ambulance:1','tank:1','sportsCar:2'),
    L('priority','Winter Animal Friends',35,'polarBear:2','penguin:2','chicken:2','bear:2','polarBear:1','penguin:2','chicken:1'),
    L('priority','Pool Club',36,'poolBall:1','billiardBall:2','yoyo:1','easterEgg:1','cactus:2','poolBall:2','billiardBall:1','yoyo:2'),
    L('priority','Christmas Gift Station',38,'train:2','bus:2','plane:2','rocket:2','robot:2','train:1','bus:1','plane:2'),
    // 19–23: manage queued parts while completing complex toys.
    L('queue','Winter Delivery',28,'robot:4','bear:1','plane:1','train:1','bear:1','plane:1'),
    L('queue','Santa’s Garage',29,'hotdogCart:4','iceCreamTruck:3','car:1','sportsCar:1','ambulance:1','car:1','sportsCar:1'),
    L('queue','Space Station',30,'spaceship:4','rocket:3','plane:1','rocket:1','plane:1','spaceship:1','tank:1'),
    L('queue','Christmas Zoo',31,'tiger:4','koala:4','panda:1','penguin:1','polarBear:1','panda:1','penguin:1','polarBear:1'),
    L('queue','Christmas Dance Floor',32,'discoBall:4','doll:4','lego:3','chicken:1','cactus:1','lego:1','chicken:1','cactus:1'),
    // 24–27: practice holding and releasing the speed boost.
    L('speed','A Leisurely Delivery',22,'car:1','bus:1','train:4','car:1','bus:1','train:4'),
    L('speed','Christmas Bus Ride',22,'bus:1','iceCreamTruck:4','ambulance:1','hotdogCart:4','bus:1','ambulance:1','iceCreamTruck:4'),
    L('speed','Bears Take Flight',23,'bear:1','plane:1','bear:4','plane:1','koala:1','panda:4','koala:1'),
    L('speed','Santa’s Gift Run',24,'robot:1','rocket:1','robot:4','train:1','rocket:1','plane:4','train:1','plane:1'),
    // 28–38: combine all skills with five toy types and up to four missing parts.
    L('master','Snow Rescue Team',34,'ambulance:3','sportsCar:2','iceCreamTruck:3','bus:2','train:3','ambulance:2','sportsCar:3','bus:1'),
    L('master','Toy Base',34,'tank:1','spaceship:3','hotdogCart:4','cadillac:2','sportsCar:2','spaceship:2','hotdogCart:2','tank:1'),
    L('master','Sunglasses Party',35,'penguin:3','doll:3','tiger:4','polarBear:2','panda:3','penguin:1','doll:2','tiger:2'),
    L('master','Desert Farm',35,'chicken:3','cactus:4','doll:2','penguin:2','tiger:3','chicken:2','cactus:1','doll:4'),
    L('master','Block Toy Corner',36,'lego:4','yoyo:2','cactus:3','chicken:4','doll:1','lego:2','yoyo:1','cactus:2'),
    L('master','Christmas Disco Night',36,'discoBall:4','yoyo:2','lego:3','cactus:2','chicken:3','discoBall:2','lego:1','yoyo:1'),
    L('master','Christmas Pool Night',37,'poolBall:3','billiardBall:2','discoBall:3','yoyo:2','lego:4','poolBall:1','billiardBall:3','discoBall:1'),
    L('master','Fireside Gift Basket',37,'easterEgg:1','billiardBall:3','poolBall:2','discoBall:4','yoyo:2','easterEgg:1','poolBall:3','discoBall:2'),
    L('master','Santa’s Escort',38,'ambulance:4','tank:1','spaceship:4','easterEgg:1','billiardBall:3','ambulance:2','spaceship:2','tank:1'),
    L('master','Plush Toy Festival',38,'panda:4','penguin:3','tiger:4','easterEgg:1','billiardBall:2','panda:2','tiger:3','penguin:1'),
    L('master','Toy Factory Celebration',38,'hotdogCart:3','doll:3','discoBall:3','robot:3','plane:3','hotdogCart:2','doll:2','discoBall:1')
  ];
  const catalog=window.ToyCatalog.toys;
  const names=Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.name.toLowerCase()]));
  // Gifts to pack per phase (6–12). Each level runs PHASES phases, so the level goal is
  // 3× this. Extra toys repeat the level's authored belt pattern, so each skill block
  // keeps its rhythm over a longer run.
  const giftTargets=[
    6,6,6,7,7,        // 1–5 shape
    7,8,8,8,          // 6–9 precision
    8,8,9,9,          // 10–13 tray
    9,10,10,11,12,    // 14–18 priority
    9,10,10,11,12,    // 19–23 queue
    9,10,10,11,       // 24–27 speed
    10,10,11,11,11,12,12,12,12,12,12 // 28–38 master
  ];
  const PHASES=3;
  // Keep the tray readable: repeated toys drop to one missing part beyond this stock.
  const MAX_STOCK=24;
  const partsOf=kind=>[...new Set(catalog[kind].slots.map(s=>s.kind))].filter(k=>!fixedParts.has(k));
  // Look-alike families: later phases swap each authored toy for an unused one from the
  // same family (similar parts keep the level's skill), falling back to any unused toy.
  const families=[
    ['car','bus','train','iceCreamTruck','ambulance','sportsCar','cadillac','hotdogCart','tank'],
    ['plane','rocket','spaceship'],
    ['bear','koala','panda','polarBear','tiger','penguin','chicken'],
    ['robot','doll','lego','cactus'],
    ['yoyo','discoBall','poolBall','billiardBall','easterEgg']
  ];
  const familyOf=Object.fromEntries(families.flatMap((f,i)=>f.map(k=>[k,i])));
  const allKinds=Object.keys(catalog);
  function substitutes(base,used,index,phase){
    const map={},want={};
    for(const {kind,n} of base)want[kind]=Math.max(want[kind]||0,n);
    for(const kind of new Set(base.map(t=>t.kind))){
      const need=Math.min(4,want[kind]),rot=index*3+phase*5;
      const rank=k=>(familyOf[k]===familyOf[kind]?0:100)+(partsOf(k).length>=need?0:10)+((allKinds.indexOf(k)+rot)%allKinds.length)/100;
      const pick=allKinds.filter(k=>!used.has(k)).sort((a,b)=>rank(a)-rank(b))[0]||kind;
      map[kind]=pick;used.add(pick);
    }
    return base.map(t=>({kind:map[t.kind],n:t.n}));
  }
  function buildPhase(base,total,index,phase){
    const toys=Array.from({length:total},(_,i)=>({...base[i%base.length]}));
    const pieces=toys.map(({kind,n})=>Math.max(1,Math.min(4,n,partsOf(kind).length)));
    for(let i=total-1,stock=pieces.reduce((a,b)=>a+b,0);i>=base.length&&stock>MAX_STOCK;i--){stock-=pieces[i]-1;pieces[i]=1;}
    const orders=toys.map(({kind},i)=>{
      const parts=partsOf(kind);
      const count=pieces[i];
      // Rotate the starting part so repeated toys miss different parts (head, legs ...).
      const shift=parts.length>count?(i+index+phase)%parts.length:0,order=[...parts.slice(shift),...parts.slice(0,shift)];
      return {kind,missing:order.slice(0,count)};
    });
    const types=[...new Set(orders.map(o=>o.kind))];
    const counts={};for(const o of orders)counts[o.kind]=(counts[o.kind]||0)+1;
    return {orders,types,slotCount:types.length,toyCount:orders.length,
      parts:orders.reduce((n,o)=>n+o.missing.length,0),
      goal:Object.entries(counts).map(([k,n])=>n+' '+names[k]).join(' · ')};
  }
  const missions=authored.map((mission,index)=>{
    // Phase count ramps up: 1 phase (tutorial levels 1–2), 2 phases (levels 3–9), then 3.
    // The gift total stays 3× the base target, split as evenly as possible.
    const phaseCount=Math.min(PHASES,index<2?1:index<9?2:3);
    const base=mission.toys,total=Math.max(giftTargets[index]||base.length,base.length)*PHASES;
    const used=new Set(base.map(t=>t.kind));
    const phases=Array.from({length:phaseCount},(_,p)=>{
      const size=Math.max(base.length,Math.floor(total/phaseCount)+(p<total%phaseCount?1:0));
      return buildPhase(p?substitutes(base,used,index,p):base,size,index,p);
    });
    const orders=phases.flatMap(p=>p.orders);
    const parts=phases.reduce((n,p)=>n+p.parts,0);
    const skill=skills[mission.skill];
    return {title:mission.title,phases,orders,types:[...new Set(orders.map(o=>o.kind))],toyCount:orders.length,level:index+1,speed:mission.speed,
      skill:mission.skill,skillName:skill.name,tip:skill.tip,
      goal:phases.map((p,i)=>'Phase '+(i+1)+': '+p.goal).join(' | '),parts,stockCount:parts};
  });
  window.FactoryMissions=missions;
})();
