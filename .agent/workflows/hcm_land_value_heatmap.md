---
description: Quy trình tạo bản đồ Heatmap giá trị đất TP.HCM từ file Excel
---

# Quy trình Triển khai Heatmap Giá Đất TP.HCM

Quy trình này mô tả các bước kỹ thuật để chuyển đổi dữ liệu bảng giá đất từ file Excel thành bản đồ nhiệt (heatmap) trực quan trên ứng dụng bản đồ.

## 1. Chuẩn bị Dữ liệu & Công cụ

- **Cài đặt thư viện**: Cài đặt thư viện `xlsx` để đọc file Excel trong môi trường React/Node.

  ```bash
  npm install xlsx
  ```

- **Xác định cấu trúc File Excel**:
  - Input: Các file trong `.agent/workflows/bang gia dat/`
  - Các cột quan trọng cần xử lý:
    - *Tên đường*: Để khớp với bản đồ.
    - *Đoạn (Từ... Đến)*: Cực kỳ quan trọng để xác định chính xác vị trí (nếu có, nhưng khó khớp tự động chính xác 100%, có thể chấp nhận khớp theo tên đường trước).
    - *Giá đất*: Thường có nhiều cột (VT1, VT2...), sẽ lấy giá VT1 (Mặt tiền) hoặc giá cao nhất làm chuẩn hiển thị.

## 2. Kỹ thuật "Geocoding" & Khớp Nối (Map Matching)

Đây là bước phức tạp nhất vì file Excel không lưu tọa độ (Lat/Lon).

- **Phương pháp**: Sử dụng dữ liệu mở OpenStreetMap (OSM) thông qua Overpass API.
- **Chiến lược khớp dữ liệu**:
  1. **Tải dữ liệu đường bộ HCM**: Tải toàn bộ mạng lưới đường bộ của TP.HCM từ OSM (hoặc tải theo từng Quận để tối ưu) có bao gồm thẻ `name` và `district`.
  2. **Chuẩn hóa chuỗi**:
     - Excel: "Đường Nguyễn Huệ" -> `nguyen hue`
     - OSM: "Đường Nguyễn Huệ" -> `nguyen hue`
  3. **Thuật toán khớp**:
     - Duyệt từng dòng trong Excel.
     - Tìm trong dữ liệu OSM các đoạn đường (`Way`) có tên trùng khớp Và nằm trong Quận tương ứng.
     - Gán giá trị giá đất vào thuộc tính của đoạn đường OSM đó.

## 3. Xử lý Phân tầng Màu (Color Grading)

Dựa trên ảnh mẫu, phân chia dải màu theo giá trị (đơn vị: triệu đồng/m2):

- **300 - 700 triệu**: 🟨 Vàng (hoặc màu Nóng đặc biệt)
- **100 - 300 triệu**: 🟩 Xanh lá sáng
- **30 - 100 triệu**: 🟦 Xanh ngọc (Teal)
- **10 - 30 triệu**: 🔵 Xanh dương đậm
- **2 - 10 triệu**: 🟣 Tím

## 4. Triển khai Ứng dụng (Coding)

1. **Tạo Component `LandHeatmapLayer`**:
   - Nút "Load Pricing Data": Để parse file Excel.
   - Logic `DataMatcher`: Chạy ngầm để map dữ liệu Excel vào Geodata.
   - Render `Polyline` trên bản đồ Leaflet với màu sắc tương ứng `price_range`.
2. **Tối ưu hiệu năng**:
   - Dữ liệu đường bộ HCM rất lớn => Cần lưu cache GeoJSON đã khớp nối để không phải tính toán lại mỗi lần tải trang.
   - Chỉ render các con đường trong khung nhìn (`bounds`).

## 5. UI/UX

- Thêm **Legend (Chú giải)** ở góc map như ảnh mẫu.
- Popup khi click vào đường: Hiển thị Tên đường, Đoạn, và Giá đất chi tiết.

---
// turbo

## Bước tiếp theo

Bạn có muốn tôi bắt đầu **Bước 1 (Cài đặt & Đọc thử file Excel)** để kiểm tra cấu trúc dữ liệu thực tế không?
