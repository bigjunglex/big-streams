type EventStore = Map<string, Callback[]>;
type WrapperState = {
    eventName: string;
    listener: Callback;
    wrapRef: null | Callback & { listener?: Callback };
}

export default class EventEmitter {
    private events: EventStore;
    
    constructor() {
        this.events = new Map();
    }

    addListener(eventName:string, listener: Callback) {
        const events = this.events;
        if(!events.has(eventName)) events.set(eventName, []);
        events.get(eventName)?.push(listener)
        return this
    }

    removeListener(eventName:string, listener: Callback) {
        const events = this.events;
        if(events.has(eventName)) {
            const arr = events.get(eventName)!;
            for (let i = arr?.length - 1; i >= 0; i--) {
                const cb = arr[i] as Callback & { listener: Callback }
                if (cb === listener || cb.listener === listener) {
                    arr.splice(i, 1)
                    break;
                }
            }
            if (arr.length === 0) events.delete(eventName);
        }
        
        return this;
    }

    on(eventName:string, listener: Callback): this | void {
        return this.addListener(eventName, listener);
    }

    off(eventName:string, listener: Callback) {
        return this.removeListener(eventName, listener)
    }

    removeAllListeners(eventName:string | undefined) {
        if (!eventName) {
            this.events = new Map();
            return this;
        }
        this.events.delete(eventName);
        return this;
    }

    private onceWrap(eventName:string, listener: Callback): Callback {
        const state: WrapperState = { eventName, listener, wrapRef:null };
        state.wrapRef = this.onceWrapper.bind(this, state)
        state.wrapRef.listener = listener;
        return state.wrapRef
    }

    private onceWrapper(state:WrapperState, ...args:any[]) {
        this.removeListener(state.eventName, state.listener);
        state.listener.apply(this, args)
    }

    once(eventName:string, listener: Callback) {
        return this.addListener(eventName, this.onceWrap(eventName, listener))
    }

    emit(eventName: string, ...args:any[]) {
        const events = this.events;
        
        if(events.has(eventName)) {
            const callbacks = events.get(eventName)!.map(cb => cb);
            for (const cb of callbacks) {
                cb.apply(this, args);
            }
        } else {
            return false
        }

        return true
    }

    listenerCount(eventName: string) {
        const events = this.events;
        if (events.has(eventName)) return events.get(eventName)?.length || 0;
        return 0;
    }
}