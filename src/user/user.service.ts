import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserUserTypeDto } from 'src/user_user_type/dto/create-user_user_type.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { createHash } from 'crypto';
import { UpdateMeDto } from './dto/update-me.dto';
import { SessionJwtPayload } from './jwt/access-token';
import { NotificationGateway } from 'src/notification/notification.gateway';

const DUMMY_PASSWORD_HASH =
  '$2b$10$Ex2C.DSbBjPV4Jg0fvGK7O4xVtCl21xt8U6Pyg/pBagOxkgsilL8e';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationGateway: NotificationGateway,
  ) {}

  private readonly logger = new Logger('UserService');

  private assertBcryptPasswordLength(password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException(
        'La contraseña no puede superar 72 bytes en UTF-8.',
      );
    }
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildDisabledEmail(user: Pick<User, 'userId' | 'email'>) {
    const safeLocalPart =
      user.email
        .split('@')[0]
        ?.replace(/[^a-zA-Z0-9._-]/g, '')
        .slice(0, 30) || 'usuario';
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    return `${safeLocalPart}+inactivo-${user.userId}-${timestamp}@disabled.local`;
  }

  private toUserResponse(
    user: User & {
      userUserTypes?: { userType?: { name: string } }[];
    },
  ) {
    const userType = user.userUserTypes?.[0]?.userType?.name ?? null;

    return {
      userId: user.userId,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      userType,
      deletedAt: user.deletedAt,
    };
  }

  private async findAnyByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userUserTypes: {
          include: {
            userType: true,
          },
        },
      },
    });
  }

  private async findAnyByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      include: {
        userUserTypes: {
          include: {
            userType: true,
          },
        },
      },
    });
  }

  private async releaseDisabledUserIdentity(user: User) {
    this.logger.log(
      `Releasing disabled user unique identity. User ID: ${user.userId}`,
    );

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(71823091)`;
      const updated = await transaction.user.update({
        where: { userId: user.userId },
        data: {
          email: this.buildDisabledEmail(user),
          phone: null,
          deletedAt: user.deletedAt ?? new Date(),
        },
      });
      const administrators = await transaction.userUserType.count({
        where: {
          user: { deletedAt: null },
          userType: { permissions: { has: 'roles.manage' } },
        },
      });
      if (!administrators)
        throw new BadRequestException(
          'No puedes deshabilitar al último administrador de permisos.',
        );
      return updated;
    });
  }

  private async ensureUniqueIdentityIsAvailable(
    data: { email?: string; phone?: string | null },
    currentUserId?: number,
  ) {
    if (data.email) {
      const existingUser = await this.findAnyByEmail(data.email);

      if (existingUser && existingUser.userId !== currentUserId) {
        if (!existingUser.deletedAt) {
          this.logger.warn(`Email already exists: ${data.email}`);
          throw new ConflictException('El correo ya está en uso.');
        }

        await this.releaseDisabledUserIdentity(existingUser);
      }
    }

    if (data.phone) {
      const existingUserByPhone = await this.findAnyByPhone(data.phone);

      if (existingUserByPhone && existingUserByPhone.userId !== currentUserId) {
        if (!existingUserByPhone.deletedAt) {
          this.logger.warn(`Phone already exists: ${data.phone}`);
          throw new ConflictException('El teléfono ya está en uso.');
        }

        await this.releaseDisabledUserIdentity(existingUserByPhone);
      }
    }
  }

  async create(createUserDto: CreateUserDto) {
    this.assertBcryptPasswordLength(createUserDto.password);
    this.logger.log(
      `Validating associated user type: ${createUserDto.userTypeId.toString()}`,
    );

    const userType = await this.prisma.userType.findUnique({
      where: { userTypeId: createUserDto.userTypeId },
    });

    if (!userType) {
      this.logger.warn(
        `User type not found: ${createUserDto.userTypeId.toString()}`,
      );
      throw new BadRequestException(
        'El tipo de usuario proporcionado no es válido.',
      );
    }

    await this.ensureUniqueIdentityIsAvailable({
      email: createUserDto.email,
      phone: createUserDto.phone,
    });

    const hashedPassword = await hash(createUserDto.password, 10);

    const { userTypeId, ...createUserDtoWithoutUserTypeId } = createUserDto;
    void userTypeId;

    const data = {
      ...createUserDtoWithoutUserTypeId,
      password: hashedPassword,
    };

    this.logger.log(
      `Creating user: ${JSON.stringify(createUserDto.password ? { ...createUserDto, password: '****' } : createUserDto)}`,
    );
    const newUser = await this.prisma.user.create({
      data,
    });

    if (!newUser) {
      this.logger.error('Failed to create user');
      throw new BadRequestException('Failed to create user');
    }

    this.logger.log(
      'Assigning user type to new user',
      `User ID: ${newUser.userId}, User Type ID: ${userType.userTypeId}`,
    );
    const payloadUserUserType: CreateUserUserTypeDto = {
      userId: newUser.userId,
      userTypeId: userType.userTypeId,
    };

    this.logger.log(
      'Creating user - userType association',
      JSON.stringify(payloadUserUserType),
    );
    const association = await this.prisma.userUserType.create({
      data: payloadUserUserType,
    });

    if (!association) {
      this.logger.error(
        'Failed to create user - userType association',
        JSON.stringify(payloadUserUserType),
      );
      throw new BadRequestException(
        'Failed to create user - userType association',
      );
    }

    const userReturn = {
      ...newUser,
      password: '',
      userType: userType.name,
    };

    this.logger.log(
      `User created successfully: ${JSON.stringify(newUser.password ? { ...newUser, password: '****' } : newUser)}`,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Usuario registrado exitosamente.',
      data: userReturn,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    if (!email || !password) {
      this.logger.warn('Email and password must be provided for login');
      throw new BadRequestException(
        'El correo y la contraseña son obligatorios.',
      );
    }

    this.logger.log(`Attempting login for email: ${email}`);
    const user = await this.findByEmail(email);

    const isPasswordValid = await compare(
      password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !isPasswordValid) {
      this.logger.warn('Login failed: invalid credentials');
      throw new UnauthorizedException(
        'El correo o la contraseña son incorrectos.',
      );
    }

    const payload: SessionJwtPayload = {
      userId: user.userId,
      email: user.email,
      authVersion: user.authVersion,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Login successful for email: ${email}`);

    const returnUser = await this.findOne(user.userId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Login successful',
      data: {
        user: returnUser.data,
        accessToken,
      },
    };
  }

  async findAll() {
    this.logger.log('Finding all users');
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
      },
    });

    if (!users || users.length === 0) {
      this.logger.warn('No users found');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado usuarios.',
        data: [],
      };
    }

    this.logger.log(`Found ${users.length} users`);
    const usersWithTypes = await Promise.all(
      users.map(async (user) => {
        const returnUser = await this.findOne(user.userId);
        return returnUser.data;
      }),
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Los usuarios han sido encontrados exitosamente.',
      data: usersWithTypes,
    };
  }

  async findPaginated(query: ListUsersQueryDto) {
    const search = query.search?.trim();
    const where = {
      deletedAt: query.includeInactive ? { not: null } : null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          userUserTypes: { include: { userType: true } },
        },
        orderBy: [
          query.includeInactive
            ? { deletedAt: 'desc' as const }
            : { name: query.order },
          { userId: 'asc' },
        ],
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    const items = users.map((user) => this.toUserResponse(user));

    return {
      statusCode: HttpStatus.OK,
      message: 'Usuarios obtenidos exitosamente.',
      data: buildPaginatedData(items, totalItems, query),
    };
  }

  async findInactive() {
    this.logger.log('Finding inactive users');
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: {
          not: null,
        },
      },
      include: {
        userUserTypes: {
          include: {
            userType: true,
          },
        },
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Los usuarios inactivos han sido encontrados exitosamente.',
      data: users.map((user) => this.toUserResponse(user)),
    };
  }

  async findOne(id: number) {
    this.logger.log(`Finding user with id: ${id}`);
    const user = await this.prisma.user.findUnique({
      where: {
        userId: id,
        deletedAt: null,
      },
      include: {
        userUserTypes: {
          include: {
            userType: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`User not found with id: ${id}`);
      throw new NotFoundException('El usuario no ha sido encontrado.');
    }

    const userWithType = this.toUserResponse(user);

    this.logger.log(`User found with id: ${id}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'El usuario ha sido encontrado exitosamente.',
      data: userWithType,
    };
  }

  async findByEmail(email: string) {
    this.logger.log(`Finding user by email: ${email}`);
    const foundUser = await this.prisma.user.findFirst({
      where: {
        email: email,
        deletedAt: null,
      },
      include: {
        userUserTypes: {
          include: {
            userType: true,
          },
        },
      },
    });

    if (!foundUser) {
      this.logger.warn(`User not found with email: ${email}`);
      return null;
    }

    this.logger.log(`User found with email: ${email}`);
    return foundUser;
  }

  async findByPhone(phone: string) {
    this.logger.log(`Finding user by phone: ${phone}`);
    const foundUser = await this.prisma.user.findFirst({
      where: {
        phone: phone,
        deletedAt: null,
      },
      include: {
        userUserTypes: {
          include: {
            userType: true,
          },
        },
      },
    });

    if (!foundUser) {
      this.logger.warn(`User not found with phone: ${phone}`);
      return null;
    }

    this.logger.log(`User found with phone: ${phone}`);
    return foundUser;
  }

  async updatePassword(resetPasswordDto: ResetPasswordDto) {
    const { accessToken, password } = resetPasswordDto;
    this.assertBcryptPasswordLength(password);
    try {
      this.jwtService.verify(accessToken, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const tokenHash = this.hashResetToken(accessToken);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });
    if (!resetToken || resetToken.used || resetToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const hashedPassword = await hash(password, 10);
    const updatedUser = await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          token: tokenHash,
          used: false,
          expiresAt: { gt: new Date() },
        },
        data: { used: true, usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      const user = await transaction.user.findFirst({
        where: { userId: resetToken.userId, deletedAt: null },
        select: { userId: true },
      });
      if (!user) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      return transaction.user.update({
        where: { userId: user.userId },
        data: { password: hashedPassword, authVersion: { increment: 1 } },
      });
    });
    this.notificationGateway.disconnectUser(updatedUser.userId);

    this.logger.log(
      `Password updated successfully for userId: ${updatedUser.userId}`,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Contraseña actualizada con éxito.',
      data: {
        userId: updatedUser.userId,
        email: updatedUser.email,
      },
    };
  }

  async updateMe(userId: number, updateUserDto: UpdateMeDto) {
    const currentUser = await this.prisma.user.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!currentUser) {
      throw new NotFoundException('El usuario no ha sido encontrado.');
    }

    const { currentPassword, ...rest } = updateUserDto;
    const data = { ...rest } as Partial<User>;

    await this.ensureUniqueIdentityIsAvailable(
      {
        email: typeof data.email === 'string' ? data.email : undefined,
        phone: typeof data.phone === 'string' ? data.phone : undefined,
      },
      userId,
    );

    if (typeof data.password === 'string' && data.password.trim().length > 0) {
      if (
        !currentPassword ||
        !(await compare(currentPassword, currentUser.password))
      ) {
        throw new UnauthorizedException('La contraseña actual es incorrecta.');
      }
      this.assertBcryptPasswordLength(data.password);
      data.password = await hash(data.password, 10);
    } else {
      delete data.password;
    }

    this.logger.log(`Updating self user with id: ${userId}`);
    const updatedUser = await this.prisma.user.update({
      where: { userId },
      data: {
        ...data,
        ...(data.password ? { authVersion: { increment: 1 } } : {}),
      },
    });
    if (data.password) this.notificationGateway.disconnectUser(userId);

    if (!updatedUser) {
      this.logger.error(`Failed to update self user with id: ${userId}`);
      throw new BadRequestException('Failed to update user');
    }

    const returnUser = await this.findOne(userId);

    this.logger.log(`Self user with id: ${userId} updated successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Usuario actualizado exitosamente.',
      data: returnUser.data,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    const { userTypeId, ...fields } = updateUserDto;
    if (userTypeId !== undefined)
      throw new BadRequestException(
        'Usa la acción Asignar rol para cambiar los permisos del usuario.',
      );
    const data = { ...fields } as Partial<User>;

    await this.ensureUniqueIdentityIsAvailable(
      {
        email: typeof data.email === 'string' ? data.email : undefined,
        phone: typeof data.phone === 'string' ? data.phone : undefined,
      },
      id,
    );

    if (typeof data.password === 'string' && data.password.trim().length > 0) {
      this.assertBcryptPasswordLength(data.password);
      data.password = await hash(data.password, 10);
    } else {
      delete data.password;
    }

    this.logger.log(`Updating user with id: ${id}`);
    const updatedUser = await this.prisma.user.update({
      where: { userId: id },
      data: {
        ...data,
        ...(data.password ? { authVersion: { increment: 1 } } : {}),
      },
    });
    if (data.password) this.notificationGateway.disconnectUser(id);

    if (!updatedUser) {
      this.logger.error(`Failed to update user with id: ${id}`);
      throw new BadRequestException('Failed to update user');
    }

    const returnUser = await this.findOne(id);

    this.logger.log(`User with id: ${id} updated successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Usuario actualizado exitosamente.',
      data: returnUser.data,
    };
  }

  async emailExists(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email,
        deletedAt: null,
      },
    });

    if (!user) {
      return null;
    }

    const rawToken = this.jwtService.sign({
      email: user.email,
      purpose: 'password-reset',
    });

    const createdToken = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.userId,
        token: this.hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    if (!createdToken) {
      this.logger.error(
        `Failed to create password reset token for email: ${email}`,
      );
      throw new BadRequestException('Failed to create password reset token');
    }

    this.logger.log(`Password reset token created for email: ${email}`);
    return rawToken;
  }

  async validateResetToken(token: string) {
    const foundToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: this.hashResetToken(token) },
    });

    if (!foundToken || foundToken.used || foundToken.expiresAt < new Date()) {
      this.logger.warn('Invalid or expired reset token');
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    this.jwtService.verify(token, { algorithms: ['HS256'] });

    const user = await this.prisma.user.findFirst({
      where: {
        userId: foundToken.userId,
        deletedAt: null,
      },
      include: {
        userUserTypes: {
          include: {
            userType: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn('Reset token belongs to a disabled or missing user');
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    this.logger.log('User found for the provided token');
    return user;
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { userId: id },
    });

    if (!user) {
      this.logger.warn(`User not found with id: ${id}`);
      throw new NotFoundException('El usuario no ha sido encontrado.');
    }

    this.logger.log(`Disabling user with id: ${id}`);

    const deletedUser = user.deletedAt
      ? user
      : await this.releaseDisabledUserIdentity(user);
    this.notificationGateway.disconnectUser(id);

    if (!deletedUser) {
      this.logger.error(`Failed to delete user with id: ${id}`);
      throw new BadRequestException('Failed to delete user');
    }

    this.logger.log(`User with id: ${id} disabled successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Usuario deshabilitado exitosamente.',
      data: {
        userId: deletedUser.userId,
        email: deletedUser.email,
        deletedAt: deletedUser.deletedAt,
      },
    };
  }

  async logout(token?: string) {
    if (!token) {
      throw new BadRequestException('Token is required for logout');
    }

    const normalizedToken = token.replace(/^Bearer\s+/i, '').trim();

    let decodedToken: SessionJwtPayload;
    try {
      decodedToken = this.jwtService.verify<SessionJwtPayload>(
        normalizedToken,
        { algorithms: ['HS256'] },
      );
    } catch {
      throw new BadRequestException('Invalid token');
    }

    if (typeof decodedToken.exp !== 'number') {
      throw new BadRequestException('Invalid token');
    }

    this.logger.log('Logging out token');
    const expiresAt = new Date(decodedToken.exp * 1000);

    await this.prisma.blacklistedToken.create({
      data: {
        token: normalizedToken,
        expiresAt,
        userId: decodedToken.userId,
      },
    });
    this.notificationGateway.disconnectUser(decodedToken.userId);

    this.logger.log('Token logged out successfully');
    return { statusCode: HttpStatus.OK };
  }

  async validateToken(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    const normalizedToken = token.replace(/^Bearer\s+/i, '').trim();

    try {
      this.jwtService.verify(normalizedToken, { algorithms: ['HS256'] });
    } catch {
      return {
        statusCode: HttpStatus.OK,
        message: 'Token inv\u00e1lido o expirado.',
        data: { valid: false },
      };
    }

    const blacklistedToken = await this.prisma.blacklistedToken.findUnique({
      where: { token: normalizedToken },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Token validado exitosamente.',
      data: { valid: !blacklistedToken },
    };
  }
}
