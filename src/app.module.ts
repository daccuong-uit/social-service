import { Module } from '@nestjs/common';

// Core
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { EventModule } from './common/events/event.module';
import { MediaResolverModule } from './common/modules/media-resolver.module';

// Phase 2 — Social Core
import { UsersModule } from './modules/users/users.module';
import { FollowModule } from './modules/follow/follow.module';
import { FriendshipModule } from './modules/friendship/friendship.module';
import { PostsModule } from './modules/posts/posts.module';
import { CommentsModule } from './modules/comments/comments.module';
import { GroupsModule } from './modules/groups/groups.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReelsModule } from './modules/reels/reels.module';
import { VideosModule } from './modules/videos/videos.module';
import { NovelsModule } from './modules/novels/novels.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HashtagsModule } from './modules/hashtags/hashtags.module';
import { SearchModule } from './modules/search/search.module';

// Legacy (profile endpoint — được thay bởi UsersModule nhưng giữ để backward compat)
import { ProfileModule } from './modules/profile/profile.module';

@Module({
  imports: [
    // Core infrastructure
    PrismaModule,
    HealthModule,
    EventModule,
    MediaResolverModule, // Global — provides MediaResolverService to all modules

    // Social Phase 2 modules
    UsersModule,
    FollowModule,
    FriendshipModule,
    PostsModule,
    CommentsModule,
    GroupsModule,
    BookmarksModule,
    NotificationsModule,
    ReelsModule,
    VideosModule,
    NovelsModule,
    AnalyticsModule,
    HashtagsModule,
    SearchModule,

    // Legacy
    ProfileModule,
  ],
})
export class AppModule {}
