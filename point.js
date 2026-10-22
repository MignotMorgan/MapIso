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

    /**
     * Écrit dans l'objet json (le fils appelle super.toJSON(json) puis complète).
     * JSON.stringify passe une clé, pas un objet : on part alors d'un {}.
     */
    toJSON(json){
        if(json == null || typeof json !== "object" || Array.isArray(json)) json = {};
        json.x = this.#x;
        json.y = this.#y;
        return json;
    }
    toString(){ return this.#x + ", " + this.#y; }

    /**
     * Lit un Point, un {x, y}, ou rien du tout, dans cette instance.
     * Un héritier appelle super.fromJSON(json) puis complète.
     */
    fromJSON(json){
        if(json instanceof Point) return this.copy(json);
        const v = json ?? {};
        return this.set(v.x ?? 0, v.y ?? 0);
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

    toJSON(json){
        json = super.toJSON(json);
        json.z = this.#z;
        return json;
    }
    toString(){ return this.x + ", " + this.y + ", " + this.#z; }

    fromJSON(json){
        super.fromJSON(json);
        this.#z = json instanceof Location ? json.z : (json ?? {}).z ?? 0;
        return this;
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

    toJSON(json){
        json = super.toJSON(json);
        json.adjustment = this.#adjustment.toJSON();
        return json;
    }
    toString(){ return this.x + ", " + this.y + " (" + this.#adjustment + ")"; }

    fromJSON(json){
        super.fromJSON(json);
        if(json instanceof CasePoint) this.#adjustment.copy(json.adjustment);
        else this.#adjustment.fromJSON((json ?? {}).adjustment);
        return this;
    }
}
