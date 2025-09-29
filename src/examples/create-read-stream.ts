import fs from "fs";
import Readable, { type ReadableOptions } from "../Readable.js";

class CreateReadStream extends Readable {
    private filePath: fs.PathLike;
    private fileDescriptor: number | null;

    constructor(filePath: fs.PathLike, options: ReadableOptions) {
        super(options);
        this.filePath = filePath;
        this.fileDescriptor = null;
    }

    _construct(callback:Callback) {
        fs.open(this.filePath, 'r+', (err, fileDescriptor) => {
            if (err) {
                callback(err);
            } else {
                this.fileDescriptor = fileDescriptor;
                callback();
            }
        })
    }

    override _read(nBytes:number): void {
        const buf = Buffer.alloc(nBytes);
        if (!this.fileDescriptor) return;
        fs.read(this.fileDescriptor, buf, 0, nBytes, null, (err, bytesRead) => {
            this.push(bytesRead > 0 ? buf.subarray(0, bytesRead) : null)
        })
    }
}

export const createReadStream = (
    filePath: fs.PathLike,
    options: ReadableOptions
) => new CreateReadStream(filePath, options);