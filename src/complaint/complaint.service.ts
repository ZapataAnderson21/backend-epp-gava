import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Injectable()
export class ComplaintService {
  private readonly logger = new Logger(ComplaintService.name);

  constructor(private readonly prismaService: PrismaService) {}

  private async isSystemsUser(userId: number) {
    const systemsUserType = await this.prismaService.userUserType.findFirst({
      where: {
        userId,
        userType: { name: 'SISTEMAS' },
      },
      select: { userUserTypeId: true },
    });

    return systemsUserType !== null;
  }

  async create(createComplaintDto: CreateComplaintDto, userId: number) {
    if (await this.isSystemsUser(userId)) {
      throw new ForbiddenException(
        'Los usuarios de SISTEMAS solo pueden consultar reclamos.',
      );
    }

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

  async findVisibleToUser(userId: number) {
    const canViewAll = await this.isSystemsUser(userId);

    const complaints = await this.prismaService.complaint.findMany({
      where: canViewAll ? undefined : { userId },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      statusCode: HttpStatus.OK,
      message: complaints.length
        ? 'Reclamos encontrados exitosamente.'
        : canViewAll
          ? 'Aún no se han registrado reclamos.'
          : 'Aún no has registrado reclamos.',
      data: complaints,
    };
  }
}
