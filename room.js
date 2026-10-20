/**
 * Une pièce du monde : un pavé de cubes aligné sur les axes.
 *
 * (x,y,z) est le coin inclus, (width,height,depth) le nombre de cubes
 * sur x, y et z. L'occupation est un intervalle semi-ouvert :
 * x <= wx < x+width (idem y, z). height est l'étendue au sol (axe y),
 * depth le nombre d'étages.
 *
 * La vue s'en sert pour lever le toit quand un personnage est dedans.
 * hides() ne décide pas la politique : inset (venant de MapView.hideWalls)
 * recule le bord min, 0 laisse les murs, 1 les garde visibles.
 */
export class Room{

    #x = 0;
    #y = 0;
    #z = 0;
    #width = 1;
    #height = 1;
    #depth = 1;

    constructor(x, y, z, width = 1, height = 1, depth = 1){
        this.#x = x ?? 0;
        this.#y = y ?? 0;
        this.#z = z ?? 0;
        this.#width = width ?? 1;
        this.#height = height ?? 1;
        this.#depth = depth ?? 1;
    }

    get x(){ return this.#x; }
    get y(){ return this.#y; }
    get z(){ return this.#z; }
    get width(){ return this.#width; }
    get height(){ return this.#height; }
    get depth(){ return this.#depth; }

    /** Le point est-il dans le volume de la pièce ? */
    contains(wx, wy, wz){
        return this.#x <= wx && wx < this.#x + this.#width
            && this.#y <= wy && wy < this.#y + this.#height
            && this.#z <= wz && wz < this.#z + this.#depth;
    }

    /**
     * Ce cube fait-il partie du couvercle à masquer ?
     * Tout ce qui est strictement au-dessus du sol (z).
     * inset recule le bord min x/y, en cubes.
     */
    hides(wx, wy, wz, inset = 0){
        return this.#x + inset <= wx && wx < this.#x + this.#width
            && this.#y + inset <= wy && wy < this.#y + this.#height
            && this.#z < wz;
    }

    static from(value){
        if(value instanceof Room) return value;
        const v = value ?? {};
        return new Room(
            v.x ?? 0,
            v.y ?? 0,
            v.z ?? 0,
            v.width ?? 1,
            v.height ?? 1,
            v.depth ?? 1
        );
    }

    toJSON(){
        return { x:this.#x, y:this.#y, z:this.#z,
                 width:this.#width, height:this.#height, depth:this.#depth };
    }
}
