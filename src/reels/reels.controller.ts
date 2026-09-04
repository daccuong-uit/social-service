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
import { ReelsService } from './reels.service';
import {
  CreateReelDto,
  UpdateReelDto,
  ShareReelDto,
  ReelsQueryDto,
  FeedQueryDto,
  DiscoverReelsQueryDto,
} from './dto/reel.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('reels')
@Controller('reels')
export class ReelsController {
  constructor(private readonly reelsService: ReelsService) {}

  // ── Feed ──────────────────────────────────────────────────
  @Get('feed')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy Reel Feed cá nhân (người đang theo dõi)' })
  getFollowingFeed(
    @CurrentUser() userId: string,
    @Query() query: FeedQueryDto,
  ) {
    return this.reelsService.getFollowingFeed(userId, query.page ?? 1, query.pageSize ?? 10);
  }

  @Get('discover')
  @ApiOperation({ summary: 'Lấy Reel Feed khám phá (For You, Trending)' })
  getDiscoverFeed(
    @CurrentUser() currentUserId: string,
    @Query() query: DiscoverReelsQueryDto,
  ) {
    return this.reelsService.getDiscoverFeed(query, currentUserId);
  }

  // ── Reels CRUD ────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách reels (có filter)' })
  listReels(
    @CurrentUser() currentUserId: string,
    @Query() query: ReelsQueryDto,
  ) {
    return this.reelsService.listReels(query, currentUserId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo reel mới' })
  @ApiResponse({ status: 201, description: 'Reel đã được tạo' })
  createReel(
    @CurrentUser() userId: string,
    @Body() dto: CreateReelDto,
  ) {
    return this.reelsService.createReel(userId, dto);
  }

  @Get(':reelId')
  @ApiOperation({ summary: 'Lấy chi tiết một reel' })
  @ApiResponse({ status: 404, description: 'Reel không tồn tại' })
  getById(
    @Param('reelId', ParseUUIDPipe) reelId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.reelsService.getById(reelId, currentUserId);
  }

  @Put(':reelId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật reel' })
  updateReel(
    @Param('reelId', ParseUUIDPipe) reelId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateReelDto,
  ) {
    return this.reelsService.updateReel(reelId, userId, dto);
  }

  @Delete(':reelId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa reel' })
  deleteReel(
    @Param('reelId', ParseUUIDPipe) reelId: string,
    @CurrentUser() userId: string,
  ) {
    return this.reelsService.deleteReel(reelId, userId);
  }

  // ── Like / Unlike ─────────────────────────────────────────
  @Post(':reelId/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like reel' })
  likeReel(
    @Param('reelId', ParseUUIDPipe) reelId: string,
    @CurrentUser() userId: string,
  ) {
    return this.reelsService.likeReel(reelId, userId);
  }

  @Delete(':reelId/like')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike reel' })
  unlikeReel(
    @Param('reelId', ParseUUIDPipe) reelId: string,
    @CurrentUser() userId: string,
  ) {
    return this.reelsService.unlikeReel(reelId, userId);
  }

  // ── Share ─────────────────────────────────────────────────
  @Post(':reelId/share')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chia sẻ reel' })
  shareReel(
    @Param('reelId', ParseUUIDPipe) reelId: string,
    @CurrentUser() userId: string,
    @Body() dto: ShareReelDto,
  ) {
    return this.reelsService.shareReel(reelId, userId, dto);
  }

  // ── Analytics ─────────────────────────────────────────────
  @Get(':reelId/analytics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analytics của reel' })
  getReelAnalytics(
    @Param('reelId', ParseUUIDPipe) reelId: string,
    @CurrentUser() userId: string,
  ) {
    return this.reelsService.getReelAnalytics(reelId, userId);
  }
}
