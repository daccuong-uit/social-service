import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  MinLength,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReelVisibility {
  PUBLIC = 'public',
  FRIENDS = 'friends',
  PRIVATE = 'private',
}

export enum ReelsFilter {
  TRENDING = 'trending',
  FOR_YOU = 'for-you',
  LATEST = 'latest',
}

// ---- Create Reel ----
export class CreateReelDto {
  @ApiProperty({ example: 'Video này hài quá! 😂 #funny' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  videoMediaId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  thumbnailMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  musicId?: string;

  @ApiPropertyOptional({ enum: ReelVisibility, default: ReelVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(ReelVisibility)
  visibility?: ReelVisibility = ReelVisibility.PUBLIC;
}

// ---- Update Reel ----
export class UpdateReelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content?: string;

  @ApiPropertyOptional({ enum: ReelVisibility })
  @IsOptional()
  @IsEnum(ReelVisibility)
  visibility?: ReelVisibility;
}

// ---- Share Reel ----
export class ShareReelDto {
  @ApiPropertyOptional({ enum: ['feed', 'direct_message'] })
  @IsOptional()
  @IsString()
  targetType?: string;
}

// ---- Query DTOs ----
export class ReelsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  pageSize?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  hashtag?: string;
}

export class FeedQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  pageSize?: number = 10;
}

export class DiscoverReelsQueryDto extends FeedQueryDto {
  @ApiPropertyOptional({ enum: ReelsFilter })
  @IsOptional()
  @IsEnum(ReelsFilter)
  filter?: ReelsFilter;
}
