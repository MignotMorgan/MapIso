import { Point, Location } from './point.js';

/**
 * Les huit orientations du voisinage d'une case, dans l'ordre qu'attendent les
 * planches de sprites : 0 nord, 1 est, 2 sud, 3 ouest, puis les diagonales
 * 4 nord-ouest, 5 nord-est, 6 sud-est, 7 sud-ouest.
 *
 * NONE (-1) : aucune orientation, la valeur d'un objet posé qui ne se tourne
 * vers rien. Distinct de SOUTH_EAST (6).
 */
export class Direction{

    static NONE = -1;
    static NORTH = 0;
    static EAST = 1;
    static SOUTH = 2;
    static WEST = 3;
    static NORTH_WEST = 4;
    static NORTH_EAST = 5;
    static SOUTH_EAST = 6;
    static SOUTH_WEST = 7;

    /** Vers où se tourner pour aller d'une case à une autre. */
    static between(wx, wy, wxTo, wyTo){
        if(wx === wxTo && wy === wyTo) return Direction.NONE;
        if(wx === wxTo) return wy > wyTo ? Direction.NORTH : Direction.SOUTH;
        if(wy === wyTo) return wx < wxTo ? Direction.EAST : Direction.WEST;
        if(wx > wxTo) return wy > wyTo ? Direction.NORTH_WEST : Direction.SOUTH_WEST;
        return wy > wyTo ? Direction.NORTH_EAST : Direction.SOUTH_EAST;
    }
}

/**
 * Le pas en cours d'une entité : la case qu'elle quitte, celle où elle va, et
 * l'avancement entre les deux — 0 au moment où elle s'élance, 1 quand elle
 * arrive.
 *
 * C'est le seul objet dont la vue a besoin pour dessiner un personnage en
 * train de marcher : elle demande la position écran des deux cases et laisse
 * le pas placer le sprite entre les deux.
 */
export class Stride{

    #from = null;
    #to = null;
    #ratio = 0;

    constructor(from, to, ratio = 0){
        this.#from = from;
        this.#to = to;
        this.#ratio = ratio;
    }

    get from(){ return this.#from; }
    get to(){ return this.#to; }
    get ratio(){ return this.#ratio; }

    /** Longueur du pas au sol : une diagonale vaut √2, un pas droit vaut 1. */
    get length(){ return this.#from.ground(this.#to); }
    /** Vers où l'entité se tourne pendant ce pas. */
    get direction(){
        return Direction.between(this.#from.x, this.#from.y, this.#to.x, this.#to.y);
    }
    /** Position intermédiaire entre deux points, au prorata de l'avancement. */
    between(from, to){
        return new Point(from.x + (to.x - from.x) * this.#ratio,
                         from.y + (to.y - from.y) * this.#ratio);
    }
    /**
     * Pied dans le monde au prorata du pas.
     * La case logique est déjà l'arrivée ; le peintre accroche le sprite ici.
     */
    at(){
        const from = this.#from;
        const to = this.#to;
        const ratio = this.#ratio;
        return new Location(
            from.x + (to.x - from.x) * ratio,
            from.y + (to.y - from.y) * ratio,
            from.z + (to.z - from.z) * ratio
        );
    }
}

/**
 * Le carnet de route d'une entité : le trajet qu'elle suit, à quelle allure,
 * et où elle en est.
 *
 * path : les cases traversées, du départ à l'arrivée.
 * speed  : durée d'un pas d'une case, en millisecondes.
 * index  : le pas en cours, 0 étant le premier.
 * step   : millisecondes déjà écoulées dans ce pas-là.
 *
 * progress(elapsed, entity) consomme le temps et pose la case, la direction
 * et la fin de trajet sur l'entité. Entity.tick lui délègue tout le déplacement.
 */
export class EntityMove{

    static type = "EntityMove";
    static version = 1;

    #id = 0;
    #path = [];
    #speed = 400;
    #index = 0;
    #step = 0;
    #sprite = null;
    #adjustment = null;

    constructor(options = {}){
        this.fromJSON(options);
    }

    get id(){ return this.#id; }
    set id(value){ this.#id = value ?? 0; }
    get path(){ return this.#path; }
    set path(value){
        this.#path = (value ?? []).map(point =>
            point instanceof Location ? point : new Location().fromJSON(point));
    }
    get speed(){ return this.#speed; }
    set speed(value){ this.#speed = value ?? 0; }
    get index(){ return this.#index; }
    get step(){ return this.#step; }
    get sprite(){ return this.#sprite; }
    set sprite(value){ this.#sprite = value ?? null; }
    get adjustment(){ return this.#adjustment; }

    /** Y a-t-il un trajet en cours ? Un trajet d'une seule case n'en est pas un. */
    get walking(){ return this.#path.length > 1 && this.#speed > 0; }
    /** La dernière case du trajet, ou null si le carnet est vide. */
    get destination(){
        return this.#path.length === 0 ? null : this.#path[this.#path.length - 1];
    }

    /** Prend un nouveau trajet, depuis le début. Renvoie false s'il n'y a rien à parcourir. */
    start(path){
        this.path = path;
        this.#index = 0;
        this.#step = 0;
        return this.walking;
    }
    /** Range le carnet : plus de trajet en cours. */
    clear(){
        this.#path = [];
        this.#index = 0;
        this.#step = 0;
    }

    /**
     * Durée d'un pas, en millisecondes.
     * Elle suit la longueur réelle du pas : une diagonale mesure √2 case, elle
     * prend donc √2 fois plus de temps. Sans cela un personnage accélère
     * visiblement dès qu'il marche en biais.
     */
    duration(index){
        if(index < 0 || index >= this.#path.length - 1) return 0;
        return this.#speed * Math.max(1, this.#path[index].ground(this.#path[index + 1]));
    }

    /** Le pas en cours, ou null si le trajet est fini ou inexistant. */
    stride(){
        if(!this.walking) return null;
        if(this.#index >= this.#path.length - 1) return null;
        const duration = this.duration(this.#index);
        return new Stride(this.#path[this.#index],
                          this.#path[this.#index + 1],
                          duration <= 0 ? 0 : this.#step / duration);
    }

    /**
     * Fait progresser le trajet de elapsed millisecondes.
     * Pose la case logique et la direction sur l'entité (l'entité occupe déjà
     * la case visée ; le sprite rattrape via stride()).
     * Renvoie true si la case logique vient de changer, ou si le trajet finit.
     */
    progress(elapsed, entity){
        if(!this.walking) return false;

        this.#step += elapsed ?? 0;

        // Une image lente peut franchir plusieurs cases d'un coup.
        let duration = this.duration(this.#index);
        while(duration > 0 && this.#step >= duration){
            this.#step -= duration;
            this.#index++;
            duration = this.duration(this.#index);
        }

        if(this.#index >= this.#path.length - 1){
            if(entity != null && this.destination !== null)
                entity.location.copy(this.destination);
            this.clear();
            return true;
        }

        const stride = this.stride();
        if(stride === null){
            if(entity != null && this.destination !== null)
                entity.location.copy(this.destination);
            this.clear();
            return true;
        }
        if(entity == null || entity.location.equals(stride.to)) return false;
        entity.direction = stride.direction;
        entity.location.copy(stride.to);
        return true;
    }

    toJSON(json){
        if(json == null || typeof json !== "object" || Array.isArray(json)) json = {};
        json.type = this.constructor.type;
        json.version = this.constructor.version;
        json.id = this.#id;
        const path = [];
        for(let i = 0; i < this.#path.length; i++)
            path[path.length] = this.#path[i].toJSON();
        json.path = path;
        json.speed = this.#speed;
        json.index = this.#index;
        json.step = this.#step;
        json.sprite = this.#sprite;
        json.adjustment = this.#adjustment === null ? null : this.#adjustment.toJSON();
        return json;
    }

    /** Carnet vierge : une allure par défaut, et aucun trajet. */
    static empty(){ return new EntityMove(); }

    fromJSON(json){
        const v = json ?? {};
        this.#id = v.id ?? 0;
        this.path = v.path ?? [];
        this.#speed = v.speed ?? 400;
        this.#index = v.index ?? 0;
        this.#step = v.step ?? 0;
        this.#sprite = v.sprite ?? null;
        this.#adjustment = v.adjustment == null ? null : new Point().fromJSON(v.adjustment);
        return this;
    }
}
