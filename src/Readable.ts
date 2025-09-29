import EventEmitter from "./EventEmitter.js";
import BufferList  from "./BufferList.js";
import type Writeable from "./Writeable.js";



type ReadableState = ReadableOptions & {
    buffer: BufferList;
    length: number;
    flowing: any;
    reading: boolean;
    resumeScheduled: boolean;
    sync: boolean;
    emittedReadable: boolean;
    needReadable: boolean;
    readableListening: boolean;
    readingMore: boolean;
    encoding: BufferEncoding | null;
    ended: boolean;
    endEmmited: boolean;
    pipes: Writeable[];
    constructed: boolean;
    errored: null | Error;
}

export type ReadableOptions = {
    highWaterMark: number;
    objectMode: boolean;
    defaultEncoding: BufferEncoding;
    read?: Callback;
    construct?: Callback;
}

class Readable extends EventEmitter {
    private state: ReadableState;

    constructor(options?: ReadableOptions) {
        super();
        this.state = {
            buffer: new BufferList(),
            length: 0,
            flowing: null,
            resumeScheduled: false,
            reading: false,
            sync: true,
            emittedReadable: false,
            needReadable: false,
            readableListening: false,
            readingMore: false,
            encoding: null,
            ended: false,
            endEmmited: false,
            pipes: [],

            constructed: true,
            errored: null,

            // OPTTIONS HLEV
            highWaterMark: options?.highWaterMark || 16 * 1024,
            objectMode: options?.objectMode || false ,
            defaultEncoding: options?.defaultEncoding || 'utf8',
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
                    if (state.needReadable) this.maybeReadMore();
                })
            })
        }

        if (options) {
            if (typeof options.read === 'function') this._read = options.read;
            //@ts-ignore
            if (typeof options.construct === 'function') this._construct = options.construct;
        }
    }

    push(chunk: Chunk | null, encoding?: BufferEncoding) {
        return this.readableAddChunk(chunk, encoding || '', false)
    }

    unshift(chunk: Chunk, encoding: BufferEncoding) {
        return this.readableAddChunk(chunk, encoding, true)
    }

    resume() {
        const state = this.state;
        state.flowing = true;
        if (!state.flowing) {
            state.flowing = !state.readableListening;
            if (!state.resumeScheduled) {
                state.resumeScheduled = true;
                process.nextTick(this._resume.bind(this))
            }
        }
    }

    _resume() {
        const state = this.state;
        if (!state.reading) this.read(0);

        state.resumeScheduled = false;
        this.emit('resume')        
        this.flow();
        
        if (state.flowing && !state.reading) this.read(0);
    }

    private flow() {
        const state = this.state;
        while(state.flowing && this.read());
    }

    read(nBytes?: number) {
        const state = this.state;
        
        if (nBytes === undefined) {
            nBytes = NaN;
        } else if (!Number.isInteger(nBytes)) {
            nBytes = parseInt(String(nBytes), 10)
        }
        
        const nBytesOrig = nBytes;
        if(nBytes > state.highWaterMark) {
            state.highWaterMark = this.getNewHighWaterMark(nBytes);
        }

        if (nBytes !== 0)  state.emittedReadable = false;

        nBytes = this.howMuchToRead(nBytes)
        
        if (!nBytes && state.ended) {
            if (!state.length) this.endReadable();
            return null;
        }

        let doRead = false; 
        
        if (state.length - nBytes < state.highWaterMark) doRead = true;
        if (
            state.reading ||
            state.ended ||
            state.errored ||
            !state.constructed
        ) {
            doRead = false
        } else if (doRead) {
            state.sync = true;
            state.reading = true;
            if (!state.length) {
                if (!state.ended) {
                    state.needReadable = true;
                }
                if (nBytesOrig !== nBytes && state.ended) {
                    this.endReadable();
                }
            }
            this._read();
            state.sync = false;
            
            if(!state.reading) nBytes = this.howMuchToRead(nBytesOrig);
        }

        let out = null;
       
        if (nBytes) out = this.fromList(nBytes);
   
        if (out) {
            state.length -= nBytes;
            this.emit('data', out)
        } else {
            state.needReadable = state.length <= state.highWaterMark;
        }

        if (!state.length) {
            state.needReadable = true;
        }

        return out;
    }

    _read(nBytes?: number) {
        throw new Error('_read requires implemetetion');
    }

    private fromList(nBytes: number) {
        const state = this.state
        if (!state.length) return null;
        let out;
        if (state.objectMode) {
            out = state.buffer.shift();
        } else if (nBytes >= state.length) {
            if (state.buffer.length === 1) {
                out = state.buffer.first();
            } else {
                out = state.buffer.concat(state.length);
            }
            state.buffer.clear();
        } else {
            out = state.buffer.consume(nBytes)
        }

        return out;
    }

    override on(eventName: string, listener: Callback) {
        const state = this.state;
        super.on(eventName, listener)
        
        if (eventName === 'data'){ 
            if (state.flowing) {
                this.resume();
            }
        } else if (eventName === 'readable') {
            if (!state.readableListening) {
                state.readableListening = true;
                state.needReadable = true;
                state.flowing = false;
                state.emittedReadable = false;
                if (state.length) this.emitReadable();

            } else if (!state.reading) {
                process.nextTick(() => this.read(0))
            } 
        }
    }

    override removeListener(eventName: string, listener: Callback): this {
        super.removeListener(eventName, listener);

        const state = this.state;
        if (eventName === 'readable') {
            process.nextTick(() => {
                state.readableListening = !!this.listenerCount('readable');
                if (state.resumeScheduled) {
                    state.flowing = true;
                } else if (!!this.listenerCount('data')) {
                    this.resume();
                } else if (!state.readableListening) {
                    state.flowing = false;
                }
            })
        }

        return this
    }

    pause() {
        const state = this.state;
        if (state.flowing) {
            state.flowing = false;
            this.emit('pause');
        }
        return this;
    }

    isPaused() {
        return !this.state.flowing 
    }

    private howMuchToRead(nBytes: number) {
        const state = this.state;
        if (nBytes <= 0 || (!state.length && state.ended)) return 0;
        if (state.objectMode) return 1;
        if (Number.isNaN(nBytes)) {
            if (state.flowing && state.length) {
                return state.buffer.first()?.length || 0;
            }
            return state.length
        }
        if (nBytes <= state.length) return nBytes;
        return state.ended ? state.length : 0;
    }

    private getNewHighWaterMark(nBytes: number) {
        const MAX_HWM = 0x40000000;
        if (nBytes >= MAX_HWM) {
            nBytes = MAX_HWM;
        } else {
            nBytes--;
            nBytes |= nBytes >>> 1;
            nBytes |= nBytes >>> 2;
            nBytes |= nBytes >>> 4;
            nBytes |= nBytes >>> 8;
            nBytes |= nBytes >>> 16;
            nBytes++;        
        }
        return nBytes;
    }


    private emitReadable() {
        const state = this.state;
        state.needReadable = false;
        if (!state.emittedReadable) {
            state.emittedReadable = true;
            process.nextTick(() => {
                if (state.length || state.ended) {
                    this.emit('readable');
                    state.emittedReadable = false;
                }
                state.needReadable = 
                    !state.flowing &&
                    !state.ended
                    state.length <= state.highWaterMark;
                this.flow();
            })
        }
    }

    private maybeReadMore() {
        const state = this.state;
        if (!state.readingMore && state.constructed) {
            state.readingMore = true;
            process.nextTick(() => {
                while (
                    !state.reading &&
                    !state.ended &&
                    state.length < state.highWaterMark
                ) {
                    const startLength = state.length;
                    this.read(0);
                    if (startLength === state.length) break;
                }
                state.readingMore = false;
            })
        }
    }

    private addChunk(chunk:Chunk, addToFront:boolean) {
        const state = this.state;
        if (
            state.flowing &&
            !state.length &&
            !state.sync &&
            this.listenerCount('data')
        ) {
            this.emit('data', chunk)
        } else {
            state.length + (state.objectMode ? 1 : chunk.length)
            addToFront 
                ? state.buffer.unshift(chunk)
                : state.buffer.push(chunk);
            
            if (state.needReadable) this.emitReadable();
            
        }
        this.maybeReadMore();
    }

    private readableAddChunk(chunk:Chunk | null, encoding:BufferEncoding | '', addToFront:boolean) {
        const state = this.state;
    
        if (!state.objectMode) {
            if (typeof chunk === 'string') {
                encoding = encoding || state.defaultEncoding;
                if (state.encoding !== encoding) {
                    if (addToFront && state.encoding) {
                        chunk = Buffer.from(chunk, encoding).toString(state.encoding);
                    } else {
                        chunk = Buffer.from(chunk, encoding);
                        encoding = '';
                    }
                }
            } else if (chunk instanceof Buffer) {
                encoding = '';
            } else if (chunk) {
                throw new Error('Invalid chunk types. Accepts Buffer or string')
            }
        }

        if (chunk === null) {
            state.reading = false;
            this.onEoFChunk();
        }else if (state.objectMode || (chunk && chunk.length)) {
            if (addToFront) {
                if(state.endEmmited) throw new Error('cant access chunks, stream already ended');
                this.addChunk(chunk, true);
            } else if (state.ended) {
                if(state.endEmmited) throw new Error('cant access chunks, stream already ended');
            } else {
                state.reading = false;
                this.addChunk(chunk, false);
            }
        } else if (!addToFront) {
            state.reading = false;
            this.maybeReadMore();
        }

        return !state.ended && state.length < state.highWaterMark;
    }

    private endReadable() {
        const state = this.state;
        if (!state.endEmmited) {
            state.ended = true;
            process.nextTick(() => {
                if (!state.endEmmited && !state.length) {
                    state.endEmmited = true;
                    this.emit('end');
                }
            })
        }
    }

    private onEoFChunk() {
        const state = this.state;
        if (state.ended) return;
        state.ended = true;
        if (state.sync) this.emitReadable();
    }

    pipe(destination: Writeable) {
        const source = this;
        const state = this.state;
        state.pipes.push(destination)
        
        let onDrain:(() => void) | undefined; 
        
        const onData = (chunk:Chunk) => {
            const out = destination.write(chunk);
            pause();
        }

        const pause = () => {
            source.pause();
            if (!onDrain) {
                onDrain = this.pipeOnDrain.bind(this);
                destination.on('drain', onDrain)
            }
        }
        
        const onEnd = () => destination.end();
        
        const onClose = () => {
            destination.removeListener('finish', onFinish);
            source.unpipe(destination);
        }
        
        const onFinish = () => {
            destination.removeListener('close', onClose);
            source.unpipe(destination)    
        }
        
        const cleanUp = () => {
            destination.removeListener('close', onClose);
            destination.removeListener('finish', onFinish);
            destination.removeListener('unpipe', onUnpipe);
            if (onDrain) destination.removeListener('drain', onDrain);
        
            source.removeListener('end', onEnd)
            source.removeListener('data', onData)
        }
        
        const onUnpipe = () => cleanUp();

        destination.once('finish', onFinish)
        destination.once('close', onClose)
        destination.emit('pipe', source)
        destination.on('unpipe', onUnpipe)

        source.on('data', onData)
        source.on('end', onEnd)

        return destination
    }

    unpipe(destination?: Writeable) {
        const state = this.state;
        if (!destination) {
            this.pause();
            state.pipes.forEach(dst => dst.emit('unpipe'))
            state.pipes = [];
            return this;
        }
        if (state.pipes.length) {}
        state.pipes = state.pipes.filter(pipe => pipe !== destination);
        if (!state.pipes.length) this.pause();
        
        destination.emit('unpipe')
        return this;
    }

    private pipeOnDrain() {
        const state = this.state;
        if (this.listenerCount('data')) {
            state.flowing = true;
            this.flow();
        }
    }
}


export default Readable;