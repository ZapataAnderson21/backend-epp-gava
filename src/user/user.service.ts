import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from 'generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginResponse } from './entities/login-response';

@Injectable()
export class UserService {

  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const newUser = await this.prisma.user.create({
      data: createUserDto
    });

    if(!newUser) {
      throw new Error('User creation failed');
    }

    return newUser;
  }

  async login(email: string, password: string): Promise<LoginResponse | null> {
    let user = await this.prisma.user.findUnique({
      where: { email: email }
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    const payload = { userId: user.user_id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    user = { ...user, password: '' };

    return {
      user,
      accessToken
    };
  }

  async findAll(): Promise<User[]> {
    const foundUsers = await this.prisma.user.findMany();

    if (!foundUsers || foundUsers.length === 0) {
      return [];
    }

    return foundUsers.map(user => ({
      ...user,
      password: '',
    })) as User[];
  }

  async findOne(id: number): Promise<User | null> {
    const foundUser = await this.prisma.user.findUnique({
      where: { user_id: id },
      include: {
        userUserTypes: {
          include: {
            userType: true
          }
        }
      }
    });

    if (!foundUser) {
      return null;
    }

    return foundUser;
  }

  async findByEmail(email: string): Promise<User | null> {
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

    return foundUser;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User | null> {
    const updatedUser = await this.prisma.user.update({
      where: { user_id: id },
      data: updateUserDto
    });

    if (!updatedUser) {
      return null;
    }

    return updatedUser;
  }

  async updatePassword(user_id: number, newPassword: string): Promise<User | null> {
    const updatedUser = await this.prisma.user.update({
      where: { user_id },
      data: { password: newPassword }
    });
    if (!updatedUser) {
      return null;
    }
    return updatedUser;
  }

  async emailExists(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email }
    });
    
    if (!user) {
      return null;
    }

    const createdToken = await this.prisma.passwordResetToken.create({
      data: {
        user_id: user.user_id,
        token: this.jwtService.sign({ email: user.email }),
        expires_at: new Date(Date.now() + 3600000)
      }
    });

    return createdToken.token;
  }

  async validateResetToken(token: string): Promise<User | null> {
    const foundToken = await this.prisma.passwordResetToken.findUnique({
      where: { token }
    });

    if (!foundToken || foundToken.used || foundToken.expires_at < new Date()) {
      return null;
    }

    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { email: decoded.email }
      });
      return user;
    } catch (err) {
      return null;
    }
  }

  async remove(id: number): Promise<User | null> {
    const deletedUser = await this.prisma.user.delete({
      where: { user_id: id }
    });

    if (!deletedUser) {
      return null;
    }

    return deletedUser;
  }

  async logout(token: string): Promise<void> {
    const decodedToken = this.jwtService.decode(token) as any;
    const expiresAt = new Date(decodedToken.exp * 1000);

    await this.prisma.blacklisted_token.create({
      data: {
        token,
        expires_at: expiresAt
      }
    });
  }
}
