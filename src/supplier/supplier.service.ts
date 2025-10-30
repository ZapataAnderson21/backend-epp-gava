import { BadRequestException, ConflictException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Currency, CurrencyLabelEs } from './enum/currency.enum';

@Injectable()
export class SupplierService {

  private readonly logger = new Logger('SupplierService');

  constructor(private readonly prismaService: PrismaService) {}

  async create(createSupplierDto: CreateSupplierDto) {
    this.logger.log('Creating a new supplier');
    const supplier = await this.prismaService.supplier.create({
      data: createSupplierDto,
    });

    if(!supplier) {
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

    if(!suppliers || suppliers.length === 0) {
      this.logger.error('Failed to fetch suppliers');
      throw new BadRequestException('No se pudieron obtener los proveedores.');
    }

    const processedSuppliers = suppliers.map(supplier => ({
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

    if(!supplier) {
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
      `Updating supplier with ID: ${supplierId} - payload: ${JSON.stringify(updateSupplierDto)}`
    );

    // Traer el actual (activo)
    const currentWrap = await this.findOne(supplierId); // OJO: había faltado el await
    const current = currentWrap.data;

    // Si cambia el name, validar conflicto
    if (
      updateSupplierDto.name &&
      updateSupplierDto.name.trim().toLowerCase() !== current.name.trim().toLowerCase()
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

    // Si cambia el email, validar conflicto (CITEXT => case-insensitive)
    if (
      updateSupplierDto.email &&
      updateSupplierDto.email.trim().toLowerCase() !== (current.email ?? '').trim().toLowerCase()
    ) {
      const byEmail = await this.findByEmail(updateSupplierDto.email);
      if (byEmail && byEmail.supplierId !== supplierId) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un proveedor con ese correo.',
          data: null,
        });
      }
    }

    // Si cambia el RUC, validar conflicto (normaliza espacios)
    if (
      updateSupplierDto.ruc &&
      updateSupplierDto.ruc.trim() !== (current.ruc ?? '').trim()
    ) {
      const byRuc = await this.findByRuc(updateSupplierDto.ruc);
      if (byRuc && byRuc.supplierId !== supplierId) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'Ya existe un proveedor con ese RUC.',
          data: null,
        });
      }
    }

    const supplier = await this.prismaService.supplier.update({
      where: { supplierId },
      data: updateSupplierDto,
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

    if(!supplier) {
      this.logger.warn(`Supplier with name: ${name} not found`);
      return null;
    }

    this.logger.log(`Supplier with name: ${name} found`);
    return supplier;
  }

  async findByEmail(email: string) {
    this.logger.log(`Searching supplier by email: ${email}`);
    const supplier = await this.prismaService.supplier.findUnique({
      where: {
        email,
        deletedAt: null,
      },
    });

    if(!supplier) {
      this.logger.warn(`Supplier with email: ${email} not found`);
      return null;
    }

    this.logger.log(`Supplier with email: ${email} found`);
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

    if(!supplier) {
      this.logger.warn(`Supplier with RUC: ${ruc} not found`);
      return null;
    }

    this.logger.log(`Supplier with RUC: ${ruc} found`);
    return supplier;
  }

  async remove(id: number) {
    this.logger.log(`Soft deleting supplier with ID: ${id}`);
    await this.findOne(id);

    const supplier = await this.prismaService.supplier.update({
      where: { 
        supplierId: id 
      },
      data: { 
        deletedAt: new Date() 
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
