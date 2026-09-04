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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VideosService } from './videos.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  CreatePlaylistDto,
  UpdatePlaylistDto,
  AddToPlaylistDto,
  UpdateHistoryDto,
  VideosQueryDto,
  PaginationQueryDto,
} from './dto/video.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  // ── 1. Videos CRUD ────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách videos (có filter)' })
  listVideos(@CurrentUser() userId: string, @Query() query: VideosQueryDto) {
    return this.videosService.listVideos(query, userId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tải lên / Tạo video mới' })
  createVideo(@CurrentUser() userId: string, @Body() dto: CreateVideoDto) {
    return this.videosService.createVideo(userId, dto);
  }

  @Get(':videoId')
  @ApiOperation({ summary: 'Xem chi tiết video' })
  getVideoById(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @CurrentUser() userId: string,
  ) {
    return this.videosService.getVideoById(videoId, userId);
  }

  @Put(':videoId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin video' })
  updateVideo(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.videosService.updateVideo(videoId, userId, dto);
  }

  @Delete(':videoId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa video' })
  deleteVideo(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @CurrentUser() userId: string,
  ) {
    return this.videosService.deleteVideo(videoId, userId);
  }

  // ── 2. Playlists ──────────────────────────────────────────

  @Get('me/playlists')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách playlist của tôi' })
  getPlaylists(@CurrentUser() userId: string, @Query() query: PaginationQueryDto) {
    return this.videosService.getPlaylists(userId, query);
  }

  @Post('playlists')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo playlist mới' })
  createPlaylist(@CurrentUser() userId: string, @Body() dto: CreatePlaylistDto) {
    return this.videosService.createPlaylist(userId, dto);
  }

  @Get('playlists/:playlistId')
  @ApiOperation({ summary: 'Xem chi tiết playlist' })
  getPlaylistById(
    @Param('playlistId', ParseUUIDPipe) playlistId: string,
    @CurrentUser() userId: string,
  ) {
    return this.videosService.getPlaylistById(playlistId, userId);
  }

  @Put('playlists/:playlistId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật playlist' })
  updatePlaylist(
    @Param('playlistId', ParseUUIDPipe) playlistId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.videosService.updatePlaylist(playlistId, userId, dto);
  }

  @Delete('playlists/:playlistId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa playlist' })
  deletePlaylist(
    @Param('playlistId', ParseUUIDPipe) playlistId: string,
    @CurrentUser() userId: string,
  ) {
    return this.videosService.deletePlaylist(playlistId, userId);
  }

  @Post('playlists/:playlistId/items')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thêm video vào playlist' })
  addVideosToPlaylist(
    @Param('playlistId', ParseUUIDPipe) playlistId: string,
    @CurrentUser() userId: string,
    @Body() dto: AddToPlaylistDto,
  ) {
    return this.videosService.addVideosToPlaylist(playlistId, userId, dto);
  }

  @Delete('playlists/:playlistId/items/:videoId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa video khỏi playlist' })
  removeVideoFromPlaylist(
    @Param('playlistId', ParseUUIDPipe) playlistId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @CurrentUser() userId: string,
  ) {
    return this.videosService.removeVideoFromPlaylist(playlistId, videoId, userId);
  }

  // ── 3. Watch History ──────────────────────────────────────

  @Get('me/history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sử xem video' })
  getHistory(@CurrentUser() userId: string, @Query() query: PaginationQueryDto) {
    return this.videosService.getHistory(userId, query);
  }

  @Put(':videoId/history')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật tiến trình xem video (Continue Watching)' })
  updateHistory(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateHistoryDto,
  ) {
    return this.videosService.updateHistory(userId, videoId, dto);
  }

  @Delete('me/history')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa toàn bộ lịch sử xem' })
  clearHistory(@CurrentUser() userId: string) {
    return this.videosService.clearHistory(userId);
  }

  // ── 4. Analytics ──────────────────────────────────────────

  @Get(':videoId/analytics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analytics của video' })
  getVideoAnalytics(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @CurrentUser() userId: string,
  ) {
    return this.videosService.getVideoAnalytics(videoId, userId);
  }
}
