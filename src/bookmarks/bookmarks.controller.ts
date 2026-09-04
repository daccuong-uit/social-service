import { Controller, Get, Post, Delete, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookmarksService } from './bookmarks.service';
import { AddBookmarkDto, RemoveBookmarkDto, BookmarksQueryDto } from './dto/bookmark.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bookmarks của tôi' })
  getBookmarks(@CurrentUser() userId: string, @Query() query: BookmarksQueryDto) {
    return this.bookmarksService.getBookmarks(userId, query);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lưu bookmark' })
  addBookmark(@CurrentUser() userId: string, @Body() dto: AddBookmarkDto) {
    return this.bookmarksService.addBookmark(userId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bỏ bookmark' })
  removeBookmark(@CurrentUser() userId: string, @Body() dto: RemoveBookmarkDto) {
    return this.bookmarksService.removeBookmark(userId, dto);
  }
}
