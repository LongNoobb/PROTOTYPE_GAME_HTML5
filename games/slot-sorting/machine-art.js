/* Slot Sorting: editable procedural 3D toy model. Three.js 0.165.0.
 * All cabinet, glass, collar and trim surfaces are actual meshes.
 * This module owns geometry/art only; core.js owns the puzzle rules.
 */
export function createToyArt(THREE, RoundedBoxGeometry) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const capDepth = 0.28;
  const capSurfaceZ = (y, radius) => -0.48 + capDepth * Math.sqrt(Math.max(0, radius * radius - y * y)) + 0.06;

  function outline(w, h, radius) {
    const r = Math.min(radius, w / 2 - .001, h / 2 - .001), x = -w / 2, y = -h / 2;
    const s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + w - r, y);
    s.bezierCurveTo(x + w - r * .448, y, x + w, y + r * .448, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.bezierCurveTo(x + w, y + h - r * .448, x + w - r * .448, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.bezierCurveTo(x + r * .448, y + h, x, y + h - r * .448, x, y + h - r);
    s.lineTo(x, y + r);
    s.bezierCurveTo(x, y + r * .448, x + r * .448, y, x + r, y);
    return s;
  }

  function frame(outerW, outerH, innerW, innerH, radius, depth, bevel, material) {
    const s = outline(outerW, outerH, radius);
    const hole = new THREE.Path();
    hole.setFromPoints(outline(innerW, innerH, Math.max(.16, radius - (outerW - innerW) / 2)).getPoints(32));
    s.holes.push(hole);
    return new THREE.Mesh(new THREE.ExtrudeGeometry(s, {
      depth, steps: 1, curveSegments: 32,
      bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 6,
    }), material);
  }

  function piping(w, h, radius, thickness, material, z) {
    const pts = outline(w, h, radius).getPoints(32).map(p => v(p.x, p.y, z));
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 192, thickness, 10, true), material);
  }

  function box(w, h, d, r, mat, x, y, z) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, r), mat);
    mesh.position.set(x, y, z); return mesh;
  }

  function studio() {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(28, 32, 16), new THREE.MeshBasicMaterial({ color: 0x777280, side: THREE.BackSide })));
    // Large softboxes produce readable, broad highlights instead of many pinpoints.
    for (const [x,y,z,w,h,power] of [[-3,4,5,5,7,5], [5,3,4,2,6,2.6], [0,9,-1,6,3,3], [-3,-3,5,4,1,.8]]) {
      const light = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(power,power,power) }));
      light.position.set(x,y,z); light.lookAt(0,0,0); env.add(light);
    }
    return env;
  }

  function curvedPane(w,h,material) {
    const geometry = new THREE.PlaneGeometry(w,h,16,40), position = geometry.attributes.position;
    for (let i=0;i<position.count;i++) {
      const yy=position.getY(i)/(h/2);
      position.setZ(i,.46 + .16*Math.sqrt(Math.max(0,1-yy*yy)));
    }
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry,material);
  }

  function cabinet({width:w,windowHeight:h,colWidth,columns,binBase}, m) {
    const g = new THREE.Group(); g.name = 'Toy slot machine / sculpted cabinet';
    const outerH = h + 1.02, outerW = w + 1.24;
    const back = box(outerW-.12,outerH-.08,1.65,.48,m.purpleDark,0,0,-1.45);
    back.name='Deep molded rear shell'; g.add(back);

    for (const sign of [-1,1]) {
      const end = new THREE.Mesh(new THREE.CylinderGeometry(outerH/2,outerH/2,.24,80),m.purple);
      end.rotation.z=Math.PI/2; end.scale.z=capDepth;
      end.position.set(sign*(w/2+.48),0,-.48); end.name='Rounded drum end cap'; g.add(end);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.26,48),m.purpleDark);
      hub.rotation.z=Math.PI/2; hub.position.set(sign*(w/2+.58),-.24,-.48); g.add(hub);
    }

    const outer = frame(outerW,outerH,w+.50,h+.50,Math.min(1.5,outerW/2),.58,.11,m.purple);
    outer.position.z=-.27; outer.name='Rounded purple front molding'; g.add(outer);
    const inner = frame(w+.61,h+.61,w-.02,h-.02,Math.min(1.16,w/2),.19,.055,m.gold);
    inner.position.z=.25; inner.name='Gold window bezel'; g.add(inner);
    g.add(piping(w+.49,h+.49,Math.min(1.1,w/2),.024,m.goldLight,.49));
    const seal = frame(w+.025,h+.025,w-.075,h-.075,Math.min(.85,w/2),.045,.015,m.purpleDark);
    seal.position.z=.23; g.add(seal);

    const recess = box(w+.07,h+.07,.18,.22,m.window,0,0,-.42); recess.name='Matte slate drum backing'; g.add(recess);
    for (let c=1;c<columns;c++) {
      const seam = box(.022,h,.08,.009,m.goldDark,(c-columns/2)*colWidth,0,-.24); g.add(seam);
    }
    const pane=curvedPane(w-.04,h-.04,m.frontGlass); pane.name='Convex clear front cover'; pane.renderOrder=7; g.add(pane);

    // Two separate splayed legs and a curved plinth make the depth of the toy visible.
    const legTop=-outerH/2+.35, legBottom=binBase+.12, legHeight=legTop-legBottom;
    for(const sign of [-1,1]) {
      const leg=box(.62,legHeight,1.1,.2,m.purpleDark,sign*(w/2+.22),(legTop+legBottom)/2,-.75);
      leg.rotation.z=sign*-.20; leg.name='Splayed support leg'; g.add(leg);
    }
    const baseBack=box(w+1.50,1.20,1.50,.38,m.purple,0,binBase+.52,-.94); g.add(baseBack);
    const base=box(w+1.5,.38,2.85,.17,m.purple,0,binBase-.18,-.12); base.name='Wide toy pedestal'; g.add(base);
    g.add(box(w+1.34,.085,2.63,.04,m.purpleLight,0,binBase+.03,-.12));
    return g;
  }

  function lathe(points, segments=64) {
    return new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),segments);
  }

  // k narrows the hopper (neck radius stays matched to the pipes), ky compresses the shoulder.
  const widen=(r,k)=>r<=.27?r:.27+(r-.27)*k;
  function bottleGeometry(bottom, top, k=1, ky=1) {
    const height=top-bottom;
    // Short neck, generous rounded shoulder and a wide cylindrical hopper.
    const profile=[[.255,0],[.255,.36*ky],[.27,.46*ky],[.35,.55*ky],[.48,.67*ky],[.59,.84*ky],[.65,1.04*ky],[.66,1.23*ky],[.66,height]].map(([r,y])=>[widen(r,k),y]);
    const smooth=new THREE.SplineCurve(profile.map(([r,y])=>new THREE.Vector2(r,y))).getPoints(40);
    return new THREE.LatheGeometry(smooth,40);
  }

  function collarGeometry(radius,length) {
    const r=radius, l=length/2;
    return lathe([[r-.06,-l],[r-.015,-l],[r+.012,-l*.6],[r+.012,l*.6],[r-.015,l],[r-.06,l],[r-.06,-l]],28);
  }

  function bottleHighlights(bottom,top,k=1,ky=1) {
    const group=new THREE.Group(); group.name='Glass edge reflections';
    const profile=[[.24,.06,.10],[.24,.37*ky,.10],[.30,.53*ky,.15],[.46,.72*ky,.21],[.59,.99*ky,.24],[.61,1.24*ky,.25],[.61,top-bottom-.10,.25]].map(([x,y,z])=>[widen(x,k),y,z]);
    for(const sign of [-1,1]) {
      const points=profile.map(([x,y,z])=>v(sign*x,bottom+y,z));
      const material=new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:sign<0?.72:.42,roughness:.13,clearcoat:1,depthWrite:false});
      const edge=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,sign<0?.025:.016,8,false),material);
      edge.renderOrder=4; group.add(edge);
    }
    return group;
  }

  function brimGeometry(k=1) {
    return lathe([[.70,-.09],[.81,-.09],[.85,-.04],[.85,.11],[.81,.16],[.70,.16],[.70,-.09]].map(([r,y])=>[widen(r,k),y]));
  }

  function binGeometry(width,depth,height) {
    const s=outline(width,depth,.22), hole=new THREE.Path();
    hole.setFromPoints(outline(width-.24,depth-.24,.13).getPoints(24)); s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s,{depth:height,steps:1,curveSegments:28,bevelEnabled:true,bevelThickness:.075,bevelSize:.065,bevelSegments:5});
  }

  return {studio,cabinet,capSurfaceZ,outline,frame,piping,bottleGeometry,bottleHighlights,collarGeometry,brimGeometry,binGeometry,lathe};
}
