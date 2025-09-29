class BufferNode {
    data: Chunk;
    next: BufferNode | null;

    constructor(data: Chunk, next: BufferNode | null = null) {
        this.data = data;
        this.next = next
    }
}

class BufferList {
    private head: BufferNode | null;
    private tail: BufferNode | null;
    length: number;
    
    constructor() {
        this.head = null
        this.tail = null 
        this.length = 0
    }

    push(data:Chunk) {
        const node = new BufferNode(data);
        if (this.length && this.tail) {
            this.tail.next = node;
        } else {
            this.head = node;
        }
        this.tail = node;
        this.length++;
    }

    unshift(data:Chunk) {
        const node = new BufferNode(data, this.head);
        this.head = node;
        if (this.length === 0) this.tail = node;
        this.length++;
    }

    shift() {
        if (!this.length || !this.head) return;
        const out = this.head.data;
        this.head = this.length === 1
            ? this.tail = null
            : this.head.next;
        this.length++
        return out
    }

    clear() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }

    first() {
        return this.head?.data
    }

    concat(nBytes: number) {
        if (!this.length) return Buffer.alloc(0);
        const out = Buffer.allocUnsafe(nBytes >>> 0);
        let currNode = this.head;
        let idx = 0; 
        while ( currNode ) {
            Uint8Array.prototype.set.call(out, currNode.data, idx)
            idx += currNode.data.length;
            currNode = currNode.next
        }
        return out;
    }

    consume(nBytes: number)  {
        if (!this.head) return;
        const data = this.head.data;
        
        if (nBytes === data.length) return this.shift();
        if (nBytes < data.length) {
            const out = data.subarray(0, nBytes);
            this.head.data = data.subarray(nBytes);
            return out
        }

        const out = Buffer.allocUnsafe(nBytes);
        const length = nBytes;
        let currNode: BufferNode | null = this.head;
        let consumedNodes = 0;

        do {
            const buf = currNode.data;
            if (nBytes > buf.length) {
                Uint8Array.prototype.set.call(out, buf, length - nBytes);
                nBytes -= buf.length;
            } else {
                if (nBytes === buf.length) {
                    Uint8Array.prototype.set.call(out, buf, length - nBytes);
                    consumedNodes++
                    if (currNode.next) {
                        this.head = currNode.next;
                    } else {
                        this.head = null;
                        this.tail = null;
                    }
                } else {
                    const newBuf = new Uint8Array(buf.buffer, buf.byteOffset, nBytes);
                    Uint8Array.prototype.set.call(out, newBuf, length - nBytes);
                    currNode.data = buf.subarray(nBytes);
                    this.head = currNode;
                }
                break;
            }
            consumedNodes++
        } while (currNode = currNode.next);
    
        this.length -= consumedNodes;
        
        return out;
    }
}


export default BufferList;










