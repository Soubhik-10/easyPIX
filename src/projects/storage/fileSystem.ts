import type { PixelProject } from "../types";

type FileSaveState = {
  connected: boolean;
  folderName: string | null;
};

type FolderProjectImport = FileSaveState & {
  project: PixelProject;
};

let activeDirectory: FileSystemDirectoryHandle | null = null;

export const fileSystemProjectSaveSupported = () =>
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

const safeFileName = (value: string) =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72) || "easypix-project";

const requestWritePermission = async (handle: FileSystemDirectoryHandle) => {
  const options = { mode: "readwrite" as const };
  if ((await handle.queryPermission?.(options)) === "granted") return true;
  return (await handle.requestPermission?.(options)) === "granted";
};

const writeFile = async (directory: FileSystemDirectoryHandle, name: string, body: Blob | string) => {
  const fileHandle = await directory.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(body);
  await writable.close();
};

export const chooseFileSystemProjectFolder = async (project: PixelProject): Promise<FileSaveState> => {
  if (!fileSystemProjectSaveSupported()) {
    throw new Error("Folder autosave needs Chrome or Edge on desktop.");
  }
  const picker = window.showDirectoryPicker;
  if (!picker) throw new Error("Folder picker is not available.");
  const directory = await picker({
    id: "easypix-project-folder",
    mode: "readwrite",
  });
  if (!(await requestWritePermission(directory))) {
    throw new Error("easyPIX needs write permission for that folder.");
  }
  activeDirectory = directory;
  await writeProjectToFileSystem(project);
  return { connected: true, folderName: directory.name };
};

export const importFileSystemProjectFolder = async (): Promise<FolderProjectImport> => {
  if (!fileSystemProjectSaveSupported()) {
    throw new Error("Project folder import needs Chrome or Edge on desktop.");
  }
  const picker = window.showDirectoryPicker;
  if (!picker) throw new Error("Folder picker is not available.");
  const directory = await picker({
    id: "easypix-project-folder",
    mode: "readwrite",
  });
  const fileHandle = await directory.getFileHandle("project.json");
  const file = await fileHandle.getFile();
  const project = JSON.parse(await file.text()) as PixelProject;
  if (!(await requestWritePermission(directory))) {
    throw new Error("easyPIX needs write permission to keep autosaving to that folder.");
  }
  activeDirectory = directory;
  await writeProjectToFileSystem(project);
  return { connected: true, folderName: directory.name, project };
};

export const writeProjectToFileSystem = async (project: PixelProject) => {
  if (!activeDirectory) return null;
  if (!(await requestWritePermission(activeDirectory))) {
    activeDirectory = null;
    throw new Error("Folder autosave permission was lost. Choose the project folder again.");
  }
  const snapshot = { ...project, updatedAt: new Date().toISOString() };
  try {
    const currentHandle = await activeDirectory.getFileHandle("project.json");
    const currentFile = await currentHandle.getFile();
    if (currentFile.size > 0) await writeFile(activeDirectory, "project.backup.json", await currentFile.text());
  } catch {
    // A new project folder has no previous snapshot yet.
  }
  await writeFile(activeDirectory, "project.json", JSON.stringify(snapshot, null, 2));
  await writeFile(
    activeDirectory,
    "README.txt",
    [
      "easyPIX project folder",
      "",
      "project.json is autosaved by easyPIX when folder autosave is connected.",
      "project.backup.json contains the previous successful folder save.",
      "Keep this folder backed up if the artwork matters.",
      "",
      `Project: ${project.name}`,
      `Safe export name: ${safeFileName(project.name)}`,
    ].join("\n"),
  );
  return { connected: true, folderName: activeDirectory.name };
};

export const disconnectFileSystemProjectFolder = () => {
  activeDirectory = null;
};
