import { Core } from 'Control/core.js';
import { FactoryWorld } from '../../factoryWorld.js';


export class CoreMapView  extends Core{

    static #version = "1.0.0";
    static #FactoryWorld = null;
    
    static get version(){ return this.#version; }
    static get FactoryWorld(){
        if (this.#FactoryWorld === null){ this.#FactoryWorld = new FactoryWorld(); }
        return this.#FactoryWorld;
    }
    
}