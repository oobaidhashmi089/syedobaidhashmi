import { Injectable, signal } from '@angular/core';
import {
  DEFAULT_DESIGN,
  DEFAULT_RESUME_MODEL,
  DEFAULT_SECTIONS,
  JobEntry,
  ResumeDesign,
  ResumeModel,
  SectionVisibility,
} from './resume.types';

const STORAGE_KEY = 'ats-resume-studio-v1';

export interface WorkspaceSnapshot {
  model: ResumeModel;
  design: ResumeDesign;
  sections: SectionVisibility;
}

@Injectable({ providedIn: 'root' })
export class ResumeWorkspaceService {
  readonly model = signal<ResumeModel>(structuredClone(DEFAULT_RESUME_MODEL));
  readonly design = signal<ResumeDesign>({ ...DEFAULT_DESIGN });
  readonly sections = signal<SectionVisibility>({ ...DEFAULT_SECTIONS });

  private history: string[] = [];
  private histIdx = -1;

  constructor() {
    this.loadFromStorage();
    this.bootstrapHistory();
  }

  private bootstrapHistory(): void {
    this.history = [this.serialize()];
    this.histIdx = 0;
  }

  serialize(): string {
    const snap: WorkspaceSnapshot = {
      model: this.model(),
      design: this.design(),
      sections: this.sections(),
    };
    return JSON.stringify(snap);
  }

  importSnapshot(json: string): void {
    const o = JSON.parse(json) as WorkspaceSnapshot;
    this.model.set(o.model);
    this.design.set({ ...DEFAULT_DESIGN, ...o.design });
    this.sections.set({ ...DEFAULT_SECTIONS, ...o.sections });
    this.persist();
    this.bootstrapHistory();
  }

  applyFromStoragePayload(raw: string): void {
    const o = JSON.parse(raw) as WorkspaceSnapshot;
    this.model.set(o.model);
    this.design.set({ ...DEFAULT_DESIGN, ...o.design });
    this.sections.set({ ...DEFAULT_SECTIONS, ...o.sections });
  }

  exportSnapshot(): WorkspaceSnapshot {
    return JSON.parse(this.serialize()) as WorkspaceSnapshot;
  }

  snapshot(): void {
    const payload = this.serialize();
    this.history = this.history.slice(0, this.histIdx + 1);
    this.history.push(payload);
    if (this.history.length > 60) {
      this.history.shift();
    }
    this.histIdx = this.history.length - 1;
  }

  undo(): boolean {
    if (this.histIdx <= 0) return false;
    this.histIdx--;
    this.applySerialized(this.history[this.histIdx]);
    return true;
  }

  redo(): boolean {
    if (this.histIdx >= this.history.length - 1) return false;
    this.histIdx++;
    this.applySerialized(this.history[this.histIdx]);
    return true;
  }

  canUndo(): boolean {
    return this.histIdx > 0;
  }

  canRedo(): boolean {
    return this.histIdx < this.history.length - 1;
  }

  persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.serialize());
    } catch {
      /* ignore quota */
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.applyFromStoragePayload(raw);
        return;
      }
    } catch {
      /* ignore */
    }
    this.model.set(structuredClone(DEFAULT_RESUME_MODEL));
    this.design.set({ ...DEFAULT_DESIGN });
    this.sections.set({ ...DEFAULT_SECTIONS });
  }

  private applySerialized(s: string): void {
    const o = JSON.parse(s) as WorkspaceSnapshot;
    this.model.set(o.model);
    this.design.set({ ...DEFAULT_DESIGN, ...o.design });
    this.sections.set({ ...DEFAULT_SECTIONS, ...o.sections });
  }

  resetDefaults(): void {
    this.model.set(structuredClone(DEFAULT_RESUME_MODEL));
    this.design.set({ ...DEFAULT_DESIGN });
    this.sections.set({ ...DEFAULT_SECTIONS });
    this.persist();
    this.bootstrapHistory();
  }

  newJob(): JobEntry {
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `j-${Date.now()}`,
      company: 'Company',
      dates: 'Dates',
      role: 'Role title',
      bullets: ['Impact statement with measurable outcome.'],
    };
  }
}
