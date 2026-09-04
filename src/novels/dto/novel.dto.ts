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
  Max,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NovelStatus {
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  HIATUS = 'hiatus',
}

export enum NovelVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

// ---- Novels ----
export class CreateNovelDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  synopsis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: NovelStatus, default: NovelStatus.ONGOING })
  @IsOptional()
  @IsEnum(NovelStatus)
  status?: NovelStatus = NovelStatus.ONGOING;

  @ApiPropertyOptional({ enum: NovelVisibility, default: NovelVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(NovelVisibility)
  visibility?: NovelVisibility = NovelVisibility.PUBLIC;
}

export class UpdateNovelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  synopsis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: NovelStatus })
  @IsOptional()
  @IsEnum(NovelStatus)
  status?: NovelStatus;

  @ApiPropertyOptional({ enum: NovelVisibility })
  @IsOptional()
  @IsEnum(NovelVisibility)
  visibility?: NovelVisibility;
}

// ---- Chapters ----
export class CreateChapterDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;
}

export class UpdateChapterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}

// ---- Ratings ----
export class RateNovelDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  review?: string;
}

// ---- Reading Progress ----
export class UpdateReadingProgressDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent!: number;
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

export class NovelsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  genre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ enum: NovelStatus })
  @IsOptional()
  @IsEnum(NovelStatus)
  status?: NovelStatus;
}
