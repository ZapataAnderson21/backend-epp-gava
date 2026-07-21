import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Injectable()
export class ComplaintService {
  private readonly logger = new Logger(ComplaintService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async create(createComplaintDto: CreateComplaintDto, userId: number) {
    const complaint = await this.prismaService.complaint.create({
      data: {
        claim: createComplaintDto.claim.trim(),
        description: createComplaintDto.description.trim(),
        userId,
      },
    });

    this.logger.log(
      `Complaint ${complaint.complaintId} registered by user ${userId}`,
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Reclamo registrado exitosamente.',
      data: complaint,
    };
  }

  async findByUser(userId: number) {
    const complaints = await this.prismaService.complaint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      statusCode: HttpStatus.OK,
      message: complaints.length
        ? 'Reclamos encontrados exitosamente.'
        : 'Aún no has registrado reclamos.',
      data: complaints,
    };
  }
}
