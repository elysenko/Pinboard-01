import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinsService } from './pins.service';
import { PrismaService } from '../prisma/prisma.service';

/** Minimal Prisma double — only the delegate methods PinsService actually calls. */
function createPrismaMock() {
  return {
    pin: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

/** The error Prisma raises when update/delete targets a row that is not there. */
function recordNotFound(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

describe('PinsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: PinsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PinsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('orders newest first, with id as a deterministic tiebreaker', async () => {
      prisma.pin.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.pin.findMany).toHaveBeenCalledWith({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    });
  });

  describe('findOne', () => {
    it('returns the pin when it exists', async () => {
      const pin = { id: 'abc', title: 'Q3 Roadmap Draft' };
      prisma.pin.findUnique.mockResolvedValue(pin);

      await expect(service.findOne('abc')).resolves.toBe(pin);
    });

    it('throws NotFoundException for a missing id', async () => {
      prisma.pin.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('defaults an omitted body to the empty string rather than null', async () => {
      prisma.pin.create.mockResolvedValue({});

      await service.create({ title: 'Rooftop Garden Plan' });

      expect(prisma.pin.create).toHaveBeenCalledWith({
        data: { title: 'Rooftop Garden Plan', body: '' },
      });
    });

    it('preserves an explicitly empty body', async () => {
      prisma.pin.create.mockResolvedValue({});

      await service.create({ title: 'Migration Checklist', body: '' });

      expect(prisma.pin.create).toHaveBeenCalledWith({
        data: { title: 'Migration Checklist', body: '' },
      });
    });
  });

  describe('update', () => {
    it('only writes the fields the client actually sent', async () => {
      prisma.pin.update.mockResolvedValue({});

      await service.update('abc', { title: 'Renamed' });

      expect(prisma.pin.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { title: 'Renamed' },
      });
    });

    it('leaves the row untouched when given an empty patch', async () => {
      prisma.pin.update.mockResolvedValue({});

      await service.update('abc', {});

      expect(prisma.pin.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: {},
      });
    });

    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.pin.update.mockRejectedValue(recordNotFound());

      await expect(service.update('gone', { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates unrelated errors unchanged', async () => {
      const boom = new Error('connection reset');
      prisma.pin.update.mockRejectedValue(boom);

      await expect(service.update('abc', { title: 'x' })).rejects.toBe(boom);
    });
  });

  describe('remove', () => {
    it('maps Prisma P2025 to NotFoundException', async () => {
      prisma.pin.delete.mockRejectedValue(recordNotFound());

      await expect(service.remove('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('resolves when the delete succeeds', async () => {
      prisma.pin.delete.mockResolvedValue({});

      await expect(service.remove('abc')).resolves.toBeUndefined();
    });
  });
});
