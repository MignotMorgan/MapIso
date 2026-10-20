import { Point } from "./point.js";
export class Case {
    #x = 0;
    #y = 0;
    #adjustment = new Point();
    #screen = new Point();
    #cubes = [];
    #entityDraws = [];

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
    get entityDraws(){return this.#entityDraws;}
    set entityDraws(value){this.#entityDraws = value;}

    /** Premier cube traversable en partant du haut de la colonne : le sol cliquable. */
    floor(){
        for(let i = this.#cubes.length-1; i >=  0; i--)
            if(this.#cubes[i].walkable)
                return this.#cubes[i];
        return null;
    }
}
