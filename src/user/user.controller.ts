import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
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
import { UpdateUserDto } from './dto/update-user.dto';

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
    const { email, password } = loginDto;

    if (!email || !password) {
      throw new HttpException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'El correo electrónico y la contraseña son obligatorios.'
      }, HttpStatus.BAD_REQUEST);
    }

    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new HttpException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No hemos encontrado un usuario con ese correo electrónico.'
      }, HttpStatus.NOT_FOUND);
    }

    const loginUser = await this.userService.login(email, password);

    if (!loginUser) {
      throw new HttpException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Credenciales incorrectas.'
      }, HttpStatus.UNAUTHORIZED);
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Autenticación exitosa',
      data: loginUser
    };
  }


  @Public()
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 400, description: 'Token is required' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @Post('logout')
  async logout(@Body('accessToken') token: string) {
    try {

      if (!token) {
        throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
      }

      await this.userService.logout(token);
      return {
        statusCode: HttpStatus.OK,
        message: 'Logout successful',
        data: null
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Logout failed',
        error: error.message || 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Token check successful', type: Boolean })
  @ApiResponse({ status: 400, description: 'Token is required' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @Post('validateToken')
  async isTokenBlacklisted(@Body('accessToken') token: string) {
    try {
      if (!token) {
        throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
      }

      const isBlacklisted = await this.userService.isTokenBlacklisted(token);

      return {
        statusCode: HttpStatus.OK,
        message: 'Token check successful',
        data: { isBlacklisted }
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to check token',
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
  @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string' } } } })
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
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {

      let hashedPassword: string;

      const { password } = updateUserDto;

      if (password) {
        hashedPassword = await hash(password, 10);
        updateUserDto.password = hashedPassword;
      } else {
        const existingUser = await this.userService.findOne(+id);
        if (!existingUser) {
          throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        }
        updateUserDto.password = existingUser.password;
      }

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

  @Post('reset-password')
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password updated successfully'})
  @ApiResponse({ status: 400, description: 'Invalid user ID or password' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updatePassword(@Body() resetPasswordDto: ResetPasswordDto) {
    try {
      const { accessToken, newPassword } = resetPasswordDto;

      if (!accessToken || !newPassword) {
        throw new HttpException('Token and new password are required', HttpStatus.BAD_REQUEST);
      }

      const user = await this.userService.validateResetToken(accessToken);

      if (!user) {
        throw new HttpException('Invalid or expired token', HttpStatus.NOT_FOUND);
      }

      const hashedPassword = await hash(newPassword, 10);
      
      const updatedUser = await this.userService.updatePassword(user.user_id, hashedPassword, accessToken);
      
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
