import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Shared limits — kept in lockstep with `@db.VarChar(...)` in prisma/schema.prisma. */
export const PIN_TITLE_MAX = 120;
export const PIN_BODY_MAX = 2000;

/** Trims strings and leaves every other type untouched so `@IsString` still reports it. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePinDto {
  @ApiProperty({ maxLength: PIN_TITLE_MAX, example: 'Q3 Roadmap Draft' })
  // Trim runs before validation, so a whitespace-only title fails @IsNotEmpty
  // rather than being stored as blank.
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(PIN_TITLE_MAX)
  title!: string;

  // No property initialiser here on purpose: PartialType(CreatePinDto) extends this
  // class, so a default would be re-applied on every PATCH and silently blank the
  // body of any pin patched with `{ title: '...' }`. The `''` default is applied
  // once, in PinsService.create().
  @ApiPropertyOptional({ maxLength: PIN_BODY_MAX, default: '' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(PIN_BODY_MAX)
  body?: string;
}
