import { Point, Location, Direction } from './pointIso.js';

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
}

/**
 * Le carnet de route d'une entité : le trajet qu'elle suit, à quelle allure,
 * et où elle en est.
 *
 * street : les cases traversées, du départ à l'arrivée.
 * speed  : durée d'un pas d'une case, en millisecondes.
 * index  : le pas en cours, 0 étant le premier.
 * step   : millisecondes déjà écoulées dans ce pas-là.
 *
 * Le carnet avance tout seul quand on lui donne le temps écoulé ; l'entité se
 * contente de lire où il en est et d'y poser sa position. Séparer les deux
 * permet de faire suivre le même trajet par autre chose qu'un personnage —
 * une caméra, un projectile — sans rien réécrire.
 */
export class EntityMove{

    #id = 0;
    #street = [];
    #speed = 400;
    #index = 0;
    #step = 0;
    #body = null;
    #adjustment = null;

    constructor(options = {}){
        this.#id = options.id ?? options.ID ?? 0;
        this.street = options.street ?? options.Street ?? [];
        this.#speed = options.speed ?? options.Speed ?? 400;
        this.#index = options.index ?? options.Index ?? 0;
        this.#step = options.step ?? options.Step ?? 0;
        this.#body = options.body ?? options.Body ?? null;
        this.#adjustment = Point.from(options.adjustment ?? options.Adjustment);
    }

    get id(){ return this.#id; }
    set id(value){ this.#id = value ?? 0; }
    get street(){ return this.#street; }
    set street(value){ this.#street = (value ?? []).map(point => Location.from(point)); }
    get speed(){ return this.#speed; }
    set speed(value){ this.#speed = value ?? 0; }
    get index(){ return this.#index; }
    get step(){ return this.#step; }
    get body(){ return this.#body; }
    set body(value){ this.#body = value ?? null; }
    get adjustment(){ return this.#adjustment; }

    /** Y a-t-il un trajet en cours ? Un trajet d'une seule case n'en est pas un. */
    get walking(){ return this.#street.length > 1 && this.#speed > 0; }
    /** La dernière case du trajet, ou null si le carnet est vide. */
    get destination(){
        return this.#street.length === 0 ? null : this.#street[this.#street.length - 1];
    }

    /** Prend un nouveau trajet, depuis le début. Renvoie false s'il n'y a rien à parcourir. */
    start(street){
        this.street = street;
        this.#index = 0;
        this.#step = 0;
        return this.walking;
    }
    /** Range le carnet : plus de trajet en cours. */
    clear(){
        this.#street = [];
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
        if(index < 0 || index >= this.#street.length - 1) return 0;
        return this.#speed * Math.max(1, this.#street[index].ground(this.#street[index + 1]));
    }

    /** Le pas en cours, ou null si le trajet est fini ou inexistant. */
    stride(){
        if(!this.walking) return null;
        if(this.#index >= this.#street.length - 1) return null;
        const duration = this.duration(this.#index);
        return new Stride(this.#street[this.#index],
                          this.#street[this.#index + 1],
                          duration <= 0 ? 0 : this.#step / duration);
    }

    /**
     * Consomme elapsed millisecondes de trajet.
     * Renvoie true quand l'arrivée est atteinte, pour que l'entité sache
     * qu'elle doit se poser et ranger le carnet.
     */
    advance(elapsed){
        if(!this.walking) return true;

        this.#step += elapsed;

        // Une image lente peut franchir plusieurs cases d'un coup.
        let duration = this.duration(this.#index);
        while(duration > 0 && this.#step >= duration){
            this.#step -= duration;
            this.#index++;
            duration = this.duration(this.#index);
        }
        return this.#index >= this.#street.length - 1;
    }

    toJSON(){
        return {
            id: this.#id,
            street: this.#street,
            speed: this.#speed,
            index: this.#index,
            step: this.#step,
            body: this.#body,
            adjustment: this.#adjustment
        };
    }

    /** Carnet vierge : une allure par défaut, et aucun trajet. */
    static empty(){ return new EntityMove(); }

    static from(value){
        if(value == null) return null;
        if(value instanceof EntityMove) return value;
        return new EntityMove(value);
    }
}
