import { IsOptional, IsString, Length } from 'class-validator';

export class CreateJoinRequestDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  message?: string;
}
