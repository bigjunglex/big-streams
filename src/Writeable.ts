import EventEmitter from "./EventEmitter.js"; 

type BufferedItem = {
    chunk: Chunk;
    encoding: Encoding;
    callback: null | Function | undefined;

} 
type WriteableState = WriteableOptions & {
    length: number;
    buffered: BufferedItem[];
    isWriting: boolean;
    writeCallback: null | Function | undefined;
    writeLength: number;
    needDrain: boolean;
    corked: number;
    errored: null | Error;
    closed: boolean;
    destroyed: boolean;
    ending: boolean; // stream is in ending phase
    ended: boolean; // stream ended
    finished: boolean; // finish event emmited
    constructed: boolean;
}

export type WriteableOptions = {
    autoDestroy: boolean;
    emitClose: boolean;
    highWaterMark: number;
    defaultEncoding: BufferEncoding;
    objectMode: boolean;
    decodeStrings: boolean;
    write?: Function;
    destroy?: Function;
    construct?: Function;
} 


class Writeable extends EventEmitter {
    state: WriteableState;

    constructor(options?: WriteableOptions) {
        super();
        this.state = {
            length: 0,
            buffered: [],
            isWriting: false,
            writeCallback: null,
            writeLength: 0,
            needDrain: false,
            corked: 0,
            errored: null,
            closed: false,
            destroyed: false,
            ended: false,
            ending: false,
            finished: false,
            constructed: true,
            //OPTIONS STOILO
            autoDestroy: options?.autoDestroy || true,
            emitClose: options?.emitClose || true,
            highWaterMark: options?.highWaterMark || 16 * 1024,
            objectMode: false,
            defaultEncoding: options?.defaultEncoding || 'utf8',
            decodeStrings: false
        }
        //@ts-ignore
        if (typeof this._construct === 'function') {
            const state = this.state;
            state.constructed = false;
            process.nextTick(() => {
                //@ts-ignore
                this._construct((err: Error) => {
                    state.constructed = true;
                    if (err) state.errored = err;
                    this.finishMaybe();
                })
            })
        }


        if (options) {
            if (typeof options.write === 'function') this._write = options.write as typeof this._write;
            if (typeof options.destroy === 'function') this.doDestroy = options.destroy as typeof this.doDestroy;
            //@ts-ignore
            if (typeof options.construct === 'function') this._construct = options.construct as typeof this._construct;

        }
    }

    write(chunk: Chunk, encoding?: Encoding, callback?: Function) {
        const state = this.state;
        if(typeof encoding === 'function') {
            callback = encoding;
            encoding = state.defaultEncoding;
        } else {
            if (!encoding) {
                encoding = state.defaultEncoding;
            } else if (encoding !== 'buffer' && !Buffer.isEncoding(encoding)) {
                throw new Error('invalid encoding')
            }
        }
        
        if (chunk === null) {
            throw new Error('chunk cannot be null')
        } else if (!state.objectMode) {
            if (typeof chunk === 'string') {
                if (state.decodeStrings !== false) {
                    chunk = Buffer.from(chunk, encoding as BufferEncoding);
                    encoding = 'buffer';
                }
            } else if ( chunk instanceof Buffer) {
                encoding = 'buffer';
            } else {
                throw new Error('invalid types, accepts only string of buffer')
            }
        }

        const len = state.objectMode ? 1 : chunk.length;
        state.length += len;
        const out = state.length < state.highWaterMark;
        if (!out) state.needDrain = true;
        if (state.ending) state.errored = new Error('cannot write after stream end');
        if (state.destroyed) state.errored = new Error('cannot write after stream destroyed');
        if (state.errored) {
            if (typeof callback === 'function') {
                process.nextTick(callback, state.errored);
            }
            return false;
        } 
        
        if(state.isWriting || state.corked || !state.constructed) {
            state.buffered.push({ chunk, encoding, callback });
        } else {
            state.isWriting = true;
            state.writeCallback = callback;
            state.writeLength = len;
            this._write(chunk, encoding, this.onWriteEnd.bind(this));
        }
    
        return out
    }
    
    _write(chunk: Chunk,  encoding: Encoding, cb: Function) {
        throw new Error('_write must be implemented!');
    }

    private onWriteEnd(err?: Error) {
        const state = this.state;
        const callback = state.writeCallback;

        state.isWriting = false;
        state.writeCallback = null;
        state.length -= state.writeLength;
        state.writeLength = 0;

        if (err) {
            state.errored = err;
            throw state.errored;
        } else {
            if (state.buffered.length) this.clearBuffer();
            if (
                state.needDrain &&
                !state.length &&
                !state.ending &&
                !state.destroyed
            ) {
                state.needDrain = false;
                this.emit('drain');
            }
            if (typeof callback === 'function') callback();
        }

        this.finishMaybe();
    }
    
    cork() {
        this.state.corked++
    }

    uncork() {
        const state = this.state;
        if (state.corked) {
            state.corked--;
            if (!state.isWriting) this.clearBuffer();
        }
    }

    private clearBuffer() {
        const state = this.state;
        if (state.corked || state.destroyed || !state.constructed) return;
        const { chunk, encoding, callback } = state.buffered.shift()!;
        this.doWrite(chunk, encoding, callback)
    }

    private doWrite(chunk: Chunk, encoding: Encoding, callback?: Function | null ) {
        const state = this.state;
        state.isWriting = true;
        state.writeCallback = callback;
        state.writeLength = state.objectMode ? 1 : chunk.length
        this._write(chunk, encoding, this.onWriteEnd.bind(this));
    }

    setDefautlEncoding(encoding: string | BufferEncoding) {
        if (!Buffer.isEncoding(encoding))  throw new Error('invalid encoding');
        this.state.defaultEncoding = encoding;
        return this;
    }

    end(chunk?: Chunk | null, encoding?: Encoding , callback?: Function | null) {
        const state = this.state;
        if(typeof chunk === 'function') {
            callback = chunk;
            chunk = null;
            encoding = null;
        } else if (typeof encoding === 'function') {
            callback = encoding;
            encoding = null;
        }

        if (chunk) this.write(chunk, encoding);
        if (state.corked) {
            state.corked = 1;
            this.uncork()
        }

        if (state.destroyed) {
            state.errored = new Error('cannot write after stream destroyed')
            if (typeof callback === 'function') {
                process.nextTick(callback, state.errored)
            }
        } else {
            state.ending = true;
            this.finishMaybe();
            state.ended = true;            
        }
    }

    private finishMaybe() {
        const state = this.state;
        if (this.needFinish()) {
            state.finished = true;
            if (state.autoDestroy) this.destroy();
            this.emit('finish')
        }
    }

    private needFinish() {
        const state = this.state;
        return (
            state.ending &&
            state.constructed &&
            !state.length &&
            !state.errored &&
            !state.finished &&
            !state.isWriting 
        )
    }

    destroy(err?: Error, callback?: Function) {
        const state = this.state;
        state.destroyed = true;
        
        if (typeof callback === 'function') callback(err);
        if (err) {
            state.errored = err;
            this.onError();
        } 
        if (state.emitClose) this.close();
        this.doDestroy(state.errored, this._destroy.bind(this))
        return this;
    }

    private doDestroy(err: Error | null, callback: Function) {
        callback(err)
    }

    private _destroy(err?: Error, callback?: Function) {
        if (err) {
            this.state.errored = err;
            this.onError();
        }
    }

    private close() {
        this.state.closed = true;
        process.nextTick(() => {
            this.emit('close');
        })
    }

    private onError() {
        process.nextTick((err:Error) => {
            this.emit('error', err)
        }, this.state.errored)
    }
}

export default Writeable;