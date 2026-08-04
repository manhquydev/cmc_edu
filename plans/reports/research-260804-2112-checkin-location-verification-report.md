# Research: Xác thực vị trí cho Check-in/Check-out (staff HR punch)

Date: 2026-08-04 21:12 ICT. Scope: kỹ thuật xác định "đang ở cơ sở" khi chấm công + UX setup cho admin. Đối sánh hiện trạng CMC EDU v2.

## TL;DR

Dự án **đã có** check-in IP/CIDR hoàn chỉnh (ADR 0043): punch luôn được ghi, offsite → bắt lý do → ticket giám đốc duyệt. Đây đã là pattern "trust but verify" mà ngành khuyến nghị. Web app **không đọc được WiFi BSSID** — mọi phương án "kỹ thuật WiFi" thực chất chỉ khả thi qua native app. Bước nâng cấp hợp lý nhất: (1) ghi thêm GPS làm **bằng chứng** đính kèm punch cho người duyệt xem, (2) sau đó cho geofence GPS làm **cổng thay thế** (IP-match OR trong-vùng) để cứu ca "đứng ở cơ sở nhưng dùng 4G". Setup admin = ghim điểm trên bản đồ + bán kính mặc định 200m, giống UX Jibble.

## Hiện trạng dự án (đã scout)

| Thành phần | File | Ghi chú |
|---|---|---|
| Punch + withinNetwork | `apps/api/src/checkin/router.ts` | IP match CIDR; 0 network rows = open mode; offsite không bị chặn, cần reason lần đầu/ngày |
| Ticket duyệt offsite | cùng file | `ensureDayTicket` → giám đốc track duyệt (anti-self-approve, freeze sau review) |
| Admin CRUD mạng | `apps/api/src/facility/network-router.ts` | `detectMyIp` tự gợi ý /32, /24; range mới mặc định `isActive=false` (quyết định PO) |
| UI setup | `apps/admin/src/pages/admin/network-ip.tsx` | đã có, tự phát hiện IP — setup 1 click |
| GPS/geolocation | — | **chưa có chỗ nào** dùng latitude/longitude trong apps |

End user: `sale`, `giao_vien` bấm punch trên browser (desktop cơ sở hoặc điện thoại). Setup: `super_admin`/quyền `facilityNetwork.manage` theo facility. Web-only, không có native app.

## So sánh kỹ thuật

| Kỹ thuật | Độ chính xác | Khả thi trên web | Friction user | Setup admin | Chống gian lận |
|---|---|---|---|---|---|
| **IP/CIDR (hiện tại)** | theo mạng (NAT: cả tòa 1 IP) | ✅ server-side, zero permission | Không có | 1 click `detectMyIp` | Trung bình — VPN vào mạng cty mới né được; IP động của ISP là rủi ro vận hành, không phải gian lận |
| **GPS geofence** (browser Geolocation API) | 3–15m ngoài trời; kém trong nhà; desktop thường suy từ WiFi/IP | ✅ cần HTTPS + permission prompt | Popup xin quyền, có thể bị từ chối | Ghim bản đồ + radius (50–200m khuyến nghị; Jibble mặc định 300m) | **Yếu** — DevTools Sensors tab giả tọa độ trong 10 giây; chỉ nên coi là bằng chứng, không phải cổng cứng |
| **WiFi BSSID** | 1–3m, đúng tầng/khu | ❌ **browser không đọc được BSSID** (privacy) — cần native app | — | — | Tốt (nếu native) |
| **BLE beacon** | <1m | ❌ cần hardware + native app | — | Mua/gắn beacon | Tốt nhất |
| **Cell triangulation** | 50–300m | chỉ là fallback bên trong Geolocation API | — | — | Yếu |
| **QR động tại cơ sở** (HMAC token xoay ~90s, single-use) | = vị trí màn hình hiển thị | ✅ camera web/scan | Phải mở camera quét | Cần 1 thiết bị/màn hình hiển thị QR ở mỗi cơ sở | Tốt — chụp màn hình gửi đi hết hạn nhanh; nhưng thêm gánh vận hành |

Điểm mấu chốt từ literature: các hệ thống thương mại/nghiên cứu đều **kết hợp** (QR động + geofence + device fingerprint) thay vì tin một tín hiệu; và geofence radius nên đặt rộng rồi thu hẹp sau khi test thực địa (GPS drift trong nhà gây false-offsite nhiều hơn gian lận thật).

## Brainstorm: phương án cho dự án

**A. GPS làm bằng chứng, không làm cổng (khuyến nghị bước 1)**
- Client gửi kèm `{lat, lng, accuracyM}` (nullable — từ chối quyền vẫn punch được) khi bấm punch.
- Lưu vào TimePunch; hiển thị khoảng cách tới cơ sở trên màn duyệt ticket của giám đốc.
- Không đổi hành vi gate → không thể làm hỏng luồng hiện có; giúp người duyệt quyết nhanh ticket offsite.
- Effort nhỏ: migration 3 cột + 1 field input + UI reviewer.

**B. Geofence làm cổng thay thế (bước 2)**
- `withinNetwork = ipMatch OR (khoảng cách Haversine ≤ radius && accuracy đủ tốt)`.
- Cứu ca thật: nhân viên đứng tại cơ sở nhưng dùng 4G (CGNAT → IP không khớp) — hiện đang bị bắt nhập lý do oan.
- Rủi ro spoof chấp nhận được vì: (i) ticket review vẫn tồn tại cho các ca khác, (ii) gian lận GPS chủ động là vi phạm kỷ luật có audit trail (lat/lng lưu lại làm bằng chứng).
- Schema: `FacilityGeofence { facilityId, lat, lng, radiusM, label, isActive }` — mặc định `isActive=false` giống quyết định PO cho FacilityNetwork.

**C. QR động kiosk** — chỉ khi phát hiện gian lận thực tế. Cần thiết bị hiển thị ở mỗi cơ sở → tăng gánh vận hành, ngược tiêu chí "setup đơn giản".

**D. Native app / BSSID / beacon** — loại. Stack là web; BSSID không đọc được từ browser là giới hạn cứng, không phải thiếu kỹ năng.

## UX setup cho admin (tiêu chí: không bắt admin làm việc kỹ thuật)

Gộp vào trang cài đặt chấm công hiện có (`network-ip.tsx` → "Chấm công & vị trí"):
1. Mạng cơ sở: giữ nguyên (đã 1-click nhờ `detectMyIp`).
2. Vùng vị trí (mới): nút **"Dùng vị trí hiện tại của tôi"** (admin đứng tại cơ sở bấm 1 lần) hoặc tìm địa chỉ → ghim trên bản đồ (Leaflet + OSM, không cần API key) → slider bán kính, mặc định 200m, min 100m.
3. Nút **"Kiểm tra"**: admin/staff mở trên điện thoại thấy ngay "bạn đang TRONG/NGOÀI vùng (cách Xm)" trước khi bật `isActive`.
4. Mọi vùng mới mặc định tắt — bật chủ động, nhất quán triết lý FacilityNetwork.

Pattern này khớp Jibble/Hubstaff: search address → pin → radius, không nhập tọa độ tay, không chạm code.

## Khuyến nghị

1. **Phase 1 (A):** thu GPS evidence kèm punch + hiển thị cho reviewer. Không phá gì, giá trị ngay.
2. **Phase 2 (B):** FacilityGeofence + gate OR + trang setup bản đồ. Radius mặc định 200m, tune sau 1–2 tuần dữ liệu thật.
3. Không làm QR/native/beacon lúc này (YAGNI) — chỉ mở lại nếu ticket duyệt cho thấy gian lận vị trí thật.
4. Ghi chú privacy: chỉ thu tọa độ tại thời điểm bấm punch (không tracking nền), nêu rõ trong UI — đây cũng là giới hạn tự nhiên của web so với app nên dễ truyền thông nội bộ.

## Nguồn

- [Radar — How accurate is geofencing](https://radar.com/blog/how-accurate-is-geofencing)
- [Truein — Geofencing attendance](https://truein.com/geofencing-attendance-system) · [factoHR](https://factohr.com/geofencing-attendance-system/) · [TimeChamp](https://www.timechamp.io/geo-fencing)
- [MDN — Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) · [HTML5 Geolocation accuracy/limitations](https://thedailyfrontend.com/html5-geolocation-api-understanding-the-accuracy-and-limitations/) · [Geolocation spoofing](http://nestbrowser.com/en/blog/geolocation-spoofing-principles-applications-best-practices/)
- [Pointr — Indoor location in browsers (BSSID không truy cập được)](https://www.pointr.tech/blog/dispelling-web-based-bluedot-myth) · [OpenTimeClock — BSSID WiFi attendance (native)](https://www.opentimeclock.com/docs/blog1/november-2025/how-to-set-up-bssid-wifi-attendance-control-for-complex-site-networks)
- [Jibble — Managing locations & geofences](https://www.jibble.io/help/managing-locations-geofences) · [Hubstaff — Geofence time tracking](https://hubstaff.com/geofence-time-tracking)
- [Fraud mitigation: dynamic QR + geofencing + device id (ResearchGate)](https://www.researchgate.net/publication/370480492_Fraud_Mitigation_in_Attendance_Monitoring_Systems_using_Dynamic_QR_Code_Geofencing_and_IMEI_Technologies) · [Palgeo — Dynamic QR + geofence](https://palgeo.com/dynamic-secured-qr-code-linked-geofencing-attendance-system/)

## Câu hỏi chưa chốt

1. Pain point thật hôm nay là gì: IP cơ sở đổi (ISP động)? staff dùng 4G tại cơ sở bị flag oan? hay nghi gian lận? → quyết định làm B ngay hay chỉ A.
2. Geofence chỉ áp cho HR punch (sale/giáo viên) hay cả điểm danh học viên (`teaching/attendance`)? Report này giả định chỉ HR punch.
3. Chính sách privacy nội bộ về lưu tọa độ nhân viên — cần PO xác nhận trước phase 1.
