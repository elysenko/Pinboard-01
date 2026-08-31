import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const normaliseEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignupDto {
  @ApiProperty({ example: 'admin@pinboard.test' })
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Passw0rd!' })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional({ example: 'Ada Lovelace' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
