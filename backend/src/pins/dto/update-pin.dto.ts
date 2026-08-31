import { PartialType } from '@nestjs/swagger';
import { CreatePinDto } from './create-pin.dto';

/**
 * Every field optional. Validation, transformation (trim) and length limits are
 * inherited from CreatePinDto, so PATCH enforces exactly the same rules as POST.
 */
export class UpdatePinDto extends PartialType(CreatePinDto) {}
