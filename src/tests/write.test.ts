import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path, { resolve } from "path";
import fs from 'fs'
import createWriteStream from '../examples/create-write-stream.js'


const filePathFS = path.join(__dirname, 'fs-out.txt');
const filePathHB = path.join(__dirname, 'home-out.txt')

beforeEach(() =>  {
    if (fs.existsSync(filePathFS)) fs.unlinkSync(filePathFS);
    if (fs.existsSync(filePathHB)) fs.unlinkSync(filePathHB);
})

afterEach(() =>  {
    if (fs.existsSync(filePathFS)) fs.unlinkSync(filePathFS);
    if (fs.existsSync(filePathHB)) fs.unlinkSync(filePathHB);
})

describe('Compare createWStream from fs and home', () => {
    it('writing',async () => {
        const writerFs = fs.createWriteStream(filePathFS)
        const writerHb = createWriteStream(filePathHB)
        let targetFS, targetHB;
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        writerFs.write('big chunk of goood data')
        writerHb.write('big chunk of goood data')
        writerFs.end();
        writerHb.end();
        writerFs.on('finish', () => targetFS = fs.readFileSync(filePathFS).toString())
        writerHb.on('finish', () => targetHB = fs.readFileSync(filePathHB).toString())
    
        await new Promise(resolve => setTimeout(resolve, 1000))

        console.log('FS:',  targetFS)
        console.log('HB:', targetHB)
        expect(targetFS).toBe(targetHB)
    })
})