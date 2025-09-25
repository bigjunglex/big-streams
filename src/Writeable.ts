type Chunk = 'string' | Buffer;
type BufferedItem = {
    chunk: Chunk;
    callback: null | Function;
} 
type WriteableState = {
    buffered: BufferedItem[];
    isWriting: boolean;
    writeCallback: null | Function;
}

class Writeable {
    private state: WriteableState;

    constructor() {
        this.state = {
            buffered: [],
            isWriting: false,
            writeCallback: null,
        }
    }

    write(chunk: Chunk, callback: Function) {
        const state = this.state;
        if(state.isWriting) {
            state.buffered.push({ chunk, callback });
        } else {
            state.isWriting = true;
            state.writeCallback = callback;
            this.#write(chunk, this.onWriteEnd.bind(this));
        }
    }
    
    #write(chunk: Chunk, cb: Function) {

    }

    private onWriteEnd() {
        const state = this.state;
        const cb = state.writeCallback;
        state.isWriting = false;
        state.writeCallback = null;
        if (state.buffered.length) this.clearBuffer();
        if (typeof cb === 'function') cb();
    }

    private clearBuffer() {
        const state = this.state;
        const { chunk, callback } = state.buffered.shift()!;
        this.doWrite(chunk, callback)
    }

    private doWrite(chunk: Chunk, callback: Function | null) {
        const state = this.state;
        state.isWriting = true;
        state.writeCallback = callback;
        this.#write(chunk, this.onWriteEnd.bind(this));
    }

}