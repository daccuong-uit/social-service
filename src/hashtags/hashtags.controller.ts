import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HashtagsService } from './hashtags.service';
import { HashtagsQueryDto, HashtagContentQueryDto } from './dto/hashtag.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('hashtags')
@Controller('hashtags')
export class HashtagsController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get('trending')
  @ApiOperation({ summary: 'Lấy danh sách hashtag thịnh hành' })
  getTrending(@Query() query: HashtagsQueryDto) {
    return this.hashtagsService.getTrending(query);
  }

  @Get(':name')
  @ApiOperation({ summary: 'Xem chi tiết thông số 1 hashtag' })
  getHashtagDetail(@Param('name') name: string) {
    return this.hashtagsService.getHashtagDetail(name);
  }

  @Get(':name/content')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy các bài đăng/reels/videos thuộc hashtag' })
  getContent(
    @Param('name') name: string,
    @Query() query: HashtagContentQueryDto,
    @CurrentUser() userId: string,
  ) {
    return this.hashtagsService.getContent(name, query, userId);
  }
}
