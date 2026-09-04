import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto, UpdateProfileDto } from '../users/dto/user.dto';

@ApiTags('profiles')
@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Get profile header and stats' })
  @ApiResponse({ status: 200, description: 'Returns profile data' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfile(
    @Param('userId') userId: string,
    @CurrentUser() currentUserId?: string,
  ) {
    const targetId = userId === 'me' ? currentUserId : userId;
    if (!targetId) throw new NotFoundException('Người dùng không tồn tại');
    return this.profileService.getProfile(targetId, currentUserId);
  }


  @Get(':userId/profile-tabs/:tabId')
  @ApiOperation({ summary: 'Get content for a profile tab' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  getProfileTab(
    @Param('userId') userId: string,
    @Param('tabId') tabId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUserId?: string,
  ) {
    const targetId = userId === 'me' ? currentUserId : userId;
    if (!targetId) throw new NotFoundException('Người dùng không tồn tại');
    return this.profileService.getProfileTabContent(
      targetId,
      tabId,
      Number(query.page ?? 1),
      Number(query.pageSize ?? 20),
      currentUserId,
    );
  }

  @Put(':userId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update profile' })
  updateProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() currentUserId?: string,
  ) {
    const targetId = userId === 'me' ? currentUserId : userId;
    if (!targetId) throw new NotFoundException('Người dùng không tồn tại');
    return this.profileService.updateProfile(targetId, dto);
  }


}
