/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsNotEmpty, IsString } from 'class-validator';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class GetPresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;
}

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned')
  async getPresignedUrl(@Req() req: any, @Body() body: GetPresignedUrlDto) {
    const { category, fileKey } = await this.uploadsService.prepareUpload(
      body.fileName,
      body.mimeType,
    );
    const origin = `${req.protocol}://${req.get('host')}`;
    return {
      url: `${origin}/api/uploads/local/${category}/${fileKey}`,
      method: 'POST',
      fieldName: 'file',
      fileKey,
      category,
      publicUrl: this.uploadsService.getFileUrl(category, fileKey, origin),
    };
  }

  @Post('local/:category/:fileKey')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLocalFile(
    @Req() req: any,
    @Param('category') category: string,
    @Param('fileKey') fileKey: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.uploadsService.saveUploadedFile(category, fileKey, file);
    const origin = `${req.protocol}://${req.get('host')}`;
    return {
      success: true,
      publicUrl: this.uploadsService.getFileUrl(category, fileKey, origin),
    };
  }
}
