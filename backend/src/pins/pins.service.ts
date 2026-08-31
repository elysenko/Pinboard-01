import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Pin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';

/** Prisma's "record required but not found" code, raised by update/delete. */
const RECORD_NOT_FOUND = 'P2025';

@Injectable()
export class PinsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Newest first. `id DESC` is a deterministic tiebreaker: two pins written in the
   * same millisecond would otherwise come back in arbitrary order between calls.
   */
  async findAll(): Promise<Pin[]> {
    return this.prisma.pin.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(id: string): Promise<Pin> {
    // `id` is a plain String column, so a malformed id is simply a miss (404),
    // never a driver-level error surfacing as a 500.
    const pin = await this.prisma.pin.findUnique({ where: { id } });
    if (!pin) throw new NotFoundException(`Pin ${id} not found`);
    return pin;
  }

  async create(dto: CreatePinDto): Promise<Pin> {
    return this.prisma.pin.create({
      // `?? ''` (not `|| ''`) so an explicit empty body stays empty and the column
      // is never null.
      data: { title: dto.title, body: dto.body ?? '' },
    });
  }

  async update(id: string, dto: UpdatePinDto): Promise<Pin> {
    const data: Prisma.PinUpdateInput = {};
    // Only copy keys the client actually sent: an absent field must not be reset,
    // and `{}` must leave the row untouched.
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.body !== undefined) data.body = dto.body;

    try {
      return await this.prisma.pin.update({ where: { id }, data });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.pin.delete({ where: { id } });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  /** Turns Prisma's P2025 into a 404; anything else propagates unchanged. */
  private mapNotFound(error: unknown, id: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === RECORD_NOT_FOUND
    ) {
      return new NotFoundException(`Pin ${id} not found`);
    }
    return error;
  }
}
