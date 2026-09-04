import { Module } from '@nestjs/common';

// Core
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { EventModule } from './events/event.module';
import { MediaResolverModule } from './common/modules/media-resolver.module';

// Phase 2 — Social Core
import { UsersModule } from './users/users.module';
import { FollowModule } from './follow/follow.module';
import { FriendshipModule } from './friendship/friendship.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { GroupsModule } from './groups/groups.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReelsModule } from './reels/reels.module';
import { VideosModule } from './videos/videos.module';
import { NovelsModule } from './novels/novels.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { SearchModule } from './search/search.module';

// Legacy (profile endpoint — được thay bởi UsersModule nhưng giữ để backward compat)
import { ProfileModule } from './profile/profile.module';

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
