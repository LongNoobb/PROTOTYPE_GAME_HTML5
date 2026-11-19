/* Cable Grid Sort — level set (prototype).
 * Coordinates are [col, row], col 0..4 left→right, row 0..5 top→bottom.
 * Every level here is checked by tools/verify.js (solver over the full state incl. unlocks).
 * Move rule: pull a plug out and plug it into ANY free open port within the cable length of the other end.
 * Levels 3–4 and 6–12 had start positions searched by tools/chaos.js (tangled: crossings, diagonal stretch, plugs far from targets — never easier than before), then solved optimally.
 */
(function (root) {
  const LEVELS = [
    {
      id: 1, name: 'Cắm đúng cổng', lesson: 'Rút ra – cắm vào',
      tip: 'Chạm một đầu dây rồi chạm cổng sáng muốn cắm (hoặc kéo thả). Đưa hai đầu vào hai cổng viền đỏ.',
      hand: true,
      cables: [
        { id: 'R', color: 'red', sym: '●', len: 3, ends: [[1, 3], [3, 3]], targets: [[1, 1], [3, 1]] },
      ],
    },
    {
      id: 2, name: 'Phối hợp hai đầu', lesson: 'Di chuyển cả hai đầu',
      tip: 'Dây chỉ dài 2: chỉ cắm được vào cổng trong tầm với của đầu kia. Hãy dời luân phiên hai đầu.',
      cables: [
        { id: 'B', color: 'blue', sym: '●', len: 2, ends: [[0, 5], [1, 5]], targets: [[2, 1], [4, 1]] },
      ],
    },
    {
      id: 3, name: 'Nhường đường', lesson: 'Ô trung chuyển',
      tip: 'Đầu dây có thể tạm đứng ở bất kỳ cổng trống nào, kể cả cổng đích của dây khác.',
      cables: [
        { id: 'R', color: 'red', sym: '●', len: 2, ends: [[1, 4], [0, 5]], targets: [[0, 2], [2, 2]] },
        { id: 'Y', color: 'yellow', sym: '■', len: 2, ends: [[1, 0], [0, 1]], targets: [[1, 3], [3, 3]] },
        { id: 'B', color: 'blue', sym: '◆', len: 2, ends: [[0, 4], [1, 5]], targets: [[2, 1], [4, 1]] },
      ],
    },
    {
      id: 4, name: 'Dây căng', lesson: 'Giới hạn chiều dài',
      tip: 'Số trên đầu cắm là chiều dài tối đa. Vòng tròn mờ cho biết tầm với của đầu đang chọn.',
      broken: [[2, 1], [3, 4]],
      cables: [
        { id: 'G', color: 'green', sym: '◆', len: 2, ends: [[3, 5], [4, 4]], targets: [[1, 1], [1, 2]] },
        { id: 'B', color: 'blue', sym: '●', len: 2, ends: [[0, 1], [1, 0]], targets: [[2, 4], [4, 4]] },
        { id: 'O', color: 'orange', sym: '▲', len: 3, ends: [[4, 5], [2, 3]], targets: [[3, 0], [3, 3]] },
      ],
    },
    {
      id: 5, name: 'Gỡ rối', lesson: 'Gỡ giao cắt',
      tip: 'Dây chỉ tính là hoàn thành khi đúng cặp cổng VÀ không giao với dây nào. Dấu ✕ đánh dấu điểm giao.',
      cables: [
        { id: 'R', color: 'red', sym: '●', len: 4, ends: [[1, 1], [4, 2]], targets: [[0, 1], [4, 1]] },
        { id: 'B', color: 'blue', sym: '▲', len: 4, ends: [[1, 2], [4, 1]], targets: [[0, 2], [4, 2]] },
      ],
    },
    {
      id: 6, name: 'Dây khuất', lesson: 'Dây che thân',
      tip: 'Thân dây nằm dưới lớp che. Chọn một đầu để thấy đầu còn lại nhấp sáng.',
      broken: [[1, 1], [3, 3]],
      cables: [
        { id: 'P', color: 'purple', sym: '★', len: 3, hidden: true, ends: [[1, 3], [0, 5]], targets: [[0, 0], [2, 2]] },
        { id: 'C', color: 'cyan', sym: '✚', len: 3, hidden: true, ends: [[0, 2], [1, 4]], targets: [[4, 0], [4, 3]] },
        { id: 'Y', color: 'yellow', sym: '■', len: 2, ends: [[2, 0], [4, 0]], targets: [[1, 5], [3, 5]] },
      ],
    },
    {
      id: 7, name: 'Dây chờ mở', lesson: 'Khóa theo số lượng',
      tip: 'Dây có nắp khóa chưa di chuyển được. Hoàn thành đủ số dây ghi trên nhãn để mở.',
      broken: [[3, 1], [2, 2]],
      cables: [
        { id: 'R', color: 'red', sym: '●', len: 2, ends: [[4, 5], [2, 5]], targets: [[0, 0], [2, 0]] },
        { id: 'G', color: 'green', sym: '◆', len: 3, ends: [[0, 3], [1, 2]], targets: [[4, 0], [4, 3]] },
        { id: 'B', color: 'blue', sym: '▲', len: 3, secret: true, lock: { total: 1 }, ends: [[3, 5], [4, 4]], targets: [[0, 2], [2, 3]] },
        { id: 'Y', color: 'yellow', sym: '■', len: 2, lock: { total: 2 }, ends: [[2, 1], [4, 1]], targets: [[1, 5], [3, 5]] },
      ],
    },
    {
      id: 8, name: 'Mở khoang dưới', lesson: 'Khóa theo màu',
      tip: 'Vùng dưới chỉ mở khi có 1 dây ĐỎ hoàn thành. Dây xanh dương không tính.',
      regions: [{ id: 'Z1', rows: [4, 5], lock: { color: 'red', n: 1 } }],
      broken: [[2, 2], [3, 1]],
      cables: [
        { id: 'R', color: 'red', sym: '●', len: 2, ends: [[4, 2], [3, 3]], targets: [[0, 1], [2, 1]] },
        { id: 'B', color: 'blue', sym: '▲', len: 2, ends: [[1, 3], [0, 2]], targets: [[3, 0], [3, 2]] },
        { id: 'G', color: 'green', sym: '◆', len: 2, ends: [[2, 5], [1, 4]], targets: [[1, 3], [3, 3]] },
        { id: 'Y', color: 'yellow', sym: '■', len: 2, ends: [[1, 5], [2, 4]], targets: [[0, 5], [2, 5]] },
      ],
    },
    {
      id: 9, name: 'Cùng màu khác ký hiệu', lesson: 'Nhiều dây cùng màu',
      tip: 'Hai dây đỏ (● và ▲) có cặp cổng riêng. Khớp ký hiệu trên đầu cắm với ký hiệu trên cổng.',
      broken: [[2, 1], [1, 2]],
      cables: [
        { id: 'R1', color: 'red', sym: '●', len: 2, ends: [[2, 3], [4, 3]], targets: [[0, 0], [2, 0]] },
        { id: 'R2', color: 'red', sym: '▲', len: 2, ends: [[3, 5], [2, 4]], targets: [[0, 2], [2, 2]] },
        { id: 'B1', color: 'blue', sym: '●', len: 3, ends: [[3, 3], [2, 5]], targets: [[4, 0], [4, 3]] },
        { id: 'B2', color: 'blue', sym: '▲', len: 2, ends: [[1, 1], [0, 0]], targets: [[1, 4], [3, 4]] },
        { id: 'Y', color: 'yellow', sym: '■', len: 2, ends: [[0, 1], [1, 0]], targets: [[0, 5], [2, 5]] },
      ],
    },
    {
      id: 10, name: 'Hai con đường', lesson: 'Điều kiện HOẶC',
      tip: 'Hàng trên mở khi đạt MỘT trong hai điều kiện: 3 dây bất kỳ HOẶC 2 dây xanh lá.',
      regions: [{ id: 'Z1', rows: [0], lock: { any: [{ total: 3 }, { color: 'green', n: 2 }] } }],
      broken: [[3, 2], [1, 4]],
      cables: [
        { id: 'G1', color: 'green', sym: '●', len: 2, ends: [[3, 4], [4, 5]], targets: [[0, 2], [0, 4]] },
        { id: 'G2', color: 'green', sym: '▲', len: 2, ends: [[2, 3], [2, 1]], targets: [[4, 2], [4, 4]] },
        { id: 'O', color: 'orange', sym: '■', len: 3, ends: [[3, 1], [0, 1]], targets: [[1, 5], [3, 5]] },
        { id: 'P', color: 'pink', sym: '◆', len: 3, ends: [[4, 3], [3, 5]], targets: [[2, 2], [2, 4]] },
        { id: 'C', color: 'cyan', sym: '✚', len: 3, ends: [[4, 0], [2, 0]], targets: [[1, 1], [3, 1]] },
      ],
    },
    {
      id: 11, name: 'Tủ chật', lesson: 'Cổng hỏng',
      tip: 'Cổng hỏng (dấu gạch chéo) là chướng ngại cố định. Có thể dời tạm dây đã xong để nhường chỗ.',
      broken: [[0, 5], [2, 5], [4, 5], [4, 0]],
      cables: [
        { id: 'R', color: 'red', sym: '●', len: 2, ends: [[3, 1], [3, 3]], targets: [[1, 2], [2, 2]] },
        { id: 'B', color: 'blue', sym: '▲', len: 2, ends: [[4, 2], [2, 2]], targets: [[1, 1], [3, 1]] },
        { id: 'Y', color: 'yellow', sym: '■', len: 2, ends: [[4, 1], [2, 1]], targets: [[1, 3], [3, 3]] },
        { id: 'G', color: 'green', sym: '◆', len: 4, ends: [[3, 5], [3, 2]], targets: [[0, 0], [0, 4]] },
        { id: 'P', color: 'pink', sym: '★', len: 3, ends: [[1, 3], [1, 5]], targets: [[4, 2], [4, 4]] },
      ],
    },
    {
      id: 12, name: 'Tủ server tổng', lesson: 'Chuỗi mở khóa',
      tip: 'Mốc 1: 2 dây bất kỳ mở Đỏ ▲ và Xanh dương ▲. Mốc 2: 2 dây đỏ VÀ 1 dây xanh dương mở hai hàng cuối.',
      regions: [{ id: 'Z1', rows: [4, 5], lock: { all: [{ color: 'red', n: 2 }, { color: 'blue', n: 1 }] } }],
      broken: [[1, 0], [4, 3]],
      cables: [
        { id: 'RA', color: 'red', sym: '●', len: 3, ends: [[1, 3], [3, 2]], targets: [[0, 0], [2, 0]] },
        { id: 'BA', color: 'blue', sym: '●', len: 3, ends: [[0, 0], [0, 2]], targets: [[3, 0], [4, 1]] },
        { id: 'Y', color: 'yellow', sym: '■', len: 3, ends: [[3, 3], [3, 0]], targets: [[0, 1], [0, 3]] },
        { id: 'G', color: 'green', sym: '◆', len: 3, ends: [[2, 0], [0, 1]], targets: [[4, 2], [4, 4]] },
        { id: 'RB', color: 'red', sym: '▲', len: 3, lock: { total: 2 }, ends: [[2, 3], [4, 1]], targets: [[1, 1], [3, 1]] },
        { id: 'BB', color: 'blue', sym: '▲', len: 3, lock: { total: 2 }, ends: [[2, 2], [4, 2]], targets: [[1, 3], [3, 2]] },
        { id: 'P', color: 'purple', sym: '★', len: 3, secret: true, lock: { all: [{ color: 'red', n: 2 }, { color: 'blue', n: 1 }] }, ends: [[4, 4], [1, 4]], targets: [[0, 5], [2, 4]] },
        { id: 'C', color: 'cyan', sym: '✚', len: 3, secret: true, lock: { all: [{ color: 'red', n: 2 }, { color: 'blue', n: 1 }] }, ends: [[3, 4], [2, 5]], targets: [[1, 5], [3, 5]] },
      ],
    },
  ];
  if (typeof module === 'object' && module.exports) module.exports = LEVELS;
  else root.CABLE_LEVELS = LEVELS;
})(typeof self !== 'undefined' ? self : this);
