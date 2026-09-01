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

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private readonly logger = new Logger('UserService');

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

    return this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        email: this.buildDisabledEmail(user),
        phone: null,
        deletedAt: user.deletedAt ?? new Date(),
      },
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
      this.logger.error(
        `Failed to create user: ${JSON.stringify(createUserDto)}`,
      );
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

    if (!user) {
      this.logger.warn(`Login failed: User not found for email ${email}`);
      throw new NotFoundException('El usuario con este correo no existe.');
    }

    this.logger.log(`User found: ${email}`);
    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Login failed: Invalid password for email ${email}`);
      throw new UnauthorizedException('La contraseña es incorrecta.');
    }

    const payload = { userId: user.userId, email: user.email };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Login successful for email: ${email}`);

    this.logger.log(JSON.stringify({ payload, accessToken }));

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

    const user = await this.validateResetToken(accessToken);

    if (!user) {
      this.logger.warn(`Invalid or expired token: ${accessToken}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hashedPassword = await hash(password, 10);

    this.logger.log(`Updating password for userId: ${user.userId}`);
    const updatedUser = await this.prisma.user.update({
      where: { userId: user.userId },
      data: { password: hashedPassword },
    });

    if (!updatedUser) {
      this.logger.error(`Failed to update password for userId: ${user.userId}`);
      throw new BadRequestException('Failed to update password');
    }

    await this.prisma.passwordResetToken.update({
      where: { token: accessToken },
      data: { used: true },
    });

    this.logger.log(`Password updated successfully for userId: ${user.userId}`);

    return {
      statusCode: HttpStatus.OK,
      message: 'Contraseña actualizada con éxito.',
      data: {
        userId: updatedUser.userId,
        email: updatedUser.email,
      },
    };
  }

  async updateMe(userId: number, updateUserDto: UpdateUserDto) {
    await this.findOne(userId);

    const { userTypeId, ...rest } = updateUserDto;
    void userTypeId;
    const data = { ...rest } as Partial<User>;

    await this.ensureUniqueIdentityIsAvailable(
      {
        email: typeof data.email === 'string' ? data.email : undefined,
        phone: typeof data.phone === 'string' ? data.phone : undefined,
      },
      userId,
    );

    if (typeof data.password === 'string' && data.password.trim().length > 0) {
      data.password = await hash(data.password, 10);
    } else {
      delete data.password;
    }

    this.logger.log(`Updating self user with id: ${userId}`);
    const updatedUser = await this.prisma.user.update({
      where: { userId },
      data,
    });

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

  async update(id: number, updateUserDto: Partial<User>) {
    await this.findOne(id);

    const data = { ...updateUserDto } as Partial<User>;

    await this.ensureUniqueIdentityIsAvailable(
      {
        email: typeof data.email === 'string' ? data.email : undefined,
        phone: typeof data.phone === 'string' ? data.phone : undefined,
      },
      id,
    );

    if (typeof data.password === 'string' && data.password.trim().length > 0) {
      data.password = await hash(data.password, 10);
    } else {
      delete data.password;
    }

    this.logger.log(`Updating user with id: ${id}`);
    const updatedUser = await this.prisma.user.update({
      where: { userId: id },
      data,
    });

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
    this.logger.log(`Checking if email exists: ${email}`);
    const user = await this.prisma.user.findUnique({
      where: {
        email: email,
        deletedAt: null,
      },
    });

    if (!user) {
      this.logger.log(`Email does not exist: ${email}`);
      throw new NotFoundException('Email does not exist');
    }

    const createdToken = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.userId,
        token: this.jwtService.sign({ email: user.email }),
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
    return createdToken.token;
  }

  async validateResetToken(token: string) {
    const foundToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!foundToken || foundToken.used || foundToken.expiresAt < new Date()) {
      this.logger.warn('Invalid or expired reset token');
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    this.jwtService.verify(token);

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

  async logout(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required for logout');
    }

    const normalizedToken = token.replace(/^Bearer\s+/i, '').trim();

    let decodedToken: unknown;
    try {
      decodedToken = this.jwtService.decode(normalizedToken);
    } catch {
      throw new BadRequestException('Invalid token');
    }

    if (
      !decodedToken ||
      typeof decodedToken !== 'object' ||
      !('exp' in decodedToken) ||
      typeof decodedToken.exp !== 'number'
    ) {
      throw new BadRequestException('Invalid token');
    }

    this.logger.log('Logging out token');
    const expiresAt = new Date(decodedToken.exp * 1000);

    await this.prisma.blacklistedToken.create({
      data: {
        token: normalizedToken,
        expiresAt,
      },
    });

    this.logger.log('Token logged out successfully');
    return { statusCode: HttpStatus.OK };
  }

  async validateToken(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    const normalizedToken = token.replace(/^Bearer\s+/i, '').trim();

    try {
      this.jwtService.verify(normalizedToken);
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
