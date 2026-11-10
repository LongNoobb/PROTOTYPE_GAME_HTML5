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

  function pieceSize(piece) {
    return {
      radius: piece.size * .329,
      depth: piece.size * (piece.fixed ? .146 : piece.kind === "hammer" ? .069 : .099)
    };
  }

  function collider(piece, radius, depth) {
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
      const body = new Body({
        mass, shape:collider(piece,radius/PIXELS,depth/PIXELS),
        position:new Vec3((piece.x-cx)/PIXELS,(piece.y-cy)/PIXELS,.04+(depth+lift)/PIXELS),
        linearDamping:.31, angularDamping:.54, sleepSpeedLimit:.68, sleepTimeLimit:.28
      });
      const pitches = piece.letter ? [.10,.24,.42] : [.13,.60,1.03];
      body.quaternion.setFromEuler(piece.fixed ? 0 : pitches[piece.pose],0,piece.angle,"ZYX");
      syncPreviousPose(body);
      bodies.set(piece,body);
      world.addBody(body);
      project(piece,body);
    }

    function syncPreviousPose(body) {
      body.previousPosition.copy(body.position);
      body.previousQuaternion.copy(body.quaternion);
    }

    function keepInTray(piece,body) {
      if (piece.fixed) return;
      const { x,y,z } = body.position;
      const limitX = width/PIXELS;
      const limitY = height/PIXELS;
      if (Math.abs(x) <= limitX+.12 && Math.abs(y) <= limitY+.12 && z >= -.15 && z <= 5) return;

      // A crowded collision can push a thin tile through a wall in one physics step.
      const margin = (pieceSize(piece).radius+8)/PIXELS;
      const clamp = (value,limit) => Math.max(-limit,Math.min(limit,value));
      body.position.set(clamp(x,limitX-margin),clamp(y,limitY-margin),1.65);
      body.quaternion.setFromEuler(0,0,piece.angle);
      body.velocity.setZero();
      body.angularVelocity.setZero();
      body.aabbNeedsUpdate = true;
      body.wakeUp();
      syncPreviousPose(body);
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
      for (const piece of tray) {
        const body = bodies.get(piece);
        keepInTray(piece,body);
        changed = project(piece,body,blend) || changed;
      }
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
      keepInTray(piece,body);
      syncPreviousPose(body);
      project(piece,body);
    }
    return {add, remove, update, poke, uncover};
  }

  window.ShapeTray = { bounds, create, pieceSize };
})();
