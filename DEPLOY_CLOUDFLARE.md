# Hướng Dẫn Vận Hành Savquiz 100% Native Trên Cloudflare (Workers + D1 Database)

Hệ thống Savquiz hiện tại đã được chuyển đổi toàn diện sang kiến trúc **Cloudflare Serverless**:
- **Frontend (Giao diện React + TailwindCSS):** Phục vụ qua CDN Static Assets.
- **Backend (API Logic + Chấm điểm):** Chạy trên **Cloudflare Workers** bằng framework siêu nhẹ **Hono**.
- **Cơ sở dữ liệu (Database):** Lưu trữ trên **Cloudflare D1 (Serverless SQLite)**.
- **Lưu trữ file âm thanh/hình ảnh:** Tự động lưu vào D1 Database (bảng `sq_media`) hoặc Cloudflare R2 Bucket.

---

## 1. Bản Sao Lưu (Backup)
Toàn bộ mã nguồn Node.js Fastify + SQLite trước khi chuyển đổi đã được nén an toàn tại:
`d:\Code\NodeJS\savquiz_backup_fastify.zip`

---

## 2. Bước Kích Hoạt Database D1 Trên Cloudflare (Chỉ mất 1 phút)

Để backend có thể lưu trữ dữ liệu, bạn chỉ cần liên kết cơ sở dữ liệu **D1** vào Worker theo 1 trong 2 cách sau:

### Cách 1: Trên giao diện Web (Cloudflare Dashboard)
1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Ở thanh menu bên trái, vào **Storage & Databases** -> chọn **D1 SQL Database** -> Bấm **Create database**.
   - Tên database: `savquiz_db`
   - Bấm **Create**.
3. Quay lại menu **Workers & Pages** -> Bấm vào tên Worker `savquiz` của bạn:
   - Vào tab **Settings** -> mục **Bindings** (hoặc **Variables and Secrets**).
   - Bấm **Add** -> chọn **D1 database binding**:
     - Variable name: `DB` *(viết hoa 2 chữ cái)*
     - D1 database: chọn `savquiz_db` vừa tạo.
   - Bấm **Save and Deploy**.

> **Tự động khởi tạo:** Ngay khi Worker nhận request đầu tiên, hệ thống sẽ tự động chạy lệnh tạo toàn bộ bảng và nạp dữ liệu mẫu ban đầu (Tài khoản Admin: `admin` / `admin`).

---

### Cách 2: Bằng dòng lệnh (Wrangler CLI)
Nếu bạn có cài đặt terminal:
```bash
# 1. Tạo database D1 trên Cloudflare
npx wrangler d1 create savquiz_db

# 2. Khởi tạo bảng và dữ liệu mẫu
npx wrangler d1 execute savquiz_db --remote --file=d1/schema.sql

# 3. Deploy lại
npx wrangler deploy
```

---

## 3. Tài Khoản Đăng Nhập Mặc Định

| Tên đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- |
| `admin` | `admin` | Quản trị viên (Toàn quyền hệ thống) |
| `student` | `123456` | Thí sinh / Học sinh |
