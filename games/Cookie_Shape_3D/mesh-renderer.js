(() => {
  "use strict";

  const identity = [0,0,0,1];
  const finishes = {
    cookieHeart:1, cookieStar:2, cookieBear:3, cookieJam:4, cookieBiscuit:5,
    syrupCandy:6, pastryBox:7, hammer:8, oven:9, ovenOpen:10,
    cookieHeartLeft:11, cookieStarLeft:11, cookieHeartRight:11, cookieStarRight:11
  };
  function rgb(hex) {
    const color = parseInt(hex.slice(1),16);
    return [color>>16,(color>>8)&255,color&255];
  }

  const models = Object.fromEntries(Object.entries(window.ShapeModels).map(([name,model]) => {
    const thickness = Math.abs(model.vertices[2]);
    return [name,{
      vertices:Float32Array.from(model.vertices), indices:Uint16Array.from(model.indices),
      color:rgb(model.color), material:finishes[name] ?? 0, thickness
    }];
  }));
  const vertexCapacity = Math.max(...Object.values(models).map(model => model.vertices.length/6));

  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  function rgba(r,g,b) {
    r = Math.max(0,Math.min(255,r))|0;
    g = Math.max(0,Math.min(255,g))|0;
    b = Math.max(0,Math.min(255,b))|0;
    return littleEndian ? (255<<24)|(b<<16)|(g<<8)|r : (r<<24)|(g<<16)|(b<<8)|255;
  }
  const shadowAlphaShift = littleEndian ? 24 : 0;

  function create({left = 0, top = 0, width, height, round = 0, picking = false}) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(width,height);
    const pixels = new Uint32Array(image.data.buffer);
    const depth = new Float32Array(width*height);
    const ids = picking ? new Uint16Array(width*height) : null;
    const piecesById = [];
    const visible = [];
    const transformed = new Float32Array(vertexCapacity*5);
    let centerX, centerY, inverseRadius;
    const rowInset = Array.from({length:height},(_,y) => {
      const edge = Math.min(y+.5,height-y-.5);
      return edge >= round ? 0 : Math.ceil(round-Math.sqrt(round*round-(round-edge)**2));
    });

    function transform(piece,model) {
      const [x,y,z,w] = piece.orientation ?? identity;
      const xx = x+x, yy = y+y, zz = z+z;
      const m00 = 1-y*yy-z*zz, m01 = x*yy-w*zz, m02 = x*zz+w*yy;
      const m10 = x*yy+w*zz, m11 = 1-x*xx-z*zz, m12 = y*zz-w*xx;
      const m20 = x*zz-w*yy, m21 = y*zz+w*xx, m22 = 1-x*xx-y*yy;
      const size = window.ShapeTray.pieceSize(piece);
      const radius = size.radius;
      const thickness = size.depth/model.thickness;
      centerX = piece.x-left;
      centerY = piece.y-top;
      inverseRadius = 1/radius;
      const offsetZ = piece.depth ?? 0;
      const ambient = picking ? .47+Math.min(.09,offsetZ*.0018) : .54;
      const source = model.vertices;
      for (let src = 0, dst = 0; src < source.length; src += 6, dst += 5) {
        const px = source[src]*radius, py = -source[src+1]*radius, pz = source[src+2]*thickness;
        transformed[dst] = centerX+m00*px+m01*py+m02*pz;
        transformed[dst+1] = centerY+m10*px+m11*py+m12*pz;
        transformed[dst+2] = offsetZ+m20*px+m21*py+m22*pz;
        const nx = source[src+3], ny = -source[src+4], nz = source[src+5]*radius/thickness;
        const length = Math.hypot(nx,ny,nz);
        const dx = (m00*nx+m01*ny+m02*nz)/length;
        const dy = (m10*nx+m11*ny+m12*nz)/length;
        const dz = (m20*nx+m21*ny+m22*nz)/length;
        transformed[dst+3] = ambient+.46*Math.max(0,-.40*dx-.61*dy+.68*dz)+
          .16*Math.max(0,.73*dx+.37*dy+.57*dz);
        const half = Math.max(0,-.19*dx-.33*dy+.925*dz);
        const rim = Math.max(0,.89*dx-.31*dy+.32*dz);
        transformed[dst+4] = half**9*.90+rim**5*.27;
      }
    }

    function triangle(a,b,c,model,piece) {
      const ax = transformed[a], ay = transformed[a+1];
      const bx = transformed[b], by = transformed[b+1];
      const cx = transformed[c], cy = transformed[c+1];
      const area = (bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      if (area >= -.001) return;
      const minX = Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5));
      const maxX = Math.min(width-1,Math.floor(Math.max(ax,bx,cx)-.5));
      const minY = Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5));
      const maxY = Math.min(height-1,Math.floor(Math.max(ay,by,cy)-.5));
      const uX = (cy-ay)/area, uY = (ax-cx)/area;
      const vX = (ay-by)/area, vY = (bx-ax)/area;
      const az = transformed[a+2], uz = transformed[b+2]-az, vz = transformed[c+2]-az;
      const shade = transformed[a+3], us = transformed[b+3]-shade, vs = transformed[c+3]-shade;
      const shine = transformed[a+4], uh = transformed[b+4]-shine, vh = transformed[c+4]-shine;
      const material = model.material;
      const syrup = 2.8*(piece.syrupSpread ?? 0)**1.35;
      const baked = material <= 5 || material === 11;
      const [red,green,blue] = model.color;
      const points = model.vertices;
      const ia = a/5*6, ib = b/5*6, ic = c/5*6;
      for (let y = minY; y <= maxY; y++) {
        const start = Math.max(minX,rowInset[y]);
        const end = Math.min(maxX,width-1-rowInset[y]);
        let u = (start+.5-ax)*uX+(y+.5-ay)*uY;
        let v = (start+.5-ax)*vX+(y+.5-ay)*vY;
        const sy = (y+.5-centerY)*inverseRadius;
        const wash = 1-sy*.115;
        for (let x = start, index = y*width+start; x <= end; x++, index++, u += uX, v += vX) {
          if (u < -.00001 || v < -.00001 || u+v > 1.00001) continue;
          const z = az+u*uz+v*vz;
          if (z <= depth[index]) continue;
          depth[index] = z;
          if (ids) ids[index] = piece.id;
          const light = (shade+u*us+v*vs)*wash;
          // A broad reflected softbox gives the flat caps a readable light falloff.
          const sx = (x+.5-centerX)*inverseRadius;
          const bar = sy+.20*sx+.48;
          const reflection = Math.max(0,1-8*bar*bar-.95*(sx+.22)**2);
          const gloss = (shine+u*uh+v*vh)*(.055+.25*reflection*reflection);
          if (!material && !syrup) {
            pixels[index] = surface(red,green,blue,light,gloss*.54);
            continue;
          }
          const lx = points[ia]+u*(points[ib]-points[ia])+v*(points[ic]-points[ia]);
          const ly = points[ia+1]+u*(points[ib+1]-points[ia+1])+v*(points[ic+1]-points[ia+1]);
          const lz = points[ia+2]+u*(points[ib+2]-points[ia+2])+v*(points[ic+2]-points[ia+2]);
          const cap = Math.abs(lz) >= model.thickness-.001;
          const grain = baked ? .94+((((lx*33)|0)*17 ^ (((ly*31)|0)*41))&15)*.007 : 1;
          pixels[index] = decoration(material,lz < 0 ? -lx : lx,ly,cap,light,gloss) ??
            surface(red,green,blue,light*grain,baked ? gloss*.55 : gloss);
          if (syrup) {
            // The glaze follows the mesh, including its wavy edges and reflected streak.
            const edge = .79-Math.abs(lx+.15*Math.sin(ly*5))-.20*ly+.10*Math.sin(ly*12);
            const coat = Math.max(0,Math.min(.74,.38+edge*2.6,(syrup-lx*lx-ly*ly)*3));
            const streak = Math.max(0,1-12*Math.abs(ly+.28+.24*lx+.09*Math.sin(lx*6)));
            const wet = Math.min(.66,.035+gloss*1.85+.35*streak*streak);
            const amber = light*(1-wet)*(1+.1*Math.sin(ly*11+lx*7));
            const byte = index*4;
            const colors = image.data;
            colors[byte] += (188*amber+255*wet-colors[byte])*coat;
            colors[byte+1] += (83*amber+221*wet-colors[byte+1])*coat;
            colors[byte+2] += (20*amber+143*wet-colors[byte+2])*coat;
          }
        }
      }
    }

    function render(pieces) {
      pixels.fill(0);
      depth.fill(-Infinity);
      if (ids) {
        ids.fill(0);
        piecesById.length = visible.length = 0;
      }
      // Drawing the upper pieces first avoids shading surfaces they hide.
      const order = picking ? [...pieces].sort((a,b) => b.depth-a.depth || a.id-b.id) : pieces;
      for (const piece of order) {
        const model = models[piece.kind];
        if (ids) {
          piecesById[piece.id] = piece;
          visible[piece.id] = 0;
        }
        transform(piece,model);
        const indices = model.indices;
        for (let i = 0; i < indices.length; i += 3) {
          triangle(indices[i]*5,indices[i+1]*5,indices[i+2]*5,model,piece);
        }
      }
      if (ids) {
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          if (id) visible[id]++;
        }
        castShadows();
      }
      ctx.putImageData(image,0,0);
    }

    function castShadows() {
      for (let y = 8; y < height; y++) {
        const inset = rowInset[y];
        const start = Math.max(6,inset);
        for (let x = start, i = y*width+start; x < width-inset; x++, i++) {
          const near = i-4*width-3;
          const far = i-8*width-6;
          const id = ids[i];
          if (!id) {
            const alpha = (ids[near] ? 49 : 0)+(ids[far] ? 22 : 0);
            if (alpha) pixels[i] = alpha<<shadowAlphaShift;
            continue;
          }
          const nearShade = ids[near] !== id ? Math.min(1,Math.max(0,(depth[near]-depth[i]-5)*.034)) : 0;
          const farShade = ids[far] !== id ? Math.min(1,Math.max(0,(depth[far]-depth[i]-9)*.027)) : 0;
          const shade = 1-nearShade*.21-farShade*.09;
          if (shade === 1) continue;
          const byte = i*4;
          const colors = image.data;
          colors[byte] *= shade;
          colors[byte+1] *= shade;
          colors[byte+2] *= shade;
        }
      }
    }

    function pick(x,y) {
      const col = Math.floor(x-left);
      const row = Math.floor(y-top);
      if (col < 0 || row < 0 || col >= width || row >= height) return null;
      return piecesById[ids[row*width+col]] ?? null;
    }

    return {canvas, render, pick, exposed:piece => visible[piece.id] >= 32};
  }

  function surface(r,g,b,light,gloss) {
    const cool = Math.max(0,.95-light);
    return rgba(r*light+(255-r*light)*gloss,g*light+(252-g*light)*gloss+cool*8,
      b*light+(255-b*light)*gloss+cool*29);
  }

  function decoration(material,x,y,cap,light,gloss) {
    const radius = x*x+y*y;
    if (material === 8) {
      return y > .31 ? surface(190,202,213,light,gloss) : surface(143,67,32,light,gloss*.5);
    }
    if (!cap) return undefined;
    if (material === 1) {
      const inner = Math.abs(x) < .57 && y < .43 && y > -.58;
      if (inner && radius < .21 && Math.abs(Math.abs(x)-.25) < .026 && y < -.01) {
        return surface(197,55,86,light,gloss*.35);
      }
    } else if (material === 2 || material === 5) {
      const dx = Math.abs(x)-.20;
      const dy = y >= 0 ? y-.16 : y+.18;
      if (dx*dx+dy*dy < .008) return surface(151,78,37,light,gloss*.3);
    } else if (material === 3) {
      const eye = (Math.abs(x)-.28)**2+(y-.18)**2 < .016;
      const nose = x*x*1.7+(y+.04)**2 < .020;
      if (eye || nose) return surface(95,42,26,light,gloss*.4);
      if (radius < .19 && y < .04) return surface(206,132,83,light,gloss*.3);
    } else if (material === 4) {
      if (radius < .21) {
        const shine = (x+.12)**2+(y-.13)**2 < .013;
        return surface(shine ? 255 : 197,shine ? 151 : 33,shine ? 172 : 82,light,gloss*.74);
      }
    } else if (material === 6) {
      const stripe = Math.abs(y-.24+x*.42);
      if (stripe < .09) return surface(207,123,62,light,gloss);
      if (stripe < .24) return surface(168,78,34,light,gloss);
    } else if (material === 7) {
      if (radius < .24) {
        const head = y > .06 && y < .26 && Math.abs(x) < .25;
        const grip = y > -.27 && y <= .06 && Math.abs(x) < .072;
        return head || grip ? surface(117,51,44,light,gloss) : surface(255,227,176,light,gloss);
      }
      if (Math.abs(x) < .12 || Math.abs(y) < .12) return surface(196,70,92,light,gloss*.6);
    } else if (material === 9 || material === 10) {
      if (y > .37 && y < .53 && Math.abs(x) < .61) return surface(255,188,94,light,gloss);
      if (y > -.50 && y < .32 && Math.abs(x) < .66) {
        if (material === 10 && y < -.20) return surface(255,149,81,light,gloss);
        const inside = y > -.40 && y < .23 && Math.abs(x) < .55;
        return inside ? surface(81,33,39,light,gloss*.6) : surface(255,164,125,light,gloss);
      }
    }
    return undefined;
  }

  function faceUp(orientation = identity, amount) {
    const direction = orientation[3] < 0 ? -1 : 1;
    const x = orientation[0]*(1-amount)*direction;
    const y = orientation[1]*(1-amount)*direction;
    const z = orientation[2]*(1-amount)*direction;
    const w = orientation[3]*(1-amount)*direction+amount;
    const length = Math.hypot(x,y,z,w);
    return [x/length,y/length,z/length,w/length];
  }

  window.ShapeMeshes = {create, faceUp};
})();
