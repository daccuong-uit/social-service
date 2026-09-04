import { IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TargetType {
  POST = 'post',
  REEL = 'reel',
  VIDEO = 'video',
  NOVEL = 'novel',
}

export class GetAnalyticsDto {
  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty({ enum: TargetType })
  @IsEnum(TargetType)
  targetType!: TargetType;
}

export class TrackWatchTimeDto {
  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty({ enum: [TargetType.REEL, TargetType.VIDEO] })
  @IsEnum(TargetType)
  targetType!: TargetType;

  @ApiProperty({ description: 'Watch time in seconds' })
  watchTimeSeconds!: number;
}
