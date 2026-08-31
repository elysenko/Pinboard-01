import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class SettingEntryDto {
  @ApiProperty({ example: 'MINIO_ENDPOINT' })
  @IsString()
  @MaxLength(200)
  key!: string;

  @ApiProperty({ example: 'https://minio.internal:9000' })
  @IsString()
  @MaxLength(4000)
  value!: string;
}
