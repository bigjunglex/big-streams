import fs from "fs";
import Writeable, { type WriteableOptions } from "../Writeable.js";

type fsWriteCallback = (err: NodeJS.ErrnoException | null, written: number, buffer: Buffer) => void

class CreateWriteStream extends Writeable {
    private filePath: fs.PathLike;
    private fileDescriptor: number;

    constructor(filePath: fs.PathLike, options?: WriteableOptions) {
        super(options)
        this.filePath = filePath
        this.fileDescriptor = 0;
    }

    _construct(callback: Function) {
        fs.open(this.filePath, 'w', (err, fd) => {
            if (err) {
                callback(err);
            } else {
                this.fileDescriptor = fd;
                callback();
            }
        })
    }

    override _write(chunk: Buffer<ArrayBufferLike>, encoding: string | null, next: fsWriteCallback): void {
        console.log(this.fileDescriptor, chunk)
        fs.write(this.fileDescriptor, chunk, next);
    }

    override _destroy(err?: Error, callback?: (err: Error | null | undefined) => void): void {
        console.log('destroy', err, callback)
        fs.close(this.fileDescriptor, (er) => callback ? callback(err || err) : null)
    }
}

const createWriteStream = (
    filePath: fs.PathLike,
    options?: WriteableOptions
) => new CreateWriteStream(filePath, options);

export default createWriteStream;