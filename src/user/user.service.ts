import { BadRequestException, ConflictException, HttpStatus, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { User } from 'generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserUserTypeDto } from 'src/user_user_type/dto/create-user_user_type.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';

@Injectable()
export class UserService {

  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  private readonly logger = new Logger('UserService');

  async create(createUserDto: CreateUserDto) {

    this.logger.log(`Validating associated user type: ${createUserDto.user_type_id.toString()}`);
    
    const userType = await this.prisma.userType.findUnique({
      where: { user_type_id: createUserDto.user_type_id }
    });

    if (!userType) {
      this.logger.warn(`User type not found: ${createUserDto.user_type_id.toString()}`);
      throw new BadRequestException('User type not found');
    }

    const existingUser = await this.findByEmail(createUserDto.email);

    if (existingUser) {
      this.logger.warn(`Email already exists: ${createUserDto.email}`);
      throw new ConflictException('User with this email already exists.');
    }

    const hashedPassword = await hash(createUserDto.password, 10);


    const createUserDtoWithoutUserTypeId = (({ user_type_id, ...o }) => o)(createUserDto);

    const data = {
      ...createUserDtoWithoutUserTypeId,
      password: hashedPassword
    }

    this.logger.log(`Creating user: ${JSON.stringify(createUserDto.password ? { ...createUserDto, password: '****' } : createUserDto)}`);
    const newUser = await this.prisma.user.create({
      data
    });

    if(!newUser) {
      this.logger.error(`Failed to create user: ${JSON.stringify(createUserDto)}`);
      throw new BadRequestException('Failed to create user');
    }

    this.logger.log('Assigning user type to new user', `User ID: ${newUser.user_id}, User Type ID: ${userType.user_type_id}`);
    const payloadUserUserType: CreateUserUserTypeDto = {
      user_id: newUser.user_id,
      user_type_id: userType.user_type_id
    }

    this.logger.log('Creating user - userType association', JSON.stringify(payloadUserUserType));
    const association = await this.prisma.userUserType.create({
      data: payloadUserUserType
    });

    if (!association) {
      this.logger.error('Failed to create user - userType association', JSON.stringify(payloadUserUserType));
      throw new BadRequestException('Failed to create user - userType association');
    }
    
    const userReturn = {
      ...newUser,
      password: '',
      userType: userType.name
    }

    this.logger.log(`User created successfully: ${JSON.stringify(newUser.password ? { ...newUser, password: '****' } : newUser)}`);
    return userReturn;
  }

  async login(loginDto: LoginDto) {
    
    const { email, password } = loginDto;

    if(!email || !password) {
      this.logger.warn('Email and password must be provided for login');
      throw new BadRequestException('Email and password must be provided');
    }

    this.logger.log(`Attempting login for email: ${email}`);
    let user = await this.findByEmail(email);
    
    if (!user) {
      this.logger.warn(`Login failed: User not found for email ${email}`);
      throw new UnauthorizedException('Invalid credentials. User with this email does not exist');
    }

    this.logger.log(`User found: ${email}`);
    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Login failed: Invalid password for email ${email}`);
      throw new UnauthorizedException('Invalid credentials. Password is incorrect');
    }

    const payload = await this.findOne(user.user_id); 

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Login successful for email: ${email}`);

    this.logger.log(JSON.stringify({ payload, accessToken }));

    return {
      user: payload,
      accessToken
    };
  }

  async findAll() {

    this.logger.log('Finding all users');
    const users = await this.prisma.user.findMany();

    if (!users || users.length === 0) {
      this.logger.warn('No users found');
      return [];
    }

    this.logger.log(`Found ${users.length} users`);
    const usersWithTypes = await Promise.all(
      users.map(async (user) => {
        const returnUser = await this.findOne(user.user_id);
        return returnUser;
      })
    );

    return usersWithTypes;
  }

  async findOne(id: number) {
    
    this.logger.log(`Finding user with id: ${id}`);
    const user = await this.prisma.user.findUnique({
      where: { user_id: id },
      include: {
        userUserTypes: {
          include: {
            userType: true
          }
        }
      }
    });

    if (!user) {
      this.logger.warn(`User not found with id: ${id}`);
      throw new NotFoundException('User not found');
    }

    const userType = user.userUserTypes[0].userType.name ? user.userUserTypes[0].userType.name : null;

    const userWithType = {
      id: user.user_id,
      name: user.name,
      last_name: user.last_name,
      email: user.email,
      userType: userType
    };

    this.logger.log(`User found with id: ${id}`);
    return userWithType;
  }

  async findByEmail(email: string) {
    this.logger.log(`Finding user by email: ${email}`);
    const foundUser = await this.prisma.user.findUnique({
      where: { email: email },
      include: {
        userUserTypes: {
          include: {
            userType: true
          }
        }
      }
    });

    if (!foundUser) {
      this.logger.warn(`User not found with email: ${email}`);
      return null;
    }

    this.logger.log(`User found with email: ${email}`);
    return foundUser;
  }

  async updatePassword(resetPasswordDto: ResetPasswordDto) {

    const { accessToken, newPassword } = resetPasswordDto;

    const user = await this.validateResetToken(accessToken);

    if (!user) {
      this.logger.warn(`Invalid or expired token: ${accessToken}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hashedPassword = await hash(newPassword, 10);

    this.logger.log(`Updating password for user_id: ${user.user_id}`);
    const updatedUser = await this.prisma.user.update({
      where: { user_id: user.user_id },
      data: { password: hashedPassword }
    });

    if (!updatedUser) {
      this.logger.error(`Failed to update password for user_id: ${user.user_id}`);
      throw new BadRequestException('Failed to update password');
    }

    await this.prisma.passwordResetToken.update({
      where: { token: accessToken },
      data: { used: true }
    });

    this.logger.log(`Password updated successfully for user_id: ${user.user_id}`);

    return HttpStatus.OK;
  }

  async update(id: number, updateUserDto: Partial<User>): Promise<User | null> {

    await this.findOne(id);

    this.logger.log(`Updating user with id: ${id}`);
    const updatedUser = await this.prisma.user.update({
      where: { user_id: id },
      data: updateUserDto
    });

    if (!updatedUser) {
      this.logger.error(`Failed to update user with id: ${id}`);
      throw new BadRequestException('Failed to update user');
    }

    this.logger.log(`User with id: ${id} updated successfully`);
    return updatedUser;
  }

  async emailExists(email: string): Promise<string | null> {
    this.logger.log(`Checking if email exists: ${email}`);
    const user = await this.prisma.user.findUnique({
      where: { email: email }
    });
    
    if (!user) {
      this.logger.log(`Email does not exist: ${email}`);
      throw new NotFoundException('Email does not exist');
    }

    const createdToken = await this.prisma.passwordResetToken.create({
      data: {
        user_id: user.user_id,
        token: this.jwtService.sign({ email: user.email }),
        expires_at: new Date(Date.now() + 3600000)
      }
    });

    if(!createdToken) {
      this.logger.error(`Failed to create password reset token for email: ${email}`);
      throw new BadRequestException('Failed to create password reset token');
    }

    this.logger.log(`Password reset token created for email: ${email}`);
    return createdToken.token;
  }

  async validateResetToken(token: string) {
    const foundToken = await this.prisma.passwordResetToken.findUnique({
      where: { token }
    });

    if (!foundToken || foundToken.used || foundToken.expires_at < new Date()) {
      this.logger.warn('Invalid or expired reset token');
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const decoded = this.jwtService.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { email: decoded.email }
    });

    if (!user) {
      this.logger.warn('User not found for the provided token');
      throw new UnauthorizedException('User not found for the provided token');
    }

    this.logger.log('User found for the provided token');
    return user;
  }

  async remove(id: number) {
    await this.findOne(id);

    this.logger.log(`Removing user with id: ${id}`);
    const deletedUser = await this.prisma.user.delete({
      where: { user_id: id }
    });

    if (!deletedUser) {
      this.logger.error(`Failed to delete user with id: ${id}`);
      throw new BadRequestException('Failed to delete user');
    }

    this.logger.log(`User with id: ${id} deleted successfully`);
    return deletedUser;
  }

  async logout(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required for logout');
    }

    this.logger.log('Logging out token');
    const decodedToken = this.jwtService.decode(token) as any;
    const expiresAt = new Date(decodedToken.exp * 1000);

    await this.prisma.blacklisted_token.create({
      data: {
        token,
        expires_at: expiresAt
      }
    });

    this.logger.log('Token logged out successfully');
    return { statusCode: HttpStatus.OK };
  }

  async isTokenBlacklisted(token: string) {

    this.logger.log('Checking if token is blacklisted');
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    this.logger.log(`Checking if token is blacklisted: ${token}`);
    const blacklistedToken = await this.prisma.blacklisted_token.findUnique({
      where: { token }
    });

    this.logger.log(`Token is ${blacklistedToken ? '' : 'not '} blacklisted`);
    return !!blacklistedToken;
  }
}
