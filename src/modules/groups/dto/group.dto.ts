import { IsString, IsOptional, IsEnum, IsArray, IsUUID, MinLength, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum GroupPrivacy { PUBLIC = 'public', PRIVATE = 'private' }
export enum GroupMemberRole { MEMBER = 'member', MODERATOR = 'moderator', ADMIN = 'admin' }

export class CreateGroupDto {
  @ApiProperty({ example: 'Hội những người yêu code' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @ApiPropertyOptional({ enum: GroupPrivacy, default: GroupPrivacy.PUBLIC })
  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy = GroupPrivacy.PUBLIC;
}

export class UpdateGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @ApiPropertyOptional({ enum: GroupPrivacy })
  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: GroupMemberRole })
  @IsEnum(GroupMemberRole)
  role!: GroupMemberRole;
}

export class InviteMembersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  userIds!: string[];
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}

export class GroupMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: GroupMemberRole })
  @IsOptional()
  @IsEnum(GroupMemberRole)
  role?: GroupMemberRole;
}
