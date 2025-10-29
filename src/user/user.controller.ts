import { Controller, Get, Post, Body, Patch, Param, NotFoundException, Logger, ParseIntPipe, Delete, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto'; 
import { Public } from './jwt/public.decorator';
import { MailService } from 'src/mail/mail.service';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { JwtAuthGuard } from './jwt/jwt.auth.guard';
import { Request } from 'express';

@Controller('user')
export class UserController {

  private readonly logger = new Logger('UserController');

  constructor(private readonly userService: UserService,
              private readonly mailService: MailService) {}

  @Public()
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    this.logger.log(`Creating user: ${createUserDto.name}`);
    return await this.userService.create(createUserDto);
  }
  
  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Attempting login for user: ${loginDto.email}`);
    return await this.userService.login(loginDto);
  }
  
  @Public()
  @Post('logout')
  async logout(@Body('accessToken') token: string) {
    this.logger.log(`Logging out token: ${token}`);
    return await this.userService.logout(token);
  }

  @Public()
  @Post('validateToken')
  async isTokenBlacklisted(@Body('accessToken') token: string) {
    this.logger.log(`Validating token...`);
    return await this.userService.isTokenBlacklisted(token);
  }
  
  @Get()
  async findAll() {
    this.logger.log('Fetching all users');
    return await this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    // JwtStrategy.validate devuelve { userId, email }
    const { userId } = req.user as any;
    const res = await this.userService.findOne(Number(userId));
    return res;
  }
  
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: string) {
    this.logger.log(`Fetching user with ID: ${id}`);
    return await this.userService.findOne(+id);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto) {
    this.logger.log(`Updating user with ID: ${id}`);
    return await this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Deleting user with ID: ${id}`);
    return await this.userService.remove(id);
  }

  @Post('reset-password')
  async updatePassword(@Body() resetPasswordDto: ResetPasswordDto) {
    this.logger.log('Processing password reset');
    return await this.userService.updatePassword(resetPasswordDto);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    
    this.logger.log('Processing forgot password request');
    const token = await this.userService.emailExists(email);

    if (!token) {
      this.logger.warn(`User with email ${email} not found`);
      throw new NotFoundException('User with the provided email does not exist');
    }

    return await this.mailService.sendPasswordResetEmail(email, token);
  }
}
