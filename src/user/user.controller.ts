import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { hash } from 'bcrypt';
import { UserTypeService } from 'src/user_type/user_type.service';
import { UserUserTypeService } from 'src/user_user_type/user_user_type.service';
import { UserType } from 'generated/prisma';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { LoginResponse } from './entities/login-response';
import { Public } from './jwt/public.decorator';
import { MailService } from 'src/mail/mail.service';

@Controller('user')
export class UserController {

  constructor(private readonly userService: UserService, 
              private readonly userType: UserTypeService, 
              private readonly userUserType: UserUserTypeService,
              private readonly mailService: MailService) {}
  
  @Public()
  @Post()
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created successfully', type: User })
  @ApiResponse({ status: 400, description: 'Invalid user type ID or user type not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      let userType: UserType | null = null;

      const { user_type_id } = createUserDto;

      if (user_type_id) {

        if (isNaN(user_type_id)) {
          throw new HttpException('Invalid user type ID', 400);
        }

        userType = await this.userType.findOne(user_type_id);

        if (!userType) {
          throw new HttpException('User type not found', 404);
        }
      }

      const { password } = createUserDto;

      const hashedPassword = await hash(password, 10);

      const newUser = { ...createUserDto, password: hashedPassword };

      const user = await this.userService.create(newUser);

      if (userType) {
        await this.userUserType.create({ user_id: user.user_id, user_type_id: userType.user_type_id });
      }

      return {
        statusCode: HttpStatus.CREATED,
        message: 'User created successfully',
        data: {
          user,
          userType
        }
      }
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'User creation failed',
        error: error.message || 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  @Public()
  @Post('login')
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: LoginResponse })
  @ApiResponse({ status: 400, description: 'Email and password are required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async login(@Body() loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;

      if (!email || !password) {
        throw new HttpException('Email and password are required', HttpStatus.BAD_REQUEST);
      }

      const user = await this.userService.findByEmail(email);

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const loginUser = await this.userService.login(email, password);

      if (!loginUser) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Login successful',
        data: loginUser
      };

    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Login failed',
        error: error.message || 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @Get()
  @ApiResponse({ status: 200, description: 'List of users', type: [User] })
  @ApiResponse({ status: 404, description: 'No users found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findAll() {
    try {
      const users = await this.userService.findAll();
      if (!users || users.length === 0) {
        return {
          statusCode: HttpStatus.OK,
          message: 'No users found',
          data: []
        }
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Users retrieved successfully',
        data: users
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve users',
        error: error.message || 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  @Public()
  @Get(':id')
  @ApiResponse({ status: 200, description: 'User retrieved successfully', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findOne(@Param('id') id: string) {
    try {
      const user = await this.userService.findOne(+id);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'User retrieved successfully',
        data: user
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve user',
        error: error.message || 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @Post('forgot-password')
  @ApiResponse({ status: 200, description: 'Password reset link sent' })
  @ApiResponse({ status: 400, description: 'Email is required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async forgotPassword(@Body('email') email: string) {
    try {
      if (!email) {
        throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
      }

      const token = await this.userService.emailExists(email);

      if (!token) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      await this.mailService.sendPasswordResetEmail(email, token);
      
      return {
        statusCode: HttpStatus.OK,
        message: 'Password reset link sent successfully',
        data: null
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to send password reset link',
        error: error.message || 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id')
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'User updated successfully', type: User })
  @ApiResponse({ status: 400, description: 'Invalid user type ID or user type not found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const updatedUser = await this.userService.update(+id, updateUserDto);
      if (!updatedUser) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'User updated successfully',
        data: updatedUser
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update user',
        error: error.message || 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id/password')
  @ApiResponse({ status: 200, description: 'Password updated successfully', type: User })
  @ApiResponse({ status: 400, description: 'Invalid user ID or password' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updatePassword(@Param('user_id') user_id: string, @Body() newPassword: string) {
    try {
      const updatedUser = await this.userService.updatePassword(+user_id, newPassword);
      if (!updatedUser) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Password updated successfully',
        data: updatedUser
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update password',
        error: error.message || 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
