# Hướng Dẫn Deploy Savquiz Lên Cloudflare Pages

Tài liệu này hướng dẫn chi tiết cách đưa frontend của **Savquiz (Vite + React + TailwindCSS)** lên **Cloudflare Pages** với hiệu năng CDN toàn cầu và hoàn toàn miễn phí.

---

## 1. Cơ Chế Hoạt Động (Kiến Trúc Triển Khai)

- **Frontend (Client):** Triển khai trực tiếp lên **Cloudflare Pages** (CDN cực nhanh, tự động xử lý HTTPS, chống DDoS).
- **Backend (Server API & SQLite):** Chạy trên một server/VPS hoặc các dịch vụ đám mây hỗ trợ Node.js dài hạn (như **Render**, **Railway**, **Fly.io**, hoặc **VPS riêng**).
- **Kết nối API:** Frontend giao tiếp với Backend qua biến môi trường `VITE_API_URL`.

---

## 2. Các File Cấu Hình Sẵn Cho Cloudflare Pages

Hệ thống đã được thiết lập sẵn các file phục vụ Cloudflare Pages:
1. `client/public/_redirects`: Quy tắc rewrite SPA (`/* /index.html 200`) giúp tránh lỗi 404 khi người dùng refresh hoặc truy cập trực tiếp các đường dẫn như `/quizzes`, `/results`, `/login`.
2. `client/public/_headers`: Cấu hình cache cho static assets và các header bảo mật chuẩn.
3. `client/src/api/client.ts` & `media.ts`: Tự động nhận biến `VITE_API_URL` để gọi API và load file audio/media.

---

## 3. Cách 1: Deploy Bằng Giao Diện Cloudflare Dashboard (Khuyên Dùng)

### Bước 1: Kết nối GitHub Repo với Cloudflare Pages
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Chọn menu **Workers & Pages** -> Bấm **Create application** -> Chọn tab **Pages** -> Bấm **Connect to Git**.
3. Chọn tài khoản GitHub của bạn và chọn repository: `khangninh2005-a11y/savquiz`.

### Bước 2: Cấu hình Build Settings
Thiết lập các thông số build như sau:

| Mục | Giá trị cần điền |
| :--- | :--- |
| **Project name** | `savquiz` (hoặc tên tuỳ chọn) |
| **Production branch** | `main` |
| **Framework preset** | `Vite` (hoặc `None`) |
| **Root directory (advanced)** | Để trống (hoặc `/`) |
| **Build command** | `npm run build:client` |
| **Build output directory** | `client/dist` |

*(Lưu ý: Nếu bạn chọn Root directory là `client`, thì Build command là `npm run build` và Build output directory là `dist`)*.

### Bước 3: Thiết lập Environment Variables (Biến môi trường)
Bấm vào mục **Environment variables (advanced)** và thêm:
- `NODE_VERSION`: `20` (hoặc `22`)
- `VITE_API_URL`: Điền địa chỉ domain backend của bạn (ví dụ: `https://api.yourdomain.com`).  
  *(Nếu ban đầu chưa có backend riêng, có thể để trống hoặc điền tạm thời)*.

### Bước 4: Deploy
- Bấm **Save and Deploy**.
- Cloudflare sẽ tự động kéo code từ GitHub, cài đặt dependencies, build và cung cấp cho bạn một domain miễn phí dạng `https://savquiz-xxx.pages.dev`.

---

## 4. Cách 2: Deploy Bằng Wrangler CLI (Dòng lệnh)

Nếu bạn muốn deploy trực tiếp từ máy tính mà không cần qua GitHub:

```bash
# 1. Cài đặt wrangler nếu chưa có
npm install -g wrangler

# 2. Đăng nhập Cloudflare
wrangler login

# 3. Build mã nguồn client
npm run build:client

# 4. Deploy thư mục client/dist lên Cloudflare Pages
wrangler pages deploy client/dist --project-name=savquiz
```

---

## 5. Lưu Ý Về Backend (Fastify + SQLite)

Vì Cloudflare Pages là môi trường static CDN cho client, server Node.js Fastify và SQLite cần được host trên môi trường có ổ cứng/container:
- **Tùy chọn 1 (Miễn phí / Giá rẻ):** Render.com (Web Service), Railway.app, Fly.io.
- **Tùy chọn 2 (VPS cá nhân):** Thuê VPS Ubuntu (DigitalOcean, Linode, Hetzner, Vietnix...), chạy `pm2 start server/dist/index.js` hoặc Docker.
- Sau khi có URL backend (ví dụ: `https://api.yourdomain.com`), bạn chỉ cần vào **Cloudflare Pages -> Settings -> Environment Variables** -> Cập nhật `VITE_API_URL = https://api.yourdomain.com` và Redeploy.
