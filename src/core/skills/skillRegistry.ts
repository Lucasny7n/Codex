import { Skill } from './skillTypes';
import { builtinSkills } from './builtinSkills';

class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  constructor() {
    builtinSkills.forEach(skill => this.register(skill));
  }

  register(skill: Skill) {
    this.skills.set(skill.id, skill);
  }

  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }
}

export const skillRegistry = new SkillRegistry();
