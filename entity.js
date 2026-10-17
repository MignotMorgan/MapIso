import { Point, Location } from './point.js';
import { EntityMove, Direction } from './entityMove.js';

/**
 * Modèle monde d'un personnage / objet.
 * Distinct de EntityDraw (sprite à l'écran) et de Cube (voxel de terrain).
 *
 * Position (x,y,z) : coin supérieur-droit-arrière du volume.
 * Le volume va vers x/y décroissants et z croissant : base width×width, hauteur height.
 *
 * Le constructeur lit le JSON camelCase (id, canMove, bodyStand…).
 */
export class Entity{
    #id = "";
    #location = null;          // position dans le monde voxel
    #width = 1;
    #height = 1;
    #adjustment = new Point(); // offset dans la case, en % de sizeCase (0..100)
    #direction = Direction.NONE;
    #canMove = false;
    #canTarget = false;
    #cross = false;            // d'autres entités peuvent traverser ce volume
    #body = null;              // sprite / animation courante
    #bodyStand = null;         // sprite idle, repris quand l'anim se termine
    #bodyAnimated = false;
    #worldMap = null;          // carte d'appartenance (pathfinding, collisions)
    #entityMove = null;

    constructor(x, y, z, options = {}){
        this.#location = new Location(x, y, z);

        this.#id = options.id ?? "";
        this.#width = options.width ?? 1;
        this.#height = options.height ?? 1;
        this.#adjustment.copy(Point.from(options.adjustment));
        this.#direction = options.direction ?? Direction.NONE;
        this.#canMove = options.canMove ?? false;
        this.#canTarget = options.canTarget ?? false;
        this.#cross = options.cross ?? false;
        this.#body = options.body ?? null;
        this.#bodyStand = options.bodyStand ?? null;
        this.#bodyAnimated = options.bodyAnimated ?? false;
        this.#worldMap = options.worldMap ?? null;
        this.#entityMove = EntityMove.from(options.entityMove);
        // Une entité qui peut marcher a forcément besoin de son carnet de route :
        // sans lui, le calcul de chemin refuse de la faire bouger.
        if(this.#entityMove == null && this.#canMove) this.#entityMove = EntityMove.empty();
    }

    get id(){ return this.#id; }
    set id(value){ this.#id = value ?? ""; }
    /** La position dans le monde. x, y et z en sont les raccourcis de lecture. */
    get location(){ return this.#location; }
    get x(){ return this.#location.x; }
    set x(value){ this.#location.x = value; }
    get y(){ return this.#location.y; }
    set y(value){ this.#location.y = value; }
    get z(){ return this.#location.z; }
    set z(value){ this.#location.z = value; }
    get width(){ return this.#width; }
    set width(value){ this.#width = value ?? 1; }
    get height(){ return this.#height; }
    set height(value){ this.#height = value ?? 1; }
    get adjustment(){ return this.#adjustment; }
    get direction(){ return this.#direction; }
    set direction(value){ this.#direction = value ?? Direction.NONE; }
    get canMove(){ return this.#canMove; }
    set canMove(value){
        this.#canMove = !!value;
        if(this.#canMove && this.#entityMove == null) this.#entityMove = EntityMove.empty();
    }
    get canTarget(){ return this.#canTarget; }
    set canTarget(value){ this.#canTarget = !!value; }
    get cross(){ return this.#cross; }
    set cross(value){ this.#cross = !!value; }
    get body(){ return this.#body; }
    set body(value){ this.#body = value ?? null; }
    get bodyStand(){ return this.#bodyStand; }
    set bodyStand(value){ this.#bodyStand = value ?? null; }
    get bodyAnimated(){ return this.#bodyAnimated; }
    set bodyAnimated(value){ this.#bodyAnimated = !!value; }
    get worldMap(){ return this.#worldMap; }
    set worldMap(value){ this.#worldMap = value ?? null; }
    get entityMove(){ return this.#entityMove; }
    set entityMove(value){ this.#entityMove = EntityMove.from(value); }

    /** L'entité est-elle en train de parcourir un trajet ? */
    get walking(){ return this.#entityMove != null && this.#entityMove.walking; }

    /**
     * Le pas en cours, ou null à l'arrêt.
     * C'est ce que la vue utilise pour placer le sprite entre deux cases.
     */
    stride(){ return this.#entityMove == null ? null : this.#entityMove.stride(); }

    /**
     * Fait avancer l'entité de elapsed millisecondes le long de son trajet.
     * Renvoie true si elle vient de changer de case, ce qui permet à la vue de
     * ne réagir (plafonds, tri) qu'aux vrais changements.
     *
     * La position logique saute sur la case visée dès le début du pas :
     * l'entité occupe la case dans laquelle elle entre, le sprite la rattrape.
     */
    advance(elapsed){
        if(!this.walking) return false;
        if(this.#entityMove.advance(elapsed)){ this.stop(); return true; }

        const stride = this.#entityMove.stride();
        if(stride == null){ this.stop(); return true; }
        if(this.#location.equals(stride.to)) return false;

        this.#direction = stride.direction;
        this.#location.copy(stride.to);
        return true;
    }

    /** Termine le trajet : on se pose sur la dernière case et on range le carnet. */
    stop(){
        if(this.#entityMove == null) return;
        this.#location.copy(this.#entityMove.destination);
        this.#entityMove.clear();
        this.#bodyAnimated = false;
    }

    /** Lance l'entité sur un trajet déjà calculé, depuis le début. */
    walk(street){
        if(this.#entityMove == null || !this.#entityMove.start(street)) return false;
        this.#bodyAnimated = true;
        return true;
    }

    /**
     * Collision point ↔ volume 3D.
     * Utilisé pour savoir si un clic / un cube vise cette entité.
     */
    contains(x, y, z){
        const location = this.#location;
        return (x <= location.x) && (x > location.x - this.#width)
            && (y <= location.y) && (y > location.y - this.#width)
            && (z >= location.z) && (z < location.z + this.#height);
    }

    /**
     * Les champs privés sont invisibles pour JSON.stringify : on les expose ici.
     * worldMap est volontairement omis : c'est la carte qui contient l'entité, pas l'inverse.
     */
    toJSON(){
        return {
            id: this.#id,
            x: this.#location.x,
            y: this.#location.y,
            z: this.#location.z,
            width: this.#width,
            height: this.#height,
            adjustment: this.#adjustment,
            direction: this.#direction,
            canMove: this.#canMove,
            canTarget: this.#canTarget,
            cross: this.#cross,
            body: this.#body,
            bodyStand: this.#bodyStand,
            bodyAnimated: this.#bodyAnimated,
            entityMove: this.#entityMove
        };
    }
}
