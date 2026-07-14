import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CurrencyLabelEs } from './enum/currency.enum';
import { SupplierDocumentType } from './enum/document-type.enum';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger('SupplierService');

  constructor(private readonly prismaService: PrismaService) {}

  private resolveDocumentType(
    inputType?: SupplierDocumentType,
    currentType?: SupplierDocumentType | string,
  ): SupplierDocumentType {
    if (inputType) {
      return inputType;
    }

    return currentType === SupplierDocumentType.dni
      ? SupplierDocumentType.dni
      : SupplierDocumentType.ruc;
  }

  async create(createSupplierDto: CreateSupplierDto) {
    this.logger.log('Creating a new supplier');
    const documentType = this.resolveDocumentType(
      createSupplierDto.documentType,
    );
    const data: Omit<CreateSupplierDto, 'documentType' | 'dni' | 'ruc'> & {
      documentType: SupplierDocumentType;
      dni?: string;
      ruc?: string;
    } = {
      ...createSupplierDto,
      documentType,
    };

    if (documentType === SupplierDocumentType.ruc) {
      if (!createSupplierDto.ruc) {
        throw new BadRequestException('El RUC es obligatorio.');
      }

      const byRuc = await this.findByRuc(createSupplierDto.ruc);
      if (byRuc) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un proveedor con ese RUC.',
          data: null,
        });
      }

      data.ruc = createSupplierDto.ruc;
      data.dni = undefined;
    } else {
      if (!createSupplierDto.dni) {
        throw new BadRequestException('El DNI es obligatorio.');
      }

      const byDni = await this.findByDni(createSupplierDto.dni);
      if (byDni) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un proveedor con ese DNI.',
          data: null,
        });
      }

      data.dni = createSupplierDto.dni;
      data.ruc = undefined;
    }

    const supplier = await this.prismaService.supplier.create({
      data,
    });

    if (!supplier) {
      this.logger.error('Failed to create supplier');
      throw new BadRequestException('No se pudo crear el proveedor.');
    }

    this.logger.log(`Supplier created with ID: ${supplier.supplierId}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Proveedor creado exitosamente.',
      data: supplier,
    };
  }

  async findAll() {
    this.logger.log('Fetching all suppliers');
    const suppliers = await this.prismaService.supplier.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (!suppliers || suppliers.length === 0) {
      this.logger.error('Failed to fetch suppliers');
      throw new BadRequestException('No se pudieron obtener los proveedores.');
    }

    const processedSuppliers = suppliers.map((supplier) => ({
      ...supplier,
      currency: CurrencyLabelEs[supplier.currency] || supplier.currency,
    }));

    this.logger.log(`Fetched ${suppliers.length} suppliers`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Proveedores obtenidos exitosamente.',
      data: processedSuppliers,
    };
  }

  async findOne(supplierId: number) {
    this.logger.log(`Fetching supplier with ID: ${supplierId}`);
    const supplier = await this.prismaService.supplier.findUnique({
      where: {
        supplierId,
        deletedAt: null,
      },
    });

    if (!supplier) {
      this.logger.error(`Supplier with ID: ${supplierId} not found`);
      throw new BadRequestException('No se pudo obtener el proveedor.');
    }

    this.logger.log(`Supplier with ID: ${supplierId} fetched successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Proveedor obtenido exitosamente.',
      data: supplier,
    };
  }

  async update(supplierId: number, updateSupplierDto: UpdateSupplierDto) {
    this.logger.log(
      `Updating supplier with ID: ${supplierId} - payload: ${JSON.stringify(updateSupplierDto)}`,
    );

    // Traer el actual (activo)
    const currentWrap = await this.findOne(supplierId); // OJO: había faltado el await
    const current = currentWrap.data;

    // Si cambia el name, validar conflicto
    if (
      updateSupplierDto.name &&
      updateSupplierDto.name.trim().toLowerCase() !==
        current.name.trim().toLowerCase()
    ) {
      const byName = await this.findByName(updateSupplierDto.name);
      if (byName && byName.supplierId !== supplierId) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un proveedor con ese nombre.',
          data: null,
        });
      }
    }

    const updateData: Omit<
      UpdateSupplierDto,
      'documentType' | 'dni' | 'ruc'
    > & {
      documentType?: SupplierDocumentType;
      dni?: string | null;
      ruc?: string | null;
    } = { ...updateSupplierDto };

    const shouldProcessDocument =
      updateSupplierDto.documentType !== undefined ||
      updateSupplierDto.ruc !== undefined ||
      updateSupplierDto.dni !== undefined;

    if (shouldProcessDocument) {
      const nextDocumentType = this.resolveDocumentType(
        updateSupplierDto.documentType,
        current.documentType,
      );

      if (nextDocumentType === SupplierDocumentType.ruc) {
        const nextRuc = updateSupplierDto.ruc ?? current.ruc;
        if (!nextRuc) {
          throw new BadRequestException('El RUC es obligatorio.');
        }

        if (nextRuc.trim() !== (current.ruc ?? '').trim()) {
          const byRuc = await this.findByRuc(nextRuc);
          if (byRuc && byRuc.supplierId !== supplierId) {
            throw new ConflictException({
              statusCode: HttpStatus.CONFLICT,
              message: 'Ya existe un proveedor con ese RUC.',
              data: null,
            });
          }
        }

        updateData.documentType = nextDocumentType;
        updateData.ruc = nextRuc;
        updateData.dni = null;
      } else {
        const nextDni = updateSupplierDto.dni ?? current.dni;
        if (!nextDni) {
          throw new BadRequestException('El DNI es obligatorio.');
        }

        if (nextDni.trim() !== (current.dni ?? '').trim()) {
          const byDni = await this.findByDni(nextDni);
          if (byDni && byDni.supplierId !== supplierId) {
            throw new ConflictException({
              statusCode: HttpStatus.CONFLICT,
              message: 'Ya existe un proveedor con ese DNI.',
              data: null,
            });
          }
        }

        updateData.documentType = nextDocumentType;
        updateData.dni = nextDni;
        updateData.ruc = null;
      }
    }

    const supplier = await this.prismaService.supplier.update({
      where: { supplierId },
      data: updateData,
    });

    if (!supplier) {
      this.logger.error(`Failed to update supplier with ID: ${supplierId}`);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No se pudo actualizar el proveedor.',
        data: null,
      });
    }

    this.logger.log(`Supplier with ID: ${supplierId} updated successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Proveedor actualizado exitosamente.',
      data: supplier,
    };
  }

  async findByName(name: string) {
    this.logger.log(`Searching supplier by name: ${name}`);
    const supplier = await this.prismaService.supplier.findUnique({
      where: {
        name,
        deletedAt: null,
      },
    });

    if (!supplier) {
      this.logger.warn(`Supplier with name: ${name} not found`);
      return null;
    }

    this.logger.log(`Supplier with name: ${name} found`);
    return supplier;
  }

  async findByRuc(ruc: string) {
    this.logger.log(`Searching supplier by RUC: ${ruc}`);
    const supplier = await this.prismaService.supplier.findUnique({
      where: {
        ruc,
        deletedAt: null,
      },
    });

    if (!supplier) {
      this.logger.warn(`Supplier with RUC: ${ruc} not found`);
      return null;
    }

    this.logger.log(`Supplier with RUC: ${ruc} found`);
    return supplier;
  }

  async findByDni(dni: string) {
    this.logger.log(`Searching supplier by DNI: ${dni}`);
    const supplier = await this.prismaService.supplier.findUnique({
      where: {
        dni,
        deletedAt: null,
      },
    });

    if (!supplier) {
      this.logger.warn(`Supplier with DNI: ${dni} not found`);
      return null;
    }

    this.logger.log(`Supplier with DNI: ${dni} found`);
    return supplier;
  }

  async remove(id: number) {
    this.logger.log(`Soft deleting supplier with ID: ${id}`);
    await this.findOne(id);

    const supplier = await this.prismaService.supplier.update({
      where: {
        supplierId: id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (!supplier) {
      this.logger.error(`Failed to delete supplier with ID: ${id}`);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'No se pudo eliminar el proveedor.',
        data: null,
      });
    }

    this.logger.log(`Supplier with ID: ${id} soft deleted successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Proveedor eliminado exitosamente.',
      data: supplier,
    };
  }
}
