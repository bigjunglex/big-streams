import EventEmitter from "./EventEmitter.js";

class Readable extends EventEmitter {
    constructor() {
        super();
    }

    push(chunk: Chunk) {
        this.emit('data', chunk)
    }

}