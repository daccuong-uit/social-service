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
import { FriendshipService } from './friendship.service';
import { PaginationQueryDto, TargetUserDto, UserListResponseDto, ActionResponseDto, AcceptRejectResponseDto, UnfriendResponseDto } from './dto/friendship.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('friendship')
@Controller()
export class FriendshipController {
  constructor(private readonly friendshipService: FriendshipService) {}

  // ── Friends List ──────────────────────────────────────────
  @Get('friends')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách bạn bè' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách bạn bè của người dùng',
    type: UserListResponseDto,
  })
  getFriends(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getFriends(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get('friendship/friends')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách bạn bè theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách bạn bè của người dùng',
    type: UserListResponseDto,
  })
  getFriendsAlias(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getFriends(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  // ── Suggestions ───────────────────────────────────────────
  @Get('friends/suggestions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gợi ý kết bạn' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách gợi ý kết bạn',
    type: UserListResponseDto,
  })
  getSuggestions(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getSuggestions(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get('friendship/suggestions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gợi ý kết bạn theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách gợi ý kết bạn',
    type: UserListResponseDto,
  })
  getSuggestionsAlias(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getSuggestions(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  // ── Incoming Requests ─────────────────────────────────────
  @Get('friends/requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lời mời kết bạn nhận được' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lời mời kết bạn nhận được',
    type: UserListResponseDto,
  })
  getIncomingRequests(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getIncomingRequests(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get('friendship/requests/received')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lời mời kết bạn nhận được theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lời mời kết bạn nhận được',
    type: UserListResponseDto,
  })
  getIncomingRequestsAlias(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getIncomingRequests(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  // ── Sent Requests ─────────────────────────────────────────
  @Get('friends/requests/sent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lời mời kết bạn đã gửi' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lời mời kết bạn đã gửi',
    type: UserListResponseDto,
  })
  getSentRequests(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getSentRequests(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get('friendship/requests/sent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lời mời kết bạn đã gửi theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lời mời kết bạn đã gửi',
    type: UserListResponseDto,
  })
  getSentRequestsAlias(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getSentRequests(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  // ── Send / Cancel Request ─────────────────────────────────
  @Post('friends/requests/:userId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lời mời kết bạn' })
  @ApiResponse({
    status: 200,
    description: 'Lời mời kết bạn đã được gửi',
    type: ActionResponseDto,
  })
  sendRequest(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.sendRequest(currentUserId, userId);
  }

  @Post('friendship/requests')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lời mời kết bạn theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Lời mời kết bạn đã được gửi',
    type: ActionResponseDto,
  })
  sendRequestAlias(
    @Body() dto: TargetUserDto,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.sendRequest(currentUserId, dto.targetUserId);
  }

  @Delete('friends/requests/:userId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy lời mời kết bạn đã gửi' })
  @ApiResponse({
    status: 200,
    description: 'Lời mời kết bạn đã được hủy',
    type: ActionResponseDto,
  })
  cancelRequest(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.cancelRequest(currentUserId, userId);
  }

  @Delete('friendship/requests/:userId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy lời mời kết bạn đã gửi theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Lời mời kết bạn đã được hủy',
    type: ActionResponseDto,
  })
  cancelRequestAlias(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.cancelRequest(currentUserId, userId);
  }

  // ── Accept / Reject Request ───────────────────────────────
  @Post('friends/requests/:userId/accept')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chấp nhận lời mời kết bạn' })
  @ApiResponse({
    status: 200,
    description: 'Lời mời kết bạn đã được chấp nhận',
    type: AcceptRejectResponseDto,
  })
  acceptRequest(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.acceptRequest(currentUserId, userId);
  }

  @Post('friendship/requests/:userId/accept')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chấp nhận lời mời kết bạn theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Lời mời kết bạn đã được chấp nhận',
    type: AcceptRejectResponseDto,
  })
  acceptRequestAlias(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.acceptRequest(currentUserId, userId);
  }

  @Post('friends/requests/:userId/reject')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối lời mời kết bạn' })
  @ApiResponse({
    status: 200,
    description: 'Lời mời kết bạn đã được từ chối',
    type: AcceptRejectResponseDto,
  })
  rejectRequest(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.rejectRequest(currentUserId, userId);
  }

  @Post('friendship/requests/:userId/decline')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối lời mời kết bạn theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Lời mời kết bạn đã được từ chối',
    type: AcceptRejectResponseDto,
  })
  declineRequestAlias(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.rejectRequest(currentUserId, userId);
  }

  @Get('friendship/relationships')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách mối quan hệ theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách mối quan hệ bạn bè',
    type: UserListResponseDto,
  })
  getRelationships(
    @CurrentUser() userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getRelationships(userId, query.page ?? 1, query.pageSize ?? 20);
  }

  @Put('friendship/:userId/relationship')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật loại mối quan hệ bạn bè' })
  @ApiResponse({
    status: 200,
    description: 'Mối quan hệ đã được cập nhật',
    type: ActionResponseDto,
  })
  updateRelationshipType(
    @Param('userId', ParseUUIDPipe) friendId: string,
    @CurrentUser() currentUserId: string,
    @Body() dto: import('./dto/friendship.dto').UpdateRelationshipTypeDto,
  ) {
    return this.friendshipService.updateRelationshipType(currentUserId, friendId, dto.type);
  }

  // ── Unfriend ──────────────────────────────────────────────
  @Delete('friends/:userId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy kết bạn' })
  @ApiResponse({
    status: 200,
    description: 'Kết bạn đã được hủy',
    type: UnfriendResponseDto,
  })
  unfriend(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.unfriend(currentUserId, userId);
  }

  @Delete('friendship/friends/:userId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy kết bạn theo route FE' })
  @ApiResponse({
    status: 200,
    description: 'Kết bạn đã được hủy',
    type: UnfriendResponseDto,
  })
  unfriendAlias(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
  ) {
    return this.friendshipService.unfriend(currentUserId, userId);
  }

  // ── Mutual Friends ────────────────────────────────────────
  @Get('friends/:userId/mutual')
  @ApiOperation({ summary: 'Bạn chung' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách bạn chung',
    type: UserListResponseDto,
  })
  getMutualFriends(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUserId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.friendshipService.getMutualFriends(
      currentUserId,
      userId,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }
}
