/**
 * Net - abstraction layer around Node's HTTP/S request system.
 * Advantages:
 * - easier acquiring of data
 * - mass disabling of outgoing requests via Config.
 */

import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import * as Streams from './streams';
declare const Config: any;

export interface PostData {
    [key: string]: string | number;
}
export interface NetRequestOptions extends https.RequestOptions {
    body?: string | PostData;
    writable?: boolean;
    query?: PostData;
}

export class HttpError extends Error {
    statusCode?: number;
    body: string;
    constructor(message: string, statusCode: number | undefined, body: string) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.body = body;
        Error.captureStackTrace(this, HttpError);
    }
}

export class NetStream extends Streams.ReadWriteStream {
    opts: NetRequestOptions | null;
    uri: string;
    request: http.ClientRequest;
    /** will be a Promise before the response is received, and the response itself after */
    response: Promise<http.IncomingMessage | null> | http.IncomingMessage | null;
    statusCode: number | null;
    /** response headers */
    headers: http.IncomingHttpHeaders | null;
    state: 'pending' | 'open' | 'timeout' | 'success' | 'error';

    constructor(uri: string, opts: NetRequestOptions | null = null) {
        super();
        this.statusCode = null;
        this.headers = null;
        this.uri = uri;
        this.opts = opts;
        // make request
        this.response = null;
        this.state = 'pending';
        this.request = this.makeRequest(opts);
    }

    private normalizeHeaders(opts: NetRequestOptions) {
        // make sure headers is always an object, never an array
        if (!opts.headers || Array.isArray(opts.headers)) {
            opts.headers = {};
        }
        return opts.headers as http.OutgoingHttpHeaders;
    }

    makeRequest(opts: NetRequestOptions | null) {
        if (!opts) opts = {};

        const headers = this.normalizeHeaders(opts);

        let body = opts.body;
        if (body && typeof body !== 'string') {
            if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            body = NetStream.encodeQuery(body);
        }

        if (opts.query) {
            this.uri += (this.uri.includes('?') ? '&' : '?') + NetStream.encodeQuery(opts.query);
        }

        if (body) {
            if (!headers['Content-Length']) {
                headers['Content-Length'] = Buffer.byteLength(body);
            }
        }

        const protocol = url.parse(this.uri).protocol as string;
        const net = protocol === 'https:' ? https : http;

        let resolveResponse: ((value: http.IncomingMessage | null) => void) | null;
        this.response = new Promise(resolve => {
            resolveResponse = resolve;
        });

        const request = net.request(this.uri, opts, response => {
            this.state = 'open';
            this.nodeReadableStream = response;
            this.response = response;
            this.statusCode = response.statusCode || null;
            this.headers = response.headers;

            response.setEncoding('utf-8');
            resolveResponse!(response);
            resolveResponse = null;

            response.on('data', data => {
                this.push(data);
            });
            response.on('end', () => {
                if (this.state === 'open') this.state = 'success';
                if (!this.atEOF) this.pushEnd();
            });
        });

        request.on('close', () => {
            if (!this.atEOF) {
                this.state = 'error';
                this.pushError(new Error("Unexpected connection close"));
            }
            if (resolveResponse) {
                this.response = null;
                resolveResponse(null);
                resolveResponse = null;
            }
        });

        request.on('error', error => {
            if (!this.atEOF) this.pushError(error, true);
        });

        if (opts.timeout || opts.timeout === undefined) {
            request.setTimeout(opts.timeout || 5000, () => {
                this.state = 'timeout';
                this.pushError(new Error("Request timeout"));
                request.abort();
            });
        }

        if (body) {
            request.write(body);
            request.end();
            if (opts.writable) {
                throw new Error(`options.body is what you would have written to a NetStream - you must choose one or the other`);
            }
        } else if (opts.writable) {
            this.nodeWritableStream = request;
        } else {
            request.end();
        }

        return request;
    }

    static encodeQuery(data: PostData) {
        let out = '';
        for (const key in data) {
            if (out) out += `&`;
            out += `${key}=${encodeURIComponent('' + data[key])}`;
        }
        return out;
    }

    _write(data: string | Buffer): Promise<void> | void {
        if (!this.nodeWritableStream) {
            throw new Error("You must specify opts.writable to write to a request.");
        }
        const result = this.nodeWritableStream.write(data);
        if (result !== false) return undefined;
        if (!this.drainListeners.length) {
            this.nodeWritableStream.once('drain', () => {
                for (const listener of this.drainListeners) listener();
                this.drainListeners = [];
            });
        }
        return new Promise(resolve => {
            this.drainListeners.push(resolve);
        });
    }

    _read() {
        this.nodeReadableStream?.resume();
    }

    _pause() {
        this.nodeReadableStream?.pause();
    }
}

export class NetRequest {
    uri: string;
    constructor(uri: string) {
        this.uri = uri;
    }

    getStream(opts: NetRequestOptions = {}) {
        if (typeof Config !== 'undefined' && Config.noNetRequests) {
            throw new Error(`Net requests are disabled.`);
        }
        return new NetStream(this.uri, opts);
    }

    async get(opts: NetRequestOptions = {}): Promise<string> {
        const stream = this.getStream(opts);
        const response = await stream.response;
        if (response && response.statusCode !== 200) {
            throw new HttpError(response.statusMessage || "Connection error", response.statusCode, await stream.readAll());
        }
        return stream.readAll();
    }

    post(opts: Omit<NetRequestOptions, 'body'>, body: PostData | string): Promise<string>;
    post(opts?: NetRequestOptions): Promise<string>;
    post(opts: NetRequestOptions = {}, body?: PostData | string) {
        if (!body) body = opts.body;
        return this.get({
            ...opts,
            method: 'POST',
            body,
        });
    }
}

export const Net = Object.assign((path: string) => new NetRequest(path), {
    NetRequest, NetStream,
});
