import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsDateString,
  IsUUID,
  MinLength,
  MaxLength,
  ArrayMaxSize,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum PostType {
  TEXT = 'text',
  IMAGE = 'image',
  GALLERY = 'gallery',
  POLL = 'poll',
  GIF = 'gif',
  LINK = 'link',
  REPOST = 'repost',
  QUOTE_REPOST = 'quote_repost',
}

export enum PostVisibility {
  PUBLIC = 'public',
  FRIENDS = 'friends',
  PRIVATE = 'private',
}

export enum DiscoverFilter {
  TRENDING = 'trending',
  LATEST = 'latest',
  FOR_YOU = 'for-you',
}

// ---- Create Poll Option ----
export class PollOptionDto {
  @ApiProperty()
  @IsString()
  text!: string;
}

// ---- Create Poll ----
export class CreatePollDto {
  @ApiProperty()
  @IsString()
  question!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(6)
  options!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

// ---- Create Post ----
export class CreatePostDto {
  @ApiProperty({ example: 'Hôm nay mình có một điều thú vị muốn chia sẻ!' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ enum: PostType, default: PostType.TEXT })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType = PostType.TEXT;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ enum: PostVisibility, default: PostVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility = PostVisibility.PUBLIC;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  originalPostId?: string;
}

// ---- Update Post ----
export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({ enum: PostVisibility })
  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;
}

// ---- Share Post ----
export class SharePostDto {
  @ApiPropertyOptional({ enum: ['feed', 'group', 'story'] })
  @IsOptional()
  @IsEnum(['feed', 'group', 'story'])
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;
}

// ---- Report ----
export class ReportDto {
  @ApiProperty({ enum: ['spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'other'] })
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

// ---- Query DTOs ----
export class PostsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  hashtag?: string;

  @ApiPropertyOptional({ enum: ['text', 'image', 'gallery', 'poll', 'gif', 'link'] })
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  groupId?: string;
}

export class FeedQueryDto {
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

export class DiscoverQueryDto extends FeedQueryDto {
  @ApiPropertyOptional({ enum: DiscoverFilter })
  @IsOptional()
  @IsEnum(DiscoverFilter)
  filter?: DiscoverFilter;
}
