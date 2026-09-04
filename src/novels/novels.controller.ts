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
import { NovelsService } from './novels.service';
import {
  CreateNovelDto,
  UpdateNovelDto,
  CreateChapterDto,
  UpdateChapterDto,
  RateNovelDto,
  UpdateReadingProgressDto,
  NovelsQueryDto,
  PaginationQueryDto,
} from './dto/novel.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('novels')
@Controller('novels')
export class NovelsController {
  constructor(private readonly novelsService: NovelsService) {}

  // ── 1. Novels CRUD ────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tiểu thuyết (có filter)' })
  listNovels(@CurrentUser() userId: string, @Query() query: NovelsQueryDto) {
    return this.novelsService.listNovels(query, userId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo tiểu thuyết mới' })
  createNovel(@CurrentUser() userId: string, @Body() dto: CreateNovelDto) {
    return this.novelsService.createNovel(userId, dto);
  }

  @Get(':novelId')
  @ApiOperation({ summary: 'Xem chi tiết tiểu thuyết' })
  getNovelById(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @CurrentUser() userId: string,
  ) {
    return this.novelsService.getNovelById(novelId, userId);
  }

  @Put(':novelId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật tiểu thuyết' })
  updateNovel(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateNovelDto,
  ) {
    return this.novelsService.updateNovel(novelId, userId, dto);
  }

  @Delete(':novelId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa tiểu thuyết' })
  deleteNovel(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @CurrentUser() userId: string,
  ) {
    return this.novelsService.deleteNovel(novelId, userId);
  }

  // ── 2. Chapters ───────────────────────────────────────────

  @Get(':novelId/chapters')
  @ApiOperation({ summary: 'Lấy danh sách chương của tiểu thuyết' })
  listChapters(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.novelsService.listChapters(novelId, query, userId);
  }

  @Post(':novelId/chapters')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm chương mới' })
  createChapter(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.novelsService.createChapter(novelId, userId, dto);
  }

  @Get(':novelId/chapters/:chapterId')
  @ApiOperation({ summary: 'Đọc nội dung chương' })
  getChapterById(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @CurrentUser() userId: string,
  ) {
    return this.novelsService.getChapterById(novelId, chapterId, userId);
  }

  @Put(':novelId/chapters/:chapterId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật chương' })
  updateChapter(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.novelsService.updateChapter(novelId, chapterId, userId, dto);
  }

  @Delete(':novelId/chapters/:chapterId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa chương' })
  deleteChapter(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @CurrentUser() userId: string,
  ) {
    return this.novelsService.deleteChapter(novelId, chapterId, userId);
  }

  // ── 3. Interactions (Follow, Rate) ────────────────────────

  @Post(':novelId/follow')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Theo dõi tiểu thuyết' })
  followNovel(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @CurrentUser() userId: string,
  ) {
    return this.novelsService.followNovel(novelId, userId);
  }

  @Delete(':novelId/follow')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bỏ theo dõi tiểu thuyết' })
  unfollowNovel(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @CurrentUser() userId: string,
  ) {
    return this.novelsService.unfollowNovel(novelId, userId);
  }

  @Post(':novelId/rate')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh giá tiểu thuyết (1-5 sao)' })
  rateNovel(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @CurrentUser() userId: string,
    @Body() dto: RateNovelDto,
  ) {
    return this.novelsService.rateNovel(novelId, userId, dto);
  }

  // ── 4. Reading Progress / Library ─────────────────────────

  @Get('me/library')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tủ sách của tôi (Tiến trình đọc)' })
  getMyLibrary(@CurrentUser() userId: string, @Query() query: PaginationQueryDto) {
    return this.novelsService.getMyLibrary(userId, query);
  }

  @Put(':novelId/chapters/:chapterId/progress')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lưu tiến trình đọc (Continue Reading)' })
  updateProgress(
    @Param('novelId', ParseUUIDPipe) novelId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateReadingProgressDto,
  ) {
    return this.novelsService.updateProgress(novelId, chapterId, userId, dto);
  }
}
