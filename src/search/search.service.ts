import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto, SearchType } from './dto/search.dto';

// In Phase 2, this is a basic Postgres ILIKE implementation.
// In Phase 5 (OpenSearch), this service will act as a proxy to OpenSearch cluster.

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private buildPagination(page: number, pageSize: number, totalItems: number) {
    return {
      currentPage: page,
      totalPages: Math.ceil(totalItems / pageSize),
      totalItems,
      itemsPerPage: pageSize,
      hasNext: page < Math.ceil(totalItems / pageSize),
    };
  }

  async search(query: SearchQueryDto, currentUserId?: string) {
    const { q, type = SearchType.ALL, page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const results: any = {};
    const meta: any = {};

    // For ALL search, we limit items per category to 5 to avoid massive payloads
    const isAll = type === SearchType.ALL;
    const currentTake = isAll ? 5 : take;
    const currentSkip = isAll ? 0 : skip;

    if (isAll || type === SearchType.USERS) {
      const [total, users] = await Promise.all([
        this.prisma.userProfile.count({ where: { OR: [{ displayName: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] } }),
        this.prisma.userProfile.findMany({
          where: { OR: [{ displayName: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] },
          skip: currentSkip, take: currentTake,
          select: { userId: true, username: true, displayName: true, avatarMediaId: true, followerCount: true },
        }),
      ]);
      results.users = users;
      if (!isAll) meta.pagination = this.buildPagination(page, pageSize, total);
    }

    if (isAll || type === SearchType.POSTS) {
      const [total, posts] = await Promise.all([
        this.prisma.post.count({ where: { content: { contains: q, mode: 'insensitive' }, isDeleted: false, visibility: 'PUBLIC' } }),
        this.prisma.post.findMany({
          where: { content: { contains: q, mode: 'insensitive' }, isDeleted: false, visibility: 'PUBLIC' },
          skip: currentSkip, take: currentTake, orderBy: { createdAt: 'desc' },
          select: { id: true, content: true, author: { select: { userId: true, username: true, displayName: true } } },
        }),
      ]);
      results.posts = posts;
      if (!isAll) meta.pagination = this.buildPagination(page, pageSize, total);
    }

    if (isAll || type === SearchType.REELS) {
      const [total, reels] = await Promise.all([
        this.prisma.reel.count({ where: { content: { contains: q, mode: 'insensitive' }, isDeleted: false, visibility: 'PUBLIC' } }),
        this.prisma.reel.findMany({
          where: { content: { contains: q, mode: 'insensitive' }, isDeleted: false, visibility: 'PUBLIC' },
          skip: currentSkip, take: currentTake, orderBy: { createdAt: 'desc' },
          select: { id: true, content: true, videoMediaId: true, author: { select: { userId: true, username: true } } },
        }),
      ]);
      results.reels = reels;
      if (!isAll) meta.pagination = this.buildPagination(page, pageSize, total);
    }

    if (isAll || type === SearchType.VIDEOS) {
      const [total, videos] = await Promise.all([
        this.prisma.video.count({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }], isDeleted: false, visibility: 'PUBLIC' } }),
        this.prisma.video.findMany({
          where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }], isDeleted: false, visibility: 'PUBLIC' },
          skip: currentSkip, take: currentTake, orderBy: { viewCount: 'desc' },
          select: { id: true, title: true, videoMediaId: true, author: { select: { userId: true, username: true } } },
        }),
      ]);
      results.videos = videos;
      if (!isAll) meta.pagination = this.buildPagination(page, pageSize, total);
    }

    if (isAll || type === SearchType.NOVELS) {
      const [total, novels] = await Promise.all([
        this.prisma.novel.count({ where: { title: { contains: q, mode: 'insensitive' }, visibility: 'PUBLIC' } }),
        this.prisma.novel.findMany({
          where: { title: { contains: q, mode: 'insensitive' }, visibility: 'PUBLIC' },
          skip: currentSkip, take: currentTake, orderBy: { averageRating: 'desc' },
          select: { id: true, title: true, coverMediaId: true, author: { select: { userId: true, username: true } } },
        }),
      ]);
      results.novels = novels;
      if (!isAll) meta.pagination = this.buildPagination(page, pageSize, total);
    }

    if (isAll || type === SearchType.GROUPS) {
      const [total, groups] = await Promise.all([
        this.prisma.group.count({ where: { name: { contains: q, mode: 'insensitive' }, privacy: 'PUBLIC' } }),
        this.prisma.group.findMany({
          where: { name: { contains: q, mode: 'insensitive' }, privacy: 'PUBLIC' },
          skip: currentSkip, take: currentTake, orderBy: { memberCount: 'desc' },
          select: { id: true, name: true, coverMediaId: true, memberCount: true },
        }),
      ]);
      results.groups = groups;
      if (!isAll) meta.pagination = this.buildPagination(page, pageSize, total);
    }

    if (isAll || type === SearchType.HASHTAGS) {
      const cleanQ = q.replace('#', '');
      const [total, hashtags] = await Promise.all([
        this.prisma.hashtag.count({ where: { name: { contains: cleanQ, mode: 'insensitive' } } }),
        this.prisma.hashtag.findMany({
          where: { name: { contains: cleanQ, mode: 'insensitive' } },
          skip: currentSkip, take: currentTake, orderBy: { score: 'desc' },
          select: { name: true, score: true },
        }),
      ]);
      results.hashtags = hashtags;
      if (!isAll) meta.pagination = this.buildPagination(page, pageSize, total);
    }

    return {
      statusCode: 200,
      data: results,
      meta: isAll ? { note: 'Global search returns max 5 items per category', timestamp: new Date().toISOString() } : { ...meta, timestamp: new Date().toISOString() },
    };
  }
}
