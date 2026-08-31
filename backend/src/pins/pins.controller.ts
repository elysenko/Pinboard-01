import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Pin } from '@prisma/client';
import { Public } from '../auth/public.decorator';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { PinsService } from './pins.service';

/**
 * The pin wall is deliberately anonymous: every route here is public, including the
 * mutations. The product spec requires the wall to render and accept edits with no
 * authentication prompt, so no guard is applied. Auth exists only for /api/admin/*.
 */
@ApiTags('pins')
@Public()
@Controller('pins')
export class PinsController {
  constructor(private readonly pinsService: PinsService) {}

  @Get()
  @ApiOperation({ summary: 'List every pin, newest first' })
  findAll(): Promise<Pin[]> {
    return this.pinsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single pin' })
  findOne(@Param('id') id: string): Promise<Pin> {
    return this.pinsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a pin' })
  create(@Body() dto: CreatePinDto): Promise<Pin> {
    return this.pinsService.create(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a pin' })
  update(@Param('id') id: string, @Body() dto: UpdatePinDto): Promise<Pin> {
    return this.pinsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a pin' })
  remove(@Param('id') id: string): Promise<void> {
    return this.pinsService.remove(id);
  }
}
