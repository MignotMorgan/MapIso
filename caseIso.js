import { CoreIso } from "./coreIso.js";
import { Point } from "./pointIso.js";
export class CaseIso {
    #x = 0;
    #y = 0;
    #adjustment = new Point();
    #screen = new Point();
    #cubes = [];
    #entitysDraw = [];
    
    constructor(x, y){
        this.#x = x;
        this.#y = y;
    }
    get x(){return this.#x;}
    set x(value){this.#x = value;}
    get y(){return this.#y;}
    set y(value){this.#y = value;}
    get adjustment(){return this.#adjustment;}
    get screen(){return this.#screen;}
    // On recopie dans le point existant : la case garde le sien, personne ne
    // peut lui glisser un objet d'une autre forme à la place.
    set screen(value){this.#screen.copy(value);}
    get cubes(){return this.#cubes;}
    set cubes(value){this.#cubes = value;}
    get entitysDraw(){return this.#entitysDraw;}
    set entitysDraw(value){this.#entitysDraw = value;}
    
    toScreen(){
        const sizeCase = CoreIso.sizeCase;
        this.#screen.x = this.#x * sizeCase;
        this.#screen.y = this.#y * sizeCase;
    }

    toFloors(){
        for(let i = this.#cubes.length-1; i >=  0; i--)
            if(this.#cubes[i].cross)  // Si le cube est traversable (sol)
                return this.#cubes[i];
        return null;  // Aucun sol trouvé
    }
}