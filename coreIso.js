import { Core } from 'Control/core.js';
export class CoreIso  extends Core{
    static #version = "1.0.0";
   
    static get version(){ return this.#version; }
}