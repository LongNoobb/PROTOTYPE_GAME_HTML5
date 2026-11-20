/* Cable Grid Sort — mechanic intro cards: short rules + a small illustration in the board's art style. */
(function (root) {
  'use strict';
  const C = { red: '#f23d3d', blue: '#2f7bf6', yellow: '#ffc61f', green: '#39c44a', purple: '#a74ff5', cyan: '#1ec8ea', gray: '#b3bac7' };
  const dark = { red: '#7a1414', blue: '#123f8f', yellow: '#7a5a00', green: '#14611d', purple: '#4b1a80', cyan: '#0a5f70', gray: '#5d6472' };
  const key = hex => Object.keys(C).find(k => C[k] === hex) || 'gray';

  function port(x, y, col, sym) {
    const k = key(col);
    let s = `<rect x="${x - 19}" y="${y - 16}" width="38" height="32" rx="7" fill="${col}" stroke="${dark[k]}" stroke-width="1.6"/>
      <rect x="${x - 12}" y="${y - 9}" width="24" height="17" rx="2.5" fill="#1b1f29"/>`;
    for (let j = 0; j < 6; j++) s += `<rect x="${x - 8 + j * 3}" y="${y + 2}" width="1.4" height="4" fill="#e0b54a"/>`;
    if (sym) s += `<circle cx="${x + 17}" cy="${y + 14}" r="7" fill="#fff" stroke="${dark[k]}" stroke-width="1.5"/><text x="${x + 17}" y="${y + 17.2}" font-size="8.5" text-anchor="middle" fill="${dark[k]}" font-weight="900">${sym}</text>`;
    return s;
  }
  function plug(x, y, col, sym, opts) {
    opts = opts || {};
    const k = key(col);
    let s = `<g ${opts.op ? `opacity="${opts.op}"` : ''} ${opts.cls ? `class="${opts.cls}"` : ''}><rect x="${x - 9}" y="${y - 10}" width="18" height="13" rx="2" fill="#eaf5ff" stroke="#7aa6cf"/>
      <path d="M${x - 10},${y + 2} L${x + 10},${y + 2} L${x + 7},${y + 18} L${x - 7},${y + 18} Z" fill="${col}" stroke="${dark[k]}" stroke-width="1.3"/>`;
    if (sym) s += `<text x="${x}" y="${y + 14}" font-size="9" text-anchor="middle" fill="#fff" stroke="${dark[k]}" stroke-width="2" paint-order="stroke" font-weight="900">${sym}</text>`;
    if (opts.len) s += `<g transform="translate(${x + 13},${y - 13})"><rect x="-7" y="-6" width="14" height="12" rx="6" fill="#1f3a8a" stroke="#fff" stroke-width="1.2"/><text y="3.5" font-size="8.5" text-anchor="middle" fill="#fff" font-weight="900">${opts.len}</text></g>`;
    if (opts.lock) s += `<text x="${x}" y="${y + 13}" font-size="10" text-anchor="middle">🔒</text>`;
    return s + '</g>';
  }
  function cable(x1, y1, x2, y2, col, extra) {
    const k = key(col), d = `M${x1},${y1 + 17} Q${(x1 + x2) / 2},${(y1 + y2) / 2 + 24} ${x2},${y2 + 17}`;
    return `<path d="${d}" fill="none" stroke="${dark[k]}" stroke-width="10" stroke-linecap="round" ${extra || ''}/>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" ${extra || ''}/>
      <path d="${d}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round" transform="translate(-1,-1.5)"/>`;
  }
  const arrow = (x1, y1, x2, y2, curve) => {
    const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - (curve || 26);
    const a = Math.atan2(y2 - my, x2 - mx), hx = x2, hy = y2;
    return `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="#1d4ed8" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"/>
      <path d="M${hx},${hy} l${Math.cos(a + 2.6) * 10},${Math.sin(a + 2.6) * 10} M${hx},${hy} l${Math.cos(a - 2.6) * 10},${Math.sin(a - 2.6) * 10}" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round"/>`;
  };
  const big = (x, y, t, col) => `<text x="${x}" y="${y}" font-size="15" text-anchor="middle" font-weight="900" fill="${col || '#1d2b55'}">${t}</text>`;
  const badge = (x, y, ok) => `<circle cx="${x}" cy="${y}" r="9" fill="${ok ? '#22b14c' : '#ef4444'}" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y + 4}" font-size="11" text-anchor="middle" fill="#fff" font-weight="900">${ok ? '✓' : '✕'}</text>`;
  const led = (x, y, col) => `<circle cx="${x}" cy="${y}" r="4" fill="${col}" stroke="#fff" stroke-width="1.2"/>`;
  const pill = (x, y, txt, w) => `<rect x="${x - w / 2}" y="${y - 11}" width="${w}" height="22" rx="11" fill="#fff" stroke="#f5b400" stroke-width="2"/><text x="${x}" y="${y + 4}" font-size="10.5" text-anchor="middle" fill="#5b4300" font-weight="800">${txt}</text>`;
  const frame = inner => `<svg viewBox="0 0 260 130" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="256" height="126" rx="14" fill="#6f7788"/><rect x="6" y="6" width="248" height="118" rx="11" fill="#7d8596"/>${inner}</svg>`;

  const ART = {
    move: () => frame(port(50, 75, C.gray) + port(130, 75, C.gray) + port(210, 45, C.red, '●') +
      cable(50, 75, 130, 75, C.red) + plug(50, 75, C.red, '●', { len: 3, op: .35 }) + plug(130, 75, C.red, '●', { len: 3 }) +
      plug(50, 75, C.red, '●', { op: .35 }) + arrow(52, 50, 205, 33, 30) + big(130, 120, 'Rút ra → cắm thẳng vào cổng đích')),
    length: () => frame(`<circle cx="90" cy="65" r="56" fill="${C.blue}" fill-opacity=".18" stroke="${C.blue}" stroke-width="2.5" stroke-dasharray="7 5"/>` +
      port(90, 65, C.gray) + port(140, 40, C.gray) + port(205, 65, C.gray) + plug(90, 65, C.blue, '●', { len: 2 }) +
      badge(160, 26, true) + badge(225, 50, false) + big(90, 122, 'Tầm với = chiều dài', '#1d4ed8') + big(205, 108, 'Quá xa', '#b91c1c')),
    transit: () => frame(port(60, 55, C.yellow, '■') + port(135, 55, C.gray) + port(210, 55, C.red, '●') +
      plug(60, 55, C.red, '●') + plug(135, 55, C.red, '●', { op: .35 }) + arrow(62, 30, 130, 30, 20) + big(130, 112, '① Dời đầu đỏ ra cổng trống  ② Cắm vàng vào')),
    crossing: () => frame(port(40, 30, C.gray) + port(110, 30, C.gray) + port(40, 82, C.gray) + port(110, 82, C.gray) +
      `<line x1="40" y1="47" x2="110" y2="99" stroke="${C.red}" stroke-width="7" stroke-linecap="round"/><line x1="110" y1="47" x2="40" y2="99" stroke="${C.blue}" stroke-width="7" stroke-linecap="round"/>` +
      `<circle cx="75" cy="73" r="9" fill="#ff7a1a" stroke="#fff" stroke-width="2"/><text x="75" y="77" font-size="11" fill="#fff" text-anchor="middle" font-weight="900">✕</text>` +
      plug(40, 30, C.red) + plug(110, 82, C.red) + plug(110, 30, C.blue) + plug(40, 82, C.blue) + led(124, 18, '#ffb020') +
      big(130, 70, '→') + port(165, 30, C.gray) + port(230, 30, C.gray) + port(165, 82, C.gray) + port(230, 82, C.gray) +
      `<line x1="165" y1="47" x2="230" y2="47" stroke="${C.red}" stroke-width="7" stroke-linecap="round"/><line x1="165" y1="99" x2="230" y2="99" stroke="${C.blue}" stroke-width="7" stroke-linecap="round"/>` +
      plug(165, 30, C.red) + plug(230, 30, C.red) + plug(165, 82, C.blue) + plug(230, 82, C.blue) + led(244, 18, '#5cff6a') + led(244, 70, '#5cff6a')),
    hidden: () => frame(port(60, 50, C.gray) + port(200, 50, C.gray) + cable(60, 50, 200, 50, C.purple) +
      `<path d="M95,85 Q130,93 165,85" fill="none" stroke="#8b93a3" stroke-width="16" stroke-linecap="round"/>` +
      plug(60, 50, C.purple, '★') + plug(200, 50, C.purple, '★', { cls: 'blink' }) +
      `<rect x="${200 - 26}" y="${50 - 22}" width="52" height="44" rx="10" fill="none" stroke="${C.purple}" stroke-width="3" class="blink"/>` + big(130, 120, 'Chọn 1 đầu → đầu kia nhấp sáng')),
    lockCable: () => frame(port(55, 55, C.gray) + plug(55, 55, '#8a93a5', '?') + pill(55, 22, '🔒 0/1', 54) +
      big(130, 62, '→') + port(205, 55, C.gray) + plug(205, 55, C.blue, '▲') + pill(205, 22, '✓ Đã mở', 70) + big(130, 116, 'Hoàn thành 1 dây bất kỳ để mở')),
    // same look as the board: tinted glass roller shutter, hazard frame, handle bar, padlock tag
    region: () => frame(`<defs><pattern id="mh-hz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#232833"/><rect width="6" height="12" fill="#ffc21a"/></pattern>
      <pattern id="mh-sl" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="rgba(16,22,38,.56)"/><rect width="8" height="1.4" fill="rgba(255,255,255,.13)"/></pattern></defs>` +
      port(45, 30, C.gray) + port(105, 30, C.gray) + port(165, 30, C.gray) + port(225, 30, C.gray) +
      port(45, 84, C.gray) + port(105, 84, C.gray) + port(165, 84, C.red, '●') + port(225, 84, C.gray) + plug(45, 84, C.yellow, '■') +
      `<rect x="14" y="58" width="232" height="58" rx="9" fill="url(#mh-sl)"/><rect x="16" y="60" width="228" height="54" rx="8" fill="none" stroke="url(#mh-hz)" stroke-width="4"/>` +
      `<rect x="26" y="56" width="208" height="8" rx="4" fill="#c3cad6" stroke="#59606f"/>` +
      `<rect x="78" y="105" width="104" height="22" rx="11" fill="#fff" stroke="#f5b400" stroke-width="2"/>` +
      `<g transform="translate(94,117)"><path d="M-4,-2 V-5 A4,4 0 0 1 4,-5 V-2" fill="none" stroke="#5b6476" stroke-width="2.2"/><rect x="-6" y="-2.5" width="12" height="9" rx="2" fill="#f5b400" stroke="#7a5a00"/></g>` +
      `<circle cx="116" cy="116" r="5" fill="${C.red}" stroke="rgba(0,0,0,.3)"/><text x="125" y="120" font-size="11.5" font-weight="900" fill="#5b4300">Đỏ 0/1</text>`),
    symbols: () => frame(port(40, 40, C.red, '●') + port(110, 40, C.red, '●') + port(150, 40, C.red, '▲') + port(220, 40, C.red, '▲') +
      plug(40, 40, C.red, '●') + plug(110, 40, C.red, '●') + plug(150, 40, C.red, '▲') + plug(220, 40, C.red, '▲') +
      `<line x1="40" y1="57" x2="110" y2="57" stroke="${C.red}" stroke-width="7" stroke-linecap="round"/><line x1="150" y1="57" x2="220" y2="57" stroke="${C.red}" stroke-width="7" stroke-linecap="round"/>` +
      big(130, 108, 'Cùng màu: khớp KÝ HIỆU ● ▲')),
    or: () => frame(pill(130, 38, '🔒 Hoàn thành 3 dây', 150) + big(130, 72, 'HOẶC', '#b45309') + pill(130, 102, '🔒 Xanh lá 2/2', 120)),
    broken: () => frame(port(60, 55, '#6b7280') + `<path d="M50,46 L70,64 M70,46 L50,64" stroke="#ff4d4d" stroke-width="4" stroke-linecap="round"/>` +
      big(60, 110, 'Cổng hỏng') + port(150, 55, C.gray) + port(215, 55, C.green, '◆') + plug(215, 55, C.green, '◆') + led(231, 41, '#5cff6a') +
      plug(150, 55, C.green, '◆', { op: .4 }) + arrow(210, 30, 155, 30, 18) + big(185, 110, 'Dời tạm dây đã xong')),
    brokenBasic: () => frame(port(70, 50, '#6b7280') + `<path d="M61,43 L79,57 M79,43 L61,57" stroke="#ff4d4d" stroke-width="3.5" stroke-linecap="round"/>` +
      plug(190, 50, C.blue, '●', { len: 3 }) + arrow(180, 28, 82, 26, 22) + badge(70, 22, false) + big(130, 112, 'Cổng hỏng: không cắm được', '#b91c1c')),
    chain: () => frame(pill(55, 40, '🔒 2 dây', 70) + big(108, 45, '→') + pill(170, 40, '🔒 Đỏ 2 VÀ XD 1', 124) +
      big(130, 92, 'Mỗi mốc mở thêm dây / vùng mới') + big(130, 114, 'Đã mở thì không đóng lại', '#15803d')),
    complete: () => frame(port(45, 50, C.red, '●') + port(115, 50, C.red, '●') + plug(45, 50, C.red) + plug(115, 50, C.red) +
      `<line x1="45" y1="67" x2="115" y2="67" stroke="${C.red}" stroke-width="7"/>` + led(129, 38, '#5cff6a') + big(80, 112, 'LED xanh = hoàn thành') +
      port(175, 50, C.blue) + port(235, 50, C.blue) + plug(175, 50, C.blue) + plug(235, 50, C.blue) + led(249, 38, '#ffb020') + big(205, 112, 'LED vàng = còn giao', '#b45309')),
  };

  // One card per mechanic, shown the first time its level is opened. Rules here mirror engine.js exactly.
  const INTROS = {
    1: { id: 'move', title: 'Rút ra – cắm vào', art: 'move', lines: [
      'Chạm một <b>đầu dây</b>, rồi chạm cổng muốn cắm — hoặc kéo thả.',
      'Cắm <b>hai đầu</b> vào hai cổng cùng <b>màu và ký hiệu</b> với dây.',] },
    3: { id: 'transit', title: 'Mỗi cổng một đầu dây', art: 'transit', lines: [
      'Cổng đã có đầu dây thì không cắm thêm được.',
      'Cổng đích bị chiếm? <b>Dời đầu dây kia</b> sang cổng trống trước.',
      'Cổng đích của dây khác vẫn dùng làm chỗ <b>đứng tạm</b> được.'] },
    5: { id: 'crossing', title: 'Không được giao nhau', art: 'crossing', lines: [
      'Dây chỉ <b>hoàn thành</b> khi đúng cặp cổng <b>và</b> không cắt dây nào.',
      'Dấu <b style="color:#ea580c">✕ cam</b> là chỗ giao. Đi xuyên qua đầu cắm khác cũng tính.',
      '<b>LED vàng</b> = đúng cặp nhưng còn giao · <b>LED xanh</b> = hoàn thành.'] },
    6: { id: 'hidden', title: 'Dây che thân', art: 'hidden', lines: [
      'Thân dây nằm dưới <b>lớp che</b>, nhưng màu, ký hiệu và chiều dài vẫn hiện.',
      'Chọn một đầu để thấy <b>đầu còn lại nhấp sáng</b>.',
      'Hoàn thành dây thì lớp che biến mất.'] },
    7: { id: 'lockCable', title: 'Dây chờ mở', art: 'lockCable', lines: [
      'Dây có <b>nắp khóa</b> chưa di chuyển được và chưa tính giao cắt.',
      'Nhãn <b>0/1</b> cho biết cần hoàn thành bao nhiêu dây để mở.',
      'Mỗi dây chỉ được <b>tính một lần</b> — rút ra sau đó cũng không mất.'] },
    8: { id: 'region', title: 'Vùng khóa theo màu', art: 'region', lines: [
      'Vùng sau <b>cửa kính viền sọc vàng-đen</b> đang khóa: không cắm vào hay rút ra được, nhưng vẫn nhìn thấy bên trong.',
      'Nhãn ghi điều kiện: ở đây cần <b>1 dây đỏ</b> hoàn thành — dây màu khác không tính.',
      'Vùng đã mở thì <b>không đóng lại</b>.'] },
    9: { id: 'symbols', title: 'Cùng màu, khác ký hiệu', art: 'symbols', lines: [
      'Hai dây đỏ có cặp cổng riêng: <b>● vào ●</b>, <b>▲ vào ▲</b>.',
      'Ký hiệu in trên đầu cắm và ở góc cổng đích.'] },
    10: { id: 'or', title: 'Điều kiện HOẶC', art: 'or', lines: [
      'Vùng mở khi đạt <b>một trong hai</b> điều kiện.',
      'Chọn con đường ngắn hơn cho bàn hiện tại.'] },
    11: { id: 'broken', title: 'Tủ chật: dời dây đã xong', art: 'broken', lines: [
      'Nhiều cổng hỏng làm tủ <b>rất ít chỗ trống</b>.',
      'Dây đã hoàn thành <b>vẫn dời được</b> để nhường chỗ — tiến độ mở khóa vẫn giữ.'] },
    12: { id: 'chain', title: 'Chuỗi mở khóa', art: 'chain', lines: [
      'Mốc 1: <b>2 dây bất kỳ</b> → mở Đỏ ▲ và Xanh dương ▲.',
      'Mốc 2: <b>2 dây đỏ VÀ 1 dây xanh dương</b> → mở hai hàng cuối và 2 dây bí mật.',
      'Thắng khi <b>cả 8 dây</b> đúng cặp và không còn giao nhau.'] },
  };

  // Shown together with the level's own card the first time a level with broken ports opens.
  const BROKEN_INTRO = { id: 'brokenBasic', title: 'Cổng hỏng', art: 'brokenBasic', lines: [
    'Cổng xám có <b style="color:#ef4444">✕ đỏ</b> là cổng hỏng: <b>không cắm vào được</b>, kể cả để đứng tạm.',
    'Cổng hỏng <b>không bao giờ sửa được</b> — hãy tìm đường vòng qua cổng khác.'] };

  root.CGS_MECH = { INTROS, BROKEN_INTRO, art: name => (ART[name] || ART.move)(), COMPLETE_ART: () => ART.complete() };
})(typeof self !== 'undefined' ? self : this);
