import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import {
  CreatePostDto,
  UpdatePostDto,
  SharePostDto,
  ReportDto,
  PostsQueryDto,
  FeedQueryDto,
  DiscoverQueryDto,
} from './dto/post.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('posts')
@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // ── Feed ──────────────────────────────────────────────────
  @Get('feed')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy Feed cá nhân (người đang theo dõi)' })
  getPersonalFeed(
    @CurrentUser() userId: string,
    @Query() query: FeedQueryDto,
  ) {
    return this.postsService.getPersonalFeed(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get('discover')
  @ApiOperation({ summary: 'Lấy Feed khám phá (trending, recommended)' })
  getDiscoverFeed(
    @CurrentUser() currentUserId: string,
    @Query() query: DiscoverQueryDto,
  ) {
    return this.postsService.getDiscoverFeed(query, currentUserId);
  }

  // ── Posts CRUD ────────────────────────────────────────────
  @Get('posts')
  @ApiOperation({ summary: 'Lấy danh sách posts (có filter)' })
  listPosts(
    @CurrentUser() currentUserId: string,
    @Query() query: PostsQueryDto,
  ) {
    return this.postsService.listPosts(query, currentUserId);
  }

  @Post('posts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo bài đăng mới' })
  @ApiResponse({ status: 201, description: 'Bài đăng đã được tạo' })
  createPost(
    @CurrentUser() userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(userId, dto);
  }

  @Get('posts/:postId')
  @ApiOperation({ summary: 'Lấy chi tiết một bài đăng' })
  @ApiResponse({ status: 404, description: 'Bài đăng không tồn tại' })
  getById(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.postsService.getById(postId, currentUserId);
  }

  @Put('posts/:postId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật bài đăng' })
  updatePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(postId, userId, dto);
  }

  @Delete('posts/:postId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa bài đăng' })
  deletePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
  ) {
    return this.postsService.deletePost(postId, userId);
  }

  // ── Like / Unlike ─────────────────────────────────────────
  @Post('posts/:postId/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like bài đăng' })
  likePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
  ) {
    return this.postsService.likePost(postId, userId);
  }

  @Delete('posts/:postId/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike bài đăng' })
  unlikePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
  ) {
    return this.postsService.unlikePost(postId, userId);
  }

  // ── Hide ──────────────────────────────────────────────────
  @Post('posts/:postId/hide')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ẩn bài đăng khỏi feed' })
  hidePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
  ) {
    return this.postsService.hidePost(postId, userId);
  }

  // ── Report ────────────────────────────────────────────────
  @Post('posts/:postId/report')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Báo cáo bài đăng' })
  reportPost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
    @Body() dto: ReportDto,
  ) {
    return this.postsService.reportPost(postId, userId, dto.reason, dto.description);
  }

  // ── Share ─────────────────────────────────────────────────
  @Post('posts/:postId/share')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chia sẻ bài đăng' })
  sharePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
    @Body() dto: SharePostDto,
  ) {
    return this.postsService.sharePost(postId, userId, dto);
  }

  // ── Analytics ─────────────────────────────────────────────
  @Get('posts/:postId/analytics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analytics của bài đăng' })
  getPostAnalytics(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() userId: string,
  ) {
    return this.postsService.getPostAnalytics(postId, userId);
  }
}
