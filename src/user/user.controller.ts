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
import { CreateUserUserTypeDto } from 'src/user_user_type/dto/create-user_user_type.dto';
import { ResetPasswordDto } from './dto/resetPassword.dto';

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

      if (!user_type_id) {
        throw new HttpException('User type ID is required', 400);
      }

      if (isNaN(user_type_id)) {
        throw new HttpException('Invalid user type ID', 400);
      }

      userType = await this.userType.findOne(user_type_id);

      if (!userType) {
        throw new HttpException('User type not found', 404);
      }

      const existingUser = await this.userService.findByEmail(createUserDto.email);
      
      if (existingUser) {
        throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
      }

      const { password } = createUserDto;

      const hashedPassword = await hash(password, 10);

      const newUser = { 
        name: createUserDto.name,
        last_name: createUserDto.last_name,
        email: createUserDto.email,
        password: hashedPassword,
      };

      const user = await this.userService.create(newUser);

      if (!user) {
        throw new HttpException('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const payloadUserUserType: CreateUserUserTypeDto = {
        user_id: user.user_id,
        user_type_id: userType.user_type_id
      }

      const userUserType = await this.userUserType.create(payloadUserUserType);

      if (!userUserType) {
        throw new HttpException('Failed to assign user type', HttpStatus.INTERNAL_SERVER_ERROR);
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

      const usersWithTypes = await Promise.all(
        users.map(async (user) => {
          const userUserType = await this.userUserType.findByUserId(user.user_id);
          if (!userUserType) {
            return { user, userUserType: null };
          }

          const userType = await this.userType.findOne(userUserType.user_type_id);
          if (!userType) {
            return { user, userUserType, userType: null };
          }

          return { user, userType };
        })
      );
      return {
        statusCode: HttpStatus.OK,
        message: 'Users retrieved successfully',
        data: usersWithTypes
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

      const userUserType = await this.userUserType.findByUserId(user.user_id);

      const userType = userUserType ? await this.userType.findOne(userUserType.user_type_id) : null;      

      return {
        statusCode: HttpStatus.OK,
        message: 'User retrieved successfully',
        data: { user, userType }
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

  @Public()
  @Patch('password-reset')
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password updated successfully'})
  @ApiResponse({ status: 400, description: 'Invalid user ID or password' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updatePassword(@Body() resetPasswordDto: ResetPasswordDto) {
    try {
      const { token, newPassword } = resetPasswordDto;

      if (!token || !newPassword) {
        throw new HttpException('Token and new password are required', HttpStatus.BAD_REQUEST);
      }

      const user = await this.userService.validateResetToken(token);

      if (!user) {
        throw new HttpException('Invalid or expired token', HttpStatus.NOT_FOUND);
      }

      const hashedPassword = await hash(newPassword, 10);
      
      const updatedUser = await this.userService.updatePassword(user.user_id, hashedPassword, token);
      
      if (!updatedUser) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return {
        statusCode: HttpStatus.OK,
        message: 'Password updated successfully',
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
