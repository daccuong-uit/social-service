# Social Service

Social Service là core backend module chịu trách nhiệm xử lý toàn bộ vòng đời tương tác, hiển thị nội dung và quản lý profile của hệ thống Social Network (Phase 2).

## Tính Năng Hiện Tại (Phase 2 Stabilization)

Service này đã hoàn thiện toàn bộ các nhóm tính năng (Domains) dưới đây:
1. **Core Social Graph:** User Profiles, Follows, Friendships.
2. **Text Content:** Posts, Comments, Polls.
3. **Short-form Video:** Reels (TikTok/Instagram style).
4. **Long-form Video:** Videos (Youtube style), Playlists, Watch History.
5. **Serialized Content:** Novels (Wattpad style), Chapters, Reading Progress.
6. **Interactions:** Reactions (Like/Love/Haha...), Bookmarks (Saves).
7. **Discoverability:** Global Search, Trending Hashtags.
8. **Ecosystem:** Groups (Communities), Notifications, Unified Analytics.

## Kiến Trúc Nổi Bật

- **Framework:** NestJS + Fastify (Max performance).
- **ORM:** Prisma Client kết nối PostgreSQL.
- **Authentication:** Giao phó cho API Gateway. Đọc thông tin qua header `X-User-ID`.
- **Performance:** Đã áp dụng quy tắc Denormalization (cộng gộp count) và tạo Composite Indexes cho toàn bộ Feeds.
- **Tài liệu tham khảo:**
  - Để biết cách Frontend gọi API, xem file [FE_INTEGRATION.md](./FE_INTEGRATION.md).
  - Để hiểu lý do chọn kiến trúc và các technical debts, xem file [ARCHITECTURE.md](./ARCHITECTURE.md).

## Chạy Ứng Dụng (Local)

1. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

2. **Cấu hình biến môi trường (`.env` ở root package):**
   ```env
   SOCIAL_DATABASE_URL="postgresql://user:pass@localhost:5432/social_db?schema=public"
   ```

3. **Database Migration / Generate Client:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Khởi chạy Development Server:**
   ```bash
   npm run dev
   ```

Service sẽ chạy tại: `http://localhost:3002` (cấu hình port theo env/gateway).

## Roadmap

- [x] Phase 2: Core Social Logic & Content.
- [ ] Phase 3: Realtime & WebSocket (bắn noti, live chat).
- [ ] Phase 4: Kafka Message Broker (offload db writes).
- [ ] Phase 5: OpenSearch Integration (tìm kiếm nâng cao).
