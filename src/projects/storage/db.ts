import Dexie, { type Table } from "dexie";
import type { PixelProject } from "../types";

export class PixelDb extends Dexie {
  projects!: Table<PixelProject, string>;

  constructor() {
    super("pixel-art-editor");
    this.version(1).stores({
      projects: "id, name, updatedAt",
    });
  }
}

export const db = new PixelDb();

export const listProjects = () => db.projects.orderBy("updatedAt").reverse().toArray();
export const saveProject = (project: PixelProject) =>
  db.projects.put({ ...project, updatedAt: new Date().toISOString() });
export const loadProject = (id: string) => db.projects.get(id);
export const deleteProject = (id: string) => db.projects.delete(id);
