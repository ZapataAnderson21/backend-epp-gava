import { Injectable } from '@nestjs/common';
import { CreateUserUserTypeDto } from './dto/create-user_user_type.dto';
import { UpdateUserUserTypeDto } from './dto/update-user_user_type.dto';

@Injectable()
export class UserUserTypeService {
  create(createUserUserTypeDto: CreateUserUserTypeDto) {
    return 'This action adds a new userUserType';
  }

  findAll() {
    return `This action returns all userUserType`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userUserType`;
  }

  update(id: number, updateUserUserTypeDto: UpdateUserUserTypeDto) {
    return `This action updates a #${id} userUserType`;
  }

  remove(id: number) {
    return `This action removes a #${id} userUserType`;
  }
}
