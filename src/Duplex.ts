import Readable, { type ReadableOptions } from "./Readable.js";
import Writeable, { type WriteableOptions } from "./Writeable.js";

export type DuplexOptions = ReadableOptions & WriteableOptions;

interface Duplex {
    [key:string]: Callback | {};  
}

class Duplex extends Readable implements Duplex{
    constructor(options?: DuplexOptions) {
        super(options);
        Object.assign(this, new Writeable(options))

        for (const method of Object.getOwnPropertyNames(Writeable.prototype)) {
            if (method !== 'constructor' && !Duplex.prototype[method]) {
                Duplex.prototype[method] = Writeable.prototype[method as keyof Writeable];
            }
        }
    }

}


export default Duplex;