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

    static type = "Room";
    static version = 1;

    #id = ""
    #x = 0;
    #y = 0;
    #z = 0;
    #width = 1;
    #height = 1;
    #depth = 1;

    constructor(options = {}){
        this.fromJSON(options);
    }

    get id(){ return this.#id; }
    set id(value){ this.#id = value; }
    get x(){ return this.#x; }
    set x(value){ this.#x = value; }
    get y(){ return this.#y; }
    set y(value){ this.#y = value; }
    get z(){ return this.#z; }
    set z(value){ this.#z = value; }
    get width(){ return this.#width; }
    set width(value){ this.#width = value; }
    get height(){ return this.#height; }
    set height(value){ this.#height = value; }
    get depth(){ return this.#depth; }
    set depth(value){ this.#depth = value; }

    /** Le point est-il dans le volume de la pièce ? */
    contains(wx, wy, wz){
        return this.x <= wx && wx < this.x + this.width
            && this.y <= wy && wy < this.y + this.height
            && this.z <= wz && wz < this.z + this.depth;
    }

    /**
     * Ce cube fait-il partie du couvercle à masquer ?
     * Tout ce qui est strictement au-dessus du sol (z).
     * inset recule le bord min x/y, en cubes.
     */
    hides(wx, wy, wz, inset = 0){
        return this.x + inset <= wx && wx < this.x + this.width
            && this.y + inset <= wy && wy < this.y + this.height
            && this.z < wz;
    }

    toJSON(json){
        if(json == null || typeof json !== "object" || Array.isArray(json)) json = {};
        json.type = this.constructor.type;
        json.version = this.constructor.version;
        json.id = this.id;
        json.x = this.x;
        json.y = this.y;
        json.z = this.z;
        json.width = this.width;
        json.height = this.height;
        json.depth = this.depth;
        return json;
    }

    fromJSON(json){
        this.id = json.id;
        this.x = json.x;
        this.y = json.y;
        this.z = json.z;
        this.width = json.width;
        this.height = json.height;
        this.depth = json.depth;
        return this;
    }
}
