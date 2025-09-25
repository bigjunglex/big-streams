import { describe, it, expect } from "vitest";
import EventEmitter from "../EventEmitter.js";

describe('[UNIT]: Emmiter tests based on  OG tests at https://github.com/nodejs/node/', () => {
    it('Base creation + getter dosent throw', () => {
        const f = new EventEmitter();
        const x = f.listenerCount('hello');
        expect(x).toBe(0);
    })

    it('Shallow ONCE test', () => {
        const cb1 = () => {};
        const cb2 = () => {};
        const ee = new EventEmitter();

        ee.once('hello', cb1)
        ee.once('hello', cb2)
        
        expect(ee.listenerCount('hello')).toBe(2);

        ee.emit('hello');

        expect(ee.listenerCount('hello')).toBe(0);
    });

    it('listener count', () => {
        const emitter = new EventEmitter();
        emitter.on('foo', () => {});
        emitter.on('foo', () => {});
        emitter.on('baz', () => {});
        // Allow any type
        // emitter.on(123, () => {}); not implemented in ATM
        const call = new EventEmitter().listenerCount.apply(emitter, ['foo'])

        expect(call).toBe(2);
        expect(emitter.listenerCount('foo')).toBe(2);
        expect(emitter.listenerCount('bar')).toBe(0);
        expect(emitter.listenerCount('baz')).toBe(1);
        expect(emitter.listenerCount('123')).toBe(0);
    })
})