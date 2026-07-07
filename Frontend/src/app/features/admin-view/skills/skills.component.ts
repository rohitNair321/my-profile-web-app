import { ChangeDetectionStrategy, Component, computed, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';
import { splitTokens, mergeTokens } from 'src/app/shared/utils/split-tokens';

interface SkillItem { name: string; proficiency: number; }
interface SkillCategory { cat: string; icon: string; color: string; items: SkillItem[]; }

const CATEGORY_COLORS = ['#10B981', '#6366F1', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6'];

@Component({
  selector: 'app-admin-skills',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './skills.component.html',
  styleUrls: ['./skills.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSkillsComponent extends CommonApp {
  saving  = signal(false);
  savedOk = signal(false);

  // Add/edit form state
  newSkill = signal('');
  editIdx  = signal<number | null>(null);

  categories = computed<SkillCategory[]>(() => {
    const skills: string[] = this.appService.profile()?.skills ?? [];
    if (!skills.length) return this._staticFallback();

    // All profile skills land in one 'Skills' bucket (no categories/proficiency in current DB schema)
    return [{
      cat: 'Skills', icon: 'code', color: '#10B981',
      items: skills.map(name => ({ name, proficiency: 0 })),
    }];
  });

  constructor(public override injector: Injector) {
    super(injector);
  }

  addSkill(): void {
    // Accepts a single skill OR a pasted bundle ("Angular, TypeScript; RxJS")
    const incoming = splitTokens(this.newSkill());
    if (!incoming.length) return;
    const { list, skipped } = mergeTokens(this._currentSkills(), incoming, { maxLen: 40 });
    this.newSkill.set('');
    if (skipped && list.length === this._currentSkills().length) return; // nothing new to add
    this._saveSkills(list);
  }

  removeSkill(name: string): void {
    this._saveSkills(this._currentSkills().filter(s => s !== name));
  }

  private _currentSkills(): string[] {
    return this.appService.profile()?.skills ?? [];
  }

  private _saveSkills(skills: string[]): void {
    this.saving.set(true);
    const fd = new FormData();
    fd.append('skills', JSON.stringify(skills));
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Skills updated').subscribe({
      next: () => {
        this.saving.set(false);
        this.savedOk.set(true);
        setTimeout(() => this.savedOk.set(false), 2000);
      },
      error: () => this.saving.set(false),
    });
  }

  private _staticFallback(): SkillCategory[] {
    return [
      {
        cat: 'Frontend', icon: 'code', color: '#10B981',
        items: [
          { name: 'Angular',    proficiency: 0 },
          { name: 'TypeScript', proficiency: 0 },
          { name: 'SCSS / CSS', proficiency: 0 },
          { name: 'RxJS',       proficiency: 0 },
        ],
      },
    ];
  }
}
