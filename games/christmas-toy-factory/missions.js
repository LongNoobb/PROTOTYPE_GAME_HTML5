/* Authored missions: slot reels announce the 1–3 toy types of a level; 4–8 toys
   must be assembled per level, 1–4 real parts per toy.
   The reveal animates; retries preserve the mission and its missing geometry. */
(() => {
  'use strict';
  // Thin glass (windows and the penguin's sunglasses) stays attached. Preserve catalog
  // slot indices for the baked atlas; only eligible assembly parts may become missing
  // geometry or tray stock.
  const fixedParts=new Set(['carWindow','carWindshield','rocketWindow']);
  const car=(...missing)=>({kind:'car',missing});
  const robot=(...missing)=>({kind:'robot',missing});
  const rocket=(...missing)=>({kind:'rocket',missing});
  const bothCar=()=>car('wheel','carRearWheel');
  const bothRobot=()=>robot('robotArm','robotPanel');
  const bothRocket=()=>rocket('rocketFin','rocketNozzle');
  const bear=(...missing)=>({kind:'bear',missing});
  const plane=(...missing)=>({kind:'plane',missing});
  const train=(...missing)=>({kind:'train',missing});
  const bothBear=()=>bear('bearEar','bearArm');
  const bothPlane=()=>plane('planeWing','planePropeller');
  const bothTrain=()=>train('trainWheel','trainChimney');
  const bus=(...missing)=>({kind:'bus',missing});
  const iceCreamTruck=(...missing)=>({kind:'iceCreamTruck',missing});
  const bothIceCream=()=>iceCreamTruck('iceCreamWheel','iceCreamSign');
  const t=kind=>({kind,missing:[]});
  const missions=[
    {title:'Ba điều ước đầu tiên',orders:[car('wheel'),robot('robotArm'),rocket('rocketNozzle')]},
    {title:'Đội xe giao quà',orders:[car('wheel'),car('carRearWheel'),bothCar()]},
    {title:'Những người bạn máy',orders:[robot('robotArm'),robot('robotPanel'),bothRobot()]},
    {title:'Chuyến bay Bắc Cực',orders:[rocket('rocketFin'),rocket('rocketNozzle'),bothRocket()]},
    {title:'Garage ông già Noel',orders:[bothCar(),robot('robotArm'),car('wheel')]},
    {title:'Trạm không gian',orders:[bothRocket(),robot('robotPanel'),rocket('rocketNozzle')]},
    {title:'Đội thợ tí hon',orders:[bothRobot(),bothCar(),robot('robotArm')]},
    {title:'Đường đua trên tuyết',orders:[bothCar(),bothCar(),rocket('rocketFin')]},
    {title:'Kỹ sư Bắc Cực',orders:[bothRobot(),bothRobot(),rocket('rocketNozzle')]},
    {title:'Ước mơ bay cao',orders:[bothRocket(),bothRocket(),car('carRearWheel')]},
    {title:'Xưởng đêm Giáng sinh',orders:[bothCar(),bothRobot(),bothRocket()]},
    {title:'Biệt đội robot Noel',orders:[bothRobot(),bothRobot(),bothRobot()]},
    {title:'Gấu bông mùa đông',orders:[bear('bearEar'),bear('bearArm'),bothBear()]},
    {title:'Phi đội quà tặng',orders:[plane('planeWing'),plane('planePropeller'),bothPlane()]},
    {title:'Tàu tốc hành Noel',orders:[train('trainWheel'),train('trainChimney'),bothTrain()]},
    {title:'Gấu và chuyến bay',orders:[bothBear(),bothPlane(),robot('robotPanel')]},
    {title:'Ga quà Giáng sinh',orders:[bothTrain(),bothBear(),car('wheel')]},
    {title:'Chuyến quà của ông Noel',orders:[bothBear(),bothPlane(),bothTrain()]},
    {title:'Xe buýt đón Giáng sinh',orders:[bus('busUpperDeck'),bus('busWheel'),bus('busUpperDeck','busWheel')]},
    {title:'Xe kem mùa tuyết',orders:[iceCreamTruck('iceCreamWheel'),iceCreamTruck('iceCreamSign'),bothIceCream()]},
    {title:'Đội xe lễ hội',orders:[bus('busWheel'),bothIceCream(),bothCar()]},
    {title:'Bầu trời đêm Noel',orders:[bothPlane(),bothRocket(),bothPlane()]},
    {title:'Chuyến hàng mùa đông',orders:[bothTrain(),bus('busWheel'),bothIceCream()]},
    {title:'Bữa tiệc quà Giáng sinh',orders:[bothBear(),bothIceCream(),bothPlane()]},
    // Levels 25+: the rest of the supplied FBX library, two new toys per level.
    {title:'Đội cứu hộ tuyết',orders:[t('ambulance'),t('sportsCar'),t('ambulance')]},
    {title:'Phố đồ ăn Giáng sinh',orders:[t('cadillac'),t('hotdogCart'),t('hotdogCart')]},
    {title:'Căn cứ đồ chơi',orders:[t('tank'),t('spaceship'),t('tank')]},
    {title:'Rừng thú bông',orders:[t('koala'),t('panda'),t('koala')]},
    {title:'Bạn thú mùa đông',orders:[t('polarBear'),t('tiger'),t('polarBear')]},
    {title:'Bữa tiệc kính râm',orders:[t('penguin'),t('doll'),t('penguin')]},
    {title:'Trang trại sa mạc',orders:[t('chicken'),t('cactus'),t('chicken')]},
    {title:'Góc xếp hình',orders:[t('lego'),t('yoyo'),t('lego')]},
    {title:'Sàn nhảy Noel',orders:[t('discoBall'),t('discoBall')]},
    {title:'Câu lạc bộ bi-a',orders:[t('poolBall'),t('billiardBall'),t('poolBall')]},
    {title:'Giỏ quà lò sưởi',orders:[t('easterEgg'),t('easterEgg')]},
    {title:'Đoàn xe đặc biệt',orders:[t('ambulance'),t('tank'),t('spaceship')]},
    {title:'Vườn thú Giáng sinh',orders:[t('panda'),t('penguin'),t('tiger')]},
    {title:'Đại tiệc xưởng đồ chơi',orders:[t('hotdogCart'),t('doll'),t('discoBall')]}
  ].map((mission,index)=>{
    // Slot reels only announce the distinct toy types; toyCount is how many toys ride the belt.
    const toyCount=Math.min(8,4+Math.floor(index/5)),maxPieces=Math.min(4,1+Math.floor((index+2)/4));
    const orders=Array.from({length:toyCount},(_,i)=>{
      const source=mission.orders[i%mission.orders.length];
      const parts=[...new Set([...source.missing,...window.ToyCatalog.toys[source.kind].slots.map(s=>s.kind)])].filter(kind=>!fixedParts.has(kind));
      // Toys with more than four parts start at a different part per toy, so every
      // part (head, legs ...) can be missing, not only the first four.
      const shift=parts.length>4?(i*maxPieces+index)%parts.length:0,order=[...parts.slice(shift),...parts.slice(0,shift)];
      return {kind:source.kind,missing:order.slice(0,1+(index+i)%maxPieces)};
    });
    mission={...mission,orders};
    const types=[...new Set(orders.map(o=>o.kind))];
    const counts={};for(const o of mission.orders)counts[o.kind]=(counts[o.kind]||0)+1;
    const names=Object.fromEntries(Object.entries(window.ToyCatalog.toys).map(([k,v])=>[k,v.name.toLowerCase()]));
    const parts=mission.orders.reduce((n,o)=>n+o.missing.length,0);
    return {...mission,types,slotCount:types.length,toyCount,level:index+1,goal:Object.entries(counts).map(([k,n])=>n+' '+names[k]).join(' · '),parts,stockCount:parts};
  });
  window.FactoryMissions=missions;
})();
