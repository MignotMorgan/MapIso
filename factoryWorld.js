import { Register } from './register.js';

export class FactoryWorld{

    static #instance = null;

    static get instance(){
        if (this.#instance === null){ this.#instance = new FactoryWorld(); }
        return this.#instance;
    }

    #register = new Register();

    register(Class){ this.#register.set(Class); }

    create(json){
        if(json == null || json.type == null) return null;
        const Class = this.#register.get(json.type);
        return new Class(json);
    }
}
