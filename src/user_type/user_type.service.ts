import { Injectable } from '@nestjs/common';
import { CreateUserTypeDto } from './dto/create-user_type.dto';
import { UpdateUserTypeDto } from './dto/update-user_type.dto';

@Injectable()
export class UserTypeService {
  create(createUserTypeDto: CreateUserTypeDto) {
    return 'This action adds a new userType';
  }

  findAll() {
    return `This action returns all userType`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userType`;
  }

  update(id: number, updateUserTypeDto: UpdateUserTypeDto) {
    return `This action updates a #${id} userType`;
  }

  remove(id: number) {
    return `This action removes a #${id} userType`;
  }
}
