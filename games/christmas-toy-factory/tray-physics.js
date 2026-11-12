(() => {
  "use strict";

  const { Body, Box, ConvexPolyhedron, SAPBroadphase, Vec3, World } = ShapeRigid;
  const PIXELS = 50;
  const STEP = 1 / 60;
  const STEP_BUDGET_MS = 12;
  const bounds = { left:58, right:480, top:710, bottom:1030 };

  function convexOutline(points) {
    const sorted = points.map(([x,y]) => [x,-y]).sort((a,b) => a[0]-b[0] || a[1]-b[1]);
    function edge(list) {
      const result = [];
      for (const point of list) {
        while (result.length > 1) {
          const [ax,ay] = result.at(-2);
          const [bx,by] = result.at(-1);
          if ((bx-ax)*(point[1]-ay)-(by-ay)*(point[0]-ax) > .00001) break;
          result.pop();
        }
        result.push(point);
      }
      result.pop();
      return result;
    }
    const outline = [...edge(sorted), ...edge(sorted.reverse())];
    if (outline.length <= 10) return outline;
    // Keep the cheaper hull outside the rendered corners.
    const reduced = outline.filter((_,i) => i%2 === 0);
    let scale = 1;
    for (let i = 0; i < reduced.length; i++) {
      const [ax,ay] = reduced[i];
      const [bx,by] = reduced[(i+1)%reduced.length];
      const nx = by-ay, ny = ax-bx;
      const boundary = nx*ax+ny*ay;
      if (boundary <= 0) return outline;
      for (const [x,y] of outline) scale = Math.max(scale,(nx*x+ny*y)/boundary);
    }
    return reduced.map(([x,y]) => [x*scale,y*scale]);
  }

  const outlines = Object.fromEntries(Object.entries(window.ShapeModels)
    .map(([kind,{outline}]) => [kind,convexOutline(outline)]));

  // Wheels tumble as real cylinders instead of flat slabs, so a poured wheel can
  // land face-up, tilted, or standing on its tyre. The axle is toy +Z carried
  // through the builder's VIEW tilt (Euler XYZ 18°, -20°), in the renderer frame
  // (model Y flipped). Track rollers (thicker than they are round) stay slabs.
  const AXLE = (() => {
    const a = 20*Math.PI/180, b = 18*Math.PI/180;
    return [-Math.sin(a)*Math.cos(b), Math.sin(b), Math.cos(a)*Math.cos(b)];
  })();
  const wheels = Object.fromEntries(Object.entries(window.ShapeModels)
    .filter(([kind]) => /wheel/i.test(kind))
    .map(([kind,{vertices}]) => {
      let low = Infinity, high = -Infinity, radius = 0;
      for (let i = 0; i < vertices.length; i += 6) {
        const p = [vertices[i],-vertices[i+1],vertices[i+2]];
        const t = p[0]*AXLE[0]+p[1]*AXLE[1]+p[2]*AXLE[2];
        low = Math.min(low,t);
        high = Math.max(high,t);
        radius = Math.max(radius,Math.hypot(p[0]-t*AXLE[0],p[1]-t*AXLE[1],p[2]-t*AXLE[2]));
      }
      return [kind,{radius, half:(high-low)/2, middle:(high+low)/2}];
    })
    .filter(([,wheel]) => wheel.half < wheel.radius*.6));

  const trueProportions = new Set(["robotAntenna"]);
  function pieceSize(piece) {
    const radius = piece.size * .329;
    // Wheels keep their true modelled thickness (renderer z scale = radius).
    if (!piece.fixed && wheels[piece.kind]) return {radius, depth: radius*window.ShapeModels[piece.kind].depth};
    if (piece.fixed) return {radius, depth: piece.size*.146};
    // Loose parts keep at least their true modelled thickness. The old shared slab
    // depth squashed chunky parts (rocket base, legs, studs, ball patches) to
    // 20–60% along the view axis, so they read as flat 2D stickers. Thin parts
    // keep the slab minimum so they stay easy to see and grab.
    const model = window.ShapeModels[piece.kind];
    // Round parts must keep true proportions: stretching the antenna's stick and ball
    // to the slab minimum turned them into a flat blade and disc.
    if (model && trueProportions.has(piece.kind)) return {radius, depth: radius*model.depth};
    const slab = piece.size*(piece.kind === "hammer" ? .069 : .099);
    return {radius, depth: Math.max(slab, model ? radius*model.depth : 0)};
  }

  // Parts whose colour only reads from one broad face (the striped ice-cream canopy)
  // always land with that face toward the camera and never tip over. The face normal
  // is the mesh's thinnest principal axis, signed toward model +Y (the part's top).
  const faceUp = Object.fromEntries(["iceCreamWindow"].filter(kind => window.ShapeModels[kind]).map(kind => {
    const v = window.ShapeModels[kind].vertices, points = [];
    for (let i = 0; i < v.length; i += 6) points.push([v[i],-v[i+1],v[i+2]]);
    const extent = n => {
      let low = Infinity, high = -Infinity;
      for (const p of points) { const t = n[0]*p[0]+n[1]*p[1]+n[2]*p[2]; low = Math.min(low,t); high = Math.max(high,t); }
      return high-low;
    };
    const normal = principalFrame(points).reduce((a,b) => extent(b) < extent(a) ? b : a);
    return [kind, normal[1] > 0 ? normal.map(x => -x) : normal];
  }));

  function cylinder(wheel, scale) {
    const SEGMENTS = 16;
    const axis = new Vec3(...AXLE);
    const u = axis.cross(Math.abs(axis.x) < .9 ? new Vec3(1,0,0) : new Vec3(0,1,0));
    u.normalize();
    const v = axis.cross(u);
    const vertices = [];
    for (const side of [-1,1]) {
      const offset = (wheel.middle+side*wheel.half)*scale;
      for (let i = 0; i < SEGMENTS; i++) {
        const angle = i/SEGMENTS*Math.PI*2;
        const c = Math.cos(angle)*wheel.radius*scale, s = Math.sin(angle)*wheel.radius*scale;
        vertices.push(new Vec3(
          u.x*c+v.x*s+axis.x*offset, u.y*c+v.y*s+axis.y*offset, u.z*c+v.z*s+axis.z*offset));
      }
    }
    // u × v = axle, so increasing angle winds counter-clockwise seen from +axle.
    const top = Array.from({length:SEGMENTS},(_,i) => i+SEGMENTS);
    const bottom = Array.from({length:SEGMENTS},(_,i) => SEGMENTS-i-1);
    const sides = Array.from({length:SEGMENTS},(_,i) => {
      const next = (i+1)%SEGMENTS;
      return [i,next,next+SEGMENTS,i+SEGMENTS];
    });
    return new ConvexPolyhedron({vertices, faces:[bottom,...sides,top]});
  }

  // Drop pose for a wheel: the axle's tilt from vertical decides how it lands.
  // Just over half start near flat, a third mid-tilt (they topple either way) and the
  // rest (~12%) close to upright, so the tray mixes hub faces and striped treads.
  function tumblePose(body) {
    const Quaternion = body.quaternion.constructor;  // not exported by the ShapeRigid bundle
    const roll = Math.random();
    const tilt = (roll < .55 ? Math.random()*30 : roll < .88 ? 30+Math.random()*35 : 68+Math.random()*22)*Math.PI/180;
    const heading = Math.random()*Math.PI*2;
    const flip = Math.random() < .5 ? -1 : 1;
    const down = new Vec3(Math.sin(tilt)*Math.cos(heading),Math.sin(tilt)*Math.sin(heading),Math.cos(tilt)*flip);
    const align = new Quaternion().setFromVectors(new Vec3(...AXLE),down);
    const spin = new Quaternion().setFromAxisAngle(down,Math.random()*Math.PI*2);
    spin.mult(align,body.quaternion);
  }

  // Loose parts collide as a convex polytope fitted around their real mesh (in
  // the renderer frame, unit radius), so a wing settles flat, a propeller on its
  // blades and a leg on its side, instead of every part lying as an outline slab.
  // The polytope is a k-DOP: planes in 13 directions (3 axes, 6 edge and 4 corner
  // diagonals) of the part's own principal frame, each moved out to touch the mesh.
  // It always encloses every vertex, so neighbours can never sink into a part
  // (a hull through sampled vertices fell short by ~9% of the radius on wings and
  // blades), and it stays cheap: at most 26 faces sharing 13 separating axes.
  const DOP = [[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,-1,0],[1,0,1],[1,0,-1],[0,1,1],[0,1,-1],
    [1,1,1],[1,1,-1],[1,-1,1],[-1,1,1]].map(d => { const l = Math.hypot(...d); return d.map(v => v/l); });
  function principalFrame(points) {
    const n = points.length;
    const mean = [0,1,2].map(a => points.reduce((s,p) => s+p[a],0)/n);
    const m = [0,1,2].map(a => [0,1,2].map(b => points.reduce((s,p) => s+(p[a]-mean[a])*(p[b]-mean[b]),0)/n));
    const v = [[1,0,0],[0,1,0],[0,0,1]];
    for (let sweep = 0; sweep < 24; sweep++) for (const [p,q] of [[0,1],[0,2],[1,2]]) {
      if (Math.abs(m[p][q]) < 1e-12) continue;    // Jacobi rotation zeroing m[p][q]
      const theta = (m[q][q]-m[p][p])/(2*m[p][q]);
      const t = Math.sign(theta || 1)/(Math.abs(theta)+Math.sqrt(theta*theta+1));
      const c = 1/Math.sqrt(t*t+1), s = t*c;
      for (let k = 0; k < 3; k++) {
        const mkp = m[k][p], mkq = m[k][q];
        m[k][p] = c*mkp-s*mkq; m[k][q] = s*mkp+c*mkq;
      }
      for (let k = 0; k < 3; k++) {
        const mpk = m[p][k], mqk = m[q][k];
        m[p][k] = c*mpk-s*mqk; m[q][k] = s*mpk+c*mqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c*vkp-s*vkq; v[k][q] = s*vkp+c*vkq;
      }
    }
    return [0,1,2].map(a => [v[0][a],v[1][a],v[2][a]]);   // eigenvectors as rows
  }
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  // Corners and faces of the polytope bounded by planes [normal, offset]. Each
  // corner remembers exactly which planes pass through it, and a face is the ring
  // of corners on its plane, so neighbouring faces always share whole edges.
  // Returns null unless the result is a closed, consistently wound polyhedron.
  function polytope(planes) {
    const corners = [];
    for (let i = 0; i < planes.length; i++) for (let j = i+1; j < planes.length; j++) {
      const ij = cross(planes[i][0],planes[j][0]);
      if (dot(ij,ij) < 1e-10) continue;
      for (let k = j+1; k < planes.length; k++) {
        const det = dot(planes[k][0],ij);
        if (Math.abs(det) < 1e-8) continue;
        const [ni,di] = planes[i], [nj,dj] = planes[j], [nk,dk] = planes[k];
        const jk = cross(nj,nk), ki = cross(nk,ni);
        const p = [0,1,2].map(x => (di*jk[x]+dj*ki[x]+dk*ij[x])/det);
        if (planes.some(([n,d]) => dot(n,p) > d+1e-7)) continue;
        const on = planes.map(([n,d],m) => Math.abs(dot(n,p)-d) < 1e-7 ? m : -1).filter(m => m >= 0);
        const twin = corners.find(c => Math.hypot(c.p[0]-p[0],c.p[1]-p[1],c.p[2]-p[2]) < 1e-6);
        if (twin) on.forEach(m => twin.on.add(m)); else corners.push({p,on:new Set(on)});
      }
    }
    const faces = [];
    const axes = [];
    planes.forEach(([n],m) => {
      const ring = corners.map((c,i) => i).filter(i => corners[i].on.has(m));
      if (ring.length < 3) return;
      const centre = [0,1,2].map(x => ring.reduce((t,i) => t+corners[i].p[x],0)/ring.length);
      const u = cross(n,Math.abs(n[0]) < .9 ? [1,0,0] : [0,1,0]);
      const w = cross(n,u);
      const angle = i => { const r = corners[i].p.map((v,x) => v-centre[x]); return Math.atan2(dot(r,w),dot(r,u)); };
      ring.sort((a,b) => angle(a)-angle(b));
      // The physics engine takes a face's normal from its first three corners, so
      // start the loop at the corner that makes that triangle largest.
      const area = start => {
        const [a,b,c] = [0,1,2].map(o => corners[ring[(start+o)%ring.length]].p);
        return Math.hypot(...cross(b.map((v,x) => v-a[x]),c.map((v,x) => v-a[x])));
      };
      let first = 0;
      for (let i = 1; i < ring.length; i++) if (area(i) > area(first)) first = i;
      faces.push([...ring.slice(first),...ring.slice(0,first)]);
      if (!axes.some(x => Math.abs(dot(x,n)) > .9999)) axes.push(n);
    });
    // Closed and consistently wound: every edge is used once each way, V-E+F = 2.
    const edges = new Set();
    for (const f of faces) f.forEach((x,j) => edges.add(x+">"+f[(j+1)%f.length]));
    const closed = faces.length >= 4 && [...edges].every(e => edges.has(e.split(">").reverse().join(">"))) &&
      corners.length-edges.size/2+faces.length === 2 &&
      faces.every(f => area0(f.map(i => corners[i].p)) > 1e-9);
    return closed ? {points:corners.map(c => c.p), faces, axes} : null;
  }
  const area0 = ([a,b,c]) => Math.hypot(...cross(b.map((v,x) => v-a[x]),c.map((v,x) => v-a[x])));

  const hulls = new Map();
  function hull(kind, zScale) {
    const key = kind+"|"+zScale.toFixed(5);
    if (hulls.has(key)) return hulls.get(key);
    const source = window.ShapeModels[kind].vertices;
    const all = [];
    for (let i = 0; i < source.length; i += 6) all.push([source[i],-source[i+1],source[i+2]*zScale]);
    const [e0,e1,e2] = principalFrame(all);
    const fit = directions => polytope(directions.flatMap(([a,b,c]) => {
      const n = [0,1,2].map(k => a*e0[k]+b*e1[k]+c*e2[k]);
      let high = -Infinity, low = Infinity;
      for (const p of all) { const t = dot(n,p); high = Math.max(high,t); low = Math.min(low,t); }
      // Flat decals (eyes, digits) still get a sliver of thickness to collide with.
      const pad = Math.max(0,.05-(high-low))/2;
      return [[n,high+pad],[n.map(v => -v),-(low-pad)]];
    }));
    // Tightest first; a degenerate fit falls back to fewer directions, ending with
    // the oriented bounding box, which is always a clean polyhedron.
    const result = fit(DOP) ?? fit(DOP.slice(0,9)) ?? fit(DOP.slice(0,3));
    hulls.set(key,result);
    return result;
  }

  function collider(piece, radius, depth) {
    const wheel = !piece.fixed && wheels[piece.kind];
    if (wheel) return cylinder(wheel,radius);
    const model = window.ShapeModels[piece.kind];
    const solid = !piece.fixed && model && hull(piece.kind,depth/radius/(model.depth ?? Math.abs(model.vertices[2])));
    if (solid) {
      const shape = new ConvexPolyhedron({
        vertices:solid.points.map(([x,y,z]) => new Vec3(x*radius,y*radius,z*radius)), faces:solid.faces,
        axes:solid.axes.map(([x,y,z]) => new Vec3(x,y,z))
      });
      shape.hull = true;
      return shape;
    }
    const outline = outlines[piece.kind];
    const count = outline.length;
    const vertices = [-depth,depth].flatMap(z =>
      outline.map(([x,y]) => new Vec3(x*radius,y*radius,z)));
    const top = Array.from({length:count},(_,i) => i+count);
    const bottom = Array.from({length:count},(_,i) => count-i-1);
    const sides = outline.map((_,i) => {
      const next = (i+1)%count;
      return [i,next,next+count,i+count];
    });
    const axes = [new Vec3(0,0,1)];
    for (let i = 0; i < count; i++) {
      const [x,y] = outline[i];
      const [nextX,nextY] = outline[(i+1)%count];
      const axis = new Vec3(nextY-y,x-nextX,0);
      axis.normalize();
      if (!axes.some(other => Math.abs(other.dot(axis)) > .9999)) axes.push(axis);
    }
    return new ConvexPolyhedron({vertices, faces:[bottom,...sides,top], axes});
  }

  function create(tray) {
    const world = new World({gravity:new Vec3(0,.45,-28), allowSleep:true});
    world.broadphase = new SAPBroadphase(world);
    world.broadphase.useBoundingBoxes = true;
    world.solver.iterations = 8;
    world.defaultContactMaterial.friction = .44;
    world.defaultContactMaterial.restitution = .08;
    const bodies = new Map();
    let accumulated = 0;

    function wall(x,y,z,w,h,d) {
      world.addBody(new Body({
        mass:0,
        position:new Vec3((x-cx)/PIXELS,(y-cy)/PIXELS,z/PIXELS),
        shape:new Box(new Vec3(w/PIXELS,h/PIXELS,d/PIXELS))
      }));
    }

    const {left,right:edge,top,bottom} = bounds;
    const cx = (left+edge)/2;
    const cy = (top+bottom)/2;
    const width = (edge-left)/2;
    const height = (bottom-top)/2;
    wall(cx,cy,-10,width,height,10);
    wall(left-11,cy,120,11,height+22,120);
    wall(edge+11,cy,120,11,height+22,120);
    wall(cx,top-11,120,width,11,120);
    wall(cx,bottom+11,120,width,11,120);
    wall(cx,cy,240,width,height,10);

    function add(piece, lift = 0) {
      const {radius,depth} = pieceSize(piece);
      const mass = piece.fixed ? 0 : (piece.size/120)**2;
      const wheel = !piece.fixed && wheels[piece.kind];
      // A randomly oriented wheel reaches as far as its rim corner in any direction.
      const shape = collider(piece,radius/PIXELS,depth/PIXELS);
      // A hull-shaped part may land on any face, so it starts tumbling freely.
      const tumbling = Boolean(shape.hull);
      // A randomly oriented part reaches as far as its farthest corner in any direction.
      const reach = wheel ? Math.hypot(wheel.radius,wheel.half)*radius :
        tumbling ? shape.boundingSphereRadius*PIXELS : depth;
      const body = new Body({
        mass, shape,
        position:new Vec3((piece.x-cx)/PIXELS,(piece.y-cy)/PIXELS,.04+(reach+lift)/PIXELS),
        linearDamping:.31, angularDamping:.54, sleepSpeedLimit:.68, sleepTimeLimit:.28
      });
      if (!piece.fixed && faceUp[piece.kind]) {
        const Quaternion = body.quaternion.constructor;  // not exported by the ShapeRigid bundle
        const up = new Vec3(0,0,1);
        const align = new Quaternion().setFromVectors(new Vec3(...faceUp[piece.kind]),up);
        new Quaternion().setFromAxisAngle(up,Math.random()*Math.PI*2).mult(align,body.quaternion);
        body.angularFactor.set(0,0,1);   // may spin flat on the tray, never flip over
        body.angularVelocity.set(0,0,(Math.random()-.5)*3);
      } else if (wheel) {
        tumblePose(body);
        body.angularVelocity.set((Math.random()-.5)*3,(Math.random()-.5)*3,(Math.random()-.5)*3);
      } else if (tumbling) {
        // Uniform random orientation (Shoemake), then a gentle spin as it drops.
        const [u1,u2,u3] = [Math.random(),Math.random()*Math.PI*2,Math.random()*Math.PI*2];
        const a = Math.sqrt(1-u1), b = Math.sqrt(u1);
        body.quaternion.set(a*Math.sin(u2),a*Math.cos(u2),b*Math.sin(u3),b*Math.cos(u3));
        body.angularVelocity.set((Math.random()-.5)*4,(Math.random()-.5)*4,(Math.random()-.5)*4);
      } else {
        body.quaternion.setFromEuler(piece.fixed ? 0 : [.13,.60,1.03][piece.pose],0,piece.angle,"ZYX");
      }
      syncPreviousPose(body);
      bodies.set(piece,body);
      world.addBody(body);
      project(piece,body);
    }

    function syncPreviousPose(body) {
      body.previousPosition.copy(body.position);
      body.previousQuaternion.copy(body.quaternion);
    }

    function project(piece,body,blend = 1) {
      let position = body.position;
      let rotation = body.quaternion;
      if (blend < 1 && body.sleepState !== Body.SLEEPING) {
        position = body.interpolatedPosition;
        rotation = body.interpolatedQuaternion;
        body.previousPosition.lerp(body.position,blend,position);
        body.previousQuaternion.slerp(body.quaternion,blend,rotation);
      }
      const {x:qx,y:qy,z:qz,w:qw} = rotation;
      const x = position.x*PIXELS+cx;
      const y = position.y*PIXELS+cy;
      const z = position.z*PIXELS;
      const previous = piece.orientation;
      if (previous && Math.abs(piece.x-x)+Math.abs(piece.y-y)+Math.abs(piece.depth-z) <= .11 &&
          Math.abs(previous[0]-qx)+Math.abs(previous[1]-qy)+
          Math.abs(previous[2]-qz)+Math.abs(previous[3]-qw) <= .0014) return false;
      const angle = Math.atan2(2*(qx*qy+qw*qz),1-2*(qy*qy+qz*qz));
      Object.assign(piece,{x,y,depth:z,angle,orientation:[qx,qy,qz,qw]});
      return true;
    }

    function update(dt) {
      if (!tray.some(piece => !piece.fixed && bodies.get(piece).sleepState !== Body.SLEEPING)) {
        accumulated = 0;
        return false;
      }
      accumulated = Math.min(STEP*3,accumulated+dt);
      const deadline = performance.now()+STEP_BUDGET_MS;
      while (accumulated >= STEP) {
        world.step(STEP);
        accumulated -= STEP;
        // Drop overdue steps when a packed tray exceeds the frame budget.
        if (accumulated >= STEP && performance.now() >= deadline) {
          accumulated %= STEP;
          break;
        }
      }
      let changed = false;
      const blend = accumulated/STEP;
      for (const piece of tray) changed = project(piece,bodies.get(piece),blend) || changed;
      return changed;
    }

    function remove(piece) {
      const body = bodies.get(piece);
      bodies.delete(piece);
      world.removeBody(body);
      for (const other of tray) {
        if (other.depth >= piece.depth-18 &&
            Math.hypot(other.x-piece.x,other.y-piece.y) < (other.size+piece.size)*.40) {
          bodies.get(other).wakeUp();
        }
      }
    }

    function poke(piece, dx,dy,lift) {
      const body = bodies.get(piece);
      body.wakeUp();
      body.applyImpulse(new Vec3(dx*body.mass,dy*body.mass,lift*body.mass),new Vec3(.12,.18,.04));
    }

    function uncover(piece, force) {
      for (const other of tray) {
        if (other.fixed || other === piece || other.depth < piece.depth-8) continue;
        const dx = other.x-piece.x;
        const dy = other.y-piece.y;
        const distance = Math.hypot(dx,dy);
        if (distance > (other.size+piece.size)*.41) continue;
        const angle = distance > 3 ? Math.atan2(dy,dx) : other.id*2.4;
        poke(other,Math.cos(angle)*force,Math.sin(angle)*force,force*.72);
      }
      poke(piece,0,-.32,force*1.35);
    }

    for (const piece of tray) add(piece,piece.fixed ? 0 : piece.tier*49+4);
    for (let i = 0; i < 18; i++) world.step(STEP);
    for (const piece of tray) {
      const body = bodies.get(piece);
      syncPreviousPose(body);
      project(piece,body);
    }
    return {add, remove, update, poke, uncover};
  }

  window.ShapeTray = { bounds, create, pieceSize, hull };
})();
