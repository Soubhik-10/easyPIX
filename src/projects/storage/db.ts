import Dexie, { type Table } from "dexie";
import type { PixelProject } from "../types";

export type ProjectRevision = {
  id: string;
  projectId: string;
  createdAt: string;
  label: string;
  project: PixelProject;
};

export class PixelDb extends Dexie {
  projects!: Table<PixelProject, string>;
  revisions!: Table<ProjectRevision, string>;

  constructor() {
    super("pixel-art-editor");
    this.version(1).stores({
      projects: "id, name, updatedAt",
    });
    this.version(2).stores({
      projects: "id, name, updatedAt",
      revisions: "id, projectId, createdAt, [projectId+createdAt]",
    });
  }
}

export const db = new PixelDb();

export const listProjects = () => db.projects.orderBy("updatedAt").reverse().toArray();
export const saveProject = (project: PixelProject) =>
  db.projects.put({ ...project, updatedAt: new Date().toISOString() });
export const loadProject = (id: string) => db.projects.get(id);
export const deleteProject = async (id: string) => {
  await db.transaction("rw", db.projects, db.revisions, async () => {
    await db.projects.delete(id);
    await db.revisions.where("projectId").equals(id).delete();
  });
};

export const listProjectRevisions = async (projectId: string) => {
  const revisions = await db.revisions.where("projectId").equals(projectId).toArray();
  return revisions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
};

const revisionWriteTimes = new Map<string, number>();

export const saveProjectRevision = async (project: PixelProject, label = "Autosave", minimumIntervalMs = 120_000) => {
  const cachedAt = revisionWriteTimes.get(project.id) ?? 0;
  if (minimumIntervalMs > 0 && Date.now() - cachedAt < minimumIntervalMs) return undefined;
  const existing = await db.revisions.where("projectId").equals(project.id).toArray();
  const latest = existing.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (minimumIntervalMs > 0 && latest?.project.updatedAt === project.updatedAt) {
    revisionWriteTimes.set(project.id, Date.now());
    return latest;
  }
  if (latest && Date.now() - new Date(latest.createdAt).getTime() < minimumIntervalMs) return latest;
  const createdAt = new Date().toISOString();
  const revision: ProjectRevision = {
    id: `${project.id}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
    projectId: project.id,
    createdAt,
    label,
    project: JSON.parse(JSON.stringify({ ...project, updatedAt: createdAt })) as PixelProject,
  };
  await db.revisions.put(revision);
  revisionWriteTimes.set(project.id, Date.now());
  const all = await db.revisions.where("projectId").equals(project.id).toArray();
  const old = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(12);
  if (old.length) await db.revisions.bulkDelete(old.map((entry) => entry.id));
  return revision;
};

export const deleteProjectRevision = (id: string) => db.revisions.delete(id);
