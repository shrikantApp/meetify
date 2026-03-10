import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateMeetingDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsOptional()
    @IsBoolean()
    lobbyEnabled?: boolean;
}
