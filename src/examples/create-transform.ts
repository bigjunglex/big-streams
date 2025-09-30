import type { DuplexOptions } from "../Duplex.js";
import Transform from "../Transform.js";

class CreateTransformStream extends Transform {
    constructor(options:DuplexOptions) {
        super(options);
    }

    override _transform(data:Chunk, encoding: BufferEncoding, callback: Callback): void {
        callback(null, data.toString().toUpperCase());
    }
}

export const createTransformStream = (options: DuplexOptions) => new CreateTransformStream(options);