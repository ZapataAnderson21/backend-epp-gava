import { Controller, Get, Post, Body, Patch, Param, NotFoundException, HttpStatus, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserTypeService } from 'src/user_type/user_type.service';
import { UserUserTypeService } from 'src/user_user_type/user_user_type.service';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { LoginResponse } from './entities/login-response';  
import { Public } from './jwt/public.decorator';
import { MailService } from 'src/mail/mail.service';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserTypes } from 'src/decorators/user-types.decorator';

@Controller('user')
export class UserController {

  private readonly logger = new Logger('UserController');

  constructor(private readonly userService: UserService, 
              private readonly userType: UserTypeService, 
              private readonly userUserType: UserUserTypeService,
              private readonly mailService: MailService) {}
  
  @Public()
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  @Post()
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User created successfully', type: User })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid user type ID or user type not found' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already exists' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto);
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
    return await this.userService.login(loginDto);
  }
  
  @Public()
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 400, description: 'Token is required' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @Post('logout')
  async logout(@Body('accessToken') token: string) {
    return await this.userService.logout(token);
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Token check successful', type: Boolean })
  @ApiResponse({ status: 400, description: 'Token is required' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  @Post('validateToken')
  async isTokenBlacklisted(@Body('accessToken') token: string) {
    return await this.userService.isTokenBlacklisted(token);
  }


  @Get()
  @ApiResponse({ status: 200, description: 'List of users', type: [User] })
  @ApiResponse({ status: 404, description: 'No users found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findAll() {
    this.logger.log('Retrieving all users');
    return await this.userService.findAll();
  }

  
  @Get(':id')
  @ApiResponse({ status: 200, description: 'User retrieved successfully', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(+id);
  }

  @Public()
  @Post('forgot-password')
  @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Password reset link sent' })
  @ApiResponse({ status: 400, description: 'Email is required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async forgotPassword(@Body('email') email: string) {
    
    this.logger.log('Processing forgot password request');
    
    const token = await this.userService.emailExists(email);

    if (!token) {
      this.logger.warn(`User with email ${email} not found`);
      throw new NotFoundException('User with the provided email does not exist');
    }

    return await this.mailService.sendPasswordResetEmail(email, token);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'User updated successfully', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return await this.userService.update(+id, updateUserDto);
  }

  @Post('reset-password')
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password updated successfully'})
  @ApiResponse({ status: 400, description: 'Invalid user ID or password' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updatePassword(@Body() resetPasswordDto: ResetPasswordDto) {

    return await this.userService.updatePassword(resetPasswordDto);
  }
}
