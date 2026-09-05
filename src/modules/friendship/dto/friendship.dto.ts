import { IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}

export class TargetUserDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  targetUserId!: string;
}

export class UpdateRelationshipTypeDto {
  @ApiProperty({ example: 'NORMAL' })
  type!: string;
}

// ── Response DTOs ─────────────────────────────────────────
export class MenuItemConfigDto {
  @ApiProperty({ example: 'unfriend' })
  id!: string;

  @ApiProperty({ example: 'Hủy kết bạn' })
  label!: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiPropertyOptional()
  isDanger?: boolean;

  @ApiPropertyOptional()
  hasSubmenu?: boolean;

  @ApiPropertyOptional({ type: () => [MenuItemConfigDto] })
  submenuItems?: MenuItemConfigDto[];
}

export class UserSuggestionDto {
  @ApiProperty({ example: 'dc225607-6ac6-40be-b51d-f2d7661f9dfd' })
  id!: string;

  @ApiProperty({ example: 'Đắc Cường' })
  name!: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', nullable: true })
  avatar!: string | null;

  @ApiProperty({ example: 5 })
  mutualFriends!: number;

  @ApiProperty({ example: null, nullable: true })
  relationshipDate!: string | null;

  @ApiProperty({ example: 'suggested' })
  status!: 'suggested' | 'accepted' | 'pending';

  @ApiProperty({ example: 'friend' })
  relationshipType!: string;

  @ApiPropertyOptional({ type: [MenuItemConfigDto] })
  menuItems?: MenuItemConfigDto[];
}

export class PaginationMeta {
  @ApiProperty({ example: 1 })
  currentPage!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;

  @ApiProperty({ example: 95 })
  totalItems!: number;

  @ApiProperty({ example: 20 })
  itemsPerPage!: number;

  @ApiProperty({ example: true })
  hasNext!: boolean;
}

export class ListResponseMeta {
  @ApiProperty()
  pagination!: PaginationMeta;

  @ApiProperty()
  timestamp?: string;

  @ApiProperty()
  path?: string;
}

export class UserListResponseDto {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty({ type: [UserSuggestionDto] })
  data!: UserSuggestionDto[];

  @ApiProperty()
  meta!: ListResponseMeta;
}

// ── Action Response DTOs ──────────────────────────────────
export class ActionResponseDto {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  timestamp?: string;
}

export class AcceptRejectResponseDto {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  timestamp?: string;
}

export class UnfriendResponseDto {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  timestamp?: string;
}
