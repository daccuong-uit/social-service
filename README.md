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

## Chạy bằng Docker

Từ Agent repository:

```powershell
docker compose up -d social-postgres social-service
docker compose logs -f social-service
```

Health check: `http://localhost:3004/api/v1/health`.

`social-service` chỉ sở hữu `social_db`; nó không đọc database của IAM hoặc Media. `.env.example` mô tả contract, còn Compose injects URL nội bộ Docker.

## Push và cập nhật

Push vào Git repository của Social sẽ chạy CI và publish image riêng. Container hiện tại không tự restart sau Git push. Build image mới và recreate service bằng `docker compose build social-service; docker compose up -d social-service`, hoặc cập nhật Deployment trong Kubernetes.

## Roadmap

- [x] Phase 2: Core Social Logic & Content.
- [ ] Phase 3: Realtime & WebSocket (bắn noti, live chat).
- [ ] Phase 4: Kafka Message Broker (offload db writes).
- [ ] Phase 5: OpenSearch Integration (tìm kiếm nâng cao).
