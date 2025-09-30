import Duplex, { type DuplexOptions } from "../Duplex.js";
import fs, { readFile } from 'fs'

class CreateDuplexStream extends Duplex {
    private readFilePath: fs.PathLike;
    private writeFilePath: fs.PathLike;
    private readFileDescriptor: number | null;
    private writeFileDescriptor: number | null;
    
    constructor(readFilePath: fs.PathLike, writeFilePath: fs.PathLike, options?: DuplexOptions) {
        super(options);
        this.readFilePath = readFilePath;
        this.writeFilePath = writeFilePath;
        this.readFileDescriptor = null;
        this.writeFileDescriptor = null;
    }

    _construct(callback:Callback) {
        fs.open(this.writeFilePath, 'w', (err, fd) => {
            if (err) {
                callback(err)
            } else {
                this.writeFileDescriptor = fd;
                fs.open(this.readFilePath, 'r+', (err, fd) => {
                    if (err) {
                        callback(err)
                    } else {
                        this.readFileDescriptor = fd;
                        callback();
                    }
                })
            }
        })
    }

    override _read(nBytes: number): void {
        if (!this.readFileDescriptor) return;
        
        const buf = Buffer.alloc(nBytes);
        fs.read(this.readFileDescriptor, buf, 0, nBytes, null, (err, bytesRead) => {
            this.push(bytesRead > 0 ? buf.subarray(0, bytesRead) : null)
        })
    }

    _write(chunk: Chunk | null, encoding: BufferEncoding, next: Callback) {
        if (!this.writeFileDescriptor) return;
        
        fs.write(this.writeFileDescriptor, chunk, next);
    }

    _destroy(err: NodeJS.ErrnoException | null, callback: Callback) {
        if (!this.writeFileDescriptor) return;
        
        fs.close(this.writeFileDescriptor, er => callback(er || err))
    }
}


export const createDuplexStream = (
    readFilePath: fs.PathLike,
    writeFilePath: fs.PathLike,
    options?: DuplexOptions
) => new CreateDuplexStream(readFilePath, writeFilePath, options)