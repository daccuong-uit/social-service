import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VideoVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
  PRIVATE = 'private',
}

// ---- Create/Update Video ----
export class CreateVideoDto {
  @ApiProperty({ example: 'Hướng dẫn NestJS cơ bản' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  videoMediaId!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  thumbnailMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ enum: VideoVisibility, default: VideoVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility = VideoVisibility.PUBLIC;
}

export class UpdateVideoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailMediaId?: string;

  @ApiPropertyOptional({ enum: VideoVisibility })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;
}

// ---- Playlists ----
export class CreatePlaylistDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: VideoVisibility, default: VideoVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility = VideoVisibility.PUBLIC;
}

export class UpdatePlaylistDto {
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

  @ApiPropertyOptional({ enum: VideoVisibility })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;
}

export class AddToPlaylistDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  videoIds!: string[];
}

export class UpdateHistoryDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  progressSeconds!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFinished?: boolean;
}

// ---- Queries ----
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

export class VideosQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  hashtag?: string;
}
