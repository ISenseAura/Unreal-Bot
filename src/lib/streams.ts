/**
 * streams.ts — strict TypeScript rewrite (Node 22.19 compatible)
 *
 * - Strict types
 * - No mutation of caller option objects
 * - Safe runtime narrowing
 * - Preserves the ReadStream / WriteStream / ReadWriteStream / Object* APIs
 */

import { Readable, Writable } from "stream";

const BUF_SIZE = 65536 * 4;

export type BufferEncoding =
  | "ascii"
  | "utf8"
  | "utf-8"
  | "utf16le"
  | "ucs2"
  | "ucs-2"
  | "base64"
  | "latin1"
  | "binary"
  | "hex";

/* -------------------------
   Utility type guards
   ------------------------- */

function isReadableStream(v: unknown): v is Readable {
  return !!v && typeof (v as Readable)._read === "function";
}
function isWritableStream(v: unknown): v is Writable {
  return !!v && typeof (v as Writable)._write === "function";
}
function isBuffer(v: unknown): v is Buffer {
  return Buffer.isBuffer(v);
}

/* -------------------------
   ReadStream (byte-oriented)
   ------------------------- */

interface ReadStreamNodeOptions {
  nodeStream: Readable;
  encoding?: BufferEncoding;
}

interface ReadStreamBufferOptions {
  buffer: Buffer | string;
  encoding?: BufferEncoding;
}

interface ReadStreamCustomOptions {
  read?: (this: ReadStream, size?: number | null) => void | Promise<void>;
  pause?: (this: ReadStream) => void | Promise<void>;
  destroy?: (this: ReadStream) => void | Promise<void>;
  buffer?: Buffer | string;
  encoding?: BufferEncoding;
}

type ReadStreamOptions =
  | ReadStreamNodeOptions
  | ReadStreamBufferOptions
  | ReadStreamCustomOptions
  | undefined;

export class ReadStream {
  protected buf: Buffer;
  protected bufStart: number;
  protected bufEnd: number;
  protected bufCapacity: number;
  protected readSize: number;
  protected atEOF: boolean;
  protected errorBuf: Error[] | null;
  protected encoding: BufferEncoding;

  // optional backing Node Readable
  protected nodeReadableStream?: Readable;

  // internal promise signalling new data
  protected nextPushResolver?: () => void;
  protected nextPush: Promise<void>;
  protected awaitingPush: boolean;

  constructor(options?: ReadStreamOptions) {
    this.bufCapacity = BUF_SIZE;
    this.buf = Buffer.allocUnsafe(this.bufCapacity);
    this.bufStart = 0;
    this.bufEnd = 0;
    this.readSize = 0;
    this.atEOF = false;
    this.errorBuf = null;
    this.encoding = "utf8";
    this.awaitingPush = false;

    this.nextPush = new Promise((resolve) => {
      this.nextPushResolver = resolve;
    });

    if (!options) return;

    // Node Readable provided
    if ((options as ReadStreamNodeOptions).nodeStream && isReadableStream((options as ReadStreamNodeOptions).nodeStream)) {
      const node = (options as ReadStreamNodeOptions).nodeStream;
      this.nodeReadableStream = node;
      const enc = (options as ReadStreamNodeOptions).encoding;
      if (enc) this.encoding = enc;

      node.on("data", (chunk: Buffer | string) => {
        if (typeof chunk === "string") this.push(Buffer.from(chunk, this.encoding));
        else this.push(Buffer.from(chunk));
      });
      node.on("end", () => this.pushEnd());
      node.on("error", (err) => this.pushError(err));
      return;
    }

    // Buffer or string provided
    if ((options as ReadStreamBufferOptions).buffer !== undefined) {
      const b = (options as ReadStreamBufferOptions).buffer;
      const enc = (options as ReadStreamBufferOptions).encoding;
      if (enc) this.encoding = enc;
      if (typeof b === "string") this.push(Buffer.from(b, this.encoding));
      else this.push(b);
      this.pushEnd();
      return;
    }

    // Custom options
    const custom = options as ReadStreamCustomOptions;
    if (custom.encoding) this.encoding = custom.encoding;
    if (custom.buffer !== undefined) {
      if (typeof custom.buffer === "string") this.push(Buffer.from(custom.buffer, this.encoding));
      else this.push(custom.buffer);
      this.pushEnd();
    }
    if (custom.read) {
      this._read = custom.read.bind(this);
    }
    if (custom.pause) {
      this._pause = custom.pause.bind(this);
    }
    if (custom.destroy) {
      this._destroy = custom.destroy.bind(this);
    }
  }

  /* internal helpers */
  get bufSize(): number {
    return this.bufEnd - this.bufStart;
  }

  protected moveBuf(): void {
    if (this.bufStart !== this.bufEnd) {
      this.buf.copy(this.buf, 0, this.bufStart, this.bufEnd);
    }
    this.bufEnd -= this.bufStart;
    this.bufStart = 0;
  }

  protected expandBuf(newCapacity = this.bufCapacity * 2): void {
    const newBuf = Buffer.allocUnsafe(newCapacity);
    this.buf.copy(newBuf, 0, this.bufStart, this.bufEnd);
    this.buf = newBuf;
    this.bufEnd -= this.bufStart;
    this.bufStart = 0;
    this.bufCapacity = newCapacity;
  }

  protected ensureCapacity(additional: number) {
    if (this.bufEnd + additional <= this.bufCapacity) return;
    const capacity = this.bufEnd - this.bufStart + additional;
    if (capacity <= this.bufCapacity) {
      this.moveBuf();
      return;
    }
    let newCapacity = this.bufCapacity * 2;
    while (newCapacity < capacity) newCapacity *= 2;
    this.expandBuf(newCapacity);
  }

  /* Public push API */
  push(data: Buffer | string): void {
    if (this.atEOF) return;
    const buf = typeof data === "string" ? Buffer.from(data, this.encoding) : data;
    const size = buf.length;
    this.ensureCapacity(size);
    buf.copy(this.buf, this.bufEnd);
    this.bufEnd += size;

    if (this.nodeReadableStream && this.bufSize > this.readSize && size * 2 < this.bufSize) {
      if (typeof this.nodeReadableStream.pause === "function") {
        this.nodeReadableStream.pause();
      }
    }
    this.resolvePush();
  }

  pushEnd(): void {
    this.atEOF = true;
    this.resolvePush();
  }

  pushError(err: Error, recoverable = false): void {
    if (!this.errorBuf) this.errorBuf = [];
    this.errorBuf.push(err);
    if (!recoverable) this.atEOF = true;
    this.resolvePush();
  }

  protected resolvePush(): void {
    if (!this.nextPushResolver) return;
    const r = this.nextPushResolver;
    r();
    if (this.atEOF) {
      this.nextPushResolver = undefined;
      return;
    }
    this.nextPush = new Promise((resolve) => {
      this.nextPushResolver = resolve;
    });
  }

  protected readError(): void {
    if (this.errorBuf) {
      const e = this.errorBuf.shift()!;
      if (!this.errorBuf.length) this.errorBuf = null;
      throw e;
    }
  }

  protected peekError(): void {
    if (this.errorBuf) {
      throw this.errorBuf[0];
    }
  }

  /* Overridable hooks */
  protected _read(size: number | null = null): void | Promise<void> {
    if (this.nodeReadableStream && typeof this.nodeReadableStream.resume === "function") {
      (this.nodeReadableStream as Readable).resume();
      return;
    }
    throw new Error("ReadStream._read() not implemented");
  }

  protected _pause(): void | Promise<void> {
    if (this.nodeReadableStream && typeof this.nodeReadableStream.pause === "function") {
      (this.nodeReadableStream as Readable).pause();
    }
  }

  protected _destroy(): void | Promise<void> {
    // no-op default
  }

  /* Loading/reading logic */

  loadIntoBuffer(byteCount: number | null | true = null, readError = false): void | Promise<void> {
    (readError ? this.readError : this.peekError).call(this);
    if (byteCount === 0) return;
    this.readSize = Math.max(
      byteCount === true ? this.bufSize + 1 : byteCount === null ? 1 : byteCount,
      this.readSize
    );
    if (!this.errorBuf && !this.atEOF && this.bufSize < this.readSize) {
      let bytes: number | null = this.readSize - this.bufSize;
      if (bytes === Infinity || byteCount === null || byteCount === true) bytes = null;
      return this.doLoad(bytes, readError);
    }
  }

  protected async doLoad(chunkSize?: number | null, readError?: boolean): Promise<void> {
    while (!this.errorBuf && !this.atEOF && this.bufSize < this.readSize) {
      if (chunkSize) await this._read(chunkSize);
      else await this._read();
      await this.nextPush;
      (readError ? this.readError : this.peekError).call(this);
    }
  }

  /* Peek / read primitives (string-centric) */

  peek(byteCount: number | null, encoding?: BufferEncoding): string | null;
  peek(encoding?: BufferEncoding): string | null;
  peek(byteCount: number | string | null = null, encoding: BufferEncoding = this.encoding): string | null {
    if (typeof byteCount === "string") {
      encoding = byteCount as BufferEncoding;
      byteCount = null;
    }
    const maybe = this.loadIntoBuffer(byteCount);
    if (maybe) {
      throw new Error("peek returned Promise; caller must await loadIntoBuffer first");
    }

    if (!this.bufSize && byteCount !== 0) return null;
    if (byteCount === null) return this.buf.toString(encoding, this.bufStart, this.bufEnd);
    if (byteCount > this.bufSize) byteCount = this.bufSize;
    return this.buf.toString(encoding, this.bufStart, this.bufStart + (byteCount as number));
  }

  peekBuffer(byteCount: number | null = null): Buffer | null {
    const maybe = this.loadIntoBuffer(byteCount);
    if (maybe) throw new Error("peekBuffer returned Promise; caller must await loadIntoBuffer first");

    if (!this.bufSize && byteCount !== 0) return null;
    if (byteCount === null) return this.buf.slice(this.bufStart, this.bufEnd);
    if (byteCount > this.bufSize) byteCount = this.bufSize;
    return this.buf.slice(this.bufStart, this.bufStart + (byteCount as number));
  }

  async read(byteCount?: number | null, encoding?: BufferEncoding): Promise<string | null>;
  async read(encoding: BufferEncoding): Promise<string | null>;
  async read(byteCount: number | string | null = null, encoding: BufferEncoding = this.encoding): Promise<string | null> {
    if (typeof byteCount === "string") {
      encoding = byteCount as BufferEncoding;
      byteCount = null;
    }
    await this.loadIntoBuffer(byteCount, true);

    const out = this.peek(byteCount, encoding);
    if (out && typeof out !== "string") {
      throw new Error("Race condition: previous read incomplete");
    }

    if (byteCount === null || byteCount >= this.bufSize) {
      this.bufStart = 0;
      this.bufEnd = 0;
      this.readSize = 0;
    } else {
      this.bufStart += byteCount as number;
      this.readSize -= byteCount as number;
    }
    return out;
  }

  async readBuffer(byteCount: number | null = null): Promise<Buffer | null> {
    await this.loadIntoBuffer(byteCount, true);

    const out = this.peekBuffer(byteCount);
    // out is Buffer|null, not a Promise — no check required
    if (byteCount === null || byteCount >= this.bufSize) {
      this.bufStart = 0;
      this.bufEnd = 0;
    } else {
      this.bufStart += byteCount;
    }
    return out;
  }

  async indexOf(symbol: string, encoding: BufferEncoding = this.encoding): Promise<number> {
    let idx = this.buf.indexOf(symbol, this.bufStart, encoding);
    while (!this.atEOF && (idx >= this.bufEnd || idx < 0)) {
      await this.loadIntoBuffer(true);
      idx = this.buf.indexOf(symbol, this.bufStart, encoding);
    }
    if (idx >= this.bufEnd) return -1;
    return idx - this.bufStart;
  }

  async readAll(encoding: BufferEncoding = this.encoding): Promise<string> {
    const res = await this.read(Infinity as unknown as number, encoding);
    return res || "";
  }

  peekAll(encoding: BufferEncoding = this.encoding): string | null {
    return this.peek(Infinity as unknown as number, encoding);
  }

  async readDelimitedBy(symbol: string, encoding: BufferEncoding = this.encoding): Promise<string | null> {
    if (this.atEOF && !this.bufSize) return null;
    const idx = await this.indexOf(symbol, encoding);
    if (idx < 0) return this.readAll(encoding);
    const out = await this.read(idx, encoding);
    this.bufStart += Buffer.byteLength(symbol, "utf8");
    return out;
  }

  async readLine(encoding: BufferEncoding = this.encoding): Promise<string | null> {
    if (!encoding) throw new Error("readLine must have an encoding");
    let line = await this.readDelimitedBy("\n", encoding);
    if (typeof line === "string" && line.endsWith("\r")) line = line.slice(0, -1);
    return line;
  }

  destroy(): void | Promise<void> {
    this.atEOF = true;
    this.bufStart = 0;
    this.bufEnd = 0;
    if (this.nextPushResolver) this.resolvePush();
    return this._destroy();
  }

  async next(byteCount: number | null = null) {
    const value = await this.read(byteCount);
    return { value, done: value === null };
  }

  async pipeTo(outStream: WriteStream, options: { noEnd?: boolean } = {}): Promise<void> {
    let res;
    while (((res = await this.next()), !res.done)) {
      await outStream.write(res.value as string);
    }
    if (!options.noEnd) await outStream.writeEnd();
  }
}

/* -------------------------
   WriteStream (buffer/string output)
   ------------------------- */

interface WriteStreamNodeOptions {
  nodeStream: Writable;
}

interface WriteStreamCustomOptions {
  write?: (this: WriteStream, data: Buffer | string) => void | Promise<void>;
  writeEnd?: (this: WriteStream) => void | Promise<void>;
}

type WriteStreamOptions = WriteStreamNodeOptions | WriteStreamCustomOptions | undefined;

export class WriteStream {
  public isReadable = false;
  public isWritable = true;
  public encoding: BufferEncoding;
  protected nodeWritableStream?: Writable;
  protected drainListeners: (() => void)[];

  constructor(options?: WriteStreamOptions) {
    this.encoding = "utf8";
    this.drainListeners = [];

    if (options && (options as WriteStreamNodeOptions).nodeStream && isWritableStream((options as WriteStreamNodeOptions).nodeStream)) {
      this.nodeWritableStream = (options as WriteStreamNodeOptions).nodeStream;
    } else if (options && (options as WriteStreamCustomOptions).write) {
      this._write = (options as WriteStreamCustomOptions).write!.bind(this);
    }
    if (options && (options as WriteStreamCustomOptions).writeEnd) {
      this._writeEnd = (options as WriteStreamCustomOptions).writeEnd!.bind(this);
    }
  }

  async write(chunk: Buffer | string): Promise<void> {
    return this._write(chunk);
  }

  writeLine(chunk: string): Promise<void> {
    if ((chunk as unknown as null) === null) {
      return this.writeEnd();
    }
    return this.write(chunk + "\n");
  }

  protected _write(_chunk: Buffer | string): void | Promise<void> {
    if (!this.nodeWritableStream) throw new Error("WriteStream._write() not implemented");
    const ok = this.nodeWritableStream.write(_chunk);
    if (ok !== false) return;
    return new Promise((resolve) => {
      this.nodeWritableStream!.once("drain", () => resolve());
    });
  }

  protected _writeEnd(): void | Promise<void> {
    if (!this.nodeWritableStream) return;
    return new Promise<void>((resolve) => {
      // avoid closing stdout/stderr
      if (this.nodeWritableStream === process.stdout || this.nodeWritableStream === process.stderr) {
        return resolve();
      }
      this.nodeWritableStream!.end(() => resolve());
    });
  }

  async writeEnd(chunk?: string): Promise<void> {
    if (chunk !== undefined) await this.write(chunk);
    return this._writeEnd();
  }
}

/* -------------------------
   ReadWriteStream (both)
   ------------------------- */

/**
 * ReadWriteStream should extend ReadStream and also provide write APIs.
 * It does not implement the class WriteStream (TypeScript forbids implementing classes).
 */
export class ReadWriteStream extends ReadStream {
  public isReadable = true;
  public isWritable = true;
  public encoding: BufferEncoding = "utf8";
  public nodeWritableStream?: Writable;
  public drainListeners: (() => void)[] = [];

  constructor(options?: ReadStreamOptions & WriteStreamOptions) {
    super(options);
    if (options && (options as WriteStreamNodeOptions).nodeStream && isWritableStream((options as WriteStreamNodeOptions).nodeStream)) {
      this.nodeWritableStream = (options as WriteStreamNodeOptions).nodeStream;
    }
  }

  async write(chunk: Buffer | string): Promise<void> {
    if (this.nodeWritableStream) {
      const res = this.nodeWritableStream.write(chunk);
      if (res !== false) return;
      return new Promise((resolve) => {
        this.nodeWritableStream!.once("drain", () => resolve());
      });
    }
    return Promise.reject(new Error("ReadWriteStream._write() not implemented"));
  }

  writeLine(chunk: string): Promise<void> {
    return this.write(chunk + "\n");
  }

  protected _write(_chunk: Buffer | string): void | Promise<void> {
    throw new Error("ReadWriteStream._write needs override when using custom behavior");
  }

  protected _writeEnd(): void | Promise<void> {
    return;
  }

  protected _read(_size: number | null = null): void | Promise<void> {
    // In read/write, _read is allowed to be a no-op
    return;
  }

  async writeEnd(): Promise<void> {
    return this._writeEnd();
  }
}

/* -------------------------
   ObjectReadStream / ObjectWriteStream
   ------------------------- */

type ObjectReadStreamNodeOptions<T> = {
  nodeStream: Readable;
} & { read?: never; pause?: never; destroy?: never; buffer?: undefined };

type ObjectReadStreamBufferOptions<T> = {
  buffer: T[];
} & { nodeStream?: undefined; read?: never; pause?: never; destroy?: never };

type ObjectReadStreamCustomOptions<T> = {
  read?: (this: ObjectReadStream<T>) => void | Promise<void>;
  pause?: (this: ObjectReadStream<T>) => void | Promise<void>;
  destroy?: (this: ObjectReadStream<T>) => void | Promise<void>;
  buffer?: T[] | undefined;
};

type ObjectReadStreamOptions<T> =
  | ObjectReadStreamNodeOptions<T>
  | ObjectReadStreamBufferOptions<T>
  | ObjectReadStreamCustomOptions<T>
  | undefined;

export class ObjectReadStream<T> {
  private buf: T[];
  private readSize: number;
  private atEOF: boolean;
  private errorBuf: Error[] | null;
  private nodeReadableStream?: Readable;
  private nextPushResolver?: () => void;
  private nextPush: Promise<void>;
  private awaitingPush: boolean;

  constructor(options?: ObjectReadStreamOptions<T>) {
    this.buf = [];
    this.readSize = 0;
    this.atEOF = false;
    this.errorBuf = null;
    this.awaitingPush = false;
    this.nextPush = new Promise((resolve) => {
      this.nextPushResolver = resolve;
    });

    if (!options) return;

    if ((options as ObjectReadStreamNodeOptions<T>).nodeStream && isReadableStream((options as ObjectReadStreamNodeOptions<T>).nodeStream)) {
      const node = (options as ObjectReadStreamNodeOptions<T>).nodeStream;
      this.nodeReadableStream = node;
      node.on("data", (d: any) => this.push(d));
      node.on("end", () => this.pushEnd());
      node.on("error", (e: Error) => this.pushError(e));
      return;
    }

    const custom = options as ObjectReadStreamCustomOptions<T>;
    if (custom.buffer) {
      this.buf = custom.buffer.slice();
      this.pushEnd();
    }
    if (custom.read) {
      this._read = custom.read.bind(this);
    }
    if (custom.pause) {
      this._pause = custom.pause.bind(this);
    }
    if (custom.destroy) {
      this._destroy = custom.destroy.bind(this);
    }
  }

  push(elem: T) {
    if (this.atEOF) return;
    this.buf.push(elem);
    if (this.buf.length > this.readSize && this.buf.length >= 16) this._pause();
    this.resolvePush();
  }

  pushEnd() {
    this.atEOF = true;
    this.resolvePush();
  }

  pushError(err: Error, recoverable = false) {
    if (!this.errorBuf) this.errorBuf = [];
    this.errorBuf.push(err);
    if (!recoverable) this.atEOF = true;
    this.resolvePush();
  }

  private resolvePush() {
    if (!this.nextPushResolver) throw new Error("Push after end of read stream");
    this.nextPushResolver();
    if (this.atEOF) {
      this.nextPushResolver = undefined;
      return;
    }
    this.nextPush = new Promise((resolve) => {
      this.nextPushResolver = resolve;
    });
  }

  private readError() {
    if (this.errorBuf) {
      const e = this.errorBuf.shift()!;
      if (!this.errorBuf.length) this.errorBuf = null;
      throw e;
    }
  }

  private peekError() {
    if (this.errorBuf) throw this.errorBuf[0];
  }

  protected _read(): void | Promise<void> {
    throw new Error("ObjectReadStream._read not implemented");
  }

  protected _pause(): void | Promise<void> {
    // default no-op
  }

  protected _destroy(): void | Promise<void> {
    return;
  }

  async loadIntoBuffer(count: number | true = 1, readError?: boolean) {
    (readError ? this.readError : this.peekError).call(this);
    if (count === true) count = this.buf.length + 1;
    if (this.buf.length >= count) return;
    this.readSize = Math.max(count, this.readSize);
    while (!this.errorBuf && !this.atEOF && this.buf.length < this.readSize) {
      const r = this._read();
      if (r) await r;
      else await this.nextPush;
      (readError ? this.readError : this.peekError).call(this);
    }
  }

  async peek() {
    if (this.buf.length) return this.buf[0];
    await this.loadIntoBuffer();
    return this.buf[0];
  }

  async read() {
    if (this.buf.length) return this.buf.shift()!;
    await this.loadIntoBuffer(1, true);
    if (!this.buf.length) return null;
    return this.buf.shift()!;
  }

  async peekArray(count: number | null = null) {
    await this.loadIntoBuffer(count === null ? 1 : count);
    return this.buf.slice(0, count === null ? Infinity : count);
  }

  async readArray(count: number | null = null) {
    await this.loadIntoBuffer(count === null ? 1 : count, true);
    const out = this.buf.slice(0, count === null ? Infinity : count);
    this.buf = this.buf.slice(out.length);
    return out;
  }

  async readAll() {
    await this.loadIntoBuffer(Infinity as unknown as number, true);
    const out = this.buf;
    this.buf = [];
    return out;
  }

  async peekAll() {
    await this.loadIntoBuffer(Infinity as unknown as number);
    return this.buf.slice();
  }

  destroy() {
    this.atEOF = true;
    this.buf = [];
    if (this.nextPushResolver) this.resolvePush();
    return this._destroy();
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  async next(): Promise<{ value?: T; done: boolean }> {
    if (this.buf.length) return { value: this.buf.shift()!, done: false };
    await this.loadIntoBuffer(1, true);
    if (!this.buf.length) return { value: undefined, done: true };
    return { value: this.buf.shift()!, done: false };
  }

  async pipeTo(outStream: ObjectWriteStream<T>, options: { noEnd?: boolean } = {}) {
    let item;
    while (((item = await this.next()), !item.done)) {
      await outStream.write(item.value as T);
    }
    if (!options.noEnd) await outStream.writeEnd();
  }
}


type ObjectWriteStreamNodeOptions<T> = {
  nodeStream: Writable;
};

type ObjectWriteStreamCustomOptions<T> = {
  write?: (this: ObjectWriteStream<T>, data: T) => void | Promise<void>;
  writeEnd?: (this: ObjectWriteStream<T>) => void | Promise<void>;
};

type ObjectWriteStreamOptions<T> = ObjectWriteStreamNodeOptions<T> | ObjectWriteStreamCustomOptions<T> | undefined;

export class ObjectWriteStream<T> {
  public isReadable = false;
  public isWritable = true;
  protected nodeWritableStream?: Writable;

  constructor(options?: ObjectWriteStreamOptions<T>) {
    if (options && (options as ObjectWriteStreamNodeOptions<T>).nodeStream && isWritableStream((options as ObjectWriteStreamNodeOptions<T>).nodeStream)) {
      this.nodeWritableStream = (options as ObjectWriteStreamNodeOptions<T>).nodeStream;
    } else if (options && (options as ObjectWriteStreamCustomOptions<T>).write) {
      this._write = (options as ObjectWriteStreamCustomOptions<T>).write!.bind(this);
    }
    if (options && (options as ObjectWriteStreamCustomOptions<T>).writeEnd) {
      this._writeEnd = (options as ObjectWriteStreamCustomOptions<T>).writeEnd!.bind(this);
    }
  }

  async write(elem: T | null): Promise<void> {
    if (elem === null) return this.writeEnd();
    return this._write(elem as T);
  }

  protected _write(_elem: T): void | Promise<void> {
    if (!this.nodeWritableStream) throw new Error("ObjectWriteStream._write not implemented");
    const ok = this.nodeWritableStream.write(String(_elem));
    if (ok !== false) return;
    return new Promise((resolve) => {
      this.nodeWritableStream!.once("drain", () => resolve());
    });
  }

  protected _writeEnd(): void | Promise<void> {
    if (!this.nodeWritableStream) return;
    return new Promise((resolve) => {
      if (this.nodeWritableStream === process.stdout || this.nodeWritableStream === process.stderr) {
        return resolve();
      }
      this.nodeWritableStream!.end(() => resolve());
    });
  }

  async writeEnd(elem?: T): Promise<void> {
    if (elem !== undefined && elem !== null) await this.write(elem);
    return this._writeEnd();
  }
}


export class ObjectReadWriteStream<T> extends ObjectReadStream<T> {
  public isReadable = true;
  public isWritable = true;

  constructor(options?: ObjectReadStreamOptions<T> & ObjectWriteStreamOptions<T>) {
    super(options as ObjectReadStreamOptions<T>);
    if (options && (options as ObjectWriteStreamCustomOptions<T>).write) {
      this._write = (options as ObjectWriteStreamCustomOptions<T>).write!.bind(this as unknown as ObjectWriteStream<T>);
    }
    if (options && (options as ObjectWriteStreamCustomOptions<T>).writeEnd) {
      this._writeEnd = (options as ObjectWriteStreamCustomOptions<T>).writeEnd!.bind(this as unknown as ObjectWriteStream<T>);
    }
  }

  // Expose write API required by ObjectWriteStream<T>
  async write(elem: T): Promise<void> {
    return this._write(elem);
  }

  // Expose writeEnd so structural typing matches ObjectWriteStream<T>
  async writeEnd(elem?: T): Promise<void> {
    if (elem !== undefined && elem !== null) {
      await this.write(elem);
    }
    return this._writeEnd();
  }

  protected _write(_elem: T): void | Promise<void> {
    throw new Error("ObjectReadWriteStream._write not implemented");
  }

  protected _writeEnd(): void | Promise<void> {
    return;
  }
}




export function readAll(nodeStream: Readable, encoding?: BufferEncoding) {
  const rs = new ReadStream({ nodeStream, encoding });
  return rs.readAll(encoding);
}

export function stdin() {
  return new ReadStream({ nodeStream: process.stdin });
}

export function stdout() {
  return new WriteStream({ nodeStream: process.stdout });
}

export async function stdpipe(stream: WriteStream | ReadStream | ReadWriteStream) {
  const promises: Promise<unknown>[] = [];

  if ((stream as ReadStream).pipeTo && typeof (stream as ReadStream).pipeTo === "function") {
    promises.push((stream as ReadStream).pipeTo(stdout()));
    return Promise.all(promises);
  }

  if ((stream as WriteStream).write && typeof (stream as WriteStream).write === "function") {
    promises.push(stdin().pipeTo(stream as unknown as WriteStream));
    return Promise.all(promises);
  }

  if ((stream as ReadWriteStream).write && (stream as ReadWriteStream).pipeTo) {
    promises.push(stdin().pipeTo(stream as unknown as WriteStream));
    promises.push((stream as ReadWriteStream).pipeTo(stdout()));
    return Promise.all(promises);
  }

  return Promise.all(promises);
}

