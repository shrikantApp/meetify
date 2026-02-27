import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    async create(data: { name: string; email: string; password: string }): Promise<User> {
        const user = this.usersRepository.create({
            name: data.name,
            email: data.email,
            password: data.password,
        });
        return this.usersRepository.save(user);
    }

    // Standard lookup by ID (no password field)
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
}
