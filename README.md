# Game Prototypes

Các bản chơi thử được đăng tại [longtd.dev/prototype/](https://longtd.dev/prototype/).

## Đăng hoặc cập nhật game

1. Export game thành bản HTML5 hoặc WebGL và giải nén nếu cần.
2. Đưa toàn bộ bản build vào `games/ten-game/`, với `index.html` nằm ngay trong thư mục đó. Tên thư mục có thể dùng chữ cái ASCII, số, dấu gạch ngang hoặc dấu gạch dưới. URL giữ nguyên chữ hoa và chữ thường của tên thư mục. Giữ nguyên các thư mục asset và dùng đường dẫn tương đối như `./Build/game.loader.js`.
3. Commit và push lên `main`. GitHub Actions ở repo portfolio kiểm tra bản cập nhật mỗi 15 phút theo lịch GitHub. Để xuất bản ngay, mở [Publish portfolio and prototypes](https://github.com/LongNoobb/Tran-Duc-Long-Portfolio/actions/workflows/publish-pages.yml), chọn **Run workflow** trên nhánh `main` và đợi run thành công.
4. Gửi link `https://longtd.dev/prototype/ten-game`. Game cũng tự xuất hiện trên trang danh sách. Để cập nhật game mà giữ link cũ, dùng lại tên thư mục.

```text
games/
└── ten-game/
    ├── index.html
    ├── Build/
    └── TemplateData/
```

Với Unity WebGL, dùng **Compression Format → Disabled** hoặc bật **Decompression Fallback** khi export build nén. GitHub Pages phục vụ tệp tĩnh và không có cấu hình header riêng cho từng build. Repo và các bản build đã đăng đều công khai.

## Nội dung trang chủ

Trang chủ tự tạo thẻ và đếm số game từ các thư mục trong `games/`. Để tùy chỉnh tên, thể loại, mô tả và hình minh họa, thêm mục có key trùng tên thư mục game vào `site/games.json`. Trường `art` là tên tệp SVG trong `site/assets/`. Game chưa có mục riêng vẫn tự xuất hiện với tên từ thư mục, mô tả và hình minh họa mặc định. Giao diện nằm trong `site/index.html` và `site/catalog.css`.

Nút **Dark mode** trên thanh điều hướng chuyển giao diện sáng/tối. Trang mặc định theo chế độ của hệ thống; lựa chọn thủ công được lưu riêng cho homepage bằng khóa `prototype-theme` trong localStorage. Logic khởi tạo nằm trong `site/theme.js`, chạy trước CSS để tránh chớp nền sáng khi mở lại trang ở chế độ tối. Theme của từng game không bị ảnh hưởng.

Trường `demo` tùy chọn là tên video `.mp4` hoặc `.webm` trong `site/assets/demos/`. Ba clip hiện tại được quay trực tiếp từ gameplay prototype, không có âm thanh. Rê chuột hoặc dùng Tab tới thẻ để xem; rời thẻ hoặc nhấn Escape để dừng và trở về ảnh. Video chỉ tải khi bắt đầu xem, dừng khi ra khỏi màn hình hoặc chuyển tab, và không tự chạy khi bật giảm chuyển động. Trên thiết bị cảm ứng, chạm thẻ vẫn mở game trực tiếp.

## Xem thử trên máy

```sh
node scripts/build.mjs .preview/prototype
npx --yes http-server .preview -p 4173
```

Mở `http://localhost:4173/prototype/`. Dùng thư mục đầu ra trống cho mỗi lần build.
