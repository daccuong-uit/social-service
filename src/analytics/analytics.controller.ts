import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { GetAnalyticsDto, TrackWatchTimeDto } from './dto/analytics.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy thống kê chung (Views, Impressions, Engagement...)' })
  getAnalytics(
    @CurrentUser() userId: string,
    @Query() query: GetAnalyticsDto,
  ) {
    return this.analyticsService.getAnalytics(query.targetType, query.targetId, userId);
  }

  @Post('watch-time')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi nhận thời gian xem (dành cho Reel/Video)' })
  trackWatchTime(
    @CurrentUser() userId: string,
    @Body() dto: TrackWatchTimeDto,
  ) {
    return this.analyticsService.trackWatchTime(userId, dto);
  }
}
