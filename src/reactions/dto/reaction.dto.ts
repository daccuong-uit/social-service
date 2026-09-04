import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ReactionType {
  LIKE = 'like',
  LOVE = 'love',
  HAHA = 'haha',
  WOW = 'wow',
  SAD = 'sad',
  ANGRY = 'angry',
  CARE = 'care',
}

export enum ReactionTarget {
  POST = 'post',
  COMMENT = 'comment',
  REEL = 'reel',
  VIDEO = 'video',
  NOVEL = 'novel',
  CHAPTER = 'chapter',
}

export class UpsertReactionDto {
  @ApiProperty({ example: 'post-uuid-here' })
  @IsString()
  targetId!: string;

  @ApiProperty({ enum: ReactionTarget })
  @IsEnum(ReactionTarget)
  targetType!: ReactionTarget;

  @ApiProperty({ enum: ReactionType })
  @IsEnum(ReactionType)
  type!: ReactionType;
}

export class RemoveReactionDto {
  @ApiProperty()
  @IsString()
  targetId!: string;

  @ApiProperty({ enum: ReactionTarget })
  @IsEnum(ReactionTarget)
  targetType!: ReactionTarget;
}
