import {
  PaginationQueryDto,
  SearchPaginationQueryDto,
} from 'src/common/pagination';

export class ListStaffPeopleQueryDto extends SearchPaginationQueryDto {}

export class ListStaffPayrollsQueryDto extends PaginationQueryDto {}
