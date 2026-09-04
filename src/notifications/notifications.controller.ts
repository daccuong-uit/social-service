import { Controller, Get, Post, Delete, Param, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationsQueryDto } from './dto/notification.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo' })
  list(@CurrentUser() userId: string, @Query() query: NotificationsQueryDto) {
    return this.notificationsService.list(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số thông báo chưa đọc' })
  getUnreadCount(@CurrentUser() userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tất cả là đã đọc' })
  markAllAsRead(@CurrentUser() userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu một thông báo là đã đọc' })
  markAsRead(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() userId: string,
  ) {
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Delete(':notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa thông báo' })
  deleteOne(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @CurrentUser() userId: string,
  ) {
    return this.notificationsService.deleteOne(userId, notificationId);
  }
}
