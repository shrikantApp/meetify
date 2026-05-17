import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    async create(data: { name: string; email: string; password: string }): Promise<User> {
        const user = this.usersRepository.create({
            name: data.name,
            fullName: data.name,
            email: data.email,
            password: data.password,
        });
        return this.usersRepository.save(user);
    }

    // Standard lookup by ID (no password field)
    async updateStatus(id: string, isOnline: boolean, lastSeen?: Date): Promise<void> {
        await this.usersRepository.update(id, { isOnline, lastSeen });
    }

    async searchUsers(query: string): Promise<User[]> {
        return this.usersRepository
            .createQueryBuilder('user')
            .where('user.name ILIKE :q', { q: `%${query}%` })
            .orWhere('user.email ILIKE :q', { q: `%${query}%` })
            .limit(10)
            .getMany();
    }

    async findOne(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    // Used for duplicate email check during registration
    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    // Explicitly selects password field for login comparison
    async findByEmailWithPassword(email: string): Promise<User | null> {
        return this.usersRepository
            .createQueryBuilder('user')
            .addSelect('user.password')
            .where('user.email = :email', { email })
            .getOne();
    }

    async searchByName(query: string, limit = 20): Promise<User[]> {
        return this.usersRepository
            .createQueryBuilder('user')
            .where('user.name ILIKE :q OR user.email ILIKE :q', { q: `%${query}%` })
            .take(limit)
            .getMany();
    }

    async getUsersByIds(ids: string[]): Promise<User[]> {
        if (!ids.length) return [];
        return this.usersRepository.findByIds(ids);
    }

    async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
        const user = await this.findOne(id);
        if (!user) {
            throw new ConflictException('User not found');
        }

        if (dto.email && dto.email !== user.email) {
            const existing = await this.findByEmail(dto.email);
            if (existing && existing.id !== id) {
                throw new ConflictException('Email already in use');
            }
        }

        Object.assign(user, {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
            ...(dto.email !== undefined ? { email: dto.email } : {}),
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.designation !== undefined ? { designation: dto.designation } : {}),
            ...(dto.phoneNumber !== undefined ? { phoneNumber: dto.phoneNumber } : {}),
            ...(dto.dateOfBirth !== undefined ? { dateOfBirth: dto.dateOfBirth } : {}),
            ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        });

        return this.usersRepository.save(user);
    }
}
