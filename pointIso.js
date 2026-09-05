/**
 * Un point du plan.
 *
 * Le moteur manipule des coordonnées partout : décalage dans une case,
 * position à l'écran, vecteur entre deux cases. Les écrire en objets plutôt
 * qu'en {x, y} anonymes donne un endroit unique où poser les opérations qui
 * vont avec (recopier, comparer, mesurer une distance), au lieu de les
 * réécrire à chaque appel.
 */
export class Point{

    #x = 0;
    #y = 0;

    constructor(x = 0, y = 0){
        this.#x = x ?? 0;
        this.#y = y ?? 0;
    }

    get x(){ return this.#x; }
    set x(value){ this.#x = value ?? 0; }
    get y(){ return this.#y; }
    set y(value){ this.#y = value ?? 0; }

    /** Déplace ce point-ci, au lieu d'en créer un nouveau. */
    set(x, y){
        this.#x = x ?? 0;
        this.#y = y ?? 0;
        return this;
    }
    /** Recopie les coordonnées d'un autre point dans celui-ci. */
    copy(other){ return other == null ? this : this.set(other.x, other.y); }
    clone(){ return new Point(this.#x, this.#y); }
    equals(other){ return other != null && other.x === this.#x && other.y === this.#y; }
    /** Distance à vol d'oiseau. */
    distance(other){ return Math.hypot(other.x - this.#x, other.y - this.#y); }

    toJSON(){ return {x:this.#x, y:this.#y}; }
    toString(){ return this.#x + ", " + this.#y; }

    /**
     * Accepte un Point, un {x, y}, l'ancien JSON {X, Y}, ou rien du tout.
     * Regrouper cette tolérance ici évite de la répandre dans tout le moteur :
     * le jour où l'ancienne notation disparaît, il n'y a qu'une ligne à retirer.
     */
    static from(value){
        if(value instanceof Point) return value;
        const v = value ?? {};
        return new Point(v.x ?? v.X ?? 0, v.y ?? v.Y ?? 0);
    }
}

/**
 * Un emplacement dans le monde voxel : x et y au sol, z en altitude.
 * C'est là que se trouve une entité, et c'est de ça qu'est fait un trajet.
 *
 * Un emplacement est un point avec une altitude en plus, donc il en hérite :
 * tout ce qui sait travailler sur un point du plan sait aussi travailler
 * sur celui-ci.
 */
export class Location extends Point{

    #z = 0;

    constructor(x = 0, y = 0, z = 0){
        super(x, y);
        this.#z = z ?? 0;
    }

    get z(){ return this.#z; }
    set z(value){ this.#z = value ?? 0; }

    set(x, y, z){
        super.set(x, y);
        this.#z = z ?? 0;
        return this;
    }
    copy(other){ return other == null ? this : this.set(other.x, other.y, other.z); }
    clone(){ return new Location(this.x, this.y, this.#z); }
    equals(other){ return super.equals(other) && other.z === this.#z; }
    /** Distance mesurée au sol : l'altitude ne compte pas dans la longueur d'un pas. */
    ground(other){ return Math.hypot(other.x - this.x, other.y - this.y); }

    toJSON(){ return {x:this.x, y:this.y, z:this.#z}; }
    toString(){ return this.x + ", " + this.y + ", " + this.#z; }

    static from(value){
        if(value instanceof Location) return value;
        const v = value ?? {};
        return new Location(v.x ?? v.X ?? 0, v.y ?? v.Y ?? 0, v.z ?? v.Z ?? 0);
    }
}

/**
 * Une position exprimée en cases de la vue : la case entière (x, y), et à
 * l'intérieur d'elle un décalage en pourcentage de sa largeur (adjustment).
 *
 * C'est la réponse à « où la souris pointe-t-elle ? » : la case visée, plus
 * l'endroit précis dans cette case. Sans ce décalage on ne saurait viser
 * qu'au losange près, ce qui suffit pour marcher mais pas pour éditer.
 */
export class CasePoint extends Point{

    #adjustment = new Point();

    constructor(x = 0, y = 0, adjustment = null){
        super(x, y);
        this.#adjustment.copy(adjustment);
    }

    get adjustment(){ return this.#adjustment; }

    set(x, y, adjustment = null){
        super.set(x, y);
        this.#adjustment.copy(adjustment);
        return this;
    }
    copy(other){
        if(other == null) return this;
        super.set(other.x, other.y);
        this.#adjustment.copy(other.adjustment);
        return this;
    }
    clone(){ return new CasePoint(this.x, this.y, this.#adjustment); }
    equals(other){ return super.equals(other) && this.#adjustment.equals(other.adjustment); }

    toJSON(){ return {x:this.x, y:this.y, adjustment:this.#adjustment}; }
    toString(){ return this.x + ", " + this.y + " (" + this.#adjustment + ")"; }

    static from(value){
        if(value instanceof CasePoint) return value;
        const v = value ?? {};
        return new CasePoint(v.x ?? v.X ?? 0, v.y ?? v.Y ?? 0, v.adjustment ?? v.Adjustment);
    }
}

/**
 * Les huit orientations du voisinage d'une case, dans l'ordre qu'attendent les
 * planches de sprites : 0 nord, 1 est, 2 sud, 3 ouest, puis les diagonales
 * 4 nord-ouest, 5 nord-est, 6 sud-est, 7 sud-ouest.
 *
 * 6 sert aussi de « aucune orientation » : c'est la valeur d'un objet posé qui
 * ne se tourne vers rien.
 */
export class Direction{

    static NONE = 6;

    /** Vers où se tourner pour aller d'une case à une autre. */
    static between(x, y, xDest, yDest){
        if(x == xDest && y == yDest) return Direction.NONE;
        if(x == xDest) return y > yDest ? 0 : 2;
        if(y == yDest) return x < xDest ? 1 : 3;
        if(x > xDest) return y > yDest ? 4 : 7;
        return y > yDest ? 5 : 6;
    }
}
