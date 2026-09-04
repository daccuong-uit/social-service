import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import {
  CreateGroupDto, UpdateGroupDto, UpdateMemberRoleDto,
  InviteMembersDto, PaginationQueryDto, GroupMembersQueryDto,
} from './dto/group.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhóm (khám phá)' })
  list(@CurrentUser() userId: string, @Query() query: PaginationQueryDto) {
    return this.groupsService.list(query.page ?? 1, query.pageSize ?? 20, userId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo nhóm mới' })
  create(@CurrentUser() userId: string, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(userId, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách nhóm của tôi' })
  getMyGroups(@CurrentUser() userId: string, @Query() query: PaginationQueryDto) {
    return this.groupsService.getMyGroups(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get(':groupId')
  @ApiOperation({ summary: 'Chi tiết nhóm' })
  getById(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() userId: string,
  ) {
    return this.groupsService.getById(groupId, userId);
  }

  @Put(':groupId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật nhóm' })
  update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(groupId, userId, dto);
  }

  @Delete(':groupId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa nhóm' })
  delete(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() userId: string,
  ) {
    return this.groupsService.delete(groupId, userId);
  }

  @Post(':groupId/join')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tham gia nhóm (hoặc gửi yêu cầu nếu nhóm private)' })
  join(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() userId: string) {
    return this.groupsService.join(groupId, userId);
  }

  @Delete(':groupId/join')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rời khỏi nhóm' })
  leave(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() userId: string) {
    return this.groupsService.leave(groupId, userId);
  }

  @Get(':groupId/members')
  @ApiOperation({ summary: 'Danh sách thành viên nhóm' })
  getMembers(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: GroupMembersQueryDto,
  ) {
    return this.groupsService.getMembers(groupId, query.page ?? 1, query.pageSize ?? 20, query.role);
  }

  @Delete(':groupId/members/:userId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa thành viên khỏi nhóm' })
  removeMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() requesterId: string,
  ) {
    return this.groupsService.removeMember(groupId, userId, requesterId);
  }

  @Put(':groupId/members/:userId/role')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật vai trò thành viên' })
  updateMemberRole(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() requesterId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.groupsService.updateMemberRole(groupId, userId, requesterId, dto);
  }

  @Post(':groupId/invite')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mời thành viên vào nhóm' })
  invite(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() userId: string,
    @Body() dto: InviteMembersDto,
  ) {
    return this.groupsService.invite(groupId, userId, dto);
  }

  @Get(':groupId/join-requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách yêu cầu tham gia nhóm' })
  getJoinRequests(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.groupsService.getJoinRequests(groupId, userId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post(':groupId/join-requests/:userId/approve')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chấp nhận yêu cầu tham gia nhóm' })
  approveJoinRequest(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() requesterId: string,
  ) {
    return this.groupsService.approveJoinRequest(groupId, userId, requesterId);
  }

  @Post(':groupId/join-requests/:userId/reject')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối yêu cầu tham gia nhóm' })
  rejectJoinRequest(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() requesterId: string,
  ) {
    return this.groupsService.rejectJoinRequest(groupId, userId, requesterId);
  }

  @Get(':groupId/feed')
  @ApiOperation({ summary: 'Feed bài đăng trong nhóm' })
  getFeed(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.groupsService.getFeed(groupId, query.page ?? 1, query.pageSize ?? 20, userId);
  }
}
