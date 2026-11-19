// Presentation data: sprite mapping, skins, VFX, descriptions.
(function () {
  'use strict';
  const META = window.ASSET_META;
  function charPath(name, anim) {
    const c = META.chars[name]; if (!c) return null;
    const a = c.anims[anim]; if (!a) return null;
    return encodeURI(META.packs[c.pack] + a.file);
  }
  function fxPath(name) { const f = META.fx[name]; return f ? encodeURI(META.packs[f.pack] + f.file) : null; }

  // hero skins (first = default). unlock = total stars needed.
  const SKINS = {
    sword: [{ sprite: 'Knight', name: 'Hiệp sĩ', unlock: 0 }, { sprite: 'Knight Templar', name: 'Thánh kỵ sĩ', unlock: 30 }, { sprite: 'Soldier', name: 'Lính gác', unlock: 60 }],
    archer: [{ sprite: 'Archer', name: 'Thợ săn', unlock: 0 }],
    mage: [{ sprite: 'Wizard', name: 'Pháp sư lam', unlock: 0 }],
    lancer: [{ sprite: 'Lancer', name: 'Thương kỵ', unlock: 0 }, { sprite: 'Armored Axeman', name: 'Rìu thủ giáp', unlock: 90 }],
    assassin: [{ sprite: 'Swordsman', name: 'Kiếm khách', unlock: 0 }],
    ice: [{ sprite: 'Priest', name: 'Nữ tu băng', unlock: 0, filter: 'hue-rotate(170deg) saturate(1.4) brightness(1.08)' }],
  };
  // animation used by each skill category per hero sprite
  function heroAnim(sprite, cat) {
    const a = META.chars[sprite].anims;
    const pick = (...k) => k.find(x => a[x]) || 'Idle';
    if (cat === 'normal') return pick('Attack01', 'Attack');
    if (cat === 'push') return pick('Attack02', 'Block', 'Attack01', 'Attack');
    return pick('Attack03', 'Attack3', 'Heal', 'Attack02', 'Attack01');
  }
  // melee heroes dash to the target, strike, then run back to their cell
  const MELEE = { sword: true, lancer: true, assassin: true };
  function walkOf(sprite) { const a = META.chars[sprite].anims; return ['Walk', 'Walk01', 'Walk02'].find(x => a[x]) || 'Idle'; }
  // VFX per skill: kind = 'proj' (flies along row) | 'cells' (plays on every AoE cell) | 'beam' (across pierce cells) | 'rain'
  const SKILL_FX = {
    sw_n: { kind: 'slash', color: '#ffe08a' },
    sw_p: { kind: 'wave', color: '#cfe8ff' },
    sw_r: { kind: 'cells', fx: 'Priest_Heal_effect', tint: 'sepia(1) saturate(4) hue-rotate(5deg)' },
    ar_n: { kind: 'proj', fx: 'Arrow01' },
    ar_p: { kind: 'proj', fx: 'Arrow02' },
    ar_r: { kind: 'rain', fx: 'Arrow03', fx2: 'Arrow_Demon_B_Attack01' },
    mg_n: { kind: 'cells', fx: 'Wizard_Attack01_Effect' },
    mg_p: { kind: 'cells', fx: 'Necromancer_Attack02_Effect' },
    mg_r: { kind: 'cells', fx: 'Wizard_Attack02_Effect', fx2: 'Warlock_Attack02_Effect' },
    ln_n: { kind: 'beam', fx: 'Black Knight_C_Beam' },
    ln_p: { kind: 'wave', color: '#ffd28a' },
    ln_r: { kind: 'beam', fx: 'Ghostfire_Beam', fx2: 'Black Knight_C_Beam' },
    as_n: { kind: 'proj', fx: 'Arrow_Demon_B_Attack01' },
    as_p: { kind: 'proj', fx: 'Cannonball_Black Knight_B_Attack03' },
    as_r: { kind: 'cells', fx: 'Necromancer_Sumon_Effect' },
    ic_n: { kind: 'cells', fx: 'Priest_Attack_effect', tint: 'hue-rotate(170deg) saturate(1.5)' },
    ic_p: { kind: 'beam', fx: 'Eyeball Monster_Beam', tint: 'hue-rotate(160deg)' },
    ic_r: { kind: 'cells', fx: 'Priest_Heal_effect', tint: 'hue-rotate(170deg) saturate(1.6)' },
  };
  const BUMP_FX = 'Lava Slime_Spike';

  const KIND_INFO = {
    slime: { name: 'Slime / Quái nhỏ', desc: 'HP thấp, dễ bị đẩy. Không có hiệu ứng đặc biệt.' },
    skel: { name: 'Bộ xương / Quái thường', desc: 'HP trung bình, không có hiệu ứng đặc biệt.' },
    armor: { name: 'Giáp nặng', desc: 'Giảm 1 sát thương mỗi sự kiện đánh (tối thiểu 0).' },
    anchor: { name: 'Quái neo', desc: 'Miễn đẩy: đứng nguyên khi bị đẩy. Chặn đường của quái khác bị đẩy vào ô của nó.' },
    boss: { name: 'Tinh anh / Boss', desc: 'HP lớn, có giáp 1 và miễn đẩy. Vẫn chiếm 1 ô.' },
  };
  const POLICY_TXT = {
    FRONT: { short: 'Hàng đầu', tip: 'Nhắm quái sống đầu tiên trong cùng hàng (quét từ cột A sang D, bỏ qua ô trống).' },
    SKIP: { short: 'Bỏ qua 1 quái', tip: 'Bỏ qua ô có quái đầu tiên, nhắm quái tiếp theo trong cùng hàng. Ô trống không được tính. Nếu sau nó không còn quái thì đánh luôn con đầu tiên.' },
  };
  const AOE_TXT = {
    single: 'Đơn mục tiêu', vline3: 'Quét dọc 3 ô', pierce3: 'Xuyên ngang 3 ô', pierce4: 'Xuyên ngang 4 ô',
    plus5: 'Dấu cộng 5 ô', block2: 'Khối 2×2', block3: 'Khối 3×3',
  };
  const CAT_TXT = { normal: 'Đánh thường', push: 'Đẩy', rage: 'Chiêu nộ' };
  const FAIL_TXT = { no_target: 'Không có mục tiêu', blocked: 'Bị tường chặn', no_rage: 'Hết nộ' };

  const CONCEPT = [
    ['assets/concept/fantasy-puzzle-portrait-skills-demo.png', 'Bố cục màn dọc & bảng kỹ năng (tham khảo art direction).'],
    ['assets/concept/fantasy-puzzle-two-grids-demo.png', 'Hai sân 4×4 song song.'],
    ['assets/concept/fantasy-puzzle-grid-4x4-demo.png', 'Nghiên cứu lưới 4×4.'],
    ['assets/concept/fantasy-puzzle-skills-push-8-directions-demo.png', 'Nghiên cứu bộ chọn hướng đẩy (bản game dùng hướng cố định theo nhân vật).'],
  ];

  window.DATA = { META, charPath, fxPath, SKINS, heroAnim, MELEE, walkOf, SKILL_FX, BUMP_FX, KIND_INFO, POLICY_TXT, AOE_TXT, CAT_TXT, FAIL_TXT, CONCEPT };
})();
