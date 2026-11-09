(() => {
  "use strict";

  const W = 540;
  const H = 1172;
  const ctx = document.querySelector("#world").getContext("2d");
  const models = window.ShapeModels;
  const room = new Image();
  const load = (img, url) => new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  const ready = load(room, "assets/room.svg");

  function mix(color, tone, amount) {
    const a = Number.parseInt(color.slice(1),16);
    const b = Number.parseInt(tone.slice(1),16);
    const channels = [16,8,0].map(shift => Math.round(
      ((a>>shift)&255)*(1-amount)+((b>>shift)&255)*amount
    ).toString(16).padStart(2,"0"));
    return "#"+channels.join("");
  }

  const palette = Object.fromEntries(Object.entries(models).map(([name,{color}]) => [name,[
    mix(color,"#fff8ed",.42), mix(color,"#fff8ed",.19), color,
    mix(color,"#261839",.16), mix(color,"#261839",.58), mix(color,"#20132e",.79)
  ]]));

  function gradient(context, x, y, x2, y2, colors) {
    const g = context.createLinearGradient(x, y, x2, y2);
    colors.forEach((value, i) => {
      if (Array.isArray(value)) g.addColorStop(value[0], value[1]);
      else g.addColorStop(i / (colors.length - 1), value);
    });
    return g;
  }

  function rounded(points, amount = 0.10) {
    const path = new Path2D();
    points.forEach(([x, y], i) => {
      const before = points[(i + points.length - 1) % points.length];
      const after = points[(i + 1) % points.length];
      const start = [x + (before[0] - x) * amount, y + (before[1] - y) * amount];
      if (i === 0) path.moveTo(...start);
      else path.lineTo(...start);
      path.quadraticCurveTo(x, y, x + (after[0] - x) * amount, y + (after[1] - y) * amount);
    });
    path.closePath();
    return path;
  }

  function box(context, x, y, w, h, r, fill, stroke, line = 1) {
    const path = new Path2D();
    path.roundRect(x, y, w, h, r);
    if (fill) {
      context.fillStyle = fill;
      context.fill(path);
    }
    if (stroke) {
      context.lineWidth = line;
      context.strokeStyle = stroke;
      context.stroke(path);
    }
    return path;
  }

  function disk(context, x, y, r, fill) {
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
  }

  const holes = Object.fromEntries(Object.entries(models).map(([name, model]) =>
    [name, rounded(model.silhouette.map(([x, y]) => [x, -y]), .23)]));

  const backdrop = document.createElement("canvas");
  backdrop.width = W;
  backdrop.height = H;
  const bg = backdrop.getContext("2d");
  bg.fillStyle = gradient(bg, 0, 0, 0, H, ["#784035","#683330","#4e262a","#50262e"]);
  bg.fillRect(0, 0, W, H);
  const diamond = 68;
  for (let y = -4, row = 0; y < H + diamond; y += diamond, row++) {
    for (let x = (row % 2) * diamond; x < W + diamond; x += diamond * 2) {
      const p = new Path2D();
      p.moveTo(x, y-diamond);
      p.lineTo(x+diamond, y);
      p.lineTo(x, y+diamond);
      p.lineTo(x-diamond, y);
      p.closePath();
      bg.fillStyle = row % 2 === 0 ? "#eaaa8118" : "#2c12202a";
      bg.fill(p);
    }
  }
  const vignette = bg.createRadialGradient(270, 400, 170, 270, 500, 650);
  vignette.addColorStop(0, "#efaa8517");
  vignette.addColorStop(1, "#290b1228");
  bg.fillStyle = vignette;
  bg.fillRect(0, 0, W, H);

  function star(x, y, size, color = "#ffe114") {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.fillStyle = gradient(ctx, 0,-1,0,1, ["#fff47a", color, "#f79b0a"]);
    ctx.shadowColor = "#934016a0";
    ctx.shadowOffsetY = .10;
    ctx.shadowBlur = .15;
    ctx.fill(holes.cookieStar);
    ctx.restore();
  }

  const MIN_DRUM_ROWS = 5;
  const drumCount = level => Math.max(MIN_DRUM_ROWS,level.rows.length);

  function dimensions(level) {
    const large = level.columns === 5;
    const layout = large ?
      { cy:350, radius:185, step:.45, width:440, inner:[69,166,402,382], band:[37,297,466,105], outer:[40,141,460,442] } :
      { cy:349, radius:163, step:.596, width:402, inner:[87,177,367,341], band:[56,289,428,120], outer:[64,154,412,394] };
    const step = Math.PI/MIN_DRUM_ROWS;
    return { ...layout, step, front:Math.sin(step/2), bandHalf:Math.sin(layout.step/2) };
  }

  function drawFrame(d, pulse) {
    const [x,y,w,h] = d.outer;
    box(ctx,x+5,y+14,w-10,h-8,38,"#d77712");
    box(ctx,x+2,y+6,w-4,h-4,39,"#75293e");
    const shell = new Path2D();
    shell.moveTo(x+40,y);
    shell.lineTo(145,y);
    shell.bezierCurveTo(181,y,193,y-42,270,y-42);
    shell.bezierCurveTo(347,y-42,359,y,395,y);
    shell.lineTo(x+w-40,y);
    shell.quadraticCurveTo(x+w,y,x+w,y+47);
    shell.lineTo(x+w,y+h-45);
    shell.quadraticCurveTo(x+w,y+h,x+w-47,y+h);
    shell.lineTo(x+47,y+h);
    shell.quadraticCurveTo(x,y+h,x,y+h-45);
    shell.lineTo(x,y+47);
    shell.quadraticCurveTo(x,y,x+40,y);
    shell.closePath();
    ctx.fillStyle = gradient(ctx,x,y-40,x+w,y+h,["#ffb2ae","#f78188","#e76a7b","#c94564"]);
    ctx.fill(shell);
    ctx.lineWidth = 3;
    ctx.strokeStyle = gradient(ctx,0,y-39,0,y+h,["#9f3a4b","#ffb0a2","#a73f56"]);
    ctx.stroke(shell);
    const crest = new Path2D();
    crest.moveTo(160,y+22);
    crest.quadraticCurveTo(270,y-70,380,y+22);
    crest.closePath();
    ctx.fillStyle = gradient(ctx,0,y-30,0,y+22,["#ffe8c8","#efad9a"]);
    ctx.fill(crest);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#bb5c64";
    ctx.stroke(crest);
    disk(ctx, d.width === 440 ? 199 : 207, y+10, 6, "#cc2d15");
    disk(ctx, d.width === 440 ? 341 : 334, y+10, 6, "#cc2d15");
    disk(ctx, d.width === 440 ? 197 : 205, y+8, 3, "#ff6740");
    disk(ctx, d.width === 440 ? 339 : 332, y+8, 3, "#ff6740");
    star(229,y+5,12+2*pulse);
    star(270,y+2,17+4*pulse);
    star(311,y+5,12+2*pulse);
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const sx = x+35+i*(w-70)/14;
      ctx.moveTo(sx,y+h-17);
      ctx.quadraticCurveTo(sx+(w-70)/28,y+h-4,sx+(w-70)/14,y+h-17);
    }
    ctx.strokeStyle = "#ffe7c9";
    ctx.lineWidth = 3;
    ctx.stroke();
    const [ix,iy,iw,ih] = d.inner;
    box(ctx,ix-1,iy,iw+2,ih,23,
      gradient(ctx,ix,iy,ix+iw,iy+ih,["#ffe93e","#ffc006","#f6a313","#fff456"]), "#ffc914",2);
    box(ctx,ix+9,iy+12,iw-18,ih-24,18,"#aa5d00","#f2a300",2);
    box(ctx,x+4,d.band[1]-16,w-8,d.band[3]+43,25,
      gradient(ctx,0,d.band[1]-16,0,d.band[1]+d.band[3]+27,["#c4556d","#a84059","#7c2d43"]));
  }

  function project(d, angle) {
    // Keep the front cell in the gold band as the angular spacing changes with the row count.
    const sine = Math.sin(angle);
    const magnitude = Math.abs(sine);
    const screen = magnitude <= d.front ? magnitude*d.bandHalf/d.front :
      d.bandHalf+(magnitude-d.front)*(1-d.bandHalf)/(1-d.front);
    return {
      y:d.cy+Math.sign(sine)*screen*d.radius,
      half:d.width*(.418+.082*Math.sqrt(Math.max(0,1-screen*screen)))
    };
  }

  function cell(d, position, columns, col) {
    const top = project(d, Math.max(-Math.PI/2, (position-.5) * d.step));
    const bottom = project(d, Math.min(Math.PI/2, (position+.5) * d.step));
    const left = -1 + col * 2 / columns;
    const right = left + 2 / columns;
    return {
      top: top.y, bottom: bottom.y,
      corners: [[270+left*top.half,top.y],[270+right*top.half,top.y],
        [270+right*bottom.half,bottom.y],[270+left*bottom.half,bottom.y]]
    };
  }

  function pocket(kind, x, y, sx, sy, colors, glow) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(sx,sy);
    const outline = holes[kind];
    ctx.lineWidth = .075;
    if (glow > 0) {
      ctx.globalAlpha *= glow;
      ctx.strokeStyle = "#ffffd7";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 9;
      ctx.stroke(outline);
    } else {
      ctx.fillStyle = gradient(ctx,0,-.82,0,.78,[colors[5],colors[4],colors[4]]);
      ctx.fill(outline);
      ctx.save();
      ctx.clip(outline);
      ctx.translate(0,.13);
      ctx.strokeStyle = "#2e14215c";
      ctx.lineWidth = .13;
      ctx.stroke(outline);
      ctx.restore();
      ctx.translate(0,.035);
      ctx.strokeStyle = "#ffedcf21";
      ctx.stroke(outline);
    }
    ctx.restore();
  }

  function foil(path,x,top,w,height) {
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = gradient(ctx,x-w*.5,top,x+w*.5,top+height,[
      "#8194a8","#e5edf2","#a6b7c8","#f9fcff","#879aaf"
    ]);
    ctx.fill(path);
    ctx.strokeStyle = "#52687e";
    ctx.lineWidth = 3;
    ctx.stroke(path);
    ctx.translate(x-w*.5,top);
    ctx.scale(w,height);
    for (const [index,points] of [
      [[0,.10],[.18,.26],[.38,0]],
      [[.04,.78],[.38,.53],[.22,1]],
      [[.43,.03],[.54,.44],[.71,.22]],
      [[.57,.63],[.77,.96],[.9,.65],[1,.48]],
      [[.71,0],[1,0],[1,.31]]
    ].entries()) {
      const crease = new Path2D();
      points.forEach(([px,py],i) => i ? crease.lineTo(px,py) : crease.moveTo(px,py));
      crease.closePath();
      ctx.fillStyle = index%2 ? "#55728743" : "#ffffff8c";
      ctx.fill(crease);
    }
    ctx.restore();
    if (height >= 17) {
      ctx.save();
      ctx.clip(path);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${Math.min(w*.49,height*.67)}px system-ui, sans-serif`;
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = "#f0f6fd";
      ctx.fillStyle = "#3f5369";
      ctx.strokeText("?",x,top+height*.5);
      ctx.fillText("?",x,top+height*.5);
      ctx.restore();
    }
  }

  function tile(d, level, row, col, pos, now, bonusKind) {
    const { top, bottom, corners } = cell(d,pos,level.columns,col);
    const height = bottom - top;
    if (height < .6) return;
    const prefilled = !bonusKind && row >= level.rows.length;
    const kind = bonusKind ?? (prefilled ? level.rows[0][(col+row-level.rows.length+1)%level.columns] : level.rows[row][col]);
    const p = rounded(corners, .081);
    const x = corners.reduce((total,[cx]) => total+cx, 0)/4;
    const w = (corners[1][0]-corners[0][0]+corners[2][0]-corners[3][0])/2;
    if (!bonusKind && level.hidden[row]?.[col]) {
      foil(p,x,top,w,height);
      return;
    }
    const colors = palette[kind];
    const placement = level.filled[row]?.[col];
    const matched = bonusKind || (Number.isFinite(placement) && placement > 0);
    const glow = !bonusKind && matched ? (1-clamp((now-placement)/350))**1.4 : 0;
    ctx.fillStyle = gradient(ctx,0,top,0,bottom,[
      [0,colors[0]], [.11,colors[1]], [.33,colors[2]], [.85,colors[2]], [1,colors[3]]
    ]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    const shade = Math.min(.44, Math.max(0,Math.abs(pos)*.105) + (pos > .5 ? .08 : 0));
    ctx.fillStyle = pos > .5 ? `rgba(82,18,62,${shade})` : `rgba(91,45,44,${shade*.56})`;
    ctx.fillRect(0,top,W,height);
    ctx.strokeStyle = "#55152d5e";
    ctx.lineWidth = 3.0;
    ctx.stroke(p);
    ctx.strokeStyle = "#fff0bf50";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(corners[0][0]+2,bottom-1.5);
    ctx.lineTo(corners[1][0]-2,bottom-1.5);
    ctx.stroke();
    if (height > 7 && Math.abs(pos*d.step) < Math.PI/2 && !prefilled) {
      const y = (top+bottom)/2;
      const rx = w*pocketRatio;
      const ry = Math.min(height*(d.width === 440 ? .29 : .28),rx*1.02);
      pocket(kind,x,y,rx,ry,colors,0);
      if (matched) {
        const scale = faceSize*seatedFaceScale/faceRadius;
        const dw = rx*scale;
        const dh = ry*scale;
        ctx.drawImage(faceImage(kind),x-dw/2,y-dh/2,dw,dh);
      }
      if (glow > 0) {
        const sparkle = ctx.createRadialGradient(x,y,0,x,y,w*.62);
        sparkle.addColorStop(0,`rgba(255,255,225,${glow*.44})`);
        sparkle.addColorStop(1,"#fff0");
        ctx.fillStyle = sparkle;
        ctx.fillRect(x-w,top,w*2,height);
        pocket(kind,x,y,rx,ry,colors,glow);
      }
    }
    if (bonusKind && !level.spin && pos === 0 && bonusKind === level.bonus.winner) {
      ctx.fillStyle = "#fff0a52d";
      ctx.fill(p);
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#fff4a3";
      ctx.stroke(p);
    }
    ctx.restore();
  }

  function arrow(x,y,direction) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(direction,1);
    const outline = rounded([[-16,-23],[25,0],[-16,23]],.31);
    ctx.fillStyle = gradient(ctx,0,-20,0,21,["#fff371","#ffc008","#f29103"]);
    ctx.fill(outline);
    ctx.strokeStyle = "#a25d00";
    ctx.lineWidth = 1.3;
    ctx.stroke(outline);
    const inside = rounded([[-11,-15],[16,0],[-11,15]],.35);
    ctx.fillStyle = gradient(ctx,-11,-13,17,15,["#ffeac2","#f59d9d","#bb4560"]);
    ctx.fill(inside);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#ad4c59";
    ctx.stroke(inside);
    ctx.restore();
  }

  function drawCylinder(level, now) {
    const d = dimensions(level);
    const spin = level.spin;
    const bonus = level.bonus;
    const cue = spin?.roll ? clamp((now-spin.started)/spin.delay) : 1;
    const pulse = Math.sin(cue*Math.PI);
    drawFrame(d,pulse);
    const [x,y,w,h] = d.inner;
    const [bx,by,bw,bh] = d.band;
    box(ctx,bx+5,by+4,bw-10,bh-8,10,"#ffb522");
    const clip = box(ctx,x+7,y+4,w-14,h-18,17);
    clip.addPath(box(ctx,bx+10,by+9,bw-20,bh-18,8));
    ctx.save();
    ctx.clip(clip);
    ctx.fillStyle = "#8e482e";
    ctx.fillRect(bx,y,bw,h);
    const edge = (MIN_DRUM_ROWS+1)/2;
    const count = drumCount(level);
    for (let col = 0; col < level.columns; col++) {
      let travel = spin ? 0 : (bonus?.steps ?? 0);
      if (spin?.roll) {
        const stagger = col*spin.stagger;
        const age = now-spin.started-spin.delay;
        if (bonus) {
          const step = clamp(age/(spin.roll+stagger));
          travel = bonus.steps*(1-(1-step)**2);
        } else {
          const step = clamp((age-stagger)/spin.roll);
          travel = .5-Math.cos(step*Math.PI)/2;
        }
      }
      const reel = bonus?.reels[col];
      for (let offset = Math.ceil(-edge-travel); offset <= Math.floor(edge-travel); offset++) {
        const row = ((level.row-offset)%count+count)%count;
        tile(d,level,row,col,offset+travel,now,reel?.[-offset]);
      }
    }
    if (cue < 1) {
      const beam = bx+(bw+120)*cue-60;
      ctx.globalAlpha = 1-cue;
      ctx.fillStyle = gradient(ctx,beam-106,0,beam+106,0,["#fff5bc27","#fff6a270","#fff5bc27"]);
      ctx.fillRect(bx,by+8,bw,bh-16);
    }
    ctx.restore();
    box(ctx,bx,by,bw,bh,13,null,"#aa680b",3.5);
    box(ctx,bx+5,by+5,bw-10,bh-10,10,null,
      gradient(ctx,0,by,0,by+bh,["#fff059","#ffcf05","#ff9d00","#ffe835"]),10);
    box(ctx,bx+3,by+3,bw-6,bh-6,11,null,"#ffd52e",2);
    if (cue < 1) box(ctx,bx+4,by+4,bw-8,bh-8,10,null,`rgba(255,249,174,${(1-cue)*.92})`,5);
    arrow(bx+8,d.cy,1);
    arrow(bx+bw-8,d.cy,-1);
  }

  function slotCenter(index) {
    return { x: 92+index*89, y: 641 };
  }

  function target(level, col) {
    const d = dimensions(level);
    const half = project(d,d.step/2).half;
    return {
      x: 270 + (col+.5-level.columns/2)*2*half/level.columns, y: d.cy,
      size: 2*half/level.columns*pocketRatio*faceSize/faceRadius
    };
  }

  const trayLayerY = 610;
  const trayLayer = document.createElement("canvas");
  trayLayer.width = W;
  trayLayer.height = 443;
  const trayContext = trayLayer.getContext("2d");
  let trayLevel = null;
  const {left:meshX, top:meshY, right:meshRight, bottom:meshBottom} = window.ShapeTray.bounds;
  const trayMeshes = window.ShapeMeshes.create({
    left:meshX, top:meshY, width:meshRight-meshX, height:meshBottom-meshY, round:22, picking:true
  });
  const flightMeshes = window.ShapeMeshes.create({width:148,height:148});
  const pocketRatio = .285;
  const faceSize = 84;
  const seatedFaceScale = .96;
  const faceRadius = window.ShapeTray.pieceSize({size:faceSize}).radius;
  const faceArtwork = new Map();
  let meshLevel = null;

  function prepareTray(level) {
    if (meshLevel === level && !level.geometryDirty) return;
    trayMeshes.render(level.tray);
    level.geometryDirty = false;
    meshLevel = level;
  }

  function pieceAt(level,x,y) {
    prepareTray(level);
    return trayMeshes.pick(x,y);
  }

  function exposed(level,item) {
    prepareTray(level);
    return trayMeshes.exposed(item);
  }

  function faceImage(kind) {
    if (!faceArtwork.has(kind)) {
      const sprite = window.ShapeMeshes.create({width:faceSize,height:faceSize});
      sprite.render([{kind,x:faceSize/2,y:faceSize/2,size:faceSize}]);
      faceArtwork.set(kind,sprite.canvas);
    }
    return faceArtwork.get(kind);
  }

  function drawTray(ctx, level) {
    for (let i = 0; i < 5; i++) {
      const {x,y} = slotCenter(i);
      const slot = rounded([[x-36,613],[x+42,613],[x+39,676],[x-42,676]],.09);
      ctx.fillStyle = gradient(ctx,0,612,0,677,[[0,"#ffd7b6"],[.13,"#ffc8a5"],[.87,"#f5a88e"],[.93,"#d77972"],[1,"#af5155"]]);
      ctx.fill(slot);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = "#a75a4f";
      ctx.stroke(slot);
      const waiting = level.waiting[i];
      if (waiting && !waiting.pending && !waiting.joining) {
        ctx.drawImage(faceImage(waiting.kind),x-faceSize/2,y-faceSize/2);
      }
    }
    box(ctx,41,697,454,353,33,"#361a1c");
    box(ctx,42,694,452,354,34,
      gradient(ctx,52,695,465,1046,[[0,"#fff16a"],[.13,"#ffcd12"],[.53,"#ffb90b"],[.89,"#ffda1b"],[1,"#fff171"]]),"#f7cc23",1.5);
    const felt = ctx.createRadialGradient(256,836,25,260,875,255);
    felt.addColorStop(0,"#35434c");
    felt.addColorStop(1,"#272f39");
    const inner = box(ctx,57,709,423,322,23,felt,"#cf7b10",3);
    ctx.save();
    ctx.clip(inner);
    const shadow = gradient(ctx,0,707,0,1030,[[0,"#181d28af"],[.052,"#181d2830"],[.13,"#181d2800"],[.94,"#181d2800"],[1,"#181d2899"]]);
    ctx.fillStyle = shadow;
    ctx.fillRect(57,709,423,322);
    prepareTray(level);
    ctx.drawImage(trayMeshes.canvas,meshX,meshY);
    ctx.restore();
  }

  const clamp = value => Math.max(0,Math.min(1,value));

  function syrupOutline(x, y, reaches, front, phase) {
    const outline = new Path2D();
    const segments = 72;
    for (let i = 0; i < segments; i++) {
      const angle = i*Math.PI*2/segments;
      const ux = Math.cos(angle), uy = Math.sin(angle);
      let reach = 0;
      for (const {dx,dy,distance} of reaches) {
        const alignment = Math.max(0,(dx*ux+dy*uy)/distance);
        reach = Math.max(reach,(distance+8)*alignment**3);
      }
      const ripple = 2.8*Math.sin(angle*5+phase)+1.7*Math.sin(angle*9-phase*1.4);
      const bank = Math.hypot(32+5*uy,reach);
      const blend = Math.max(0,1-Math.abs(bank-front)/16);
      const radius = Math.min(bank,front)-4*blend*blend+ripple*clamp(front/26);
      const px = x+radius*ux, py = y+radius*uy;
      if (i === 0) outline.moveTo(px,py);
      else outline.lineTo(px,py);
    }
    outline.closePath();
    return outline;
  }

  function drawSyrup(effect, age) {
    const { prop:candy, targets, impact, end } = effect;
    const flow = clamp(age/impact);
    const settle = clamp((age-impact)/(end-impact));
    const melt = clamp(flow/.36);
    const opacity = Math.min(1,flow*7)*(1-settle)**.8;
    const {x,y,size} = candy;
    const waterY = y+4+7*flow;
    const phase = flow*7+settle*3;
    const reaches = targets.map(piece => {
      const dx = piece.x-x, dy = piece.y-waterY;
      return {dx,dy,distance:Math.max(1,Math.hypot(dx,dy))};
    });
    const bank = Math.hypot(37,Math.max(...reaches.map(({distance}) => distance))+8);
    const front = 8+(bank-8)*(1-(1-flow)**1.55);
    const radius = front+5;
    const surface = syrupOutline(x,waterY,reaches,front,phase);
    ctx.save();
    ctx.clip(box(ctx,meshX,meshY,meshRight-meshX,meshBottom-meshY,22));

    ctx.save();
    ctx.clip(surface);
    const left = Math.max(0,Math.floor(x-radius-5));
    const right = Math.min(W,Math.ceil(x+radius+5));
    const top = Math.max(meshY,Math.floor(waterY-radius));
    const bottom = Math.min(meshBottom,Math.ceil(waterY+radius));
    // Sample the tray beneath the moving surface to bend its details like water.
    ctx.globalAlpha = opacity*.48;
    const refraction = .4+.6*flow;
    for (let row = top; row < bottom; row += 3) {
      const wave = (row-waterY)*.15-phase*3;
      const shiftX = (2.3*Math.sin(wave)+.8*Math.sin(wave*1.7))*refraction;
      const shiftY = Math.cos(wave)*1.4*refraction;
      ctx.drawImage(trayLayer,left,row-trayLayerY+shiftY,right-left,3,left+shiftX,row,right-left,3);
    }
    ctx.globalAlpha = opacity;
    ctx.fillStyle = gradient(ctx,x,waterY-radius,x,waterY+radius,
      ["#efb258aa","#cc7d32b8","#98501cbd"]);
    ctx.fill(surface);
    ctx.strokeStyle = "#71361384";
    ctx.lineWidth = 5;
    ctx.stroke(surface);
    const reflection = gradient(ctx,x-radius,waterY-radius,x+radius,waterY+radius,
      ["#fff0c9e0","#ffd48c9c","#ffbd6335"]);
    ctx.lineCap = "round";
    for (const offset of [0,.33,.66]) {
      const wave = (flow*.96+settle*.46+offset)%1;
      const ring = radius*(.14+wave*.84);
      ctx.globalAlpha = opacity*Math.sin(wave*Math.PI)*.85;
      ctx.beginPath();
      ctx.ellipse(x-6*wave,waterY+3*wave,ring,ring*.61,-.19,.17,Math.PI*1.18);
      ctx.strokeStyle = "#77432247";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = reflection;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalAlpha = opacity;
    ctx.strokeStyle = gradient(ctx,x,waterY-radius,x,waterY+radius,
      ["#ffe8b4e0","#e8aa5d80","#ffce81bc"]);
    ctx.lineWidth = 1.65;
    ctx.stroke(surface);
    ctx.globalAlpha = 1;
    if (melt < 1) {
      flightMeshes.render([{ kind:candy.kind,x:74,y:74,size,orientation:candy.orientation }]);
      ctx.translate(x,y+6*melt);
      ctx.scale(1+.16*melt,1-.85*melt);
      ctx.globalAlpha = (1-melt)**.68;
      ctx.drawImage(flightMeshes.canvas,-74,-74);
    }
    ctx.restore();
  }

  const cartonCuts = [[-.38,-.38],[.04,-.38],[.38,-.38],[.38,-.06],
    [.38,.38],[-.08,.38],[-.38,.38],[-.38,.03]];

  function drawCartonShards(effect, age) {
    const { x,y,size } = effect.prop;
    const spread = clamp((age-effect.impact)/(effect.end-effect.impact));
    const alpha = 1-clamp((age-effect.fade)/(effect.end-effect.fade));
    const texture = homePiece("pastryBox",false);
    for (const [i,[ax,ay]] of cartonCuts.entries()) {
      const [bx,by] = cartonCuts[(i+1)%cartonCuts.length];
      const dx = (ax+bx)/2, dy = (ay+by)/2;
      const travel = 96*(1-(1-spread)**2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x+dx*travel,y+dy*travel+20*spread*spread);
      ctx.rotate(spread*(i%2 ? .74 : -.74));
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(ax*size,ay*size);
      ctx.lineTo(bx*size,by*size);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(texture,-size/2,-size/2,size,size);
      ctx.restore();
    }
  }

  function drawHammer(effect, age) {
    if (age >= effect.impact) drawCartonShards(effect,age);
    const swing = clamp(age/effect.impact);
    const recoil = clamp((age-effect.impact)/(effect.impact*.72));
    if (recoil >= 1) return;
    const angle = swing < .58 ? -.16+Math.sin(swing/.58*Math.PI/2)*.68 :
      .52-1.40*((swing-.58)/.42)**1.7;
    const {x,y} = effect.prop;
    ctx.save();
    ctx.globalAlpha = 1-recoil;
    ctx.translate(x+37,y+31-14*recoil);
    ctx.rotate(angle+.48*recoil);
    ctx.drawImage(homePiece("hammer",false),-59,-97,118,118);
    ctx.restore();
  }

  function drawOven(oven, open, opacity = 1) {
    const size = oven.size/169;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(oven.x,oven.y);
    ctx.scale(size,size);
    box(ctx,-51,-41,102,82,13,gradient(ctx,0,-41,0,41,["#ff9b76","#cf6252","#8f3d3c"]),"#863a3a",2.1);
    box(ctx,-43,-33,86,64,8,"#f68d68","#ffc69a",1.5);
    box(ctx,-39,-26,78,52,7,gradient(ctx,0,-26,0,26,["#452229","#6b2c26","#b85527"]),"#733439",2);
    box(ctx,-28,10,56,7,3,"#ef9450");
    box(ctx,-28,19,56,3,1.5,"#a65334");
    for (const x of [-31,-22,-13]) box(ctx,x,-37,5,3,1,"#923e3d");
    disk(ctx,33,-34,3.1,"#ffce5b");
    const angle = open*Math.PI*.76;
    const tipY = 25-50*Math.cos(angle);
    const edge = 36+6*Math.sin(angle);
    if (Math.abs(tipY-25) > 1) {
      const door = rounded([[-38,25],[38,25],[edge,tipY],[-edge,tipY]],.11);
      ctx.save();
      ctx.clip(door);
      ctx.fillStyle = gradient(ctx,0,25,0,tipY,open < .66 ? ["#9c4341","#fa9573"] : ["#a35240","#ffb081"]);
      ctx.fill(door);
      ctx.strokeStyle = "#6b3036";
      ctx.lineWidth = 3;
      ctx.stroke(door);
      const middle = (tipY+25)/2;
      box(ctx,-24,middle-11,48,22,5,open < .66 ? "#532d35" : "#7d4036","#ffc795",1.2);
      box(ctx,-22,tipY+(open < .66 ? 3 : -6),44,3,1.5,"#ffd7a2");
      if (open < .38) {
        ctx.globalAlpha *= 1-clamp(open/.38);
        ctx.fillStyle = "#fff2ca";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = '900 21px system-ui, sans-serif';
        ctx.fillText(String(oven.remaining),0,middle);
      }
      ctx.restore();
    }
    box(ctx,-34,23,68,4,2,"#ffba7b");
    ctx.restore();
  }

  function flightPose(flight, now) {
    const f = clamp((now-flight.start)/flight.duration);
    const aim = flight.to;
    const approach = aim.seat ? clamp(f/.72) : f;
    const ease = 1-(1-approach)**2;
    const seat = aim.seat ? clamp((f-.72)/.28)**2 : 0;
    const lift = aim.seat ? 34 : 0;
    const approachScale = aim.seat ? 1.16 : 1;
    return {
      x:flight.from.x+(aim.x-flight.from.x)*ease,
      y:flight.from.y+(aim.y-flight.from.y)*ease+lift*(seat-ease)-
        Math.sin(approach*Math.PI)*(aim.arc ?? (aim.seat ? 8 : 30)),
      size:flight.from.size*(1-ease)+aim.size*(approachScale*ease-(approachScale-seatedFaceScale)*seat),
      orientation:window.ShapeMeshes.faceUp(flight.from.orientation,ease)
    };
  }

  function drawPlay(level, now) {
    ctx.drawImage(backdrop,0,0);
    drawCylinder(level,now);
    if (level !== trayLevel || level.trayDirty) {
      trayContext.clearRect(0,0,W,trayLayer.height);
      trayContext.save();
      trayContext.translate(0,-trayLayerY);
      drawTray(trayContext,level);
      trayContext.restore();
      level.trayDirty = false;
      trayLevel = level;
    }
    ctx.drawImage(trayLayer,0,trayLayerY);
    for (const piece of level.tray) {
      if (piece.kind === "oven") drawOven(piece,0);
    }
    for (const effect of level.mechanicFX) {
      const age = level.elapsed-effect.start;
      if (effect.kind === "syrup") drawSyrup(effect,age);
      else if (effect.kind === "hammer") drawHammer(effect,age);
      else if (effect.kind === "oven") {
        const open = 1-(1-clamp(age/effect.impact))**2;
        const opacity = 1-clamp((age-effect.fade)/(effect.end-effect.fade));
        drawOven(effect.prop,open,opacity);
      }
    }
    for (const flight of level.flights) {
      if (now < flight.start) continue;
      const {x,y,size,orientation} = flightPose(flight,now);
      flightMeshes.render([{kind:flight.kind,x:74,y:74,size,orientation}]);
      ctx.drawImage(flightMeshes.canvas,x-74,y-74);
    }
  }

  const pile = [
    [260,427,134,"cookieBiscuit",-.19],[211,457,94,"cookieStar",-.2],[352,456,108,"cookieHeart",.55],
    [116,493,110,"cookieHeart",.56],[179,467,119,"cookieJam",-.18],[319,472,134,"cookieBear",-.39],
    [237,501,146,"cookieStar",-.11],[389,526,121,"cookieStar",.20],[64,545,110,"cookieBear",.47],
    [143,551,136,"cookieBear",.26],[236,560,137,"cookieHeart",-.14],[313,542,132,"cookieJam",.20],
    [464,555,124,"cookieJam",.38],[502,577,118,"cookieBear",.24],[388,582,126,"cookieStar",-.18],
    [35,608,98,"cookieHeart",.44],[84,600,132,"cookieJam",-.12],[155,610,101,"cookieStar",-.22],
    [219,629,108,"cookieStar",.27],[312,610,147,"cookieBear",-.21],[451,622,148,"cookieHeart",.16],
    [518,655,117,"cookieStar",-.19],[552,637,132,"cookieJam",.14],[18,673,120,"cookieBear",.07],
    [96,689,152,"cookieHeart",.12],[152,635,137,"cookieStar",.21],[213,641,138,"cookieJam",-.06],
    [285,684,137,"cookieStar",.04],[371,674,153,"cookieBiscuit",-.16],[475,716,154,"cookieBear",-.31],
    [37,757,137,"cookieStar",-.19],[101,776,143,"cookieJam",.18],[198,744,155,"cookieBear",-.10],
    [274,767,124,"cookieJam",.08],[329,749,164,"cookieHeart",-.25],[393,762,125,"cookieStar",.49],
    [472,818,154,"cookieStar",.15],[285,854,148,"cookieBear",-.19],[378,879,139,"cookieJam",.09],
    [99,880,169,"cookieHeart",.32]
  ];

  const homeArtwork = new Map();
  function homePiece(kind, tipped) {
    const key = kind + Number(tipped);
    if (!homeArtwork.has(key)) {
      const size = 152;
      const mesh = window.ShapeMeshes.create({width:size,height:size});
      const tilt = tipped ? .54 : .16;
      mesh.render([{ kind,size,x:size/2,y:size/2,orientation:[Math.sin(tilt/2),0,0,Math.cos(tilt/2)] }]);
      homeArtwork.set(key,mesh.canvas);
    }
    return homeArtwork.get(key);
  }

  function drawHome() {
    ctx.fillStyle = "#f8c7a2";
    ctx.fillRect(0,0,W,H);
    if (room.complete && room.naturalWidth) ctx.drawImage(room,0,0,W,H);
    const shadow = ctx.createRadialGradient(268,696,35,268,696,283);
    shadow.addColorStop(0,"#6a3028ab");
    shadow.addColorStop(1,"#71322a00");
    ctx.save();
    ctx.translate(0,186);
    ctx.scale(1,.76);
    ctx.fillStyle = shadow;
    ctx.fillRect(0,386,W,638);
    ctx.restore();
    for (let i = 0; i < pile.length; i++) {
      const [x,y,size,kind,angle] = pile[i];
      ctx.save();
      ctx.shadowColor = "#53292294";
      ctx.shadowBlur = 9;
      ctx.shadowOffsetY = 9;
      ctx.translate(x,y);
      ctx.rotate(angle);
      ctx.drawImage(homePiece(kind,i%7 < 2),-size/2,-size/2,size,size);
      ctx.restore();
    }
  }

  const icons = {
    heart: `<svg viewBox="0 0 73 65" aria-hidden="true"><defs><radialGradient id="heart-color" cx=".35" cy=".24" r=".73"><stop stop-color="#ff7b7b"/><stop offset=".49" stop-color="#f92d41"/><stop offset="1" stop-color="#b60817"/></radialGradient></defs><path d="M36 61C28 56 4 43 3 24 2 3 25-3 36 13 47-3 70 3 70 23c0 18-22 33-34 38z" fill="url(#heart-color)" stroke="#7d1b24" stroke-width="2.6"/><path d="M8 22C9 9 23 5 30 14" fill="none" stroke="#ff9a9a" stroke-width="3" stroke-linecap="round" opacity=".76"/></svg>`,
    gear: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m19 3 10 0 1 6 5 2 5-3 6 8-4 4v7l4 3-5 9-6-2-5 2-1 6H19l-1-6-5-2-5 2-5-9 4-3v-7l-4-4 6-8 5 3 4-2z" fill="#fff0d7" stroke="#76374a" stroke-width="2.6" stroke-linejoin="round"/><path d="m12 11 5 2 4-4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="8.2" fill="#dc7083" stroke="#913950" stroke-width="2.5"/><circle cx="24" cy="24" r="4.6" fill="#963b50"/></svg>`,
    clock: `<svg viewBox="0 0 53 58" aria-hidden="true"><path d="M20 1h13v13H20z" fill="#ffc52a" stroke="#ac6506" stroke-width="2"/><circle cx="26.5" cy="32" r="24" fill="#ffb314" stroke="#945516" stroke-width="1.7"/><circle cx="26.5" cy="32" r="19" fill="#fff1dc" stroke="#db8a06" stroke-width="2.5"/><path d="M13 32h3m21 0h3M26 17v4m0 22v4" stroke="#c86c69" stroke-width="4" stroke-linecap="round"/><path d="M26 32v10m0-10h8" stroke="#7f3744" stroke-width="3.5" stroke-linecap="round"/><circle cx="26" cy="32" r="4" fill="#813946"/><path d="M9 21A20 20 0 0 1 38 14" fill="none" stroke="#fff183" stroke-width="3" stroke-linecap="round"/></svg>`,
    lock: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 22V15a10 10 0 0 1 20 0v7" fill="none" stroke="#2a4269" stroke-width="8"/><path d="M14 22V15a10 10 0 0 1 20 0v7" fill="none" stroke="#bdcce0" stroke-width="5"/><rect x="6" y="17" width="36" height="27" rx="9" fill="#a4b4cc" stroke="#344d77" stroke-width="2"/><path d="M10 25q1-5 7-5h13" stroke="#e4ecf6" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="m22 29-2 9h8l-2-9" fill="#324664"/><circle cx="24" cy="29" r="4" fill="#324664"/></svg>`,
    home: `<svg viewBox="0 0 110 96" aria-hidden="true"><defs><linearGradient id="roof" x2="0" y2="1"><stop stop-color="#fff075"/><stop offset="1" stop-color="#f6a109"/></linearGradient></defs><path d="M17 40 55 14l38 26v49H17z" fill="#fff2bd" stroke="#9a5315" stroke-width="3"/><path d="M27 42h56v46H27z" fill="#ffda75"/><path d="M37 89V69a18 18 0 0 1 36 0v20z" fill="#a66024" stroke="#f9b62e" stroke-width="5"/><circle cx="63" cy="75" r="3.3" fill="#ffdc56"/><path d="m4 37 44-32q7-6 14 0l44 32q5 5-1 11l-5 4q-4 2-10-2L55 25 17 50q-7 5-12-1z" fill="url(#roof)" stroke="#8f541e" stroke-width="2.5"/><path d="m14 38 39-29 40 28" fill="none" stroke="#fff083" stroke-width="3" stroke-linecap="round"/></svg>`,
    shop: `<svg viewBox="0 0 105 95" aria-hidden="true"><path d="M21 33h64v45H21z" fill="#f6b824" stroke="#834a1b" stroke-width="3"/><path d="M31 42h45v27H31z" fill="#a65954" stroke="#79523b" stroke-width="2"/><path d="M20 20 53 7l34 13v19H20z" fill="#ffcf3a" stroke="#8d661d" stroke-width="3"/><path d="M18 30h70l8 10v8q-5 12-17 2-10 10-18 0-8 12-18 0-9 10-17 0-11 10-18-2v-8z" fill="#ee8e92" stroke="#873d4b" stroke-width="2"/><path d="m37 31-5 9v10q7 6 13 0V39l3-8m10 0 3 9v10q8 6 14 0V39l-5-8" fill="#fff2dc"/><rect x="17" y="70" width="73" height="12" rx="5" fill="#ffda47" stroke="#996216" stroke-width="2"/><path d="M23 82h61l-5 11H28z" fill="#cc6675" stroke="#225392" stroke-width="2"/></svg>`,
    trophy: `<svg viewBox="0 0 105 95" aria-hidden="true"><defs><linearGradient id="cup"><stop stop-color="#b96507"/><stop offset=".38" stop-color="#ffe85e"/><stop offset=".7" stop-color="#fbc12d"/><stop offset="1" stop-color="#ca730c"/></linearGradient></defs><path d="M27 31H15c-11 0-11 17 0 23l20 9m43-32h12c11 0 11 17 0 23l-20 9" fill="none" stroke="#703c19" stroke-width="11"/><path d="M27 31H15c-11 0-11 17 0 23l20 9m43-32h12c11 0 11 17 0 23l-20 9" fill="none" stroke="#f8b12c" stroke-width="7"/><path d="M27 21h51l-3 27q-3 16-17 23v10l16 7v6H32v-6l16-7V71Q35 64 30 48z" fill="url(#cup)" stroke="#804516" stroke-width="2"/><ellipse cx="53" cy="19" rx="32" ry="7" fill="#ffc632" stroke="#8a4c17" stroke-width="3"/><ellipse cx="53" cy="20" rx="25" ry="3.8" fill="#e28c15"/></svg>`,
    profile: `<svg viewBox="0 0 70 70" aria-hidden="true"><rect x="12" y="13" width="46" height="51" rx="9" fill="#ffd6a0" stroke="#85463e" stroke-width="3"/><rect x="23" y="7" width="24" height="13" rx="5" fill="#ba5969" stroke="#743940" stroke-width="3"/><path d="m22 33 4 4 8-9m-12 21 4 4 8-9m5-10h10m-10 16h10" fill="none" stroke="#8e4546" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  function rewardCoins() {
    const stack = [[48,76,5],[76,50,5],[112,56,6],[139,81,6],[59,102,4],[103,105,8],[133,110,3]];
    return `<svg viewBox="0 0 190 152" aria-hidden="true"><defs><linearGradient id="reward-gold"><stop stop-color="#f98a0d"/><stop offset=".48" stop-color="#ffcf25"/><stop offset="1" stop-color="#ff8b09"/></linearGradient></defs>${
      stack.map(([x,y,count]) => Array.from({length:count},(_,i) => {
        const cy = y-i*7;
        return `<path d="M${x-23} ${cy}v7c0 12 46 12 46 0v-7z" fill="url(#reward-gold)" stroke="#bd5809" stroke-width="1.3"/><ellipse cx="${x}" cy="${cy}" rx="23" ry="10" fill="#ffbd1c" stroke="#ce7309" stroke-width="1.1"/><ellipse cx="${x}" cy="${cy-1}" rx="15" ry="6.5" fill="#ffad09" stroke="#ffdc4a" stroke-width="2"/>`;
      }).join("")).join("")
    }<ellipse cx="37" cy="112" rx="18" ry="23" transform="rotate(29 37 112)" fill="#ffb515" stroke="#d77407" stroke-width="3"/><ellipse cx="37" cy="112" rx="13" ry="17" transform="rotate(29 37 112)" fill="#ffc522" stroke="#ffdc3d" stroke-width="2"/></svg>`;
  }

  window.ShapeArt = { ready, W, H, drawHome, drawPlay, flightPose, pieceAt, exposed, slotCenter, target, drumCount, icons, rewardCoins };
})();
