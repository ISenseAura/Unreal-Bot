import fs from "fs";
import path from "path";

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export class StorageManager {
  root: string;

  constructor(root: string = "./database") {
    this.root = root;

    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
  }

  file(relativePath: string, options: StorageOptions = {}) {
    const full = path.join(this.root, relativePath);
    return new StorageFile(full, options);
  }

  wipeAll(): boolean {
  try {
    if (fs.existsSync(this.root)) {
      fs.rmSync(this.root, { recursive: true, force: true });
    }
    fs.mkdirSync(this.root, { recursive: true });
    return true;
  } catch (err) {
    console.error("[Storage] Failed to wipe storage:", err);
    return false;
  }
}

}

export interface StorageOptions {
  autoSave?: boolean;
  pretty?: boolean;
  backup?: boolean;
}

export class StorageFile {
  filePath: string;
  dir: string;
  ext: ".json" | ".txt";
  data: any;
  autoSave: boolean;
  pretty: boolean;
  backup: boolean;
  writeQueue: Promise<any>;

  constructor(filePath: string, options: StorageOptions = {}) {
    this.filePath = filePath;
    this.dir = path.dirname(filePath);

    const ext = path.extname(filePath).toLowerCase();
    this.ext = ext === ".txt" ? ".txt" : ".json";

    this.data = this.ext === ".json" ? {} : "";
    this.autoSave = options.autoSave ?? true;
    this.pretty = options.pretty ?? true;
    this.backup = options.backup ?? true;
    this.writeQueue = Promise.resolve();

    this.load();
  }

  // ------------------------------------
  // LOAD
  // ------------------------------------
  load() {
    try {
      if (!fs.existsSync(this.dir)) {
        fs.mkdirSync(this.dir, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(
          this.filePath,
          this.ext === ".json" ? "{}" : "",
          "utf8"
        );
        this.data = this.ext === ".json" ? {} : "";
        return;
      }

      const raw = fs.readFileSync(this.filePath, "utf8");

      if (this.ext === ".json") {
        try {
          this.data = JSON.parse(raw || "{}");
        } catch (err) {
          console.error("[Storage] Corrupted JSON:", this.filePath, err);

          if (this.backup) {
            const name = this.filePath + `.corrupted-${Date.now()}`;
            fs.renameSync(this.filePath, name);
            console.warn("[Storage] Backup saved:", name);
          }

          this.data = {};
          fs.writeFileSync(this.filePath, "{}", "utf8");
        }
      } else {
        this.data = raw ?? "";
      }
    } catch (err) {
      console.error("[Storage] LOAD ERROR:", err);
      this.data = this.ext === ".json" ? {} : "";
    }
  }


  async _saveAtomic() {
    const temp = this.filePath + ".tmp";

    try {
      const content =
        this.ext === ".json"
          ? this.pretty
            ? JSON.stringify(this.data, null, 2)
            : JSON.stringify(this.data)
          : this.data;

      fs.writeFileSync(temp, content, "utf8");
      fs.renameSync(temp, this.filePath);
    } catch (err) {
      console.error("[Storage] SAVE ERROR:", err);
    }
  }

  async save() {
    this.writeQueue = this.writeQueue.then(async () => {
      await this._saveAtomic();
      await wait(10);
    });

    return this.writeQueue;
  }

  // ------------------------------------
  // JSON API
  // ------------------------------------
  get(key: string, def: any = null) {
    if (this.ext !== ".json") return null;
    return this.data[key] ?? def;
  }

  set(key: string, value: any) {
    if (this.ext !== ".json") return;
    this.data[key] = value;
    if (this.autoSave) this.save();
    return value;
  }

  delete(key: string): boolean {
    if (this.ext !== ".json") return false;
    const exists = key in this.data;
    if (exists) delete this.data[key];
    if (this.autoSave) this.save();
    return exists;
  }

  push(key: string, value: any) {
    if (this.ext !== ".json") return;
    if (!Array.isArray(this.data[key])) this.data[key] = [];
    this.data[key].push(value);
    if (this.autoSave) this.save();
    return this.data[key];
  }

  replace(obj: Record<string, any>) {
    if (this.ext !== ".json") return;
    this.data = obj;
    if (this.autoSave) this.save();
  }

  all() {
    if (this.ext !== ".json") return null;
    return { ...this.data };
  }

  // ------------------------------------
  // TEXT API
  // ------------------------------------
  read(): string | null {
    if (this.ext !== ".txt") return null;
    return this.data;
  }

  write(text: string) {
    if (this.ext !== ".txt") return;
    this.data = text ?? "";
    if (this.autoSave) this.save();
  }

  append(text: string) {
    if (this.ext !== ".txt") return;
    this.data += text ?? "";
    if (this.autoSave) this.save();
  }

  appendLine(text: string) {
    if (this.ext !== ".txt") return;
    this.data += (text ?? "") + "\n";
    if (this.autoSave) this.save();
  }

  clear() {
    if (this.ext !== ".txt") return;
    this.data = "";
    if (this.autoSave) this.save();
  }
}
