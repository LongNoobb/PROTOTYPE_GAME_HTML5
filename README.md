# Game Prototypes

Các bản chơi thử được đăng tại [longtd.dev/prototype/](https://longtd.dev/prototype/).

## Đăng hoặc cập nhật game

1. Export game thành bản HTML5 hoặc WebGL và giải nén nếu cần.
2. Đưa toàn bộ bản build vào `games/ten-game/`, với `index.html` nằm ngay trong thư mục đó. Dùng chữ thường, số và dấu gạch ngang cho tên thư mục. Giữ nguyên các thư mục asset và dùng đường dẫn tương đối như `./Build/game.loader.js`.
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

## Xem thử trên máy

```sh
node scripts/build.mjs .preview/prototype
npx --yes http-server .preview -p 4173
```

Mở `http://localhost:4173/prototype/`. Dùng thư mục đầu ra trống cho mỗi lần build.
