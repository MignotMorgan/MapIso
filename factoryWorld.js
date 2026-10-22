import { Register } from './register.js';


export class FactoryWorld{

    #register = new Register();

    create(json){
        if(json == null || json.type == null) return null;
        const Class = this.#register.get(json.type);
        return new Class(json);
    }
}
