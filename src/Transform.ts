import Duplex, { type DuplexOptions } from "./Duplex.js";



class Transform extends Duplex {
    private callback: Callback | null;

    constructor(options?: DuplexOptions) {
        super(options)
        this.callback = null;
    }

    _transform(chunk: Chunk, encoding: BufferEncoding, callback: Callback) {
        throw new Error('_transform should be implemented');
    }

    _write(chunk: Chunk, encoding: BufferEncoding, callback: Callback) {
        this._transform(chunk, encoding, (err: Error | null, val: Chunk) => {
            if (err) {
                callback(err);
                return;
            }
            if (val !== null) this.push(val);
            this.callback = callback;
        })
    }

    override _read(nBytes?: number): void {
        if (this.callback) {
            const callback = this.callback;
            this.callback = null;
            callback();
        }
    }
}


export default Transform;