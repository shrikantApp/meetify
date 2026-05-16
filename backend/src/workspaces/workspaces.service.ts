import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember, WorkspaceRole } from './entities/workspace-member.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private workspacesRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private workspaceMembersRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createWorkspace(userId: string, name: string): Promise<Workspace> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate slug from name
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (!slug) slug = 'workspace';
    
    // Ensure slug is unique
    let isUnique = false;
    let counter = 1;
    let finalSlug = slug;
    
    while (!isUnique) {
      const existing = await this.workspacesRepository.findOne({ where: { slug: finalSlug } });
      if (!existing) {
        isUnique = true;
      } else {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
    }

    // Create Workspace
    const workspace = this.workspacesRepository.create({
      name,
      slug: finalSlug,
      ownerId: userId,
    });
    
    const savedWorkspace = await this.workspacesRepository.save(workspace);

    // Create Owner Member
    const member = this.workspaceMembersRepository.create({
      workspaceId: savedWorkspace.id,
      userId: userId,
      role: WorkspaceRole.OWNER,
    });
    
    await this.workspaceMembersRepository.save(member);

    return savedWorkspace;
  }

  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const members = await this.workspaceMembersRepository.find({
      where: { userId },
      relations: ['workspace'],
    });
    
    return members.map(m => m.workspace);
  }

  async getWorkspaceById(id: string, userId: string): Promise<Workspace> {
    const member = await this.workspaceMembersRepository.findOne({
      where: { workspaceId: id, userId },
      relations: ['workspace'],
    });

    if (!member) {
      throw new NotFoundException('Workspace not found or you are not a member');
    }

    return member.workspace;
  }
}
