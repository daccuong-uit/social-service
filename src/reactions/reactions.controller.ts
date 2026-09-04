import { Controller, Post, Delete, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReactionsService } from './reactions.service';
import { UpsertReactionDto, RemoveReactionDto } from './dto/reaction.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('reactions')
@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thêm hoặc thay đổi reaction' })
  upsert(@CurrentUser() userId: string, @Body() dto: UpsertReactionDto) {
    return this.reactionsService.upsert(userId, dto);
  }

  @Delete()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa reaction' })
  remove(@CurrentUser() userId: string, @Body() dto: RemoveReactionDto) {
    return this.reactionsService.remove(userId, dto);
  }

  @Get(':targetType/:targetId')
  @ApiOperation({ summary: 'Lấy tóm tắt reaction của một target' })
  getSummary(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.reactionsService.getSummary(targetType, targetId, currentUserId);
  }
}
