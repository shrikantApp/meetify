import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

type UploadCategory = 'images' | 'videos' | 'audio' | 'documents';

@Injectable()
export class UploadsService {
  private readonly storageRoot = join(process.cwd(), 'storage');

  private getCategoryFromMimeType(mimeType: string): UploadCategory {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'documents';
  }

  private sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  }

  async prepareUpload(fileName: string, mimeType: string) {
    const category = this.getCategoryFromMimeType(mimeType);
    const ext = extname(fileName) || '';
    const baseName = this.sanitizeFileName(fileName.replace(ext, '')) || 'file';
    const fileKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${baseName}${ext}`;

    await fs.mkdir(join(this.storageRoot, category), { recursive: true });

    return { category, fileKey };
  }

  async saveUploadedFile(category: string, fileKey: string, file: Express.Multer.File) {
    const targetDir = join(this.storageRoot, category);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = join(targetDir, fileKey);

    try {
      await fs.writeFile(targetPath, file.buffer);
      return targetPath;
    } catch {
      throw new InternalServerErrorException('Could not save uploaded file');
    }
  }

  getFileUrl(category: string, fileKey: string, origin: string) {
    return `${origin}/api/storage/${category}/${fileKey}`;
  }
}
