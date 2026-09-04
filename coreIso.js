import { Core } from 'Control/core.js';
import { FactoryElementIso } from './factoryIso.js';


export class CoreIso  extends Core{

    static #version = "1.0.0";
    static #FactoryElementIso = null;
    
    static get version(){ return this.#version; }
    static get FactoryElementIso(){
        if (this.#FactoryElementIso === null){ this.#FactoryElementIso = new FactoryElementIso(); }
        return this.#FactoryElementIso;
    }
    
}