import {
  IsString,
  IsOptional,
  IsUrl,
  IsBoolean,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

// ---- Update Profile ----
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Mình là creator yêu thích công nghệ 🚀' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatarMediaId?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @ApiPropertyOptional({ example: 'https://mywebsite.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'Hồ Chí Minh, Việt Nam' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Hà Nội, Việt Nam' })
  @IsOptional()
  @IsString()
  hometown?: string;

  @ApiPropertyOptional({ example: '1995-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  birthday?: string;

  @ApiPropertyOptional({ example: 'Độc thân' })
  @IsOptional()
  @IsString()
  relationshipStatus?: string;

  @ApiPropertyOptional({ example: 'Nam' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

// ---- Report ----
export class ReportDto {
  @ApiProperty({ example: 'spam', enum: ['spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'other'] })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ example: 'Chi tiết thêm về nội dung vi phạm' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

// ---- Privacy Settings ----
export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivateAccount?: boolean;

  @ApiPropertyOptional({ enum: ['everyone', 'friends', 'only_me'] })
  @IsOptional()
  @IsEnum(['everyone', 'friends', 'only_me'])
  whoCanSeeMyPosts?: string;

  @ApiPropertyOptional({ enum: ['everyone', 'friends_of_friends'] })
  @IsOptional()
  @IsEnum(['everyone', 'friends_of_friends'])
  whoCanSendFriendRequest?: string;

  @ApiPropertyOptional({ enum: ['everyone', 'friends', 'only_me'] })
  @IsOptional()
  @IsEnum(['everyone', 'friends', 'only_me'])
  whoCanSeeMyFriendList?: string;

  @ApiPropertyOptional({ enum: ['everyone', 'friends', 'no_one'] })
  @IsOptional()
  @IsEnum(['everyone', 'friends', 'no_one'])
  whoCanTagMe?: string;
}

// ---- Account Settings ----
export class UpdateAccountSettingsDto {
  @ApiPropertyOptional({ example: 'vi' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;
}

// ---- Query DTOs ----
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;
}

export class SuggestionsQueryDto {
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
